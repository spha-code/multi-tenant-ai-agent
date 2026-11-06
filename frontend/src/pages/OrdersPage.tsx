import { ReactNode } from "react";
import { Loading, EmptyState, ErrorBanner } from "../components/States";
import { useOrders } from "../hooks/useOrders";
import { useTenant } from "../hooks/useTenant";
import { CreateOrderModal } from "../components/CreateOrderModal";

const fmtDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const fmtMoney = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });

export default function OrdersPage() {
  const { orders, customers, error, reload, setOrders } = useOrders();
  const tenant = useTenant().tenant;

  if (error) {
    return (
      <div className="page">
        <OrdersHeader count={null} />
        <ErrorBanner message={error} onRetry={reload} />
      </div>
    );
  }

  if (orders === null || customers === null) {
    return (
      <div className="page">
        <OrdersHeader count={null} />
        <div className="card">
          <Loading label={customers === null ? "Loading customers…" : "Loading orders…"} />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <OrdersHeader
        count={orders.length}
        actions={
          <CreateOrderModal
            customers={customers}
            accent={tenant?.theme_color}
            onCreated={(o) => setOrders((prev) => [o, ...(prev ?? [])])}
          />
        }
      />
      <div className="card table-card">
        {orders.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="No orders yet"
            hint={
              customers.length > 0
                ? "Create your first order — pick one of your customers and an item."
                : "You have no customers yet, so there is nothing to order against. Add a customer first."
            }
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Status</th>
                <th className="cell-amount">Amount</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="cell-strong">{o.title}</td>
                  <td>
                    <div className="cell-strong">{o.customer_name}</div>
                    <div className="cell-muted" style={{ fontSize: 12.5 }}>
                      {o.customer_email}
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${o.status}`}>{o.status}</span>
                  </td>
                  <td className="cell-amount cell-strong">{fmtMoney.format(o.amount)}</td>
                  <td className="cell-muted">{fmtDate.format(new Date(o.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function OrdersHeader({ count, actions }: { count: number | null; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">Orders</h1>
        <div className="page-sub">
          {count === null ? "Everything this company has ordered" : `${count} order${count === 1 ? "" : "s"}`}
        </div>
      </div>
      {actions}
    </div>
  );
}
