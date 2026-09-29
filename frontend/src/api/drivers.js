import { api } from "./client";

export async function setAvailability(isOnline) {
  const { data } = await api.patch("/drivers/availability", { isOnline });
  return data;
}

export async function updateLocation(coordinates) {
  const { data } = await api.patch("/drivers/location", { coordinates });
  return data;
}

export async function getNearbyDrivers({ lat, lng, radius = 5000, limit = 20 }) {
  const { data } = await api.get("/drivers/nearby", {
    params: { lat, lng, radius, limit }
  });
  return data;
}
