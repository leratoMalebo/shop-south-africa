import { STAGES } from "./calc.js";
import { paymentInstructionsFor } from "./payments.js";

// Shapes an orders row for the API. Orders placed before the batch-orders
// update have no "items" column — reconstruct a one-item array from their old
// productName/retailer/etc. columns so they still display correctly.
export function serializeOrder(order, { includeCustomer = false } = {}) {
  const items = order.items
    ? JSON.parse(order.items)
    : [{
        productName: order.productName,
        productLink: order.productLink,
        retailer: order.retailer,
        parcelSize: order.parcelSize,
        price: order.price,
      }];

  const paid = Boolean(order.paid);

  const out = {
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
    paid,
    // Only shown while there's still something to pay.
    paymentInstructions: paid ? null : paymentInstructionsFor(order.paymentMethod),
    stageIndex: order.stageIndex,
    stageTimes: JSON.parse(order.stageTimes),
    stages: STAGES,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };

  if (includeCustomer) {
    out.customer = {
      name: order.customerName || null,
      email: order.customerEmail || null,
      phone: order.customerPhone || null,
    };
  }
  return out;
}




