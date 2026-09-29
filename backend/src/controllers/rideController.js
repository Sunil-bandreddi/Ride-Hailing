import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { Ride } from "../models/Ride.js";
import { Driver } from "../models/Driver.js";
import { User } from "../models/User.js";
import { haversineDistanceKm } from "../utils/geo.js";
import { ALLOWED_TRANSITIONS, RideState } from "../constants/rideState.js";
import { emitToUser, getIo } from "../socket/index.js";

function estimate(pickupCoordinates, dropCoordinates) {
  const distance = haversineDistanceKm(pickupCoordinates, dropCoordinates);
  const timeMin = (distance / 25) * 60;
  return {
    estimatedDistanceKm: Number(distance.toFixed(2)),
    estimatedTimeMin: Number(timeMin.toFixed(2)),
    fare: Number((50 + distance * 14 + timeMin * 2.5).toFixed(2))
  };
}

export async function estimateFare(req, res) {
  try {
    const { pickupCoordinates, dropCoordinates } = req.body;
    if (!pickupCoordinates || !dropCoordinates) {
      return res.status(400).json({ message: "pickupCoordinates and dropCoordinates are required" });
    }
    return res.json(estimate(pickupCoordinates, dropCoordinates));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export async function requestRide(req, res) {
  try {
    const { pickupCoordinates, dropCoordinates, pickupAddress, dropAddress } = req.body;
    if (req.user.role !== "rider") {
      return res.status(403).json({ message: "Only riders can request rides" });
    }
    if (!pickupCoordinates || !dropCoordinates) {
      return res.status(400).json({ message: "pickupCoordinates and dropCoordinates are required" });
    }

    const existingActiveRide = await Ride.findOne({
      riderId: req.user.sub,
      status: { $in: [RideState.SEARCHING, RideState.ACCEPTED, RideState.ARRIVING, RideState.ONGOING] }
    });
    if (existingActiveRide) {
      return res.status(409).json({ message: "You already have an active ride", ride: existingActiveRide });
    }

    const requestToken = uuidv4();
    const fareData = estimate(pickupCoordinates, dropCoordinates);
    const ride = await Ride.create({
      riderId: req.user.sub,
      pickupLocation: { type: "Point", coordinates: pickupCoordinates },
      dropLocation: { type: "Point", coordinates: dropCoordinates },
      pickupAddress: pickupAddress || "",
      dropAddress: dropAddress || "",
      requestToken,
      ...fareData
    });

    // Find nearby online drivers within 5km
    const drivers = await Driver.find({
      isOnline: true,
      currentLocation: {
        $near: {
          $geometry: { type: "Point", coordinates: pickupCoordinates },
          $maxDistance: 5000
        }
      }
    }).limit(5);

    console.log(`[ride:request] Found ${drivers.length} nearby online drivers for ride ${ride._id}`);

    const requestPayload = {
      rideId: String(ride._id),
      requestToken,
      ...fareData,
      pickupCoordinates,
      dropCoordinates,
      pickupAddress: pickupAddress || "",
      dropAddress: dropAddress || ""
    };

    for (const d of drivers) {
      const driverUserId = String(d.userId);
      console.log(`[ride:request] Emitting ride_request to driver userId=${driverUserId}`);
      emitToUser(driverUserId, "ride_request", requestPayload);
    }

    // Auto-cancel after 2 mins if no driver accepts
    setTimeout(async () => {
      try {
        const freshRide = await Ride.findById(ride._id);
        if (freshRide && freshRide.status === RideState.SEARCHING) {
          freshRide.status = RideState.CANCELLED;
          freshRide.cancelledAt = new Date();
          await freshRide.save();
          emitToUser(String(ride.riderId), "ride_status_update", freshRide.toObject());
          emitToUser(String(ride.riderId), "ride_timeout", { rideId: String(freshRide._id) });
          console.log(`[ride:timeout] Ride ${ride._id} auto-cancelled — no driver accepted`);
        }
      } catch (e) {
        console.error("[ride:timeout] error:", e.message);
      }
    }, 120000);

    return res.status(201).json({ ride });
  } catch (err) {
    console.error("[ride:request] error:", err);
    return res.status(500).json({ message: err.message });
  }
}

export async function updateRideStatus(req, res) {
  try {
    const { id } = req.params;
    const { nextStatus, requestToken } = req.body;

    if (!nextStatus) {
      return res.status(400).json({ message: "nextStatus is required" });
    }

    if (nextStatus === RideState.ACCEPTED) {
      return acceptRide(id, requestToken, req.user.sub, res);
    }

    const ride = await Ride.findById(id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    // Authorization check using String() on both sides to avoid ObjectId vs string mismatch
    if (req.user.role === "rider" && String(ride.riderId) !== String(req.user.sub)) {
      return res.status(403).json({ message: "Rider cannot modify this ride" });
    }
    if (req.user.role === "driver" && String(ride.driverId) !== String(req.user.sub)) {
      return res.status(403).json({ message: "Driver cannot modify this ride" });
    }

    const allowedNext = ALLOWED_TRANSITIONS[ride.status] || [];
    if (!allowedNext.includes(nextStatus)) {
      // Make cancelling idempotent to prevent errors if clicked multiple times or network retries
      if (nextStatus === RideState.CANCELLED && ride.status === RideState.CANCELLED) {
        return res.json({ ride });
      }
      return res.status(400).json({
        message: `Cannot transition from ${ride.status} to ${nextStatus}. Allowed: [${allowedNext.join(", ")}]`
      });
    }
    if (nextStatus === RideState.CANCELLED && ride.status === RideState.ONGOING) {
      return res.status(400).json({ message: "Ongoing ride cannot be cancelled" });
    }

    ride.status = nextStatus;
    if (nextStatus === RideState.ONGOING) ride.startedAt = new Date();
    if (nextStatus === RideState.COMPLETED) ride.completedAt = new Date();
    if (nextStatus === RideState.CANCELLED) ride.cancelledAt = new Date();
    await ride.save();

    const rideObj = ride.toObject();
    emitToUser(String(ride.riderId), "ride_status_update", rideObj);
    if (ride.driverId) emitToUser(String(ride.driverId), "ride_status_update", rideObj);

    console.log(`[ride:status] ${ride._id} → ${nextStatus}`);
    return res.json({ ride });
  } catch (err) {
    console.error("[ride:updateStatus] error:", err);
    return res.status(500).json({ message: err.message });
  }
}

async function acceptRide(rideId, requestToken, driverUserId, res) {
  try {
    const driverProfile = await Driver.findOne({ userId: driverUserId });
    if (!driverProfile) {
      return res.status(400).json({ message: "Driver profile not found" });
    }
    if (!driverProfile.isOnline) {
      return res.status(400).json({ message: "Driver must be online to accept rides" });
    }

    // Atomic update: only succeeds if ride is still SEARCHING (race-condition safe)
    const ride = await Ride.findOneAndUpdate(
      { _id: rideId, requestToken, status: RideState.SEARCHING },
      { $set: { driverId: driverUserId, status: RideState.ACCEPTED, acceptedAt: new Date() } },
      { new: true }
    );

    if (!ride) {
      return res.status(409).json({ message: "Ride no longer available — another driver may have accepted it" });
    }

    const rideObj = ride.toObject();
    emitToUser(String(ride.riderId), "ride_accepted", rideObj);
    // Broadcast to all connected clients so pending request cards clear
    getIo().emit("request_expired", { rideId: String(ride._id) });
    console.log(`[ride:accept] Ride ${ride._id} accepted by driver ${driverUserId}`);
    return res.json({ ride });
  } catch (err) {
    console.error("[ride:accept] error:", err);
    return res.status(500).json({ message: err.message });
  }
}

export async function getRideHistory(req, res) {
  try {
    const rides = await Ride.find({
      $or: [{ riderId: req.user.sub }, { driverId: req.user.sub }]
    })
      .sort({ createdAt: -1 })
      .limit(50);
    return res.json({ rides });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export async function rateRide(req, res) {
  try {
    const { id } = req.params;
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const ride = await Ride.findById(id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (ride.status !== RideState.COMPLETED) {
      return res.status(400).json({ message: "Can only rate completed rides" });
    }
    if (String(ride.riderId) !== String(req.user.sub)) {
      return res.status(403).json({ message: "Only the rider can rate this ride" });
    }
    if (ride.driverRating !== null && ride.driverRating !== undefined) {
      return res.status(409).json({ message: "Ride already rated" });
    }

    ride.driverRating = rating;
    await ride.save();

    // Recompute driver's average rating
    const allRated = await Ride.find({ driverId: ride.driverId, driverRating: { $ne: null } });
    const avg = allRated.reduce((s, r) => s + r.driverRating, 0) / allRated.length;
    await User.findByIdAndUpdate(ride.driverId, { rating: Number(avg.toFixed(2)) });

    return res.json({ ride, newAvgRating: Number(avg.toFixed(2)) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
