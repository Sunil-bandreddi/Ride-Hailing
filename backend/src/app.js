import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import authRoutes from "./routes/authRoutes.js";
import rideRoutes from "./routes/rideRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { requireAuth, requireAdmin } from "./middleware/auth.js";

export function createApp() {

  const app = express();
  const allowedExactOrigins = new Set([env.clientUrl]);
  const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;
  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser clients (curl/postman) with no Origin header.
        if (!origin) return callback(null, true);
        if (allowedExactOrigins.has(origin) || localhostPattern.test(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin ${origin}`));
      },
      credentials: true
    })
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
  app.get("/health", (req, res) => res.json({ ok: true }));
  app.use("/auth", authRoutes);
  app.use("/rides", rideRoutes);
  app.use("/drivers", driverRoutes);
  app.use("/admin", requireAuth, requireAdmin, adminRoutes);
  return app;
}
