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

export function getQuote({ price, parcelSize, insurance }) {
  return fetch(`${BASE}/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ price, parcelSize, insurance }),
  }).then(handle);
}

export function createOrder(payload) {
  return fetch(`${BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function listOrders() {
  return fetch(`${BASE}/orders`).then(handle);
}

export function advanceOrder(id) {
  return fetch(`${BASE}/orders/${id}/advance`, { method: "POST" }).then(handle);
}
