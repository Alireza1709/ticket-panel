import { randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool } from "./db.js";
import { config } from "./config.js";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: "customer" | "staff";
}
interface LoginUser extends PublicUser {
  password_hash: string;
}
export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();
const dummyHash = await argon2.hash(randomBytes(32), { type: argon2.argon2id });
const token = () => randomBytes(32).toString("hex");
const cookieName = "tickets.sid";
export const sessionCookieName = cookieName;
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.APP_ORIGIN.startsWith("https://"),
  path: "/",
};
export const authRouter = Router();

export async function currentUser(req: Request): Promise<PublicUser | null> {
  if (!req.session.userId) return null;
  const result = await pool.query<PublicUser>(
    "SELECT id, name, email, role FROM users WHERE id = $1 AND NOT is_cancelled",
    [req.session.userId],
  );
  return result.rows[0] ?? null;
}
export function requireRole(role: PublicUser["role"]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await currentUser(req);
    if (!user) {
      res.status(401).json({ message: "برای ادامه وارد حساب خود شوید" });
      return;
    }
    if (user.role !== role) {
      res.status(403).json({ message: "اجازه دسترسی به این بخش را ندارید" });
      return;
    }
    res.locals.user = user;
    next();
  };
}
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const supplied = req.get("X-CSRF-Token");
  const expected = req.session.csrfToken;
  const origin = req.get("Origin");
  if (
    (origin && origin !== config.APP_ORIGIN) ||
    !supplied ||
    !expected ||
    !/^[a-f0-9]{64}$/.test(supplied) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  ) {
    res
      .status(403)
      .json({ message: "درخواست معتبر نیست؛ صفحه را تازه‌سازی کنید" });
    return;
  }
  next();
}
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
authRouter.get("/csrf", (req, res) => {
  req.session.csrfToken ??= token();
  res.json({ csrfToken: req.session.csrfToken });
});
authRouter.get("/me", async (req, res) => {
  res.json({ user: await currentUser(req) });
});
authRouter.post("/login", loginLimit, csrfProtection, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "ایمیل و گذرواژه معتبر وارد کنید" });
    return;
  }
  const result = await pool.query<LoginUser>(
    "SELECT id, name, email, role, password_hash FROM users WHERE email = $1 AND NOT is_cancelled",
    [parsed.data.email],
  );
  const account = result.rows[0];
  const verified = await argon2.verify(
    account?.password_hash ?? dummyHash,
    parsed.data.password,
  );
  if (!account || !verified) {
    res.status(401).json({ message: "ایمیل یا گذرواژه نادرست است" });
    return;
  }
  const user: PublicUser = {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
  };
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
  req.session.userId = user.id;
  req.session.csrfToken = token();
  await new Promise<void>((resolve, reject) =>
    req.session.save((error) => (error ? reject(error) : resolve())),
  );
  res.json({
    user,
    csrfToken: req.session.csrfToken,
    redirectTo: user.role === "staff" ? "/staff/inbox" : "/customer/tickets",
  });
});
authRouter.post("/logout", csrfProtection, async (req, res) => {
  if (!z.object({}).strict().safeParse(req.body).success) {
    res.status(400).json({ message: "درخواست نامعتبر است" });
    return;
  }
  await new Promise<void>((resolve, reject) =>
    req.session.destroy((error) => (error ? reject(error) : resolve())),
  );
  res.clearCookie(cookieName, cookieOptions);
  res.json({ message: "از حساب خارج شدید" });
});
