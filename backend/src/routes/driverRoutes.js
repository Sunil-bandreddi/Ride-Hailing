import { Router } from "express";
import { nearbyDrivers, setAvailability, updateLocation } from "../controllers/driverController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
const router = Router();
router.patch("/location", requireAuth, requireRole("driver"), updateLocation);
router.patch("/availability", requireAuth, requireRole("driver"), setAvailability);
router.get("/nearby", requireAuth, nearbyDrivers);
export default router;
