import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ShellLayout } from "../components/ShellLayout";
import { setAvailability, updateLocation } from "../api/drivers";
import { setRide } from "../store/slices/activeRideSlice";
import { rideHistory, updateRideStatus } from "../api/rides";
import { useSocket } from "../hooks/useSocket";
import { ChatBox } from "../components/ChatBox";
import { DirectionsRenderer, GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

const mapLibraries = ["places"];

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1a1c23" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1c23" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#252830" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3d48" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1117" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] }
];

function useGPS() {
  const [coords, setCoords]   = useState(null);   // { lat, lng }
  const [gpsError, setGpsError] = useState(null);
  const [gpsReady, setGpsReady] = useState(false);
  const watchId = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation not supported by this browser.");
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsReady(true);
        setGpsError(null);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGpsError("Location access denied. Please allow location in browser settings.");
            break;
          case err.POSITION_UNAVAILABLE:
            setGpsError("Location unavailable. Check GPS signal.");
            break;
          default:
            setGpsError("Could not get location: " + err.message);
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  const requestOnce = useCallback(() => {
    return new Promise((resolve, reject) => {
      navigator.geolocation?.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);

  return { coords, gpsError, gpsReady, requestOnce };
}

function useReverseGeocode(coords, mapsLoaded) {
  const [address, setAddress] = useState("");
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!mapsLoaded || !coords || !window.google) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      new window.google.maps.Geocoder().geocode(
        { location: { lat: coords.lat, lng: coords.lng } },
        (results, status) => {
          if (status === "OK" && results[0]) setAddress(results[0].formatted_address);
        }
      );
    }, 1500);
    return () => clearTimeout(debounceRef.current);
  }, [coords, mapsLoaded]);

  return address;
}

function computeEarnings(rides) {
  const completed = rides.filter((r) => r.status === "COMPLETED");
  const total     = completed.reduce((s, r) => s + (r.fare || 0), 0);
  const today     = new Date().toDateString();
  const todayAmt  = completed
    .filter((r) => new Date(r.completedAt || r.createdAt).toDateString() === today)
    .reduce((s, r) => s + (r.fare || 0), 0);
  return { total, today: todayAmt, trips: completed.length };
}

function statusClass(s) {
  return "chip status-" + (s || "").toLowerCase();
}

