import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { clearUser } from "../store/slices/userSlice";
import { clearRideState } from "../store/slices/activeRideSlice";
import { logout } from "../api/auth";

export function ShellLayout({ title, children }) {
  const user = useSelector((state) => state.user.profile);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  async function onLogout() {
    await logout();
    dispatch(clearUser());
    dispatch(clearRideState());
    navigate("/login");
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">🚖</div>
          <div>
            <h1>RideHailing</h1>
            <p>{user?.name} · <span style={{ color: "var(--teal)", textTransform: "capitalize" }}>{user?.role}</span></p>
          </div>
        </div>
        <div className="topbar-actions">
          <Link to={user?.role === "rider" ? "/rider" : "/driver"}>Dashboard</Link>
          <button onClick={onLogout}>Logout</button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
