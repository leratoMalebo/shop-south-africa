import React, { useState, useEffect, useCallback } from "react";
import { getQuote, createOrder, listOrders, requestStore, getMe, logout } from "./api.js";
import AuthScreen from "./Auth.jsx";
import AdminScreen from "./Admin.jsx";

const RETAILERS = ["Takealot", "Makro", "SHEIN", "Game", "Superbalist", "Bash", "Builders", "Incredible Connection", "Akhona Furniture", "Other"];
const SIZES = [
  { key: "Small", label: "<5kg" },
  { key: "Medium", label: "5–15kg" },
  { key: "Large", label: "15–30kg" },
];
// Payments are manual for now: the customer sends the money using their order
// reference and our team confirms it. Card payments need a payment-gateway
// account first, so that option is shown but switched off.
const PAY_METHODS = [
  { key: "Bank transfer (EFT)", icon: "EFT", sub: "Send a transfer — confirmed once we receive it" },
  { key: "Orange Money Botswana", icon: "OM", sub: "Send via Orange Money — confirmed once we receive it" },
  { key: "Mascom MyZaka", icon: "MZ", sub: "Send via MyZaka — confirmed once we receive it" },
  { key: "Visa / Mastercard", icon: "V/M", sub: "Coming soon", disabled: true },
];
const STAGES = [
  "Payment confirmed",
  "Purchased from retailer(s)",
  "Received at Johannesburg warehouse",
  "Consolidated and in transit to Botswana",
  "Customs clearance",
  "Delivered / ready for collection",
];
const STEPS = [
  { key: "s1", label: "Start" },
  { key: "s2", label: "Cost" },
  { key: "s3", label: "Pay" },
  { key: "s4", label: "Track" },
];

const emptyDraft = { link: "", retailer: "Takealot", customStore: "", name: "", price: "", size: "Small" };

