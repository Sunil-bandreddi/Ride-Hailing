import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },
    vehicleDetails: {
      make: String,
      model: String,
      plateNumber: String
    },
    licenseNumber: { type: String, required: true },
    isOnline: { type: Boolean, default: false },
    currentLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }
    }
  },
  { timestamps: true }
);

driverSchema.index({ currentLocation: "2dsphere" });

export const Driver = mongoose.model("Driver", driverSchema);
