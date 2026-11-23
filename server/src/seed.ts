import argon2 from "argon2";
import { config } from "./config.js";
import { pool } from "./db.js";

// Fixed identities keep demo seeding repeatable. Passwords are supplied privately.
const accounts = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "سارا احمدی",
    email: "sara@example.test",
    role: "customer",
    passwordVariable: "DEMO_SARA_PASSWORD",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "علی رضایی",
    email: "ali@example.test",
    role: "customer",
    passwordVariable: "DEMO_ALI_PASSWORD",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "مریم کریمی",
    email: "maryam@example.test",
    role: "staff",
    passwordVariable: "DEMO_MARYAM_PASSWORD",
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    name: "رضا محمدی",
    email: "reza@example.test",
    role: "staff",
    passwordVariable: "DEMO_REZA_PASSWORD",
  },
] as const;
const subjects = [
  "عدم دریافت ایمیل تأیید",
  "خطا در پرداخت اشتراک",
  "درخواست تغییر شماره تماس",
  "کندی بارگذاری گزارش‌ها",
  "بازیابی دسترسی حساب",
  "مغایرت مبلغ فاکتور",
  "راهنمای اتصال سامانه",
  "مشکل دانلود پیوست",
  "تمدید اشتراک سازمانی",
  "خطای ثبت درخواست",
  "تغییر اطلاعات شرکت",
  "درخواست نسخه پشتیبان",
  "نمایش نادرست تاریخ",
  "قطع اعلان‌های پیامکی",
  "راهنمای تنظیم دسترسی",
  "پیگیری برگشت وجه",
  "خطا در ورود با مرورگر",
  "درخواست آموزش گزارش‌گیری",
  "مشکل جست‌وجوی سفارش",
  "به‌روزرسانی نشانی صورتحساب",
];
const statuses = [
  "new",
  "in_progress",
  "waiting_customer",
  "resolved",
  "closed",
] as const;
const priorities = ["low", "normal", "high", "urgent"] as const;

async function seed() {
  if (config.NODE_ENV === "production")
    throw new Error("Demo seed disabled in production");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(71002002)");
    const creator = accounts[2].id;
    for (const account of accounts) {
      const password = process.env[account.passwordVariable];
      if (!password || password.length < 16)
        throw new Error(`Set ${account.passwordVariable} to a demo password of at least 16 characters`);
      const hash = await argon2.hash(password, {
        type: argon2.argon2id,
      });
      await client.query(
        `INSERT INTO users (id, created_by, name, email, role, password_hash)
        VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [account.id, creator, account.name, account.email, account.role, hash],
      );
    }
    for (const [index, subject] of subjects.entries()) {
      const suffix = String(index + 1).padStart(12, "0");
      const id = `20000000-0000-4000-8000-${suffix}`;
      const customer = accounts[index % 2 === 0 ? 0 : 1];
      const staff = accounts[index % 2 === 0 ? 2 : 3];
      const status = statuses[index % statuses.length]!;
      const date = new Date(Date.UTC(2026, 10, 1 + index));
      await client.query(
        `INSERT INTO tickets (id, created_at, created_by, customer_id, assigned_to, subject, description, status, priority)
        VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [
          id,
          date,
          customer.id,
          status === "new" ? null : staff.id,
          subject,
          `سلام، درباره «${subject}» به راهنمایی نیاز دارم. لطفاً درخواست من را بررسی کنید و مراحل پیگیری را اطلاع دهید.`,
          status,
          priorities[index % priorities.length],
        ],
      );
      await client.query(
        `INSERT INTO ticket_messages (id, created_at, created_by, ticket_id, body)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [
          `30000000-0000-4000-8000-${suffix}`,
          date,
          customer.id,
          id,
          `سلام، ${subject} برای حساب من رخ داده است. لطفاً راهنمایی کنید.`,
        ],
      );
      await client.query(
        `INSERT INTO status_history (id, created_at, created_by, ticket_id, from_status, to_status)
        VALUES ($1,$2,$3,$4,NULL,'new') ON CONFLICT (id) DO NOTHING`,
        [`50000000-0000-4000-8000-${suffix}`, date, customer.id, id],
      );
      if (status !== "new") {
        const later = new Date(date.getTime() + 3600000);
        const replies = {
          in_progress: "درخواست شما دریافت شد و در حال بررسی است.",
          waiting_customer: "لطفاً تصویر خطا و زمان وقوع آن را ارسال کنید.",
          resolved: "مشکل بررسی و رفع شد. لطفاً نتیجه را تأیید کنید.",
          closed: "با تأیید شما پیگیری تکمیل و درخواست بسته شد.",
        };
        await client.query(
          `INSERT INTO ticket_messages (id, created_at, created_by, ticket_id, body)
          VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
          [
            `40000000-0000-4000-8000-${suffix}`,
            later,
            staff.id,
            id,
            replies[status],
          ],
        );
        await client.query(
          `INSERT INTO status_history (id, created_at, created_by, ticket_id, from_status, to_status)
          VALUES ($1,$2,$3,$4,'new',$5) ON CONFLICT (id) DO NOTHING`,
          [`60000000-0000-4000-8000-${suffix}`, later, staff.id, id, status],
        );
      }
    }
    await client.query("COMMIT");
    console.log(
      "Demo seed ready: 2 customers, 2 staff, 20 tickets. Existing records preserved.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
try {
  await seed();
} catch {
  console.error(
    "Seed failed; database details withheld. Apply migrations first and check account conflicts.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
