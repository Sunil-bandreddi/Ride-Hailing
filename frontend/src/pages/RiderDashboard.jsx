import { useEffect, useMemo, useRef, useState } from "react";
import { ShellLayout } from "../components/ShellLayout";
import { estimateFare, rateRide, requestRide, rideHistory, updateRideStatus } from "../api/rides";
import { useDispatch, useSelector } from "react-redux";
import { dismissRatingModal, setRide } from "../store/slices/activeRideSlice";
import { useSocket } from "../hooks/useSocket";
import { ChatBox } from "../components/ChatBox";
import { getNearbyDrivers } from "../api/drivers";
import {
  Autocomplete,
  DirectionsRenderer,
  GoogleMap,
  Marker,
  useJsApiLoader
} from "@react-google-maps/api";

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };
const mapLibraries   = ["places"];

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

const STATUS_LABELS = {
  SEARCHING:  "🔍 Searching for a driver nearby…",
  ACCEPTED:   "✅ Driver accepted! Heading to you",
  ARRIVING:   "🚗 Driver is almost here!",
  ONGOING:    "🛣️ Ride in progress",
  COMPLETED:  "🎉 Ride completed",
  CANCELLED:  "❌ Ride cancelled"
};

function statusClass(s) {
  return "chip status-" + (s || "").toLowerCase();
}

