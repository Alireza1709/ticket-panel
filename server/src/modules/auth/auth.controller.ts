import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { Request, Response } from "express";
import { findActiveLogin, type PublicUser } from "../../models/user.model.js";
import { cookieOptions, currentUser, sessionCookieName } from "./auth.middleware.js";
import { loginSchema, logoutSchema } from "./auth.validator.js";

const dummyHash = await argon2.hash(randomBytes(32), { type: argon2.argon2id });
const token = () => randomBytes(32).toString("hex");

export function getCsrf(req: Request, res: Response) {
  req.session.csrfToken ??= token();
  res.json({ csrfToken: req.session.csrfToken });
}

export async function getMe(req: Request, res: Response) {
  res.json({ user: await currentUser(req) });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "ایمیل و گذرواژه معتبر وارد کنید" });
    return;
  }
  const account = await findActiveLogin(parsed.data.email);
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
}

export async function logout(req: Request, res: Response) {
  if (!logoutSchema.safeParse(req.body).success) {
    res.status(400).json({ message: "درخواست نامعتبر است" });
    return;
  }
  await new Promise<void>((resolve, reject) =>
    req.session.destroy((error) => (error ? reject(error) : resolve())),
  );
  res.clearCookie(sessionCookieName, cookieOptions);
  res.json({ message: "از حساب خارج شدید" });
}

export function customerOverview(_req: Request, res: Response) {
  res.json({ user: res.locals.user, message: "به بخش تیکت‌های خود خوش آمدید" });
}

export function staffOverview(_req: Request, res: Response) {
  res.json({ user: res.locals.user, message: "به صندوق پشتیبانی خوش آمدید" });
}
