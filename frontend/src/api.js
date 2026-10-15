// In local dev, Vite proxies /api/* to the backend (see vite.config.js).
// In production (e.g. deployed as a Render static site), there's no dev
// proxy, so VITE_API_BASE must point at the deployed backend's full URL,
// e.g. https://shop-south-africa-api.onrender.com/api
const BASE = import.meta.env.VITE_API_BASE || "/api";

// --- Session token -------------------------------------------------------
// The server sets an httpOnly cookie on login, but Safari/iPhone refuses
// cookies exchanged between two different sites (our frontend and API sit on
// separate onrender.com subdomains). So the server also returns the session
// token, which we keep here and send as an Authorization header. Works on
// every browser. Once frontend and API share one custom domain, the cookie
// alone is enough and this can be removed.
const TOKEN_KEY = "shopsa_token";
function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setToken(token) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
}

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function authedFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${BASE}${path}`, { ...options, headers, credentials: "include" }).then(handle);
}

const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// --- Shopping ------------------------------------------------------------
// items: [{ price, parcelSize, retailer?, productName?, productLink? }, ...]
export const getQuote = ({ items, insurance }) => authedFetch(`/quote`, json("POST", { items, insurance }));
export const createOrder = (payload) => authedFetch(`/orders`, json("POST", payload));
export const listOrders = () => authedFetch(`/orders`);
export const requestStore = ({ storeName, link, note }) =>
  authedFetch(`/store-requests`, json("POST", { storeName, link, note }));

// --- Accounts ------------------------------------------------------------
export async function signup({ email, password, name, phone }) {
  const { token, ...user } = await authedFetch(`/auth/signup`, json("POST", { email, password, name, phone }));
  setToken(token);
  return user;
}
export async function login({ email, password }) {
  const { token, ...user } = await authedFetch(`/auth/login`, json("POST", { email, password }));
  setToken(token);
  return user;
}
export async function logout() {
  setToken(null);
  return authedFetch(`/auth/logout`, { method: "POST" });
}
export const getMe = () => authedFetch(`/auth/me`);

// --- Staff (admin) -------------------------------------------------------
export const adminListOrders = () => authedFetch(`/admin/orders`);
export const adminConfirmPayment = (id) => authedFetch(`/admin/orders/${id}/confirm-payment`, { method: "POST" });
export const adminAdvanceOrder = (id) => authedFetch(`/admin/orders/${id}/advance`, { method: "POST" });
export const adminListStoreRequests = () => authedFetch(`/admin/store-requests`);


