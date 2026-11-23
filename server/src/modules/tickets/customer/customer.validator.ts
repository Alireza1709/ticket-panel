import { z } from "zod";

export const createSchema = z
  .object({
    subject: z.string().trim().min(3).max(200),
    description: z.string().trim().min(1).max(10000),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    category: z.enum(["technical", "billing", "account", "other"]),
  })
  .strict();
export const replySchema = z
  .object({ body: z.string().trim().min(1).max(10000) })
  .strict();
export const idSchema = z.uuid();
export type NewTicket = z.output<typeof createSchema>;
export const cancelSchema = z.object({}).strict();
