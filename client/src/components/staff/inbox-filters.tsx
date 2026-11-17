import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { JalaliPicker } from "@/components/ui/jalali-picker";
import { inputClass } from "@/components/customer/shared";
import {
  priorities,
  statuses,
  prioritySchema,
  statusSchema,
} from "@/lib/tickets";
import { dayBoundary, pickerDate, type InboxFilters } from "@/lib/staff-inbox";

const schema = z
  .object({
    q: z.string().trim().max(100, "جست‌وجو نباید بیشتر از صد نویسه باشد"),
    status: statusSchema.or(z.literal("")),
    priority: prioritySchema.or(z.literal("")),
    page_size: z
      .string()
      .regex(/^[1-9]\d*$/, "اندازه صفحه معتبر نیست")
      .refine(
        (value) => Number(value) <= 100,
        "حداکثر اندازه صفحه صد مورد است",
      ),
    from: z.string(),
    to: z.string(),
  })
  .refine(
    (value) =>
      !value.from || !value.to || Date.parse(value.from) < Date.parse(value.to),
    { path: ["to"], message: "تاریخ پایان نباید قبل از تاریخ شروع باشد" },
  );
type Values = z.infer<typeof schema>;
export function InboxFilterForm({
  filters,
  apply,
  clear,
}: {
  filters: InboxFilters;
  apply: (filters: InboxFilters) => void;
  clear: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      q: filters.q,
      status: filters.status,
      priority: filters.priority,
      page_size: String(filters.page_size),
      from: filters.from,
      to: filters.to,
    },
  });
  const from = watch("from"),
    to = watch("to");
  const fromDate = useMemo(() => pickerDate(from), [from]);
  const toDate = useMemo(() => pickerDate(to, true), [to]);
  const sizes = [10, 20, 50, 100];
  if (!sizes.includes(filters.page_size)) sizes.push(filters.page_size);
  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) =>
        apply({
          ...filters,
          ...values,
          page_size: Number(values.page_size),
          page: 1,
        }),
      )}
      className="space-y-4 rounded-xl bg-slate-50 p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm" htmlFor="staff-search">
            جست‌وجوی شماره یا موضوع
          </label>
          <input
            id="staff-search"
            defaultValue={filters.q}
            maxLength={100}
            {...register("q")}
            className={inputClass}
          />
          {errors.q && (
            <p role="alert" className="text-sm text-red-700">
              {errors.q.message}
            </p>
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm" htmlFor="staff-status">
            وضعیت
          </label>
          <select
            id="staff-status"
            defaultValue={filters.status}
            {...register("status")}
            className={inputClass}
          >
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm" htmlFor="staff-priority">
            اولویت
          </label>
          <select
            id="staff-priority"
            defaultValue={filters.priority}
            {...register("priority")}
            className={inputClass}
          >
            <option value="">همه اولویت‌ها</option>
            {Object.entries(priorities).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm" htmlFor="staff-from">
            تاریخ ثبت از
          </label>
          <JalaliPicker
            id="staff-from"
            value={fromDate}
            editable={false}
            onChange={(date) =>
              setValue("from", date?.isValid ? dayBoundary(date) : "", {
                shouldValidate: true,
              })
            }
            inputClass={inputClass}
            placeholder="از تاریخ"
          />
          {from && (
            <button
              type="button"
              className="mt-1 text-xs text-primary underline"
              onClick={() => setValue("from", "", { shouldValidate: true })}
            >
              پاک‌کردن تاریخ شروع
            </button>
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm" htmlFor="staff-to">
            تاریخ ثبت تا
          </label>
          <JalaliPicker
            id="staff-to"
            value={toDate}
            editable={false}
            onChange={(date) =>
              setValue("to", date?.isValid ? dayBoundary(date, true) : "", {
                shouldValidate: true,
              })
            }
            inputClass={inputClass}
            placeholder="تا تاریخ"
          />
          {to && (
            <button
              type="button"
              className="mt-1 text-xs text-primary underline"
              onClick={() => setValue("to", "", { shouldValidate: true })}
            >
              پاک‌کردن تاریخ پایان
            </button>
          )}
          {errors.to && (
            <p role="alert" className="text-sm text-red-700">
              {errors.to.message}
            </p>
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm" htmlFor="staff-page-size">
            تعداد در صفحه
          </label>
          <select
            id="staff-page-size"
            defaultValue={filters.page_size}
            {...register("page_size")}
            className={inputClass}
          >
            {[...sizes]
              .sort((a, b) => a - b)
              .map((size) => (
                <option key={size} value={size}>
                  {size.toLocaleString("fa-IR")}
                </option>
              ))}
          </select>
          {errors.page_size && (
            <p role="alert" className="text-red-700">
              {errors.page_size.message}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit">اعمال فیلترها</Button>
        <Button type="button" variant="outline" onClick={clear}>
          پاک‌کردن فیلترها
        </Button>
      </div>
    </form>
  );
}
