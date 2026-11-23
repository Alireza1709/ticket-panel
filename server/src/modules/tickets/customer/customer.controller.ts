import type { Request, Response } from "express";
import {
  listTickets,
  createTicket,
  getTicket,
  replyToTicket,
  cancelTicket,
} from "../../../models/customer-ticket.model.js";
import { cancelSchema, createSchema, idSchema, replySchema } from "./customer.validator.js";
import { customerFilters } from "../ticket-filters.js";
import { listFilteredTickets } from "../../../models/ticket-list.model.js";

function ticketId(req: Request, res: Response): string | null {
  const result = idSchema.safeParse(req.params.id);
  if (!result.success) {
    res.status(400).json({ message: "شناسه تیکت معتبر نیست" });
    return null;
  }
  return result.data;
}
function notFound(res: Response) {
  // Identical response for another owner's, cancelled and nonexistent tickets.
  res.status(404).json({ message: "تیکت یافت نشد یا در دسترس شما نیست" });
}

export async function list(req: Request, res: Response) {
  // The legacy list ignored customer_id. Keep ignoring it and always use the session owner.
  const { customer_id: _ignoredOwner, ...query } = req.query;
  const filters = customerFilters.safeParse(query);
  if (!filters.success) {
    res.status(400).json({ message: "فیلترهای تیکت معتبر نیستند" });
    return;
  }
  const userId = req.session.userId!;
  if (Object.keys(query).length === 0) {
    res.json({ tickets: await listTickets(userId) });
    return;
  }
  const result = await listFilteredTickets(filters.data, userId);
  res.json({
    ...result,
    tickets: result.tickets.map(({ assigned_to, assignee_name, customer_name, ...ticket }) => ticket),
  });
}

export async function create(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ message: "عنوان، توضیحات، اولویت و دسته‌بندی معتبر وارد کنید" });
    return;
  }
  const ticket = await createTicket(req.session.userId!, parsed.data);
  res.status(201).json({ ticket, message: "تیکت با موفقیت ثبت شد" });
}

export async function detail(req: Request, res: Response) {
  const id = ticketId(req, res);
  if (!id) return;
  const result = await getTicket(id, req.session.userId!);
  if (!result) {
    notFound(res);
    return;
  }
  res.json(result);
}

export async function reply(req: Request, res: Response) {
  const id = ticketId(req, res);
  if (!id) return;
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ message: "متن پاسخ باید بین یک تا ده هزار نویسه باشد" });
    return;
  }
  const result = await replyToTicket(id, req.session.userId!, parsed.data.body);
  if (!result) {
    notFound(res);
    return;
  }
  res.status(201).json({ message: "پاسخ شما با موفقیت ثبت شد" });
}

export async function cancel(req: Request, res: Response) {
  const id = ticketId(req, res);
  if (!id) return;
  if (!cancelSchema.safeParse(req.body).success) {
    res.status(400).json({ message: "درخواست نامعتبر است" });
    return;
  }
  const result = await cancelTicket(id, req.session.userId!);
  if (!result) {
    notFound(res);
    return;
  }
  if (result === "conflict") {
    res.status(409).json({ message: "فقط تیکت‌های باز قابل لغو هستند" });
    return;
  }
  res.json({ message: "تیکت با موفقیت لغو شد" });
}
