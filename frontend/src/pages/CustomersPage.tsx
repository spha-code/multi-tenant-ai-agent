import { ReactNode, useCallback, useEffect, useState } from "react";
import { Customer, CustomerSchema, NewCustomerSchema } from "../api/types";
import { api } from "../api/client";
import { Modal, Loading, EmptyState, ErrorBanner } from "../components/States";
import { apiListError } from "../hooks/useOrders";
import { useTenant } from "../hooks/useTenant";

const fmtDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export default function CustomersPage() {
  const tenant = useTenant().tenant;
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setError(null);
    setCustomers(null);
    api<unknown[]>("/customers")
      .then((rows) => rows.map((r) => CustomerSchema.parse(r)))
      .then((list) => {
        if (alive) setCustomers(list);
      })
      .catch((err: unknown) => {
        if (alive) setError(apiListError(err));
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  return (
    <div className="page">
      <CustomersHeader
        count={customers ? customers.length : null}
        actions={
          <AddCustomerModal
            accent={tenant?.theme_color}
            onAdded={(c) => setCustomers((prev) => [...(prev ?? []), c])}
          />
        }
      />
      {error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <div className="card table-card">
          {customers === null ? (
            <Loading label="Loading customers…" />
          ) : customers.length === 0 ? (
            <EmptyState
              icon="👥"
              title="No customers yet"
              hint="Add the first customer for this organization — orders are placed against customers."
            />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {[...customers]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => (
                    <tr key={c.id}>
                      <td className="cell-strong">{c.name}</td>
                      <td className="cell-muted">{c.email}</td>
                      <td className="cell-muted">{fmtDate.format(new Date(c.created_at))}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function CustomersHeader({ count, actions }: { count: number | null; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">Customers</h1>
        <div className="page-sub">
          {count === null ? "People and companies you sell to" : `${count} customer${count === 1 ? "" : "s"}`}
        </div>
      </div>
      {actions}
    </div>
  );
}

function AddCustomerModal({
  accent,
  onAdded,
}: {
  accent?: string;
  onAdded: (c: Customer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setFormError(null);
    // basics; server stays authoritative (e.g. duplicate emails)
    const parsed = NewCustomerSchema.safeParse({ name: name.trim(), email: email.trim().toLowerCase() });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0].path.includes("email") ? "Enter a valid email address." : "Enter the customer's name.");
      return;
    }
    setSubmitting(true);
    try {
      const raw = await api<unknown>("/customers", { method: "POST", body: parsed.data });
      onAdded(CustomerSchema.parse(raw));
      setOpen(false);
      setName("");
      setEmail("");
    } catch (err: unknown) {
      setFormError(apiListError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const btnStyle = accent ? { background: accent } : undefined;

  return (
    <>
      <button className="btn btn-primary" style={btnStyle} onClick={() => { setFormError(null); setOpen(true); }}>
        + Add customer
      </button>
      {open && (
        <Modal
          open={open}
          title="Add customer"
          subtitle="Created inside your organization automatically."
          onClose={() => setOpen(false)}
        >
          <div className="field">
            <label htmlFor="customer-name">Name</label>
            <input
              id="customer-name"
              value={name}
              placeholder="e.g. Alice Harrison"
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="customer-email">Email</label>
            <input
              id="customer-email"
              value={email}
              placeholder="e.g. alice@company.com"
              onChange={(e) => setEmail(e.target.value)}
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
            <button className="btn btn-primary" style={btnStyle} disabled={submitting} onClick={() => void submit()}>
              {submitting ? "Adding…" : "Add customer"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
