import { Driver } from "../models/Driver.js";

export async function updateLocation(req, res) {
  const { coordinates } = req.body;
  const driver = await Driver.findOneAndUpdate(
    { userId: req.user.sub },
    { currentLocation: { type: "Point", coordinates } },
    { new: true }
  );
  if (!driver) return res.status(404).json({ message: "Driver not found" });
  return res.json({ driver });
}

export async function setAvailability(req, res) {
  const driver = await Driver.findOneAndUpdate(
    { userId: req.user.sub },
    { isOnline: req.body.isOnline },
    { new: true }
  );
  if (!driver) return res.status(404).json({ message: "Driver not found" });
  return res.json({ driver });
}

export async function nearbyDrivers(req, res) {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusMeters = Number(req.query.radius || 5000);
  const limit = Number(req.query.limit || 20);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ message: "lat and lng query params are required" });
  }

  const drivers = await Driver.find({
    isOnline: true,
    currentLocation: {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: radiusMeters
      }
    }
  })
    .limit(limit)
    .populate("userId", "name rating");

  return res.json({
    drivers: drivers.map((d) => ({
      id: d._id,
      userId: d.userId?._id,
      name: d.userId?.name || "Driver",
      rating: d.userId?.rating || 5,
      isOnline: d.isOnline,
      location: d.currentLocation?.coordinates || [0, 0],
      vehicleDetails: d.vehicleDetails
    }))
  });
}