export function DriverDashboard() {
  const dispatch        = useDispatch();
  const socket          = useSocket();
  const ride            = useSelector((s) => s.activeRide.ride);
  const pendingRequests = useSelector((s) => s.activeRide.pendingRequests);

  const [isOnline,   setIsOnline]   = useState(false);
  const [history,    setHistory]    = useState([]);
  const [directions, setDirections] = useState(null);

  // Loading states
  const [togglingOnline,  setTogglingOnline]  = useState(false);
  const [acceptingRideId, setAcceptingRideId] = useState(null);
  const [updatingStatus,  setUpdatingStatus]  = useState(false);
  const [pushingLocation, setPushingLocation] = useState(false);
  const [statusError,     setStatusError]     = useState("");

  const { coords, gpsError, gpsReady, requestOnce } = useGPS();

  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: mapLibraries
  });

  const driverAddress = useReverseGeocode(coords, mapsLoaded);
  const earnings      = computeEarnings(history);

  // ── Load history ──────────────────────────────
  async function loadHistory() {
    try {
      const data = await rideHistory();
      setHistory(data.rides);
    } catch {}
  }

  useEffect(() => { loadHistory(); }, []);

  // ── Broadcast GPS via socket every 6s when online ─
  useEffect(() => {
    if (!socket || !isOnline || !coords) return;
    const timer = setInterval(() => {
      socket.emit("location_update", { coordinates: [coords.lng, coords.lat] });
      updateLocation([coords.lng, coords.lat]).catch(() => {});
    }, 6000);
    return () => clearInterval(timer);
  }, [socket, isOnline, coords]);

  // ── Navigation directions to pickup or drop ───
  useEffect(() => {
    if (!mapsLoaded || !coords || !ride?.pickupLocation || !ride?.dropLocation) {
      setDirections(null);
      return;
    }
    const svc    = new window.google.maps.DirectionsService();
    const pickup = { lat: ride.pickupLocation.coordinates[1], lng: ride.pickupLocation.coordinates[0] };
    const drop   = { lat: ride.dropLocation.coordinates[1],   lng: ride.dropLocation.coordinates[0] };
    const dest   = ["ONGOING", "COMPLETED"].includes(ride.status) ? drop : pickup;
    svc.route(
      { origin: { lat: coords.lat, lng: coords.lng }, destination: dest, travelMode: "DRIVING" },
      (result, status) => { if (status === "OK") setDirections(result); }
    );
  }, [mapsLoaded, ride, coords]);

  // ── Toggle Online / Offline ───────────────────
  async function toggleOnline() {
    setTogglingOnline(true);
    setStatusError("");
    try {
      const next = !isOnline;

      if (next) {
        // Must have GPS before going online
        let position = coords;
        if (!position) {
          try { position = await requestOnce(); }
          catch { setStatusError("Cannot go online – location access is required."); return; }
        }
        // Push location first so the geospatial query can find this driver
        await updateLocation([position.lng, position.lat]);
        socket?.emit("location_update", { coordinates: [position.lng, position.lat] });
        await setAvailability(true);
        setIsOnline(true);
      } else {
        await setAvailability(false);
        setIsOnline(false);
      }
    } catch (err) {
      setStatusError(err.response?.data?.message || "Failed to update availability");
    } finally {
      setTogglingOnline(false);
    }
  }

  // ── Manual "push location now" ────────────────
  async function pushLocationNow() {
    if (!coords && !gpsReady) {
      setStatusError("GPS not ready yet. Please wait.");
      return;
    }
    setPushingLocation(true);
    setStatusError("");
    try {
      let position = coords;
      if (!position) position = await requestOnce();
      await updateLocation([position.lng, position.lat]);
      socket?.emit("location_update", { coordinates: [position.lng, position.lat] });
    } catch (err) {
      setStatusError("Failed to push location: " + (err.message || "unknown error"));
    } finally {
      setPushingLocation(false);
    }
  }

  // ── Accept a ride request ─────────────────────
  async function acceptRide(rideRequest) {
    setAcceptingRideId(rideRequest.rideId);
    setStatusError("");
    try {
      const data = await updateRideStatus(rideRequest.rideId, {
        nextStatus: "ACCEPTED",
        requestToken: rideRequest.requestToken
      });
      dispatch(setRide(data.ride));
      await loadHistory();
    } catch (err) {
      setStatusError(err.response?.data?.message || "Could not accept ride — it may have been taken already");
    } finally {
      setAcceptingRideId(null);
    }
  }

  // ── Driver advances ride state ────────────────
  async function advanceStatus(nextStatus) {
    if (!ride) return;
    setUpdatingStatus(true);
    setStatusError("");
    try {
      const data = await updateRideStatus(ride._id, { nextStatus });
      dispatch(setRide(data.ride));
      await loadHistory();
    } catch (err) {
      setStatusError(err.response?.data?.message || "Failed to update ride status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  const isActiveRide = ride && !["COMPLETED", "CANCELLED"].includes(ride.status);

  return (
    <ShellLayout title="Driver Dashboard">
      <div className="uber-layout">

        {/* ── Side Panel ──────────────────────── */}
        <div className="side-panel">

          {/* Status & GPS */}
          <div className="panel-card">
            <h3>⚙️ Driver Status</h3>

            {/* GPS Status */}
            {gpsError ? (
              <div className="error" style={{ marginBottom: "10px" }}>
                📡 {gpsError}
              </div>
            ) : !gpsReady ? (
              <div className="info-msg" style={{ marginBottom: "10px" }}>
                <span className="spinner-sm" /> Acquiring GPS signal…
              </div>
            ) : (
              <div className="driver-address-pill" style={{ marginBottom: "10px" }}>
                <div className="pulse" />
                <span title={coords ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : ""}>
                  {driverAddress || (coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "Locating…")}
                </span>
              </div>
            )}

            {/* Online toggle */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                id="driver-toggle-online"
                onClick={toggleOnline}
                disabled={togglingOnline || (!gpsReady && !isOnline)}
                className={isOnline ? "danger" : ""}
                style={{ flex: 1 }}
              >
                {togglingOnline
                  ? (isOnline ? "Going offline…" : "Going online…")
                  : (isOnline ? "Go Offline" : "Go Online")}
              </button>
              <span className={isOnline ? "chip online" : "chip offline"}>
                {isOnline ? "● ONLINE" : "● OFFLINE"}
              </span>
            </div>

            {/* Push location button */}
            <button
              id="push-location-btn"
              className="ghost"
              style={{ marginTop: "8px", width: "100%" }}
              onClick={pushLocationNow}
              disabled={pushingLocation || !gpsReady}
            >
              {pushingLocation ? "📡 Pushing…" : "📡 Push Location Now"}
            </button>

            {statusError ? <p className="error" style={{ marginTop: "8px" }}>{statusError}</p> : null}
          </div>

          {/* Earnings */}
          <div className="panel-card">
            <h3>💰 Earnings</h3>
            <div className="earnings-grid">
              <div className="earnings-stat">
                <div className="amount">₹{earnings.today.toFixed(0)}</div>
                <div className="label">Today</div>
              </div>
              <div className="earnings-stat">
                <div className="amount">₹{earnings.total.toFixed(0)}</div>
                <div className="label">All Time</div>
              </div>
            </div>
            <p style={{ textAlign: "center", marginTop: "4px" }}>
              {earnings.trips} completed trip{earnings.trips !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Incoming Requests */}
          <div className="panel-card">
            <h3>📥 Ride Requests</h3>
            {pendingRequests.length === 0 ? (
              <p>
                {isOnline
                  ? gpsReady
                    ? "Waiting for ride requests nearby…"
                    : "GPS acquiring — requests will appear once location is confirmed"
                  : "Go online to receive requests"}
              </p>
            ) : null}

            {pendingRequests.map((req) => (
              <div className="request-card" key={req.rideId}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    #{String(req.rideId).slice(-6).toUpperCase()}
                  </span>
                  <div className="request-fare">₹{req.fare}</div>
                </div>

                <div className="request-addr">
                  <span className="addr-icon" style={{ color: "var(--teal)" }}>●</span>
                  <span className="addr-text">{req.pickupAddress || "Pickup location"}</span>
                </div>
                <div className="request-addr">
                  <span className="addr-icon" style={{ color: "var(--red)" }}>●</span>
                  <span className="addr-text">{req.dropAddress || "Drop location"}</span>
                </div>

                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "5px 0 8px" }}>
                  {req.estimatedDistanceKm} km · ~{req.estimatedTimeMin} min ETA
                </div>

                <button
                  id={`accept-ride-${req.rideId}`}
                  style={{ width: "100%" }}
                  disabled={acceptingRideId === req.rideId}
                  onClick={() => acceptRide(req)}
                >
                  {acceptingRideId === req.rideId ? "Accepting…" : "✓ Accept Ride"}
                </button>
              </div>
            ))}
          </div>

          {/* Current Ride */}
          <div className="panel-card">
            <h3>🚗 Current Ride</h3>
            {isActiveRide ? (
              <div className="current-ride-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span className={statusClass(ride.status)}>{ride.status}</span>
                  <strong style={{ color: "var(--teal)" }}>₹{ride.fare}</strong>
                </div>

                <div className="ride-address-block">
                  <div className="addr-line">
                    <div className="dot pickup" />
                    <div className="addr-body">
                      <div className="addr-label">Rider Pickup</div>
                      {ride.pickupAddress ||
                        `${ride.pickupLocation?.coordinates?.[1]?.toFixed(5)}, ${ride.pickupLocation?.coordinates?.[0]?.toFixed(5)}`}
                    </div>
                  </div>
                  <div className="addr-line">
                    <div className="dot drop" />
                    <div className="addr-body">
                      <div className="addr-label">Rider Destination</div>
                      {ride.dropAddress ||
                        `${ride.dropLocation?.coordinates?.[1]?.toFixed(5)}, ${ride.dropLocation?.coordinates?.[0]?.toFixed(5)}`}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "6px", marginTop: "12px" }}>
                  {["ACCEPTED", "ARRIVING"].includes(ride.status) && (
                    <button
                      id="start-ride-btn"
                      className="secondary"
                      disabled={updatingStatus}
                      onClick={() => advanceStatus("ONGOING")}
                    >
                      {updatingStatus ? "Starting…" : "▶ Start Ride"}
                    </button>
                  )}
                  {ride.status === "ONGOING" && (
                    <button
                      id="complete-ride-btn"
                      disabled={updatingStatus}
                      onClick={() => advanceStatus("COMPLETED")}
                    >
                      {updatingStatus ? "Completing…" : "✓ Complete Ride"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p>No active ride assigned.</p>
            )}
          </div>

          {/* Trip History */}
          <div className="panel-card">
            <h3>📋 Recent Trips</h3>
            {history.length === 0 ? (
              <p>No trips yet.</p>
            ) : (
              <div className="history-list">
                {history.slice(0, 8).map((item) => (
                  <div key={item._id} className="history-item">
                    <span className="hist-date">{new Date(item.createdAt).toLocaleDateString()}</span>
                    <span className={statusClass(item.status)}>{item.status}</span>
                    <span className="hist-fare">₹{item.fare ?? "—"}</span>
                    {item.driverRating
                      ? <span style={{ fontSize: "0.78rem", color: "var(--amber)" }}>⭐ {item.driverRating}</span>
                      : <span />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Map Panel ────────────────────────── */}
        <div className="map-panel">
          {mapsLoaded && coords ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={{ lat: coords.lat, lng: coords.lng }}
              zoom={14}
              options={{ disableDefaultUI: true, zoomControl: true, styles: darkMapStyle }}
            >
              {/* Driver marker */}
              <Marker
                position={{ lat: coords.lat, lng: coords.lng }}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: "#14d2aa",
                  fillOpacity: 1,
                  strokeColor: "#0d0f14",
                  strokeWeight: 2
                }}
                title="Your location"
              />

              {/* Rider pickup */}
              {ride?.pickupLocation && (
                <Marker
                  position={{
                    lat: ride.pickupLocation.coordinates[1],
                    lng: ride.pickupLocation.coordinates[0]
                  }}
                  label={{ text: "P", color: "#fff", fontWeight: "bold" }}
                  title="Rider pickup"
                />
              )}

              {/* Rider destination */}
              {ride?.dropLocation && (
                <Marker
                  position={{
                    lat: ride.dropLocation.coordinates[1],
                    lng: ride.dropLocation.coordinates[0]
                  }}
                  label={{ text: "D", color: "#fff", fontWeight: "bold" }}
                  title="Rider destination"
                />
              )}

              {directions && <DirectionsRenderer directions={directions} />}
            </GoogleMap>
          ) : (
            <div className="map-loader">
              {!mapsLoaded
                ? <p>⚠️ Google Maps failed to load. Check your API key.</p>
                : <p style={{ color: "var(--text-muted)" }}>📡 Waiting for GPS…</p>}
            </div>
          )}

          <div className="map-legend">
            <span>🟢 Your live location</span>
            {ride?.pickupLocation && <span>P = Rider pickup</span>}
            {ride?.dropLocation && <span>D = Rider destination</span>}
            {isOnline && <span style={{ color: "var(--teal)", borderColor: "rgba(20,210,170,0.3)" }}>● Live tracking</span>}
          </div>
        </div>
      </div>
      <ChatBox />
    </ShellLayout>
  );
}
