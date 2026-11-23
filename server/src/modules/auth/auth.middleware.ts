import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { config } from "../../config.js";
import { findActiveUser, type PublicUser } from "../../models/user.model.js";

export const sessionCookieName = "tickets.sid";
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.APP_ORIGIN.startsWith("https://"),
  path: "/",
};

export async function currentUser(req: Request) {
  return req.session.userId ? findActiveUser(req.session.userId) : null;
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
