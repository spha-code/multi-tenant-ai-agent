import { z } from "zod";

/**
 * Response shapes are validated with Zod so a backend/front contract drift
 * fails loudly and early instead of rendering `undefined.name`.
 * `.catch()` keeps the UI resilient to nullable/absent optional fields.
 */

export const MeSchema = z.object({
  user_id: z.string(),
  email: z.string().nullish().catch(null),
  tenant: z.string(),
});
export type Me = z.infer<typeof MeSchema>;

export const TenantSchema = z.object({
  id: z.string(),
  legal_name: z.string().nullish().catch(null),
  display_name: z.string().nullish().catch(null),
  tagline: z.string().nullish().catch(null),
  theme_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/)
    .catch("#4f46e5"),
});
export type Tenant = z.infer<typeof TenantSchema>;

export const CustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  created_at: z.string(),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const ORDER_STATUSES = ["open", "paid", "shipped", "cancelled"] as const;

export const OrderSchema = z.object({
  id: z.string(),
  title: z.string(),
  amount: z.number(),
  status: z.enum(ORDER_STATUSES),
  created_at: z.string(),
  customer_name: z.string().nullish().catch(null),
  customer_email: z.string().nullish().catch(null),
});
export type Order = z.infer<typeof OrderSchema>;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const NewCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export const NewOrderSchema = z.object({
  title: z.string().min(1),
  amount: z.number(),
  status: z.enum(ORDER_STATUSES),
  customer_email: z.string().email(),
});
