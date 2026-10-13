// In local dev, Vite proxies /api/* to the backend (see vite.config.js).
// In production (e.g. deployed as a Render static site), there's no dev
// proxy, so VITE_API_BASE must point at the deployed backend's full URL,
// e.g. https://shop-south-africa-api.onrender.com/api
const BASE = import.meta.env.VITE_API_BASE || "/api";

async function handle(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// Every call that touches a session cookie needs credentials: "include" —
// without it, the browser won't send/accept the httpOnly auth cookie,
// especially cross-origin (frontend and backend are separate Render
// services in production).
function authedFetch(path, options = {}) {
  return fetch(`${BASE}${path}`, { ...options, credentials: "include" }).then(handle);
}

// items: [{ price, parcelSize, retailer?, productName?, productLink? }, ...]
export function getQuote({ items, insurance }) {
  return authedFetch(`/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, insurance }),
  });
}

export function createOrder(payload) {
  return authedFetch(`/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function listOrders() {
  return authedFetch(`/orders`);
}

export function advanceOrder(id) {
  return authedFetch(`/orders/${id}/advance`, { method: "POST" });
}

export function signup({ email, password, name, phone }) {
  return authedFetch(`/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, phone }),
  });
}

export function login({ email, password }) {
  return authedFetch(`/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return authedFetch(`/auth/logout`, { method: "POST" });
}

export function getMe() {
  return authedFetch(`/auth/me`);
}

export function requestStore({ storeName, link, note }) {
  return fetch(`${BASE}/store-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeName, link, note }),
  }).then(handle);
}




