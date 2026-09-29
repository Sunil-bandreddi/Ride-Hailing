import { api } from "./client";

export const getAdminStats = async () => {
  const { data } = await api.get("/admin/stats");
  return data;
};

export const getAdminActiveRides = async () => {
  const { data } = await api.get("/admin/rides/active");
  return data;
};

export const getAdminDrivers = async () => {
  const { data } = await api.get("/admin/drivers");
  return data;
};

export const updateAdminDriverStatus = async (driverId, payload) => {
  const { data } = await api.patch(`/admin/drivers/${driverId}/status`, payload);
  return data;
};
