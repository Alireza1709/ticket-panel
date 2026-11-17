import { useQuery } from "@tanstack/react-query";
import { Headphones, RefreshCw } from "lucide-react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";
import { z } from "zod";
import { Button } from "@/components/ui/button";
const healthSchema = z.object({ status: z.literal("ok") });
export function App() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await fetch("/api/health");
      if (!response.ok) throw new Error("ارتباط با سرور برقرار نشد");
      return healthSchema.parse(await response.json());
    },
  });
  return (
    <main dir="rtl" className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-8 flex items-center gap-3">
        <Headphones className="text-primary" size={32} />
        <h1 className="text-3xl font-bold">سامانه پشتیبانی</h1>
      </header>
      <section className="space-y-6 rounded-xl border border-border bg-white p-6">
        <h2 className="text-xl font-semibold">راه‌اندازی اولیه</h2>
        <p>
          زیرساخت سامانه آماده است. امکانات تیکت در مراحل بعد اضافه می‌شوند.
        </p>
        <div role="status" aria-live="polite">
          {health.isPending
            ? "در حال بررسی ارتباط با سرور…"
            : health.isError
              ? "خطا در ارتباط با سرور. دوباره تلاش کنید."
              : health.data
                ? "ارتباط با سرور برقرار است."
                : "اطلاعاتی موجود نیست."}
        </div>
        <Button
          onClick={() => {
            void health.refetch();
          }}
          disabled={health.isFetching}
        >
          <RefreshCw size={16} />
          بررسی دوباره
        </Button>
        <div className="space-y-2">
          <label htmlFor="sample-date" className="block">
            انتخاب تاریخ شمسی
          </label>
          <DatePicker
            id="sample-date"
            calendar={persian}
            locale={persianFa}
            calendarPosition="bottom-right"
            inputClass="rounded-md border border-border px-3 py-2"
            placeholder="انتخاب تاریخ"
          />
        </div>
        <p className="text-sm">
          تاریخ امروز:{" "}
          {new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
            dateStyle: "long",
          }).format(new Date())}
        </p>
      </section>
    </main>
  );
}
