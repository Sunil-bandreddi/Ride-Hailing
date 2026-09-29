import mongoose from "mongoose";
import { RideState } from "../constants/rideState.js";

const pointSchema = {
  type: { type: String, enum: ["Point"], default: "Point" },
  coordinates: { type: [Number], required: true }
};

const rideSchema = new mongoose.Schema(
  {
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    pickupLocation: pointSchema,
    dropLocation: pointSchema,
    pickupAddress: { type: String, default: "" },
    dropAddress: { type: String, default: "" },
    estimatedDistanceKm: Number,
    estimatedTimeMin: Number,
    fare: Number,
    status: { type: String, enum: Object.values(RideState), default: RideState.SEARCHING },
    requestToken: { type: String, required: true, index: true },
    driverRating: { type: Number, min: 1, max: 5, default: null },
    acceptedAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date
  },
  { timestamps: true }
);

export const Ride = mongoose.model("Ride", rideSchema);