/* ─── Rating Modal ──────────────────────────────── */
function RatingModal({ ride, onClose }) {
  const dispatch    = useDispatch();
  const [star, setStar]           = useState(0);
  const [hover, setHover]         = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]           = useState(false);
  const [rateError, setRateError] = useState("");

  async function submit() {
    if (!star) return;
    setSubmitting(true);
    setRateError("");
    try {
      await rateRide(ride._id, star);
      setDone(true);
      setTimeout(() => { dispatch(dismissRatingModal(ride._id)); onClose(); }, 1400);
    } catch (err) {
      setRateError(err.response?.data?.message || "Failed to submit rating");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>🎉</div>
        <h2>Ride Complete!</h2>
        <p style={{ marginBottom: "6px" }}>
          How was your trip? Your feedback helps the driver community.
        </p>
        <p style={{ color: "var(--teal)", fontWeight: 600, marginBottom: "18px" }}>
          ₹{ride.fare} · {ride.estimatedDistanceKm} km
        </p>

        {done ? (
          <div className="info-msg" style={{ textAlign: "center" }}>
            Thanks for the {star}⭐ rating!
          </div>
        ) : (
          <>
            <div className="star-row">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={`star-btn ${(hover || star) >= n ? "active" : ""}`}
                  onClick={() => setStar(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  type="button"
                >
                  ⭐
                </button>
              ))}
            </div>
            {rateError && <p className="error" style={{ marginBottom: "8px" }}>{rateError}</p>}
            <div style={{ display: "grid", gap: "8px" }}>
              <button
                id="submit-rating-btn"
                onClick={submit}
                disabled={!star || submitting}
              >
                {submitting ? "Submitting…" : `Submit ${star ? `${star}⭐` : "Rating"}`}
              </button>
              <button className="ghost" onClick={() => { dispatch(dismissRatingModal(ride._id)); onClose(); }}>
                Skip
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────── */
export function RiderDashboard() {
  useSocket();
  const dispatch = useDispatch();

  const pickupRef = useRef(null);
  const dropRef   = useRef(null);

  const [pickupAddress, setPickupAddress] = useState("");
  const [dropAddress,   setDropAddress]   = useState("");
  const [pickupCoords,  setPickupCoords]  = useState(DEFAULT_CENTER);
  const [dropCoords,    setDropCoords]    = useState({ lat: 28.5355, lng: 77.391 });

  const [estimate,      setEstimate]      = useState(null);
  const [directions,    setDirections]    = useState(null);
  const [history,       setHistory]       = useState([]);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);

  // Loading & error states
  const [error,         setError]         = useState("");
  const [estimating,    setEstimating]    = useState(false);
  const [requesting,    setRequesting]    = useState(false);
  const [cancelling,    setCancelling]    = useState(false);
  const [detectingLoc,  setDetectingLoc]  = useState(false);

  const ride            = useSelector((s) => s.activeRide.ride);
  const driverLocation  = useSelector((s) => s.activeRide.driverLocation);
  const showRatingModal = useSelector((s) => s.activeRide.showRatingModal);

  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: mapLibraries
  });

  // ── Auto-detect current location for pickup ───
  function detectCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation not supported by your browser.");
      return;
    }
    setDetectingLoc(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPickupCoords(newCoords);
        // Reverse geocode to get address
        if (mapsLoaded && window.google) {
          new window.google.maps.Geocoder().geocode(
            { location: newCoords },
            (results, status) => {
              if (status === "OK" && results[0]) {
                setPickupAddress(results[0].formatted_address);
              } else {
                setPickupAddress(`${newCoords.lat.toFixed(5)}, ${newCoords.lng.toFixed(5)}`);
              }
              setDetectingLoc(false);
            }
          );
        } else {
          setPickupAddress(`${newCoords.lat.toFixed(5)}, ${newCoords.lng.toFixed(5)}`);
          setDetectingLoc(false);
        }
      },
      (err) => {
        setError("Could not get location: " + (err.code === 1 ? "permission denied" : err.message));
        setDetectingLoc(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function loadHistory() {
    try {
      const data = await rideHistory();
      setHistory(data.rides);
    } catch {}
  }

  useEffect(() => { loadHistory(); }, []);

  // ── Route polyline between pickup and drop ────
  useEffect(() => {
    if (!mapsLoaded) return;
    const svc = new window.google.maps.DirectionsService();
    svc.route(
      { origin: pickupCoords, destination: dropCoords, travelMode: "DRIVING" },
      (result, status) => { if (status === "OK") setDirections(result); }
    );
  }, [mapsLoaded, pickupCoords, dropCoords]);

  // ── Nearby drivers polling ────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getNearbyDrivers({
          lat: pickupCoords.lat, lng: pickupCoords.lng, radius: 5000, limit: 10
        });
        setNearbyDrivers(data.drivers || []);
      } catch { setNearbyDrivers([]); }
    };
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [pickupCoords]);

  // ── Autocomplete handlers ─────────────────────
  function applyAutocomplete(ref, setAddr, setCoords) {
    const place = ref.current?.getPlace();
    if (!place?.geometry?.location) return;
    setAddr(place.formatted_address || place.name || "");
    setCoords({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
  }

  // ── Estimate fare ─────────────────────────────
  async function onEstimate() {
    if (!pickupAddress || !dropAddress) {
      setError("Please enter both pickup and drop locations.");
      return;
    }
    setEstimating(true);
    setError("");
    try {
      const data = await estimateFare({
        pickupCoordinates: [pickupCoords.lng, pickupCoords.lat],
        dropCoordinates:   [dropCoords.lng,   dropCoords.lat]
      });
      setEstimate(data);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to estimate fare");
    } finally {
      setEstimating(false);
    }
  }

  // ── Request ride ──────────────────────────────
  async function onRequestRide() {
    if (!pickupAddress || !dropAddress) {
      setError("Please enter both pickup and drop locations.");
      return;
    }
    setRequesting(true);
    setError("");
    try {
      const data = await requestRide({
        pickupCoordinates: [pickupCoords.lng, pickupCoords.lat],
        dropCoordinates:   [dropCoords.lng,   dropCoords.lat],
        pickupAddress,
        dropAddress
      });
      dispatch(setRide(data.ride));
      await loadHistory();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to request ride — please try again");
    } finally {
      setRequesting(false);
    }
  }

  // ── Cancel ride ───────────────────────────────
  async function onCancelRide() {
    if (!ride || !ride._id) return;
    setCancelling(true);
    setError("");
    try {
      const data = await updateRideStatus(ride._id, { nextStatus: "CANCELLED" });
      dispatch(setRide(data.ride));
      await loadHistory();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel ride");
    } finally {
      setCancelling(false);
    }
  }

  const isActiveRide = ride && !["COMPLETED", "CANCELLED"].includes(ride.status);

  return (
    <ShellLayout title="Rider Dashboard">
      {showRatingModal && ride?.status === "COMPLETED" && (
        <RatingModal ride={ride} onClose={() => dispatch(dismissRatingModal(ride._id))} />
      )}

      <div className="uber-layout">

        {/* ── Side Panel ────────────────────── */}
        <div className="side-panel">

          {/* Booking */}
          <div className="panel-card">
            <h3>📍 Where to?</h3>

            {mapsLoaded ? (
              <div style={{ display: "grid", gap: "8px" }}>
                {/* Pickup row */}
                <div style={{ position: "relative" }}>
                  <Autocomplete
                    onLoad={(a) => (pickupRef.current = a)}
                    onPlaceChanged={() => applyAutocomplete(pickupRef, setPickupAddress, setPickupCoords)}
                  >
                    <input
                      id="pickup-input"
                      placeholder="Pickup location"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      style={{ paddingRight: "42px" }}
                    />
                  </Autocomplete>
                  <button
                    id="use-current-location-btn"
                    onClick={detectCurrentLocation}
                    disabled={detectingLoc}
                    title="Use current location"
                    style={{
                      position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)",
                      padding: "4px 8px", fontSize: "1rem",
                      background: "transparent", color: "var(--teal)", border: "none",
                      cursor: "pointer", lineHeight: 1
                    }}
                  >
                    {detectingLoc ? "⏳" : "📍"}
                  </button>
                </div>

                <Autocomplete
                  onLoad={(a) => (dropRef.current = a)}
                  onPlaceChanged={() => applyAutocomplete(dropRef, setDropAddress, setDropCoords)}
                >
                  <input
                    id="drop-input"
                    placeholder="Drop location"
                    value={dropAddress}
                    onChange={(e) => setDropAddress(e.target.value)}
                  />
                </Autocomplete>
              </div>
            ) : (
              <div className="info-msg">Loading Google Maps…</div>
            )}

            {/* Estimate box */}
            {estimate && (
              <div className="estimate-box">
                <div className="estimate-item">
                  <div className="value">₹{estimate.fare}</div>
                  <div className="label">Fare</div>
                </div>
                <div className="estimate-item">
                  <div className="value">{estimate.estimatedDistanceKm}</div>
                  <div className="label">km</div>
                </div>
                <div className="estimate-item">
                  <div className="value">{estimate.estimatedTimeMin}</div>
                  <div className="label">min ETA</div>
                </div>
              </div>
            )}

            {error && <p className="error" style={{ marginTop: "8px" }}>{error}</p>}

            <div className="row" style={{ marginTop: "12px" }}>
              <button
                id="estimate-fare-btn"
                className="ghost"
                style={{ flex: 1 }}
                onClick={onEstimate}
                disabled={estimating || !!isActiveRide}
              >
                {estimating ? "Estimating…" : "Estimate Fare"}
              </button>
              <button
                id="request-ride-btn"
                style={{ flex: 1 }}
                onClick={onRequestRide}
                disabled={requesting || !!isActiveRide}
              >
                {requesting ? "Finding drivers…" : "Request Ride"}
              </button>
            </div>

            {nearbyDrivers.length > 0 && !isActiveRide && (
              <p style={{ marginTop: "8px", color: "var(--teal)", fontSize: "0.78rem" }}>
                🚗 {nearbyDrivers.length} driver{nearbyDrivers.length > 1 ? "s" : ""} available nearby
              </p>
            )}
          </div>

          {/* Active Ride */}
          <div className="panel-card">
            <h3>🚖 Active Ride</h3>
            {isActiveRide ? (
              <div className="active-ride-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span className={statusClass(ride.status)}>{ride.status}</span>
                  <strong style={{ color: "var(--teal)", fontSize: "1.1rem" }}>₹{ride.fare}</strong>
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "10px" }}>
                  {STATUS_LABELS[ride.status]}
                </p>

                <div className="ride-address-block">
                  <div className="addr-line">
                    <div className="dot pickup" />
                    <div className="addr-body">
                      <div className="addr-label">Pickup</div>
                      {ride.pickupAddress || "—"}
                    </div>
                  </div>
                  <div className="addr-line">
                    <div className="dot drop" />
                    <div className="addr-body">
                      <div className="addr-label">Destination</div>
                      {ride.dropAddress || "—"}
                    </div>
                  </div>
                </div>

                {driverLocation && (
                  <div className="driver-loc-pill" style={{ marginTop: "8px" }}>
                    <span>📍</span>
                    Driver: {driverLocation[1]?.toFixed(4)}, {driverLocation[0]?.toFixed(4)}
                  </div>
                )}

                {["SEARCHING", "ACCEPTED", "ARRIVING"].includes(ride.status) && (
                  <button
                    id="cancel-ride-btn"
                    className="danger"
                    style={{ marginTop: "12px", width: "100%" }}
                    onClick={onCancelRide}
                    disabled={cancelling}
                  >
                    {cancelling ? "Cancelling…" : "Cancel Ride"}
                  </button>
                )}
              </div>
            ) : ride?.status === "CANCELLED" ? (
              <div className="error">
                Ride was cancelled. {ride.cancelledAt ? "You can book a new one." : ""}
              </div>
            ) : (
              <p>No active ride. Enter locations above to book one.</p>
            )}
          </div>

          {/* Ride History */}
          <div className="panel-card">
            <h3>📋 Ride History</h3>
            {history.length === 0 ? (
              <p>No previous rides yet.</p>
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

        {/* ── Map Panel ─────────────────────── */}
        <div className="map-panel">
          {mapsLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={pickupCoords}
              zoom={13}
              options={{ disableDefaultUI: true, zoomControl: true, styles: darkMapStyle }}
            >
              {/* Pickup */}
              <Marker
                position={pickupCoords}
                label={{ text: "P", color: "#fff", fontWeight: "bold" }}
                title="Pickup"
              />

              {/* Drop */}
              {dropAddress && (
                <Marker
                  position={dropCoords}
                  label={{ text: "D", color: "#fff", fontWeight: "bold" }}
                  title="Drop"
                />
              )}

              {/* Nearby driver dots */}
              {nearbyDrivers.map((d) => (
                <Marker
                  key={d.id}
                  position={{ lat: d.location[1], lng: d.location[0] }}
                  icon={{ url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png" }}
                  title={`${d.name} · ⭐ ${d.rating}`}
                />
              ))}

              {/* Live assigned driver */}
              {driverLocation && (
                <Marker
                  position={{ lat: driverLocation[1], lng: driverLocation[0] }}
                  icon={{ url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png" }}
                  title="Your driver"
                />
              )}

              {directions && <DirectionsRenderer directions={directions} />}
            </GoogleMap>
          ) : (
            <div className="map-loader">
              <div style={{ textAlign: "center" }}>
                <p>⚠️ Google Maps failed to load.</p>
                <p>Check your API key in <code>frontend/.env</code></p>
              </div>
            </div>
          )}

          <div className="map-legend">
            {nearbyDrivers.length > 0 && <span>🔵 Available drivers</span>}
            {driverLocation && <span>🟢 Your driver</span>}
            {directions && <span>Route shown</span>}
          </div>
        </div>
      </div>
      <ChatBox />
    </ShellLayout>
  );
}
