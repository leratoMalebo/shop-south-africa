import { Router } from "express";
import crypto from "node:crypto";
import { computeBatchBreakdown, generateReference, STAGES } from "../calc.js";
import { createOrder, listOrders, getOrder, updateOrderStage } from "../db.js";

const router = Router();

// POST /api/orders — creates an order from one or more items (a "batch").
// In this prototype, creating an order IS the payment confirmation step
// (stageIndex starts at 0 = "Payment confirmed"). Wiring a real payment
// gateway means calling this only from that gateway's success
// webhook/callback, not directly from the client.
router.post("/", async (req, res) => {
  const { items, insurance, paymentMethod } = req.body;

  try {
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
      paid: true,
      stageIndex: 0,
      stageTimes: JSON.stringify([new Date().toISOString(), null, null, null, null, null]),
    });

    res.status(201).json(serialize(order));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/orders — list all orders, most recent first
router.get("/", async (req, res) => {
  const orders = await listOrders();
  res.json(orders.map(serialize));
});

// GET /api/orders/:id
router.get("/:id", async (req, res) => {
  const order = await getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(serialize(order));
});

// POST /api/orders/:id/advance — moves the order to the next workflow stage.
// Stands in for the ops dashboard until that's built (see design spec,
// section 4). In production this should require staff auth.
router.post("/:id/advance", async (req, res) => {
  const order = await getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.stageIndex >= STAGES.length - 1) {
    return res.status(400).json({ error: "Order already at final stage" });
  }

  const stageTimes = JSON.parse(order.stageTimes);
  const nextIndex = order.stageIndex + 1;
  stageTimes[nextIndex] = new Date().toISOString();

  const updated = await updateOrderStage(order.id, nextIndex, JSON.stringify(stageTimes));
  res.json(serialize(updated));
});

// Orders placed before the batch-orders update have no "items" column —
// reconstruct a one-item array from their old productName/retailer/etc.
// columns so they still display correctly in the tracker.
function serialize(order) {
  const items = order.items
    ? JSON.parse(order.items)
    : [{
        productName: order.productName,
        productLink: order.productLink,
        retailer: order.retailer,
        parcelSize: order.parcelSize,
        price: order.price,
      }];

  return {
    id: order.id,
    reference: order.reference,
    items,
    serviceFee: order.serviceFee,
    transportFee: order.transportFee,
    rawTransportFee: order.rawTransportFee,
    customsDuty: order.customsDuty,
    insuranceFee: order.insuranceFee,
    totalZar: order.totalZar,
    totalBwp: order.totalBwp,
    paymentMethod: order.paymentMethod,
    paid: Boolean(order.paid),
    stageIndex: order.stageIndex,
    stageTimes: JSON.parse(order.stageTimes),
    stages: STAGES,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export default router;


