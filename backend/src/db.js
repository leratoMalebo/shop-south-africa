import pg from "pg";

const { Pool } = pg;

// Render's managed Postgres requires SSL; local/dev Postgres usually doesn't
// accept the same self-signed cert setup, so this is toggled by NODE_ENV.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Swap this file for a different client without touching the route
// handlers — they only call the functions exported below.
//
// --- Schema history ---
// v1 (single-item orders): productName/retailer/parcelSize/price columns.
// v2 (this version, batch orders): adds an "items" JSON column holding an
// array of {productName, productLink, retailer, parcelSize, price}, so one
// order can cover several stores/products shipped together. The v1 columns
// are kept (now nullable) so any orders placed before this update still
// read back correctly — see serialize() in routes/orders.js, which
// reconstructs a one-item "items" array from them when "items" is null.
await pool.query(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    "productName" TEXT,
    "productLink" TEXT,
    retailer TEXT,
    "parcelSize" TEXT,
    price DOUBLE PRECISION,
    items TEXT,
    "serviceFee" DOUBLE PRECISION NOT NULL,
    "transportFee" DOUBLE PRECISION NOT NULL,
    "rawTransportFee" DOUBLE PRECISION,
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

// Migrate any table created by the v1 schema: add the new columns and
// relax the old ones from NOT NULL, since a batch order no longer fills
// them in. Each statement is safe to run repeatedly.
await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS items TEXT;`);
await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS "rawTransportFee" DOUBLE PRECISION;`);
await pool.query(`ALTER TABLE orders ALTER COLUMN "productName" DROP NOT NULL;`);
await pool.query(`ALTER TABLE orders ALTER COLUMN retailer DROP NOT NULL;`);
await pool.query(`ALTER TABLE orders ALTER COLUMN "parcelSize" DROP NOT NULL;`);
await pool.query(`ALTER TABLE orders ALTER COLUMN price DROP NOT NULL;`);

// Requests for stores/retailers that aren't in the app yet — lets the
// business see real demand before committing to onboard a new retailer
// (see Phase 5 of the design spec).
await pool.query(`
  CREATE TABLE IF NOT EXISTS store_requests (
    id TEXT PRIMARY KEY,
    "storeName" TEXT NOT NULL,
    link TEXT,
    note TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`);

export async function createOrder(order) {
  const { rows } = await pool.query(
    `INSERT INTO orders (
      id, reference, items, "serviceFee", "transportFee", "rawTransportFee",
      "customsDuty", "insuranceFee", "totalZar", "totalBwp", "paymentMethod",
      paid, "stageIndex", "stageTimes"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING *`,
    [
      order.id, order.reference, order.items, order.serviceFee, order.transportFee,
      order.rawTransportFee, order.customsDuty, order.insuranceFee, order.totalZar,
      order.totalBwp, order.paymentMethod, order.paid, order.stageIndex, order.stageTimes,
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

export async function createStoreRequest(req) {
  const { rows } = await pool.query(
    `INSERT INTO store_requests (id, "storeName", link, note) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.id, req.storeName, req.link || null, req.note || null]
  );
  return rows[0];
}

export async function listStoreRequests() {
  const { rows } = await pool.query(`SELECT * FROM store_requests ORDER BY "createdAt" DESC`);
  return rows;
}




