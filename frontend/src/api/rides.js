import { api } from "./client";

export async function estimateFare(payload) {
  const { data } = await api.post("/rides/estimate", payload);
  return data;
}

export async function requestRide(payload) {
  const { data } = await api.post("/rides/request", payload);
  return data;
}

export async function updateRideStatus(rideId, payload) {
  const { data } = await api.patch(`/rides/${rideId}/status`, payload);
  return data;
}

export async function rideHistory() {
  const { data } = await api.get("/rides/history");
  return data;
}

export async function rateRide(rideId, rating) {
  const { data } = await api.post(`/rides/${rideId}/rate`, { rating });
  return data;
}
