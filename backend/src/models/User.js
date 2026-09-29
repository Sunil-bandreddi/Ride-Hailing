import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: String,
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["rider", "driver", "admin"], required: true },
    rating: { type: Number, default: 5, min: 0, max: 5 }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
