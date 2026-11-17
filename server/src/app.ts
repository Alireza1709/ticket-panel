import express from "express";
import helmet from "helmet";
import session from "express-session";
import { pool } from "./db.js";
import { config } from "./config.js";
import { PostgresSessionStore } from "./session-store.js";
import { customerTickets } from "./customer-tickets.js";
import { staffRouter } from "./staff-tickets.js";
import {
  authRouter,
  cookieOptions,
  requireRole,
  sessionCookieName,
} from "./auth.js";
export const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    strictTransportSecurity: config.APP_ORIGIN.startsWith("https://")
      ? undefined
      : false,
    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests: config.APP_ORIGIN.startsWith("https://")
          ? []
          : null,
      },
    },
  }),
);
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
// Only the local reverse proxy is trusted; remote clients cannot choose their IP.
app.set("trust proxy", "loopback");
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(
  "/api",
  session({
    name: sessionCookieName,
    secret: config.SESSION_SECRET,
    store: new PostgresSessionStore(),
    resave: false,
    saveUninitialized: false,
    cookie: { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 },
  }),
);
app.use("/api/auth", authRouter);
app.use("/api/customer/tickets", customerTickets);
app.use("/api/staff", staffRouter);
app.get("/api/customer/overview", requireRole("customer"), (_req, res) => {
  res.json({ user: res.locals.user, message: "به بخش تیکت‌های خود خوش آمدید" });
});
app.get("/api/staff/overview", requireRole("staff"), (_req, res) => {
  res.json({ user: res.locals.user, message: "به صندوق پشتیبانی خوش آمدید" });
});
app.use((_req, res) => {
  res.status(404).json({ message: "مسیر یافت نشد" });
});
const errorHandler: express.ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400
  ) {
    res.status(400).json({ message: "درخواست نامعتبر است" });
    return;
  }
  res.status(500).json({ message: "خطایی در سرور رخ داد؛ دوباره تلاش کنید" });
};
app.use(errorHandler);
