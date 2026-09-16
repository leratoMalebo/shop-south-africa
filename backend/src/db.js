import pg from "pg";

const { Pool } = pg;

// Render's managed Postgres requires SSL; local/dev Postgres usually doesn't
// accept the same self-signed cert setup, so this is toggled by NODE_ENV.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Swap this file for a different client (or the node:sqlite version used
// during local prototyping) without touching the route handlers — they
// only call the functions exported below.
await pool.query(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    "productName" TEXT NOT NULL,
    "productLink" TEXT,
    retailer TEXT NOT NULL,
    "parcelSize" TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    "serviceFee" DOUBLE PRECISION NOT NULL,
    "transportFee" DOUBLE PRECISION NOT NULL,
    "customsDuty" DOUBLE PRECISION NOT NULL,
    "insuranceFee" DOUBLE PRECISION NOT NULL,
    "totalZar" DOUBLE PRECISION NOT NULL,
    "totalBwp" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    paid BOOLEAN NOT NULL DEFAULT false,
    "stageIndex" INTEGER NOT NULL DEFAULT 0,
    "stageTimes" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`);

export async function createOrder(order) {
  const { rows } = await pool.query(
    `INSERT INTO orders (
      id, reference, "productName", "productLink", retailer, "parcelSize",
      price, "serviceFee", "transportFee", "customsDuty", "insuranceFee",
      "totalZar", "totalBwp", "paymentMethod", paid, "stageIndex", "stageTimes"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING *`,
    [
      order.id, order.reference, order.productName, order.productLink,
      order.retailer, order.parcelSize, order.price, order.serviceFee,
      order.transportFee, order.customsDuty, order.insuranceFee,
      order.totalZar, order.totalBwp, order.paymentMethod, order.paid,
      order.stageIndex, order.stageTimes,
    ]
  );
  return rows[0];
}

export async function listOrders() {
  const { rows } = await pool.query(`SELECT * FROM orders ORDER BY "createdAt" DESC`);
  return rows;
}

export async function getOrder(id) {
  const { rows } = await pool.query(`SELECT * FROM orders WHERE id = $1`, [id]);
  return rows[0];
}

export async function updateOrderStage(id, stageIndex, stageTimes) {
  const { rows } = await pool.query(
    `UPDATE orders SET "stageIndex" = $1, "stageTimes" = $2, "updatedAt" = now() WHERE id = $3 RETURNING *`,
    [stageIndex, stageTimes, id]
  );
  return rows[0];
}
