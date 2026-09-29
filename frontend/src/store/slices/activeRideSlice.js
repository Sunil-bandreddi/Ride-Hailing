import { createSlice } from "@reduxjs/toolkit";

const slice = createSlice({
  name: "activeRide",
  initialState: {
    ride: null,
    driverLocation: null,
    pendingRequests: [],
    showRatingModal: false,
    ratedRideId: null,
    messages: []
  },
  reducers: {
    setRide(state, action) {
      const incoming = action.payload;
      if (!incoming) { state.ride = null; return; }

      const currentId  = state.ride?._id;
      const incomingId = incoming._id;

      // Only update if: no current ride, same ride, or incoming is newer/active
      // Prevent stale CANCELLED/COMPLETED from overwriting a newer active ride
      if (currentId && currentId !== incomingId) {
        const activeStatuses = ["SEARCHING", "ACCEPTED", "ARRIVING", "ONGOING"];
        const currentIsActive = activeStatuses.includes(state.ride?.status);
        const incomingIsActive = activeStatuses.includes(incoming.status);
        // Ignore stale update for an old ride if we already have a newer active one
        if (currentIsActive && !incomingIsActive) return;
      }

      state.ride = incoming;

      // Show rating modal when ride completes (only once)
      if (incoming.status === "COMPLETED" && state.ratedRideId !== incomingId) {
        state.showRatingModal = true;
      }
    },
    clearRide(state) {
      state.ride = null;
      state.driverLocation = null;
      state.showRatingModal = false;
    },
    setDriverLocation(state, action) {
      state.driverLocation = action.payload;
    },
    addPendingRequest(state, action) {
      state.pendingRequests = [
        action.payload,
        ...state.pendingRequests.filter((r) => r.rideId !== action.payload.rideId)
      ];
    },
    removePendingRequest(state, action) {
      state.pendingRequests = state.pendingRequests.filter((r) => r.rideId !== action.payload);
    },
    dismissRatingModal(state, action) {
      state.showRatingModal = false;
      state.ratedRideId = action.payload || null;
    },
    clearRideState(state) {
      state.ride = null;
      state.driverLocation = null;
      state.pendingRequests = [];
      state.showRatingModal = false;
      state.ratedRideId = null;
      state.messages = [];
    },
    addMessage(state, action) {
      state.messages.push(action.payload);
    },
    clearMessages(state) {
      state.messages = [];
    }
  }
});

export const {
  setRide, clearRide,
  setDriverLocation,
  addPendingRequest, removePendingRequest,
  dismissRatingModal,
  clearRideState,
  addMessage, clearMessages
} = slice.actions;
export default slice.reducer;
