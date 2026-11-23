import { z } from "zod";
export const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: z.enum(["customer", "staff"]),
});
export type User = z.infer<typeof userSchema>;
export const meSchema = z.object({ user: userSchema.nullable() });
export const csrfSchema = z.object({ csrfToken: z.string() });
export const loginResponseSchema = z.object({
  user: userSchema,
  csrfToken: z.string(),
  redirectTo: z.string(),
});
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
// Empty by default so nginx and the Vite proxy can serve the API on the UI origin.
const apiBase = (import.meta.env?.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

export async function api<T>(
  path: string,
  schema: z.ZodType<T>,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, { ...options, credentials: "same-origin" });
  } catch {
    throw new ApiError("ارتباط با سرور برقرار نشد؛ اتصال خود را بررسی کنید", 0);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = z.object({ message: z.string() }).safeParse(body);
    throw new ApiError(
      error.success ? error.data.message : "خطا در دریافت اطلاعات از سرور",
      response.status,
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ApiError("پاسخ سرور معتبر نیست؛ دوباره تلاش کنید", 0);
  return parsed.data;
}
export function postOptions(body: unknown, csrfToken: string): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify(body),
  };
}
