import express from "express";
import { getStats, getActiveRides, getDrivers, updateDriverStatus } from "../controllers/adminController.js";

const router = express.Router();

router.get("/stats", getStats);
router.get("/rides/active", getActiveRides);
router.get("/drivers", getDrivers);
router.patch("/drivers/:driverId/status", updateDriverStatus);

export default router;
