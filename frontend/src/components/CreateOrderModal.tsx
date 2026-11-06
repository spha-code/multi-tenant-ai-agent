import { useState } from "react";
import { Link } from "react-router-dom";
import { Customer, NewOrderSchema, Order, OrderSchema, OrderStatus, ORDER_STATUSES } from "../api/types";
import { api } from "../api/client";
import { Modal } from "./States";
import { apiListError } from "../hooks/useOrders";

export function CreateOrderModal({
  customers,
  accent,
  onCreated,
}: {
  customers: Customer[];
  accent?: string;
  onCreated: (o: Order) => void;
}) {
  const [openGuard, setOpenGuard] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<OrderStatus>("open");
  const [customerEmail, setCustomerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openForm = () => {
    setFormError(null);
    setStatus("open");
    setAmount("");
    setTitle("");
    // Pre-select when obvious — one less step for the user.
    setCustomerEmail(customers.length === 1 ? customers[0].email : "");
    setOpen(true);
  };

  const submit = async () => {
    setFormError(null);

    // Client-side basics; the server stays authoritative for real validation.
    const parsed = NewOrderSchema.safeParse({
      title: title.trim(),
      amount: Number(amount),
      status,
      customer_email: customerEmail,
    });

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      if (first.path.includes("customer_email")) {
        setFormError("Pick a customer.");
      } else if (first.path.includes("title")) {
        setFormError("Give the order a title.");
      } else {
        setFormError("Amount must be a positive number.");
      }
      return;
    }

    setSubmitting(true);
    try {
      const raw = await api<unknown>("/orders", { method: "POST", body: parsed.data });
      const order = OrderSchema.parse(raw);
      onCreated(order);
      setOpen(false);
    } catch (err: unknown) {
      setFormError(apiListError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const btnStyle = accent ? { background: accent } : undefined;
  const sortedCustomers = [...customers].sort((a, b) => a.name.localeCompare(b.name));

  const button = (
    <button
      className="btn btn-primary"
      style={btnStyle}
      onClick={() => {
        if (customers.length === 0) setOpenGuard(true);
        else openForm();
      }}
    >
      + New order
    </button>
  );

  return (
    <>
      {button}
      {openGuard && (
        <Modal
          open={openGuard}
          title="You need a customer first"
          subtitle="Orders are always placed against a customer in your organization."
          onClose={() => setOpenGuard(false)}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <div className="modal-sub">
              Add a customer on the Customers page, then come back here to place
              their first order.
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setOpenGuard(false)}>
                Got it
              </button>
              <Link className="btn btn-primary" style={btnStyle} to="/customers">
                Go to Customers
              </Link>
            </div>
          </div>
        </Modal>
      )}

      {open && (
        <Modal
          open={open}
          title="New order"
          subtitle="Placed in your organization automatically — tenants are never chosen by the user."
          onClose={() => setOpen(false)}
        >
          <div className="field">
            <label htmlFor="order-title">Title</label>
            <input
              id="order-title"
              value={title}
              placeholder="e.g. Precision valve set"
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="order-customer">Customer</label>
            <select
              id="order-customer"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            >
              <option value="" disabled>
                Select a customer…
              </option>
              {sortedCustomers.map((c) => (
                <option key={c.id} value={c.email}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="order-status">Status</label>
            <select
              id="order-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="order-amount">Amount (USD)</label>
            <input
              id="order-amount"
              value={amount}
              inputMode="decimal"
              placeholder="e.g. 2450.75"
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
          </div>

          {formError && <div className="form-error">{formError}</div>}

          <div className="modal-actions">
            <button className="btn btn-ghost" disabled={submitting} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              style={btnStyle}
              disabled={submitting}
              onClick={() => void submit()}
            >
              {submitting ? "Creating…" : "Create order"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
