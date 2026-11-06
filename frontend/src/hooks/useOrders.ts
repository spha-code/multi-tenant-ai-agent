import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { Customer, CustomerSchema, Order, OrderSchema } from "../api/types";

export function useOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setError(null);
    setOrders(null);
    Promise.all([
      api<unknown[]>("/orders").then((rows) => rows.map((r) => OrderSchema.parse(r))),
      api<unknown[]>("/customers").then((rows) => rows.map((r) => CustomerSchema.parse(r))),
    ])
      .then(([o, c]) => {
        if (alive) {
          setOrders(o);
          setCustomers(c);
        }
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Failed to load orders");
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  return { orders, customers, error, reload, setOrders };
}

/** Parse the API's list rows defensively; used by the customers page too. */
export function apiListError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : "Something went wrong";
}
