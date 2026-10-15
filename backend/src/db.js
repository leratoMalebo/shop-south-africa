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

// Real accounts. "role" is a plain text column rather than a separate
// table/enum on purpose — this is the first cut of auth, and a staff flag
// is all the upcoming admin dashboard needs; it can graduate into a proper
// roles/permissions table later without touching anything else here.
await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    "passwordHash" TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'customer', -- 'customer' | 'staff'
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`);

// Orders now belong to a user. Nullable + migrated in, so every order
// placed during the pilot (before accounts existed) still reads back fine
// — just with no owner, which the UI/route layer treats as "unclaimed".
await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS "userId" TEXT REFERENCES users(id);`);

export async function createOrder(order) {
  const { rows } = await pool.query(
    `INSERT INTO orders (
      id, reference, items, "serviceFee", "transportFee", "rawTransportFee",
      "customsDuty", "insuranceFee", "totalZar", "totalBwp", "paymentMethod",
      paid, "stageIndex", "stageTimes", "userId"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING *`,
    [
      order.id, order.reference, order.items, order.serviceFee, order.transportFee,
      order.rawTransportFee, order.customsDuty, order.insuranceFee, order.totalZar,
      order.totalBwp, order.paymentMethod, order.paid, order.stageIndex, order.stageTimes,
      order.userId,
    ]
  );
  return rows[0];
}

// Used by the admin dashboard (staff see every order).
export async function listOrders() {
  const { rows } = await pool.query(`SELECT * FROM orders ORDER BY "createdAt" DESC`);
  return rows;
}

// Used by the customer-facing tracker (a customer only sees their own).
export async function listOrdersForUser(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM orders WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
    [userId]
  );
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

export async function createUser(user) {
  const { rows } = await pool.query(
    `INSERT INTO users (id, email, "passwordHash", name, phone, role)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [user.id, user.email.toLowerCase(), user.passwordHash, user.name, user.phone || null, user.role || "customer"]
  );
  return rows[0];
}

export async function getUserByEmail(email) {
  const { rows } = await pool.query(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase()]);
  return rows[0];
}

export async function getUserById(id) {
  const { rows } = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  return rows[0];
}

export async function setUserRole(id, role) {
  const { rows } = await pool.query(`UPDATE users SET role = $1 WHERE id = $2 RETURNING *`, [role, id]);
  return rows[0];
}

// Staff view: every order, with the customer's contact details attached so
// the team knows who to follow up with about payment/delivery.
export async function listAllOrdersWithCustomers() {
  const { rows } = await pool.query(`
    SELECT o.*, u.name AS "customerName", u.email AS "customerEmail", u.phone AS "customerPhone"
    FROM orders o LEFT JOIN users u ON u.id = o."userId"
    ORDER BY o."createdAt" DESC
  `);
  return rows;
}

// Marks an order as paid and stamps the first timeline stage ("Payment
// confirmed") with the moment staff verified the money arrived.
export async function confirmOrderPayment(id, stageTimes) {
  const { rows } = await pool.query(
    `UPDATE orders SET paid = true, "stageTimes" = $1, "updatedAt" = now() WHERE id = $2 RETURNING *`,
    [stageTimes, id]
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




