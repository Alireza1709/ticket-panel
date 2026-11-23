import type { Request, Response } from "express";
import {
  listTickets,
  getTicket,
  replyToTicket,
  updateTicketStatus,
  assignTicket,
} from "../../../models/staff-ticket.model.js";
import { listActiveStaff } from "../../../models/user.model.js";
import { assignmentBody, filtersSchema, replySchema, statusBody } from "./staff.validator.js";

function missing(res: Response) {
  res.status(404).json({ message: "تیکت یافت نشد یا لغو شده است" });
}

export async function members(_req: Request, res: Response) {
  res.json({ members: await listActiveStaff() });
}

export async function list(req: Request, res: Response) {
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "صفحه، فیلترها یا بازه زمانی معتبر نیست" });
    return;
  }
  const result = await listTickets(parsed.data);
  res.json(result);
}

export async function detail(req: Request<{ id: string }>, res: Response) {
  const result = await getTicket(req.params.id);
  if (!result) {
    missing(res);
    return;
  }
  res.json(result);
}

export async function reply(req: Request<{ id: string }>, res: Response) {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ message: "متن پاسخ باید بین یک تا ده هزار نویسه باشد" });
    return;
  }
  const result = await replyToTicket(
    req.params.id,
    req.session.userId!,
    parsed.data.body,
  );
  if (!result) {
    missing(res);
    return;
  }
  res.status(201).json({ message: "پاسخ پشتیبانی ثبت شد" });
}

export async function changeStatus(req: Request<{ id: string }>, res: Response) {
  const parsed = statusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "وضعیت معتبر انتخاب کنید" });
    return;
  }
  const result = await updateTicketStatus(
    req.params.id,
    req.session.userId!,
    parsed.data.status,
  );
  if (!result) {
    missing(res);
    return;
  }
  if (result === "conflict") {
    res.status(409).json({
      message: "این تغییر وضعیت مجاز نیست؛ اطلاعات تیکت را تازه‌سازی کنید",
    });
    return;
  }
  res.json({ message: "وضعیت تیکت به‌روزرسانی شد" });
}

export async function assign(req: Request<{ id: string }>, res: Response) {
  const parsed = assignmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "کارشناس معتبر انتخاب کنید" });
    return;
  }
  const result = await assignTicket(req.params.id, parsed.data.assigned_to);
  if (!result) {
    missing(res);
    return;
  }
  if (result === "invalid_assignee") {
    res.status(400).json({
      message: "کارشناس انتخاب‌شده فعال نیست یا نقش پشتیبانی ندارد",
    });
    return;
  }
  res.json({ message: "کارشناس تیکت ثبت شد" });
}
