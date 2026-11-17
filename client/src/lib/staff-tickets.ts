import { z } from "zod";
import { prioritySchema, statusSchema } from "./tickets";
export const inboxResponseSchema = z.object({
  tickets: z.array(
    z.object({
      id: z.uuid(),
      ticket_number: z.string(),
      subject: z.string(),
      customer_name: z.string(),
      status: statusSchema,
      priority: prioritySchema,
      assigned_to: z.uuid().nullable(),
      assignee_name: z.string().nullable(),
      updated_at: z.iso.datetime(),
    }),
  ),
  page: z.number().int(),
  page_size: z.number().int(),
  total: z.number().int(),
  total_pages: z.number().int(),
});
export const membersSchema = z.object({
  members: z.array(z.object({ id: z.uuid(), name: z.string() })),
});
type Status = z.infer<typeof statusSchema>;
export const allowedTransitions: Record<Status, readonly Status[]> = {
  new: ["in_progress"],
  in_progress: ["waiting_customer", "resolved"],
  waiting_customer: ["in_progress", "resolved"],
  resolved: ["in_progress", "closed"],
  closed: [],
};
