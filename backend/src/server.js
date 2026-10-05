import "dotenv/config";
import express from "express";
import cors from "cors";
import quoteRoute from "./routes/quote.js";
import ordersRoute from "./routes/orders.js";
import storeRequestsRoute from "./routes/storeRequests.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/quote", quoteRoute);
app.use("/api/orders", ordersRoute);
app.use("/api/store-requests", storeRequestsRoute);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Shop South Africa API listening on http://localhost:${PORT}`);
});



