import { Router, type Express } from "express";
import rateLimit from "express-rate-limit";
import {
  customerOverview,
  getCsrf,
  getMe,
  login,
  logout,
  registerCustomer,
  staffOverview,
} from "./auth.controller.js";
import { csrfProtection, requireRole } from "./auth.middleware.js";

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    message: "تلاش‌های ورود بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید",
  },
});
const registrationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "کمی بعد دوباره برای ثبت‌نام تلاش کنید" },
});

export const authRouter = Router();
authRouter.get("/csrf", getCsrf);
authRouter.get("/me", getMe);
authRouter.post("/register", registrationLimit, csrfProtection, registerCustomer);
authRouter.post("/login", loginLimit, csrfProtection, login);
authRouter.post("/logout", csrfProtection, logout);

export function registerOverviewRoutes(app: Express) {
  app.get("/api/customer/overview", requireRole("customer"), customerOverview);
  app.get("/api/staff/overview", requireRole("staff"), staffOverview);
}
