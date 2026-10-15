import { Router } from "express";
import crypto from "node:crypto";
import { computeBatchBreakdown, generateReference } from "../calc.js";
import { createOrder, listOrdersForUser, getOrder } from "../db.js";
import { requireAuth } from "../auth.js";
import { isSupportedMethod } from "../payments.js";
import { serializeOrder } from "../serialize.js";

const router = Router();

// POST /api/orders — places an order (one or more items shipped as a batch)
// for the logged-in user. The order starts UNPAID: the customer is shown how
// to pay using their order reference, and staff mark it paid from the admin
// screen once the money has arrived. Nothing is purchased or shipped before
// that. (When a payment gateway is integrated, its success webhook should
// take over the "mark as paid" step instead of staff.)
router.post("/", requireAuth, async (req, res) => {
  const { items, insurance, paymentMethod } = req.body;

  try {
    if (!isSupportedMethod(paymentMethod)) {
      return res.status(400).json({
        error: "Card payments aren't available yet — please choose bank transfer, Orange Money or Mascom MyZaka.",
      });
    }

    const breakdown = computeBatchBreakdown(items, Boolean(insurance));

    const order = await createOrder({
      id: crypto.randomUUID(),
      reference: generateReference(),
      items: JSON.stringify(items),
      serviceFee: breakdown.serviceFee,
      transportFee: breakdown.transportFee,
      rawTransportFee: breakdown.rawTransportFee,
      customsDuty: breakdown.customsDuty,
      insuranceFee: breakdown.insuranceFee,
      totalZar: breakdown.totalZar,
      totalBwp: breakdown.totalBwp,
      paymentMethod,
      paid: false,
      stageIndex: 0,
      stageTimes: JSON.stringify([null, null, null, null, null, null]),
      userId: req.userId,
    });

    res.status(201).json(serializeOrder(order));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/orders — the logged-in user's own orders only, most recent first.
router.get("/", requireAuth, async (req, res) => {
  const orders = await listOrdersForUser(req.userId);
  res.json(orders.map(o => serializeOrder(o)));
});

// GET /api/orders/:id — only if it belongs to the requesting user.
router.get("/:id", requireAuth, async (req, res) => {
  const order = await getOrder(req.params.id);
  if (!order || order.userId !== req.userId) {
    return res.status(404).json({ error: "Order not found" });
  }
  res.json(serializeOrder(order));
});

// Note: advancing a shipment's stage used to live here. It's now staff-only
// (see routes/admin.js) — a customer shouldn't be able to move their own order
// along the timeline.

export default router;





