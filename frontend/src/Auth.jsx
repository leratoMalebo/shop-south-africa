import React, { useState } from "react";
import { signup, login } from "./api.js";

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = mode === "login"
        ? await login({ email: form.email, password: form.password })
        : await signup(form);
      onAuthed(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <img src="/icon-192.png" alt="" className="auth-mark" />
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="auth-sub">Shop South Africa, delivered home to Botswana.</p>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="field">
              <label>Full name</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          </div>
          {mode === "signup" && (
            <div className="field">
              <label>Phone (optional)</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+267 ..." />
            </div>
          )}
          <div className="field">
            <label>Password</label>
            <input required type="password" minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"} />
          </div>

          {error && <div className="error-note">{error}</div>}

          <button className="go-btn" type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? (
            <span>New here? <a onClick={() => { setMode("signup"); setError(""); }}>Create an account</a></span>
          ) : (
            <span>Already have an account? <a onClick={() => { setMode("login"); setError(""); }}>Log in</a></span>
          )}
        </div>
      </div>
    </div>
  );
}



