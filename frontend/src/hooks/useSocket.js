import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useDispatch, useSelector } from "react-redux";
import {
  addPendingRequest,
  removePendingRequest,
  setDriverLocation,
  setRide,
  addMessage
} from "../store/slices/activeRideSlice";

let globalSocket = null;
let connectionCount = 0;
let listenersAttached = false;

export function useSocket() {
  const dispatch = useDispatch();
  const token = useSelector((s) => s.user.token);
  const [socket, setSocket] = useState(globalSocket);

  useEffect(() => {
    if (!token) return;

    if (!globalSocket) {
      globalSocket = io(import.meta.env.VITE_API_URL || "http://localhost:5000", {
        auth: { token }
      });
    }

    setSocket(globalSocket);
    connectionCount++;

    if (!listenersAttached) {
      globalSocket.on("ride_status_update", (ride) => dispatch(setRide(ride)));
      globalSocket.on("ride_accepted", (ride) => dispatch(setRide(ride)));
      globalSocket.on("ride_reconnected", (ride) => dispatch(setRide(ride)));
      globalSocket.on("ride_request", (payload) => dispatch(addPendingRequest(payload)));
      globalSocket.on("request_expired", ({ rideId }) => dispatch(removePendingRequest(rideId)));
      globalSocket.on("driver_location", ({ coordinates }) => dispatch(setDriverLocation(coordinates)));
      globalSocket.on("ride_timeout", () => {
        // ride_status_update will handle the cancelled state via setRide
      });
      globalSocket.on("chat_message", (message) => dispatch(addMessage(message)));
      listenersAttached = true;
    }

    return () => {
      connectionCount--;
      if (connectionCount === 0 && globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
        listenersAttached = false;
      }
    };
  }, [dispatch, token]);

  return socket;
}
