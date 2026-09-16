// Landed-cost calculation for the Shop South Africa module.
// Kept in one place so the /quote endpoint (used before payment) and the
// /orders endpoint (used at payment time) can never disagree on price.

export const FX_RATE = 0.62; // 1 ZAR -> BWP. Placeholder until a live rate feed is wired up.

export const PARCEL_SIZES = {
  Small: 450,
  Medium: 650,
  Large: 950,
};

export const STAGES = [
  "Payment confirmed",
  "Purchased from retailer",
  "Received at Johannesburg warehouse",
  "In transit to Botswana",
  "Customs clearance",
  "Delivered / ready for collection",
];

export function computeBreakdown({ price, parcelSize, insurance }) {
  if (typeof price !== "number" || !(price > 0)) {
    throw new Error("price must be a positive number");
  }
  const transportFee = PARCEL_SIZES[parcelSize];
  if (transportFee === undefined) {
    throw new Error(`parcelSize must be one of: ${Object.keys(PARCEL_SIZES).join(", ")}`);
  }

  const serviceFee = Math.max(150, price * 0.05);
  const customsDuty = (price + transportFee) * 0.15;
  const insuranceFee = insurance ? price * 0.01 : 0;
  const totalZar = price + serviceFee + transportFee + customsDuty + insuranceFee;
  const totalBwp = totalZar * FX_RATE;

  return {
    price,
    serviceFee: round2(serviceFee),
    transportFee: round2(transportFee),
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
