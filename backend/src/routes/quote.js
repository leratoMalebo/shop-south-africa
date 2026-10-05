import { Router } from "express";
import { computeBatchBreakdown } from "../calc.js";

const router = Router();

// POST /api/quote
// body: { items: [{ price, parcelSize }, ...], insurance: boolean }
// Used on the "Cost" screen before an order exists — no DB write.
// Accepts one or many items; the discount for shipping multiple items
// together is applied automatically inside computeBatchBreakdown.
router.post("/", (req, res) => {
  const { items, insurance } = req.body;
  try {
    const breakdown = computeBatchBreakdown(items, Boolean(insurance));
    res.json(breakdown);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;


