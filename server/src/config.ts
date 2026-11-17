import "dotenv/config";
import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  SESSION_SECRET: z
    .string()
    .min(48)
    .refine((value) => !value.startsWith("REPLACE_")),
  APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) =>
      ["postgres:", "postgresql:"].includes(new URL(value).protocol),
    ),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("تنظیمات محیطی نامعتبر است؛ فایل نمونه را بررسی کنید.");
  process.exit(1);
}
if (
  parsed.data.NODE_ENV === "production" &&
  !parsed.data.APP_ORIGIN.startsWith("https://")
) {
  console.error("در محیط عملیاتی نشانی امن سامانه الزامی است.");
  process.exit(1);
}
export const config = parsed.data;