function money(n) {
  return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtTime(iso) {
  if (!iso) return "Pending";
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" }) +
    " · " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}
function itemRetailer(item) { return item.retailer; }

// Gatekeeper: checks for an existing session on load, shows the login/signup
// screen if there isn't one, and renders the real app (ShopApp) once there
// is. Also owns the PWA "install" prompt, since it lives in the header
// regardless of which screen inside the app is showing.
export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [installEvent, setInstallEvent] = useState(null);

  useEffect(() => {
    getMe().then(setUser).catch(() => {}).finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault();
      setInstallEvent(e);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  async function handleLogout() {
    await logout().catch(() => {});
    setUser(null);
  }

  if (!authChecked) return null; // avoid a login-screen flash while checking for a session
  if (!user) return <AuthScreen onAuthed={setUser} />;

  return (
    <ShopApp
      user={user}
      onLogout={handleLogout}
      installEvent={installEvent}
      onInstall={() => { installEvent?.prompt(); setInstallEvent(null); }}
    />
  );
}

function ShopApp({ user, onLogout, installEvent, onInstall }) {
  const [screen, setScreen] = useState("s1");
  const [draft, setDraft] = useState(emptyDraft);
  const [cart, setCart] = useState([]);
  const [cartError, setCartError] = useState("");
  const [insurance, setInsurance] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(PAY_METHODS.find(m => !m.disabled).key);
  const [orders, setOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [placing, setPlacing] = useState(false);

  const [storeFormOpen, setStoreFormOpen] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeNote, setStoreNote] = useState("");
  const [storeStatus, setStoreStatus] = useState("idle"); // idle | sending | sent | error
  const [storeErrorMsg, setStoreErrorMsg] = useState("");

  const refreshOrders = useCallback(() => {
    listOrders().then(setOrders).catch((err) => {
      if (err.message.includes("log in")) onLogout(); // session expired/cookie cleared elsewhere
    });
  }, [onLogout]);
  useEffect(() => { refreshOrders(); }, [refreshOrders]);
  // Staff update orders from their own device, so re-fetch whenever the
  // customer opens Track (and keep it fresh while they sit on it).
  useEffect(() => {
    if (screen !== "s4") return;
    refreshOrders();
    const t = setInterval(refreshOrders, 30000);
    return () => clearInterval(t);
  }, [screen, refreshOrders]);

  function addItemToCart() {
    const price = parseFloat(draft.price);
    const retailer = draft.retailer === "Other" ? draft.customStore.trim() : draft.retailer;

    if (!draft.name.trim() || !price || price <= 0) {
      setCartError("Enter a product name and a price greater than zero.");
      return;
    }
    if (draft.retailer === "Other" && !retailer) {
      setCartError("Tell us which store this item is from.");
      return;
    }
    setCartError("");

    setCart(prev => [...prev, {
      localId: crypto.randomUUID(),
      productLink: draft.link.trim() || null,
      retailer,
      productName: draft.name.trim(),
      price,
      parcelSize: draft.size,
    }]);

    // If someone shops from a store we don't officially support yet, log it
    // as demand automatically — same signal as the standalone request form.
    if (draft.retailer === "Other" && retailer) {
      requestStore({ storeName: retailer, note: "Auto-logged: used as 'Other' at checkout" }).catch(() => {});
    }

    setDraft({ ...emptyDraft, retailer: draft.retailer === "Other" ? "Takealot" : draft.retailer });
  }

  function removeItem(localId) {
    setCart(prev => prev.filter(i => i.localId !== localId));
  }

  async function handleGetQuote() {
    if (cart.length === 0) {
      setCartError("Add at least one item to your cart first.");
      return;
    }
    setQuoteError("");
    try {
      const q = await getQuote({ items: cart.map(stripLocal), insurance });
      setQuote(q);
      setScreen("s2");
    } catch (err) {
      setQuoteError(err.message);
    }
  }

  async function refreshQuoteWithInsurance(nextInsurance) {
    try {
      const q = await getQuote({ items: cart.map(stripLocal), insurance: nextInsurance });
      setQuote(q);
    } catch { /* ignore */ }
  }

  async function handlePlaceOrder() {
    setPlacing(true);
    try {
      const order = await createOrder({
        items: cart.map(stripLocal),
        insurance,
        paymentMethod,
      });
      setOrders(prev => [order, ...prev]);
      setActiveOrderId(order.id);
      setScreen("s4");
      setCart([]);
      setDraft(emptyDraft);
      setInsurance(false);
      setQuote(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setPlacing(false);
    }
  }

  async function handleSubmitStoreRequest() {
    if (!storeName.trim()) {
      setStoreErrorMsg("Enter the name of the store.");
      return;
    }
    setStoreStatus("sending");
    setStoreErrorMsg("");
    try {
      await requestStore({ storeName: storeName.trim(), note: storeNote.trim() || null });
      setStoreStatus("sent");
      setStoreName("");
      setStoreNote("");
    } catch (err) {
      setStoreStatus("error");
      setStoreErrorMsg(err.message);
    }
  }

  function stripLocal(item) {
    const { localId, ...rest } = item;
    return rest;
  }

  const activeOrder = orders.find(o => o.id === activeOrderId) || orders[0];
  const cartTotal = cart.reduce((sum, i) => sum + i.price, 0);

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
            {(user.role === "staff" ? [...STEPS, { key: "s5", label: "Admin" }] : STEPS).map(s => (
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
          <div className="topbar-account">
            {installEvent && (
              <button className="install-btn" onClick={onInstall}>Install app</button>
            )}
            <span className="topbar-username">{user.name.split(" ")[0]}</span>
            <button className="logout-btn" onClick={onLogout}>Log out</button>
          </div>
        </div>
      </header>

      <main className="main">
        <IosInstallHint />
        {screen === "s1" && (
          <div className="hero-grid">
            <div className="hero-panel">
              <h2>Shop South Africa, delivered home to Botswana.</h2>
              <p>Add items from one store or several — we'll consolidate them into a single shipment and a single payment, and work out everything it costs to land it at your door.</p>
              <div className="hero-note">
                <strong>Note on product links:</strong> pasting a link doesn't auto-fill details yet — most SA retailer sites (including Takealot) build their pages with JavaScript, so the price isn't readable from the page source. Enter the details manually below for now; this is a known next step.
              </div>
              <div className="hero-note">
                <strong>Shopping from multiple stores?</strong> Add each item below with "Add to cart," then get one combined quote — items shipped together save on transport.
              </div>
            </div>

            <div className="form-card">
              <h3 className="card-heading">Add an item</h3>
              <div className="field">
                <label>Product link</label>
                <input value={draft.link} onChange={e => setDraft({ ...draft, link: e.target.value })} placeholder="Paste product link here (for reference)" />
              </div>
              <div className="field">
                <label>Retailer</label>
                <div className="retailer-row">
                  {RETAILERS.map(r => (
                    <div key={r} className={"chip" + (draft.retailer === r ? " sel" : "")} onClick={() => setDraft({ ...draft, retailer: r })}>{r}</div>
                  ))}
                </div>
                {draft.retailer === "Other" && (
                  <input
                    className="inline-followup"
                    value={draft.customStore}
                    onChange={e => setDraft({ ...draft, customStore: e.target.value })}
                    placeholder="Which store? e.g. Woolworths"
                  />
                )}
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Product name</label>
                  <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Dyson V8 Cordless Vacuum" />
                </div>
                <div className="field">
                  <label>Product price (ZAR)</label>
                  <input type="number" min="0" step="0.01" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} placeholder="e.g. 5499" />
                </div>
              </div>
              <div className="field">
                <label>Parcel size</label>
                <div className="size-row">
                  {SIZES.map(s => (
                    <div key={s.key} className={"chip size-chip" + (draft.size === s.key ? " sel" : "")} onClick={() => setDraft({ ...draft, size: s.key })}>
                      {s.key}<small>{s.label}</small>
                    </div>
                  ))}
                </div>
              </div>
              <button className="go-btn secondary" onClick={addItemToCart}>+ Add to cart</button>
              {cartError && <div className="error-note">{cartError}</div>}

              {cart.length > 0 && (
                <div className="cart-list">
                  <div className="cart-list-head">Your cart ({cart.length} item{cart.length > 1 ? "s" : ""})</div>
                  {cart.map(item => (
                    <div key={item.localId} className="cart-item">
                      <div>
                        <div className="cart-item-name">{item.productName}</div>
                        <div className="cart-item-meta">{item.retailer} · {item.parcelSize} · R {money(item.price)}</div>
                      </div>
                      <button className="cart-remove" onClick={() => removeItem(item.localId)} aria-label="Remove item">×</button>
                    </div>
                  ))}
                  {cart.length >= 2 && (
                    <div className="cart-savings-hint">Shipping these {cart.length} items together saves on transport versus separate orders.</div>
                  )}
                </div>
              )}

              <button className="go-btn" onClick={handleGetQuote} disabled={cart.length === 0}>
                Get landed cost {cart.length > 0 ? `for ${cart.length} item${cart.length > 1 ? "s" : ""}` : ""}
              </button>
              {quoteError && <div className="error-note">{quoteError}</div>}

              <div className="store-request-box">
                {!storeFormOpen ? (
                  <span className="back-link" onClick={() => setStoreFormOpen(true)}>Don't see your store? Request it →</span>
                ) : (
                  <div>
                    <label>Which store would you like to shop from?</label>
                    <input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="e.g. Woolworths" />
                    <input value={storeNote} onChange={e => setStoreNote(e.target.value)} placeholder="Anything else? (optional)" style={{ marginTop: 8 }} />
                    <div className="store-request-actions">
                      <button className="go-btn secondary small" disabled={storeStatus === "sending"} onClick={handleSubmitStoreRequest}>
                        {storeStatus === "sending" ? "Sending…" : "Submit request"}
                      </button>
                      <span className="back-link" onClick={() => { setStoreFormOpen(false); setStoreStatus("idle"); }}>Cancel</span>
                    </div>
                    {storeStatus === "sent" && <div className="success-note">Thanks — we've logged {`"${storeName || "your"}"`} as a request.</div>}
                    {storeStatus === "error" && <div className="error-note">{storeErrorMsg}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {screen === "s2" && quote && (
          <div className="checkout-grid">
            <div className="main-card">
              <h3 className="card-heading">Items in this shipment</h3>
              {cart.map(item => (
                <div key={item.localId} className="product-card">
                  <div className="product-thumb">{item.productName.charAt(0).toUpperCase()}</div>
                  <div>
                    <p className="product-name">{item.productName}</p>
                    <p className="product-meta">{item.retailer} · {item.parcelSize} parcel · R {money(item.price)}</p>
                  </div>
                </div>
              ))}

              <h3 className="card-heading" style={{ marginTop: 8 }}>Landed cost to Gaborone</h3>
              <div className="line-item"><span className="label">Items total ({quote.itemCount})</span><span className="val">R {money(quote.totalPrice)}</span></div>
              <div className="line-item"><span className="label">Shopping service fee (5%, min R150)</span><span className="val">R {money(quote.serviceFee)}</span></div>
              <div className="line-item">
                <span className="label">Cross-border transport{quote.consolidationDiscountPct > 0 ? ` (${quote.consolidationDiscountPct}% consolidation discount)` : ""}</span>
                <span className="val">
                  {quote.transportSavings > 0 && <span className="strike">R {money(quote.rawTransportFee)}</span>}
                  {" "}R {money(quote.transportFee)}
                </span>
              </div>
              <div className="line-item"><span className="label">Estimated customs duty (15%)</span><span className="val">R {money(quote.customsDuty)}</span></div>
              {insurance && (
                <div className="line-item"><span className="label">Shipment insurance (1%)</span><span className="val">R {money(quote.insuranceFee)}</span></div>
              )}
              {quote.transportSavings > 0 && (
                <div className="savings-badge">You're saving R {money(quote.transportSavings)} on transport by shipping {quote.itemCount} items together.</div>
              )}
              <div className="insurance-toggle" onClick={async () => {
                const next = !insurance;
                setInsurance(next);
                await refreshQuoteWithInsurance(next);
              }}>
                <span>Add shipment insurance</span>
                <div className={"switch" + (insurance ? " on" : "")} />
              </div>
              <div><span className="back-link" onClick={() => setScreen("s1")}>← Edit cart</span></div>
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
                  <div
                    key={m.key}
                    className={"pay-method" + (paymentMethod === m.key ? " sel" : "") + (m.disabled ? " disabled" : "")}
                    onClick={() => !m.disabled && setPaymentMethod(m.key)}
                  >
                    <div className="pay-icon">{m.icon}</div>
                    <div><div className="pay-name">{m.key}</div><div className="pay-sub">{m.sub}</div></div>
                    <div className="radio" />
                  </div>
                ))}
              </div>
              <p className="secure-note">After you place your order you'll see exactly how to pay, with your order reference. We only buy your items once we've confirmed your payment.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Total due today ({quote.itemCount} item{quote.itemCount > 1 ? "s" : ""})</span>
              <div className="summary-total">P {money(quote.totalBwp)}</div>
              <button className="pay-btn" disabled={placing} onClick={handlePlaceOrder}>
                {placing ? "Placing order…" : `Place order · P ${money(quote.totalBwp)}`}
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
                    <div className="order-list-name">
                      {o.items[0]?.productName}{o.items.length > 1 ? ` & ${o.items.length - 1} more` : ""}
                    </div>
                    <div className="order-list-stage">{o.paid ? STAGES[o.stageIndex] : "Awaiting payment"}</div>
                  </div>
                ))
              )}
            </aside>
            <div className="main-card">
              {!activeOrder ? (
                <div className="empty-state">No orders yet.<br />Place an order to see it tracked here.</div>
              ) : (
                <>
                  <div className="track-head">
                    <div className="order-id">Order {activeOrder.reference} · {activeOrder.paymentMethod}</div>
                    <h3>{activeOrder.items.length > 1 ? `${activeOrder.items.length} items in this shipment` : activeOrder.items[0]?.productName}</h3>
                  </div>
                  {activeOrder.items.length > 1 && (
                    <div className="track-items">
                      {activeOrder.items.map((it, i) => (
                        <div key={i} className="track-item-row">
                          <span className="track-item-name">{it.productName}</span>
                          <span className="track-item-retailer">{it.retailer}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!activeOrder.paid && (
                    <div className="pay-pending">
                      <div className="pay-pending-title">Awaiting your payment</div>
                      <div className="pay-pending-amount">P {money(activeOrder.totalBwp)}</div>
                      <div className="pay-pending-row"><span>Pay with</span><strong>{activeOrder.paymentMethod}</strong></div>
                      <div className="pay-pending-row"><span>Use this reference</span><strong className="pay-ref">{activeOrder.reference}</strong></div>
                      <div className="pay-pending-details">{activeOrder.paymentInstructions}</div>
                      <p className="pay-pending-note">We start buying your items as soon as we confirm your payment. This page updates automatically — or message us on WhatsApp with your reference and proof of payment to speed things up.</p>
                    </div>
                  )}
                  <div className="route-line">
                    {STAGES.map((stage, i) => {
                      const cls = !activeOrder.paid ? "" : i < activeOrder.stageIndex ? "done" : i === activeOrder.stageIndex ? "current" : "";
                      return (
                        <div key={stage} className={"stage " + cls}>
                          <div className="dot" />
                          <div className="stage-title">{stage}</div>
                          <div className="stage-time">{fmtTime(activeOrder.stageTimes[i])}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {screen === "s5" && user.role === "staff" && <AdminScreen />}
      </main>
    </div>
  );
}


// iPhone Safari never fires the install prompt Android does, so point people to
// the manual route (Share → Add to Home Screen). Hidden once installed or dismissed.
function IosInstallHint() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installed = window.navigator.standalone === true;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem("shopsa_ios_hint") === "1"; } catch { return false; }
  });
  if (!isIos || installed || dismissed) return null;
  return (
    <div className="ios-hint">
      <span>Install this app: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</span>
      <button onClick={() => { try { localStorage.setItem("shopsa_ios_hint", "1"); } catch { /* ignore */ } setDismissed(true); }} aria-label="Dismiss">×</button>
    </div>
  );
}



