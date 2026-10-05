// Landed-cost calculation for the Shop South Africa module.
// Kept in one place so the /quote endpoint (used before payment) and the
// /orders endpoint (used at payment time) can never disagree on price.

export const FX_RATE = 0.62; // 1 ZAR -> BWP. Placeholder until a live rate feed is wired up.

export const PARCEL_SIZES = {
  Small: 450,
  Medium: 650,
  Large: 950,
};

// When 2+ items are shipped together in one batch, they travel in the same
// consolidated load, so the combined transport fee is discounted versus
// booking each item separately. This is the concrete version of "batch
// deliveries" — tune the discount as real consolidated-freight costs come in.
export const CONSOLIDATION_DISCOUNT = 0.20;
export const MAX_ITEMS_PER_BATCH = 10;

export const STAGES = [
  "Payment confirmed",
  "Purchased from retailer(s)",
  "Received at Johannesburg warehouse",
  "Consolidated and in transit to Botswana",
  "Customs clearance",
  "Delivered / ready for collection",
];

// items: [{ price, parcelSize, retailer?, productName?, productLink? }, ...]
export function computeBatchBreakdown(items, insurance) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Add at least one item before requesting a quote.");
  }
  if (items.length > MAX_ITEMS_PER_BATCH) {
    throw new Error(`A single batch can include at most ${MAX_ITEMS_PER_BATCH} items — split the rest into another order.`);
  }

  let totalPrice = 0;
  let rawTransportFee = 0;

  for (const item of items) {
    const price = Number(item.price);
    if (!(price > 0)) {
      throw new Error("Each item needs a price greater than zero.");
    }
    const sizeFee = PARCEL_SIZES[item.parcelSize];
    if (sizeFee === undefined) {
      throw new Error(`parcelSize must be one of: ${Object.keys(PARCEL_SIZES).join(", ")}`);
    }
    totalPrice += price;
    rawTransportFee += sizeFee;
  }

  const itemCount = items.length;
  const discount = itemCount >= 2 ? CONSOLIDATION_DISCOUNT : 0;
  const transportFee = rawTransportFee * (1 - discount);
  const transportSavings = rawTransportFee - transportFee;

  const serviceFee = Math.max(150, totalPrice * 0.05);
  const customsDuty = (totalPrice + transportFee) * 0.15;
  const insuranceFee = insurance ? totalPrice * 0.01 : 0;
  const totalZar = totalPrice + serviceFee + transportFee + customsDuty + insuranceFee;
  const totalBwp = totalZar * FX_RATE;

  return {
    itemCount,
    totalPrice: round2(totalPrice),
    serviceFee: round2(serviceFee),
    rawTransportFee: round2(rawTransportFee),
    transportFee: round2(transportFee),
    transportSavings: round2(transportSavings),
    consolidationDiscountPct: Math.round(discount * 100),
    customsDuty: round2(customsDuty),
    insuranceFee: round2(insuranceFee),
    totalZar: round2(totalZar),
    totalBwp: round2(totalBwp),
  };
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function generateReference() {
  const n = Math.floor(10000 + Math.random() * 89999);
  return `MOK-${n}`;
}



