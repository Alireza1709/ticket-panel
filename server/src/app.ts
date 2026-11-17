import express from "express";
import helmet from "helmet";
import { pool } from "./db.js";
export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "100kb" }));
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "سرور فعال است" });
});
app.get("/api/health/db", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", message: "پایگاه داده در دسترس است" });
  } catch {
    res
      .status(503)
      .json({ status: "error", message: "پایگاه داده در دسترس نیست" });
  }
});
app.use((_req, res) => {
  res.status(404).json({ message: "مسیر یافت نشد" });
});
const errorHandler: express.ErrorRequestHandler = (
  _error: unknown,
  _req,
  res,
  _next,
) => {
  res.status(400).json({ message: "درخواست نامعتبر است" });
};
app.use(errorHandler);
