import { Router } from "express";
import { STAGES } from "../calc.js";
import { requireStaff } from "../auth.js";
import {
  listAllOrdersWithCustomers, getOrder, confirmOrderPayment, updateOrderStage, listStoreRequests,
} from "../db.js";
import { serializeOrder } from "../serialize.js";

const router = Router();
router.use(requireStaff); // every route below is staff-only

// GET /api/admin/orders — every order from every customer.
router.get("/orders", async (req, res) => {
  const rows = await listAllOrdersWithCustomers();
  res.json(rows.map(o => serializeOrder(o, { includeCustomer: true })));
});

// POST /api/admin/orders/:id/confirm-payment — staff verified the money arrived.
router.post("/orders/:id/confirm-payment", async (req, res) => {
  const order = await getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.paid) return res.status(400).json({ error: "Payment was already confirmed." });

  const stageTimes = JSON.parse(order.stageTimes);
  stageTimes[0] = new Date().toISOString();
  const updated = await confirmOrderPayment(order.id, JSON.stringify(stageTimes));
  res.json(serializeOrder(updated));
});

// POST /api/admin/orders/:id/advance — move a PAID order to its next stage.
router.post("/orders/:id/advance", async (req, res) => {
  const order = await getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (!order.paid) return res.status(400).json({ error: "Confirm payment before moving this order forward." });
  if (order.stageIndex >= STAGES.length - 1) {
    return res.status(400).json({ error: "Order already at final stage" });
  }

  const stageTimes = JSON.parse(order.stageTimes);
  const nextIndex = order.stageIndex + 1;
  stageTimes[nextIndex] = new Date().toISOString();
  const updated = await updateOrderStage(order.id, nextIndex, JSON.stringify(stageTimes));
  res.json(serializeOrder(updated));
});

// GET /api/admin/store-requests — demand for stores not yet supported.
router.get("/store-requests", async (req, res) => {
  res.json(await listStoreRequests());
});

export default router;



