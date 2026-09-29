import { createSlice } from "@reduxjs/toolkit";

const saved = JSON.parse(localStorage.getItem("rh_user") || "null");

const slice = createSlice({
  name: "user",
  initialState: { profile: saved?.profile || null, token: saved?.token || null },
  reducers: {
    setUser(state, action) {
      state.profile = action.payload.profile;
      state.token = action.payload.token;
      localStorage.setItem("rh_user", JSON.stringify(action.payload));
    },
    clearUser(state) {
      state.profile = null;
      state.token = null;
      localStorage.removeItem("rh_user");
    }
  }
});

export const { setUser, clearUser } = slice.actions;
export default slice.reducer;
