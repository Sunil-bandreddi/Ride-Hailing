import { configureStore } from "@reduxjs/toolkit";
import user from "./slices/userSlice";
import activeRide from "./slices/activeRideSlice";

export const store = configureStore({
  reducer: { user, activeRide }
});
