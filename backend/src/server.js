import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import quoteRoute from "./routes/quote.js";
import ordersRoute from "./routes/orders.js";
import storeRequestsRoute from "./routes/storeRequests.js";
import authRoute from "./routes/auth.js";
import adminRoute from "./routes/admin.js";

const app = express();

// Accounts use an httpOnly cookie, which requires the actual frontend
// origin(s) to be listed (credentialed requests can't use "*"). Set
// CORS_ORIGINS on Render to a comma-separated list, e.g.
// "https://shop-south-africa-app.onrender.com,https://yourdomain.com"
// Cleaned defensively: pasting a link from a rendered page into an env var can
// bring markdown brackets/parentheses or a trailing slash along, and any of
// those makes the browser's exact-match origin check fail silently.
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map(s => s
    .trim()
    .replace(/\(.*\)$/, "")     // drop a trailing "(url)" from markdown-style [url](url)
    .replace(/[\[\]]/g, "")      // drop any leftover square brackets
    .replace(/\/+$/, ""))        // drop trailing slashes
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoute);
app.use("/api/quote", quoteRoute);
app.use("/api/orders", ordersRoute);
app.use("/api/store-requests", storeRequestsRoute);
app.use("/api/admin", adminRoute);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Shop South Africa API listening on http://localhost:${PORT}`);
});






