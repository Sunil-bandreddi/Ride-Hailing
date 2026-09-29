import { User } from "../models/User.js";
import { Driver } from "../models/Driver.js";
import { Ride } from "../models/Ride.js";
import { RideState } from "../constants/rideState.js";

const ACTIVE_RIDE_STATUSES = [
  RideState.SEARCHING,
  RideState.ACCEPTED,
  RideState.ARRIVING,
  RideState.ONGOING
];

export async function getStats(req, res) {
  try {
    const [totalDrivers, totalRiders, activeRides] = await Promise.all([
      User.countDocuments({ role: "driver" }),
      User.countDocuments({ role: "rider" }),
      Ride.countDocuments({ status: { $in: ACTIVE_RIDE_STATUSES } })
    ]);

    return res.status(200).json({ totalDrivers, totalRiders, activeRides });
  } catch (err) {
    console.error("[admin:getStats] error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getActiveRides(req, res) {
  try {
    const rides = await Ride.find({ status: { $in: ACTIVE_RIDE_STATUSES } })
      .populate("riderId", "name phone")
      .populate("driverId", "name phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({ rides });
  } catch (err) {
    console.error("[admin:getActiveRides] error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getDrivers(req, res) {
  try {
    const drivers = await Driver.find().populate("userId", "name phone email").lean();
    
    // For each driver, find if they have an active ride
    const driversWithRides = await Promise.all(
      drivers.map(async (driver) => {
        if (!driver.userId) return driver; // In case of dangling reference
        const activeRide = await Ride.findOne({
          driverId: driver.userId._id,
          status: { $in: ACTIVE_RIDE_STATUSES }
        }).select("_id status").lean();

        return {
          ...driver,
          activeRide: activeRide ? activeRide : null
        };
      })
    );

    return res.status(200).json({ drivers: driversWithRides });
  } catch (err) {
    console.error("[admin:getDrivers] error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateDriverStatus(req, res) {
  try {
    const { driverId } = req.params;
    const { isOnline, clearStuckRide } = req.body;

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    if (typeof isOnline === "boolean") {
      driver.isOnline = isOnline;
      await driver.save();
    }

    if (clearStuckRide) {
      // Find active rides and cancel them
      await Ride.updateMany(
        { driverId: driver.userId, status: { $in: ACTIVE_RIDE_STATUSES } },
        { $set: { status: RideState.CANCELLED, cancelledAt: new Date() } }
      );
    }

    return res.status(200).json({ message: "Driver status updated successfully" });
  } catch (err) {
    console.error("[admin:updateDriverStatus] error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
