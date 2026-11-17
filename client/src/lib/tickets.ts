import { z } from "zod";
export const priorities = {
  low: "کم",
  normal: "عادی",
  high: "زیاد",
  urgent: "فوری",
} as const;
export const statuses = {
  new: "جدید",
  in_progress: "در حال بررسی",
  waiting_customer: "در انتظار مشتری",
  resolved: "حل‌شده",
  closed: "بسته",
} as const;
export const categories = {
  technical: "فنی",
  billing: "مالی",
  account: "حساب کاربری",
  other: "سایر",
} as const;
export const statusSchema = z.enum([
  "new",
  "in_progress",
  "waiting_customer",
  "resolved",
  "closed",
]);
export const prioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export const categorySchema = z.enum([
  "technical",
  "billing",
  "account",
  "other",
]);
export const createTicketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, "عنوان باید حداقل سه نویسه داشته باشد")
    .max(200, "عنوان نباید بیشتر از دویست نویسه باشد"),
  description: z
    .string()
    .trim()
    .min(1, "توضیحات را وارد کنید")
    .max(10000, "توضیحات نباید بیشتر از ده هزار نویسه باشد"),
  priority: prioritySchema,
  category: categorySchema,
});
export type CreateTicketValues = z.infer<typeof createTicketSchema>;
export const replySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "متن پاسخ را وارد کنید")
    .max(10000, "پاسخ نباید بیشتر از ده هزار نویسه باشد"),
});
export type ReplyValues = z.infer<typeof replySchema>;
export const ticketSchema = z.object({
  id: z.uuid(),
  ticket_number: z.string(),
  subject: z.string(),
  priority: prioritySchema,
  status: statusSchema,
  category: categorySchema,
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
export const listSchema = z.object({ tickets: z.array(ticketSchema) });
export const detailSchema = z.object({
  ticket: ticketSchema.extend({
    description: z.string(),
    customer_name: z.string(),
    assigned_to: z.uuid().nullable(),
    assignee_name: z.string().nullable(),
  }),
  messages: z.array(
    z.object({
      id: z.uuid(),
      body: z.string(),
      created_at: z.iso.datetime(),
      author_name: z.string(),
      author_role: z.enum(["customer", "staff"]).nullable(),
    }),
  ),
  history: z.array(
    z.object({
      id: z.uuid(),
      from_status: statusSchema.nullable(),
      to_status: statusSchema,
      created_at: z.iso.datetime(),
      author_name: z.string(),
    }),
  ),
});
export type Detail = z.infer<typeof detailSchema>;
export const createdSchema = z.object({
  ticket: z.object({ id: z.uuid(), ticket_number: z.string() }),
  message: z.string(),
});
export const successSchema = z.object({ message: z.string() });
const dateFormat = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tehran",
});
export function jalali(value: string): string {
  return dateFormat.format(new Date(value));
}
export function canCancel(status: z.infer<typeof statusSchema>): boolean {
  return ["new", "in_progress", "waiting_customer"].includes(status);
}
