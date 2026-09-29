import { Server } from "socket.io";
import { verifyAuthToken } from "../utils/jwt.js";
import { Ride } from "../models/Ride.js";
import { Driver } from "../models/Driver.js";
import { RideState } from "../constants/rideState.js";
import { haversineDistanceKm } from "../utils/geo.js";

let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: { origin: true, credentials: true },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token provided"));
      socket.user = verifyAuthToken(token);
      next();
    } catch (err) {
      next(new Error("Unauthorized: " + err.message));
    }
  });

  io.on("connection", async (socket) => {
    const uid = String(socket.user.sub);
    const role = socket.user.role;

    // Each user joins their own private room
    socket.join(`user:${uid}`);
    console.log(`[socket] ${role} ${uid} connected (socket=${socket.id})`);

    // Reconnect to any active ride
    try {
      const activeRide = await Ride.findOne({
        $or: [{ riderId: uid }, { driverId: uid }],
        status: { $in: [RideState.SEARCHING, RideState.ACCEPTED, RideState.ARRIVING, RideState.ONGOING] }
      }).sort({ createdAt: -1 });

      if (activeRide) {
        socket.emit("ride_reconnected", activeRide.toObject());
        console.log(`[socket] Reconnected ${role} ${uid} to active ride ${activeRide._id}`);
      }
    } catch (err) {
      console.error("[socket] reconnect error:", err.message);
    }

    // Driver: live location updates
    socket.on("location_update", async ({ coordinates }) => {
      if (role !== "driver") return;
      if (!coordinates || coordinates.length !== 2) return;

      try {
        await Driver.findOneAndUpdate(
          { userId: uid },
          { currentLocation: { type: "Point", coordinates } },
          { new: true }
        );

        // Find active ride for this driver
        const active = await Ride.findOne({
          driverId: uid,
          status: { $in: [RideState.ACCEPTED, RideState.ARRIVING, RideState.ONGOING] }
        });

        if (!active) return;

        // Auto-transition ACCEPTED → ARRIVING when within 200m of pickup
        const meters = haversineDistanceKm(coordinates, active.pickupLocation.coordinates) * 1000;
        if (active.status === RideState.ACCEPTED && meters <= 200) {
          active.status = RideState.ARRIVING;
          await active.save();
          console.log(`[socket] Ride ${active._id} auto-transitioned to ARRIVING`);
        }

        const riderId = String(active.riderId);
        io.to(`user:${riderId}`).emit("driver_location", {
          rideId: String(active._id),
          coordinates
        });
        io.to(`user:${riderId}`).emit("ride_status_update", active.toObject());
      } catch (err) {
        console.error("[socket] location_update error:", err.message);
      }
    });

    // Chat messages
    socket.on("chat_message", async ({ text }) => {
      if (!text || !text.trim()) return;
      try {
        const active = await Ride.findOne({
          $or: [{ riderId: uid }, { driverId: uid }],
          status: { $in: [RideState.ACCEPTED, RideState.ARRIVING, RideState.ONGOING] }
        });
        if (!active) return;

        const targetId = role === "rider" ? active.driverId : active.riderId;
        if (!targetId) return;

        const messagePayload = {
          sender: role,
          text: text.trim(),
          timestamp: new Date().toISOString()
        };

        io.to(`user:${targetId}`).emit("chat_message", messagePayload);
      } catch (err) {
        console.error("[socket] chat_message error:", err.message);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[socket] ${role} ${uid} disconnected (${reason})`);
    });

    socket.on("error", (err) => {
      console.error(`[socket] error for ${uid}:`, err.message);
    });
  });
}

export function getIo() {
  return io;
}

export function emitToUser(userId, event, payload) {
  const room = `user:${userId}`;
  const count = io?.to(room).emit(event, payload);
  console.log(`[emit] ${event} → room ${room}`);
  return count;
}
