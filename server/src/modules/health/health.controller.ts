import type { Request, Response } from "express";
import { checkDatabase } from "../../models/health.model.js";

export function serverHealth(_req: Request, res: Response) {
  res.json({ status: "ok", message: "سرور فعال است" });
}

export async function databaseHealth(_req: Request, res: Response) {
  try {
    await checkDatabase();
    res.json({ status: "ok", message: "پایگاه داده در دسترس است" });
  } catch {
    res
      .status(503)
      .json({ status: "error", message: "پایگاه داده در دسترس نیست" });
  }
}

