import jwt from "jsonwebtoken";
import { getUserById } from "./db.js";

// In production this MUST be set to a long random value (e.g.
// `openssl rand -hex 32`) via Render's environment variables — if it's
// ever left as the dev fallback in production, every session is forgeable.
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";
if (process.env.NODE_ENV === "production" && JWT_SECRET === "dev-only-insecure-secret-change-me") {
  console.error("JWT_SECRET is not set in production — refusing to start with the insecure default.");
  process.exit(1);
}

const COOKIE_NAME = "token";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Frontend and backend are on different Render subdomains in
    // production, which counts as cross-site — SameSite=None is required
    // for the cookie to be sent at all, and only works together with
    // Secure. Locally, both run on localhost so "lax" is fine.
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: MAX_AGE_MS,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
}

export function getUserIdFromRequest(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.sub;
  } catch {
    return null;
  }
}

// Protects a route: 401s if there's no valid session, otherwise attaches
// req.userId for the handler to use.
export function requireAuth(req, res, next) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Please log in to continue." });
  req.userId = userId;
  next();
}

// Protects a staff-only route (the admin dashboard). Attaches req.user
// (the full row, so handlers can check role again if needed) alongside
// req.userId.
export async function requireStaff(req, res, next) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Please log in to continue." });
  const user = await getUserById(userId);
  if (!user || user.role !== "staff") {
    return res.status(403).json({ error: "Staff access only." });
  }
  req.userId = userId;
  req.user = user;
  next();
}
