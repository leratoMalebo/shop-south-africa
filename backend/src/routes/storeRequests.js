import { Router } from "express";
import crypto from "node:crypto";
import { createStoreRequest, listStoreRequests } from "../db.js";

const router = Router();

// POST /api/store-requests — logs a customer's request for a store that
// isn't in the app yet. Used both by the "Request a store" form and
// automatically when someone picks "Other" as their retailer at checkout,
// so the business can see real demand before onboarding a new retailer.
router.post("/", async (req, res) => {
  const { storeName, link, note } = req.body;
  if (!storeName || !storeName.trim()) {
    return res.status(400).json({ error: "Enter the name of the store you'd like to shop from." });
  }
  const created = await createStoreRequest({
    id: crypto.randomUUID(),
    storeName: storeName.trim(),
    link: link || null,
    note: note || null,
  });
  res.status(201).json(created);
});

// GET /api/store-requests — for internal review of demand. No auth yet;
// add it before this is exposed anywhere staff-only.
router.get("/", async (req, res) => {
  res.json(await listStoreRequests());
});

export default router;


