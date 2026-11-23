import { z } from "zod";

export const statusSchema = z.enum([
  "new",
  "in_progress",
  "waiting_customer",
  "resolved",
  "closed",
]);
export type Status = z.infer<typeof statusSchema>;
const pageNumber = (max: number) =>
  z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(max));
const timestamp = z.iso
  .datetime({ offset: true })
  .refine(
    (value) => !value.startsWith("0000-") && Number.isFinite(Date.parse(value)),
  );
const baseFilters = z
  .object({
    page: pageNumber(1000000).default(1),
    page_size: pageNumber(100).default(20),
    status: statusSchema.optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    q: z.string().trim().max(100).default(""),
    category: z.enum(["technical", "billing", "account", "other"]).optional(),
    updated_from: timestamp.optional(),
    updated_to: timestamp.optional(),
    from: timestamp.optional(),
    to: timestamp.optional(),
  })
  .strict();
const validRange = (from?: string, to?: string) =>
  !from || !to || Date.parse(from) < Date.parse(to);
const validDates = (value: z.output<typeof baseFilters>) =>
  validRange(value.from, value.to) && validRange(value.updated_from, value.updated_to);

export const customerFilters = baseFilters.refine(validDates);
export const filtersSchema = baseFilters.extend({
  assigned_to: z.uuid().or(z.literal("unassigned")).optional(),
}).refine(validDates);
export type InboxFilters = z.output<typeof filtersSchema>;
