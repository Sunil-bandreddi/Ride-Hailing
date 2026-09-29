import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { Driver } from "../models/Driver.js";
import { signAuthToken } from "../utils/jwt.js";

export async function register(req, res) {
  try {
    const { name, email, phone, password, role, vehicleDetails, licenseNumber } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "name, email, password and role are required" });
    }
    if (!["rider", "driver"].includes(role)) {
      return res.status(400).json({ message: "role must be rider or driver" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "password must be at least 6 characters" });
    }
    if (await User.findOne({ email })) {
      return res.status(409).json({ message: "Email already exists. Please login instead." });
    }

    if (role === "driver") {
      if (!licenseNumber) {
        return res.status(400).json({ message: "licenseNumber is required for driver registration" });
      }
      if (!vehicleDetails?.make || !vehicleDetails?.model || !vehicleDetails?.plateNumber) {
        return res.status(400).json({ message: "vehicle make, model and plateNumber are required for driver registration" });
      }
    }

    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, phone, password: hash, role });
    if (role === "driver") {
      await Driver.create({ userId: user._id, vehicleDetails, licenseNumber });
    }

    const token = signAuthToken({ sub: String(user._id), role: user.role });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
    // Always return id, name, role, rating so the frontend has everything it needs
    return res.status(201).json({
      user: { id: String(user._id), name: user.name, role: user.role, rating: user.rating },
      token
    });
  } catch (error) {
    console.error("register error:", error);
    return res.status(500).json({ message: "Registration failed. Please try again." });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = signAuthToken({ sub: String(user._id), role: user.role });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
    return res.json({
      user: { id: String(user._id), name: user.name, role: user.role, rating: user.rating },
      token
    });
  } catch {
    return res.status(500).json({ message: "Login failed. Please try again." });
  }
}

export function logout(req, res) {
  res.clearCookie("token");
  return res.status(204).send();
}

export async function me(req, res) {
  const user = await User.findById(req.user.sub).select("-password");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  // Return consistent shape including role
  return res.json({
    user: { id: String(user._id), name: user.name, role: user.role, rating: user.rating }
  });
}
