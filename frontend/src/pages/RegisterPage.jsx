import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/auth";
import { useDispatch } from "react-redux";
import { setUser } from "../store/slices/userSlice";

export function RegisterPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "rider",
    vehicleDetails: { make: "", model: "", plateNumber: "" },
    licenseNumber: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (form.role === "driver") {
      if (!form.licenseNumber || !form.vehicleDetails.make || !form.vehicleDetails.model || !form.vehicleDetails.plateNumber) {
        setError("Driver registration needs license number, vehicle make/model, and plate number.");
        return;
      }
    }
    setLoading(true);
    try {
      const payload =
        form.role === "driver"
          ? form
          : { name: form.name, email: form.email, phone: form.phone, password: form.password, role: form.role };
      const data = await register(payload);
      dispatch(setUser({ profile: data.user, token: data.token }));
      navigate(`/${data.user.role}`);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Check all required fields.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">
          <div className="auth-logo-icon">🚖</div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Create account</h2>
            <p style={{ margin: 0 }}>Join RideHailing today</p>
          </div>
        </div>

        <div style={{ display: "grid", gap: "10px", marginTop: "8px" }}>
          <input id="reg-name" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input id="reg-email" type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input id="reg-phone" type="tel" placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input id="reg-password" type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />

          <select id="reg-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="rider">🧍 I'm a Rider</option>
            <option value="driver">🚗 I'm a Driver</option>
          </select>

          {form.role === "driver" ? (
            <>
              <div className="auth-divider">Driver Details</div>
              <input
                id="reg-license"
                placeholder="License Number"
                value={form.licenseNumber}
                onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
              />
              <div className="grid-form">
                <input
                  placeholder="Vehicle Make"
                  value={form.vehicleDetails.make}
                  onChange={(e) => setForm({ ...form, vehicleDetails: { ...form.vehicleDetails, make: e.target.value } })}
                />
                <input
                  placeholder="Vehicle Model"
                  value={form.vehicleDetails.model}
                  onChange={(e) => setForm({ ...form, vehicleDetails: { ...form.vehicleDetails, model: e.target.value } })}
                />
              </div>
              <input
                placeholder="Plate Number"
                value={form.vehicleDetails.plateNumber}
                onChange={(e) => setForm({ ...form, vehicleDetails: { ...form.vehicleDetails, plateNumber: e.target.value } })}
              />
            </>
          ) : null}
        </div>

        {error ? <p className="error">{error}</p> : null}

        <button id="reg-submit" type="submit" disabled={loading} style={{ marginTop: "4px" }}>
          {loading ? "Creating account…" : "Create Account"}
        </button>

        <p style={{ textAlign: "center", marginTop: "4px" }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
