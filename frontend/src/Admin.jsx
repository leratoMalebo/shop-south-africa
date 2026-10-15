import React, { useState, useEffect, useCallback } from "react";
import { adminListOrders, adminConfirmPayment, adminAdvanceOrder, adminListStoreRequests } from "./api.js";

function money(n) {
  return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) + " " +
    d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}
// wa.me wants digits only, with country code and no leading +.
function whatsappLink(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

const FILTERS = [
  { key: "awaiting", label: "Awaiting payment" },
  { key: "active", label: "In progress" },
  { key: "done", label: "Delivered" },
  { key: "all", label: "All" },
];

export default function AdminScreen() {
  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("awaiting");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [o, r] = await Promise.all([adminListOrders(), adminListStoreRequests()]);
      setOrders(o);
      setRequests(r);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(order, fn, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(order.id);
    try {
      const updated = await fn(order.id);
      setOrders(prev => prev.map(o => (o.id === order.id ? { ...updated, customer: o.customer } : o)));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const lastStage = (o) => o.stageIndex >= o.stages.length - 1;
  const visible = orders.filter(o => {
    if (filter === "awaiting") return !o.paid;
    if (filter === "active") return o.paid && !lastStage(o);
    if (filter === "done") return o.paid && lastStage(o);
    return true;
  });
  const awaitingCount = orders.filter(o => !o.paid).length;

  return (
    <div className="admin-wrap">
      <div className="admin-head">
        <div>
          <h2 className="admin-title">Orders</h2>
          <p className="admin-sub">Confirm payments as the money arrives, then move each shipment along.</p>
        </div>
        <button className="logout-btn" onClick={() => { setLoading(true); load(); }}>Refresh</button>
      </div>

      <div className="admin-filters">
        {FILTERS.map(f => (
          <button key={f.key} className={"chip" + (filter === f.key ? " sel" : "")} onClick={() => setFilter(f.key)}>
            {f.label}{f.key === "awaiting" && awaitingCount > 0 ? ` (${awaitingCount})` : ""}
          </button>
        ))}
      </div>

      {error && <div className="error-note">{error}</div>}
      {loading && <p className="sidebar-empty">Loading…</p>}
      {!loading && visible.length === 0 && !error && <p className="sidebar-empty">Nothing here.</p>}

      {visible.map(o => {
        const wa = whatsappLink(o.customer?.phone);
        return (
          <div key={o.id} className="admin-order">
            <div className="admin-order-top">
              <div>
                <div className="admin-ref">{o.reference}</div>
                <div className="admin-meta">{fmt(o.createdAt)} · {o.paymentMethod}</div>
              </div>
              <div className="admin-total">P {money(o.totalBwp)}</div>
            </div>

            <div className="admin-customer">
              <strong>{o.customer?.name || "Unclaimed (placed before accounts)"}</strong>
              {o.customer?.phone && <span> · <a href={`tel:${o.customer.phone}`}>{o.customer.phone}</a></span>}
              {wa && <span> · <a href={wa} target="_blank" rel="noreferrer">WhatsApp</a></span>}
              {o.customer?.email && <span> · {o.customer.email}</span>}
            </div>

            <div className="track-items">
              {o.items.map((it, i) => (
                <div key={i} className="track-item-row">
                  <span className="track-item-name">
                    {it.productLink ? <a href={it.productLink} target="_blank" rel="noreferrer">{it.productName}</a> : it.productName}
                  </span>
                  <span className="track-item-retailer">{it.retailer} · {it.parcelSize} · R {money(it.price)}</span>
                </div>
              ))}
            </div>

            <div className="admin-actions">
              {!o.paid ? (
                <>
                  <span className="pill pill-warn">Awaiting payment</span>
                  <button
                    className="go-btn small"
                    disabled={busyId === o.id}
                    onClick={() => act(o, adminConfirmPayment, `Confirm you've received P ${money(o.totalBwp)} for ${o.reference}?`)}
                  >
                    Confirm payment received
                  </button>
                </>
              ) : (
                <>
                  <span className={"pill " + (lastStage(o) ? "pill-ok" : "pill-info")}>{o.stages[o.stageIndex]}</span>
                  {!lastStage(o) && (
                    <button
                      className="go-btn small secondary"
                      disabled={busyId === o.id}
                      onClick={() => act(o, adminAdvanceOrder)}
                    >
                      Move to: {o.stages[o.stageIndex + 1]}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}

      {requests.length > 0 && (
        <div className="admin-requests">
          <h3 className="card-heading">Store requests ({requests.length})</h3>
          {requests.map(r => (
            <div key={r.id} className="track-item-row">
              <span className="track-item-name">{r.storeName}{r.note ? ` — ${r.note}` : ""}</span>
              <span className="track-item-retailer">{fmt(r.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



