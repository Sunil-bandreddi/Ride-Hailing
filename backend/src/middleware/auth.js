import { verifyAuthToken } from "../utils/jwt.js";

export function requireAuth(req, res, next) {
  // Accept token from cookie OR Authorization: Bearer header
  let token = req.cookies?.token;

  if (!token) {
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  if (!token) return res.status(401).json({ message: "Unauthorized – no token provided" });

  try {
    req.user = verifyAuthToken(token);
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden – insufficient role" });
  }
  return next();
};

export const requireAdmin = requireRole("admin");
