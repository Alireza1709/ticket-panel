import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

const statusSchema = z.enum([
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
export const filtersSchema = z
  .object({
    page: pageNumber(1000000).default(1),
    page_size: pageNumber(100).default(20),
    status: statusSchema.optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    q: z.string().trim().max(100).default(""),
    from: timestamp.optional(),
    to: timestamp.optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.from || !value.to || Date.parse(value.from) < Date.parse(value.to),
  );
export const replySchema = z
  .object({ body: z.string().trim().min(1).max(10000) })
  .strict();
export const statusBody = z.object({ status: statusSchema }).strict();
export const assignmentBody = z.object({ assigned_to: z.uuid() }).strict();
export type InboxFilters = z.output<typeof filtersSchema>;
const idSchema = z.uuid();

export function validateTicketId(
  _req: Request,
  res: Response,
  next: NextFunction,
  id: string,
) {
  if (!idSchema.safeParse(id).success) {
    res.status(400).json({ message: "شناسه تیکت معتبر نیست" });
    return;
  }
  next();
}
