import { Router } from "express";
import { computeBreakdown } from "../calc.js";

const router = Router();

// POST /api/quote
// body: { price: number, parcelSize: "Small"|"Medium"|"Large", insurance: boolean }
// Used on the "Cost" screen before an order exists — no DB write.
router.post("/", (req, res) => {
  const { price, parcelSize, insurance } = req.body;
  try {
    const breakdown = computeBreakdown({
      price: Number(price),
      parcelSize,
      insurance: Boolean(insurance),
    });
    res.json(breakdown);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
