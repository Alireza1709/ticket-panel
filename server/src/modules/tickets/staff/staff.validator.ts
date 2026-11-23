import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

import { statusSchema } from "../ticket-filters.js";
export { filtersSchema, type InboxFilters, type Status } from "../ticket-filters.js";
export const replySchema = z
  .object({ body: z.string().trim().min(1).max(10000) })
  .strict();
export const statusBody = z.object({ status: statusSchema }).strict();
export const assignmentBody = z.object({ assigned_to: z.uuid() }).strict();
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
