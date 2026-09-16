import React, { useState, useEffect, useCallback } from "react";
import { getQuote, createOrder, listOrders, advanceOrder } from "./api.js";

const RETAILERS = ["Takealot", "Makro", "Builders", "Game", "Incredible Connection"];
const SIZES = [
  { key: "Small", label: "<5kg" },
  { key: "Medium", label: "5–15kg" },
  { key: "Large", label: "15–30kg" },
];
const PAY_METHODS = [
  { key: "Visa / Mastercard", icon: "V/M", sub: "Charged instantly" },
  { key: "Bank transfer (EFT)", icon: "EFT", sub: "Confirmed within 1 business day" },
  { key: "Orange Money Botswana", icon: "OM", sub: "Confirm on your phone" },
  { key: "Mascom MyZaka", icon: "MZ", sub: "Confirm on your phone" },
];
const STAGES = [
  "Payment confirmed",
  "Purchased from retailer",
  "Received at Johannesburg warehouse",
  "In transit to Botswana",
  "Customs clearance",
  "Delivered / ready for collection",
];
const STEPS = [
  { key: "s1", label: "Start" },
  { key: "s2", label: "Cost" },
  { key: "s3", label: "Pay" },
  { key: "s4", label: "Track" },
];

function money(n) {
  return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtTime(iso) {
  if (!iso) return "Pending";
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" }) +
    " · " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

export default function App() {
  const [screen, setScreen] = useState("s1");
  const [form, setForm] = useState({
    link: "", retailer: "Takealot", name: "", price: "", size: "Small", insurance: false,
  });
  const [quote, setQuote] = useState(null);
  const [formError, setFormError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(PAY_METHODS[0].key);
  const [orders, setOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [placing, setPlacing] = useState(false);

  const refreshOrders = useCallback(() => {
    listOrders().then(setOrders).catch(() => {});
  }, []);

  useEffect(() => { refreshOrders(); }, [refreshOrders]);

  async function handleGetQuote() {
    const price = parseFloat(form.price);
    if (!form.name.trim() || !price || price <= 0) {
      setFormError("Enter a product name and a price greater than zero.");
      return;
    }
    setFormError("");
    try {
      const q = await getQuote({ price, parcelSize: form.size, insurance: form.insurance });
      setQuote(q);
      setScreen("s2");
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function refreshQuote(nextForm) {
    const price = parseFloat(nextForm.price);
    if (!price || price <= 0) return;
    try {
      const q = await getQuote({ price, parcelSize: nextForm.size, insurance: nextForm.insurance });
      setQuote(q);
    } catch { /* ignore mid-edit */ }
  }

  async function handlePlaceOrder() {
    setPlacing(true);
    try {
      const order = await createOrder({
        productName: form.name,
        productLink: form.link || null,
        retailer: form.retailer,
        parcelSize: form.size,
        price: parseFloat(form.price),
        insurance: form.insurance,
        paymentMethod,
      });
      setOrders(prev => [order, ...prev]);
      setActiveOrderId(order.id);
      setScreen("s4");
      setForm({ link: "", retailer: "Takealot", name: "", price: "", size: "Small", insurance: false });
      setQuote(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setPlacing(false);
    }
  }

  async function handleAdvance(id) {
    const updated = await advanceOrder(id);
    setOrders(prev => prev.map(o => (o.id === id ? updated : o)));
  }

  const activeOrder = orders.find(o => o.id === activeOrderId) || orders[0];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <img src="/logo.png" alt="Mok Transports Services" className="topbar-logo" />
            <div className="topbar-title">
              <strong>Shop South Africa</strong>
              <span>Mok Transports</span>
            </div>
          </div>
          <nav className="step-nav">
            {STEPS.map(s => (
              <button
                key={s.key}
                className={"step-tab" + (screen === s.key ? " on" : "")}
                disabled={(s.key === "s2" || s.key === "s3") && !quote}
                onClick={() => ((s.key !== "s2" && s.key !== "s3") || quote) && setScreen(s.key)}
              >
                <span className="step-dot" />{s.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">
        {screen === "s1" && (
          <div className="hero-grid">
            <div className="hero-panel">
              <h2>Shop South Africa, delivered home to Botswana.</h2>
              <p>Tell us what you want to buy and we'll work out everything it costs to land it at your door — purchase, transport, customs, and delivery, in one payment.</p>
              <div className="hero-note">
                <strong>Note on product links:</strong> pasting a link doesn't auto-fill details yet — most SA retailer sites (including Takealot) build their pages with JavaScript, so the price isn't readable from the page source. Enter the details manually below for now; this is flagged as a known next step, not a bug.
              </div>
            </div>
            <div className="form-card">
              <h3 className="card-heading">Product details</h3>
              <div className="field">
                <label>Product link</label>
                <input value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="Paste product link here (for reference)" />
              </div>
              <div className="field">
                <label>Retailer</label>
                <div className="retailer-row">
                  {RETAILERS.map(r => (
                    <div key={r} className={"chip" + (form.retailer === r ? " sel" : "")} onClick={() => setForm({ ...form, retailer: r })}>{r}</div>
                  ))}
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Product name</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dyson V8 Cordless Vacuum" />
                </div>
                <div className="field">
                  <label>Product price (ZAR)</label>
                  <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="e.g. 5499" />
                </div>
              </div>
              <div className="field">
                <label>Parcel size</label>
                <div className="size-row">
                  {SIZES.map(s => (
                    <div key={s.key} className={"chip size-chip" + (form.size === s.key ? " sel" : "")} onClick={() => setForm({ ...form, size: s.key })}>
                      {s.key}<small>{s.label}</small>
                    </div>
                  ))}
                </div>
              </div>
              <button className="go-btn" onClick={handleGetQuote}>Get landed cost</button>
              {formError && <div className="error-note">{formError}</div>}
            </div>
          </div>
        )}

        {screen === "s2" && quote && (
          <div className="checkout-grid">
            <div className="main-card">
              <div className="product-card">
                <div className="product-thumb">{form.name.charAt(0).toUpperCase() || "?"}</div>
                <div>
                  <p className="product-name">{form.name}</p>
                  <p className="product-meta">{form.retailer} · {form.size} parcel</p>
                </div>
              </div>
              <h3 className="card-heading">Landed cost to Gaborone</h3>
              <div className="line-item"><span className="label">Product price</span><span className="val">R {money(quote.price)}</span></div>
              <div className="line-item"><span className="label">Shopping service fee (5%, min R150)</span><span className="val">R {money(quote.serviceFee)}</span></div>
              <div className="line-item"><span className="label">Cross-border transport</span><span className="val">R {money(quote.transportFee)}</span></div>
              <div className="line-item"><span className="label">Estimated customs duty (15%)</span><span className="val">R {money(quote.customsDuty)}</span></div>
              {form.insurance && (
                <div className="line-item"><span className="label">Shipment insurance (1%)</span><span className="val">R {money(quote.insuranceFee)}</span></div>
              )}
              <div className="insurance-toggle" onClick={async () => {
                const next = { ...form, insurance: !form.insurance };
                setForm(next);
                await refreshQuote(next);
              }}>
                <span>Add shipment insurance</span>
                <div className={"switch" + (form.insurance ? " on" : "")} />
              </div>
              <div><span className="back-link" onClick={() => setScreen("s1")}>← Edit product details</span></div>
            </div>
            <div className="summary-card">
              <span className="summary-label">Total, paid once</span>
              <div className="summary-total">P {money(quote.totalBwp)}</div>
              <div className="fx-note">≈ R {money(quote.totalZar)} · indicative FX rate: 1 ZAR = 0.62 BWP</div>
              <button className="continue-btn" onClick={() => setScreen("s3")}>Continue to payment</button>
            </div>
          </div>
        )}

        {screen === "s3" && quote && (
          <div className="checkout-grid">
            <div className="main-card">
              <h3 className="card-heading">Choose how to pay</h3>
              <div className="pay-methods">
                {PAY_METHODS.map(m => (
                  <div key={m.key} className={"pay-method" + (paymentMethod === m.key ? " sel" : "")} onClick={() => setPaymentMethod(m.key)}>
                    <div className="pay-icon">{m.icon}</div>
                    <div><div className="pay-name">{m.key}</div><div className="pay-sub">{m.sub}</div></div>
                    <div className="radio" />
                  </div>
                ))}
              </div>
              <p className="secure-note">Your order is only placed with the retailer once payment clears.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Total due today</span>
              <div className="summary-total">P {money(quote.totalBwp)}</div>
              <button className="pay-btn" disabled={placing} onClick={handlePlaceOrder}>
                {placing ? "Placing order…" : `Pay P ${money(quote.totalBwp)}`}
              </button>
            </div>
          </div>
        )}

        {screen === "s4" && (
          <div className="track-grid">
            <aside className="order-sidebar">
              <h3 className="card-heading">Orders</h3>
              {orders.length === 0 ? (
                <p className="sidebar-empty">No orders yet.</p>
              ) : (
                orders.map(o => (
                  <div key={o.id} className={"order-list-item" + (activeOrder?.id === o.id ? " sel" : "")} onClick={() => setActiveOrderId(o.id)}>
                    <div className="order-list-ref">{o.reference}</div>
                    <div className="order-list-name">{o.productName}</div>
                    <div className="order-list-stage">{STAGES[o.stageIndex]}</div>
                  </div>
                ))
              )}
            </aside>
            <div className="main-card">
              {!activeOrder ? (
                <div className="empty-state">No orders yet.<br />Complete a payment to see live tracking here.</div>
              ) : (
                <>
                  <div className="track-head">
                    <div className="order-id">Order {activeOrder.reference} · {activeOrder.paymentMethod}</div>
                    <h3>{activeOrder.productName}</h3>
                  </div>
                  <div className="route-line">
                    {STAGES.map((stage, i) => {
                      const cls = i < activeOrder.stageIndex ? "done" : i === activeOrder.stageIndex ? "current" : "";
                      return (
                        <div key={stage} className={"stage " + cls}>
                          <div className="dot" />
                          <div className="stage-title">{stage}</div>
                          <div className="stage-time">{fmtTime(activeOrder.stageTimes[i])}</div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="advance-btn"
                    disabled={activeOrder.stageIndex >= STAGES.length - 1}
                    onClick={() => handleAdvance(activeOrder.id)}
                  >
                    {activeOrder.stageIndex >= STAGES.length - 1 ? "Delivered — no further stages" : "Simulate: advance to next stage"}
                  </button>
                  <p className="ops-note">This button stands in for the ops dashboard updating shipment status.</p>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
