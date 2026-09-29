import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

export const AdminProtectedRoute = ({ children }) => {
  const user = useSelector((state) => state.user.profile);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    // Redirect to their respective dashboard or login
    return <Navigate to={`/${user.role}`} replace />;
  }

  return children;
};
