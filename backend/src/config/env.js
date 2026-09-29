import dotenv from "dotenv";
dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ride_hailing",
  jwtSecret: process.env.JWT_SECRET || "change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173"
};
