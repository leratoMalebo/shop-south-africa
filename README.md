# Shop South Africa — Mok Transports

Full-stack scaffold for the "Shop South Africa" module: Botswana customers get a landed-cost quote, pay, and track an order from purchase through delivery.

This is a real, running codebase — not a mockup — but it stands in for a few things that need Phase 0 decisions first (see "What's not real yet" below).

## Stack

- **Frontend:** React + Vite (`/frontend`)
- **Backend:** Node.js (18+) + Express (`/backend`)
- **Database:** Postgres (via `pg`)

Postgres was chosen over the SQLite version used earlier in development because it's what Render (and most hosts) can actually persist reliably — a locally-written SQLite file doesn't survive redeploys or restarts on most platforms.

## Project structure

```
shop-south-africa/
├── backend/
│   ├── src/
│   │   ├── server.js       # Express app entry point
│   │   ├── calc.js         # Landed-cost calculation (shared logic)
│   │   ├── db.js           # SQLite access layer
│   │   └── routes/
│   │       ├── quote.js    # POST /api/quote — price a product before ordering
│   │       └── orders.js   # POST/GET orders, POST .../advance to move stages
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # The four-screen flow: Start → Cost → Pay → Track
│   │   ├── api.js          # Fetch wrapper for the backend API
│   │   └── styles.css      # Mok Transports brand tokens (blue #004AAD)
│   └── public/logo.png
└── README.md
```

## Running it locally

You'll need Node.js 18+ installed.

**1. Backend**
```bash
cd backend
cp .env.example .env
```
Edit `.env` and point `DATABASE_URL` at a local or hosted Postgres instance (Postgres.app, Docker, or a free Render/Supabase database all work). Then:
```bash
npm install
npm run dev
```
This starts the API on `http://localhost:4000` and creates the `orders` table automatically on first run.

**2. Frontend** (in a second terminal)
```bash
cd frontend
npm install
npm run dev
```
This starts the app on `http://localhost:5173`. It proxies `/api/*` requests to the backend, so both need to be running.

Open `http://localhost:5173` — paste a product link (or leave it, it's not parsed yet), fill in a name and price, and walk through the flow. Orders you create are saved in Postgres and will still be there if you restart the servers.

## Deploying (Render)

`render.yaml` in this repo describes the three pieces — a Postgres database, the backend web service, and the frontend static site — for reference. In practice, once this repo is on GitHub, these can be provisioned directly (Postgres database → backend web service, wired to it via `DATABASE_URL` → frontend static site, built with `VITE_API_BASE` pointing at the backend's Render URL). If setting up manually via the Render dashboard instead, follow the same order so each piece's URL/connection string is available to the next.

## API reference

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/quote` | Compute a landed-cost breakdown from `{ price, parcelSize, insurance }` — no order is created |
| `POST` | `/api/orders` | Create an order (treated as "payment confirmed" — see note below) |
| `GET` | `/api/orders` | List all orders, most recent first |
| `GET` | `/api/orders/:id` | Get one order |
| `POST` | `/api/orders/:id/advance` | Move an order to its next workflow stage |

Pricing logic (`backend/src/calc.js`):
- Service fee: 5% of product price, minimum R150
- Transport: flat rate by parcel size — Small R450 / Medium R650 / Large R950
- Customs duty: 15% of (price + transport), an estimate
- Insurance (optional): 1% of product price
- FX conversion: 1 ZAR = 0.62 BWP (placeholder — swap for a live rate feed)

These are the numbers from the Phase 1 design spec and are easy to tune in one place once real supplier/customs data is available.

## What's not real yet

This scaffold makes the *math and data flow* real. It does not yet include:

- **Live link-parsing** — product name/price are entered manually. Adding this means either scraping product pages or integrating each retailer's API, and checking each retailer's terms of service first (flagged in the Phase 1 design spec).
- **Real payments** — `POST /api/orders` currently marks an order as paid immediately on creation. In production, this endpoint should only be called from a payment gateway's success webhook (Visa/Mastercard), or after EFT/mobile money confirmation — not directly from the browser.
- **Staff/ops dashboard** — the "advance to next stage" button on the tracking screen is a placeholder for what should be a staff-only action inside the ops dashboard described in the design spec (Section 4), with authentication.
- **Customs, warehouse, and fleet integrations** — stage advancement is currently manual; real integrations would update stages automatically from customs and warehouse systems.

## Suggested next step

Wire up the Visa/Mastercard gateway first (most standardised of the four payment rails), having it call `POST /api/orders` from its webhook instead of directly from the frontend. That closes the loop on the one piece of Phase 2 most exposed to real money.
