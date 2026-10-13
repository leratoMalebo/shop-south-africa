import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { createUser, getUserByEmail, getUserById } from "../db.js";
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from "../auth.js";

const router = Router();

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role };
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const { email, password, name, phone } = req.body;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Enter your name." });
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists — try logging in instead." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUser({
    id: crypto.randomUUID(),
    email,
    passwordHash,
    name: name.trim(),
    phone: phone || null,
  });

  const token = signToken(user.id);
  setAuthCookie(res, token);
  res.status(201).json(publicUser(user));
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ error: "Enter your email and password." });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  const token = signToken(user.id);
  setAuthCookie(res, token);
  res.json(publicUser(user));
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me — used on app load to check for an existing session.
router.get("/me", requireAuth, async (req, res) => {
  const user = await getUserById(req.userId);
  if (!user) return res.status(401).json({ error: "Session no longer valid." });
  res.json(publicUser(user));
});

export default router;


