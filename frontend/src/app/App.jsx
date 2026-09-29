import { Navigate, Route, Routes } from "react-router-dom";
import { RiderDashboard } from "../pages/RiderDashboard";
import { DriverDashboard } from "../pages/DriverDashboard";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { me } from "../api/auth";
import { setAuthHeader } from "../api/client";
import { clearUser, setUser } from "../store/slices/userSlice";
import { AdminDashboard } from "../pages/AdminDashboard";
import { AdminProtectedRoute } from "../components/AdminProtectedRoute";

export function App() {
  const dispatch = useDispatch();
  const user  = useSelector((state) => state.user.profile);
  const token = useSelector((state) => state.user.token);

  // Ensure axios always has the Bearer token set (survives page refresh)
  useEffect(() => {
    setAuthHeader(token);
  }, [token]);

  // Validate the stored token against the server on mount
  useEffect(() => {
    if (!token) return;
    me()
      .then((data) => {
        dispatch(setUser({ profile: data.user, token }));
      })
      .catch(() => {
        dispatch(clearUser());
      });
  }, [dispatch, token]);

  return (
    <Routes>
      <Route path="/login"    element={user ? <Navigate to={`/${user.role}`} /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to={`/${user.role}`} /> : <RegisterPage />} />
      <Route path="/rider"    element={user?.role === "rider"  ? <RiderDashboard />  : <Navigate to="/login" />} />
      <Route path="/driver"   element={user?.role === "driver" ? <DriverDashboard /> : <Navigate to="/login" />} />
      <Route path="/admin"    element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
      <Route path="*"         element={<Navigate to={user ? `/${user.role}` : "/login"} />} />
    </Routes>
  );
}
