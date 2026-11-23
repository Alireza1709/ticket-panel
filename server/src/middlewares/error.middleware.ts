import type { ErrorRequestHandler, RequestHandler } from "express";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "مسیر یافت نشد" });
};
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof Error && "type" in error && error.type === "entity.too.large") {
    res.status(413).json({ message: "حجم درخواست بیش از حد مجاز است" });
    return;
  }
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
