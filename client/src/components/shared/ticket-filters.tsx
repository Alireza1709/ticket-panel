import { useEffect, useId, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, selectOptions } from "@/components/ui/select";
import { JalaliPicker } from "@/components/ui/jalali-picker";
import { TextInput, inputClass } from "@/components/ui/field";
import { categories, priorities, statuses } from "@/lib/tickets";
import { staffApi } from "@/lib/ticket-api";
import { dayBoundary, pickerDate, inboxSchema, type InboxFilters } from "@/lib/staff-inbox";

const dateFields = [
  { key: "from", label: "تاریخ ثبت از", end: false },
  { key: "to", label: "تاریخ ثبت تا", end: true },
  { key: "updated_from", label: "تاریخ به‌روزرسانی از", end: false },
  { key: "updated_to", label: "تاریخ به‌روزرسانی تا", end: true },
] as const;

export function TicketFilters({
  filters, apply, clear, staff = false, userId,
}: {
  filters: InboxFilters;
  apply: (filters: InboxFilters) => void;
  clear: () => void;
  staff?: boolean;
  userId: string;
}) {
  const id = useId();
  const { register, watch, setValue, handleSubmit, reset, setError, clearErrors, formState } =
    useForm<InboxFilters>({ defaultValues: filters });
  const members = useQuery({ queryKey: ["staff-members"], queryFn: staffApi.members, enabled: staff });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    setValue("q", filters.q);
    return () => clearTimeout(timer.current);
  }, [filters.q, filters.page, setValue]);
  const sizes = [...new Set([10, 20, 50, 100, filters.page_size])].sort((a, b) => a - b);
  const search = register("q");
  return (
    <form className="panel space-y-4 p-4 sm:p-5" onSubmit={handleSubmit((values) => {
      clearTimeout(timer.current);
      const result = inboxSchema.safeParse({ ...values, page: 1 });
      if (result.success) {
        clearErrors();
        apply(result.data);
      } else {
        setError("root", { message: "بازه تاریخ یا فیلتر واردشده معتبر نیست" });
      }
    })}>
      <div className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold">
        <SlidersHorizontal size={18} className="text-primary" aria-hidden="true" />
        فیلتر تیکت‌ها
      </div>
      <div className="grid gap-4 min-[360px]:grid-cols-2 xl:grid-cols-3">
        <div className="col-span-full xl:col-span-1">
          <label className="mb-2 block text-sm" htmlFor={`${id}-search`}>جست‌وجوی شماره یا موضوع</label>
          <div className="relative">
            <Search size={17} aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <TextInput id={`${id}-search`} type="search" defaultValue={filters.q} maxLength={100} className="ps-9"
              {...search} onChange={(event) => {
                void search.onChange(event);
                clearTimeout(timer.current);
                const q = event.target.value.trim();
                if (q !== filters.q) timer.current = setTimeout(() => apply({ ...filters, q, page: 1 }), 350);
              }} />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm" htmlFor={`${id}-status`}>وضعیت</label>
          <Select id={`${id}-status`} value={watch("status")} options={selectOptions({ "": "همه وضعیت‌ها", ...statuses })}
            onChange={(value) => setValue("status", value)} />
        </div>
        <div>
          <label className="mb-2 block text-sm" htmlFor={`${id}-priority`}>اولویت</label>
          <Select id={`${id}-priority`} value={watch("priority")} options={selectOptions({ "": "همه اولویت‌ها", ...priorities })}
            onChange={(value) => setValue("priority", value)} />
        </div>
        <div>
          <label className="mb-2 block text-sm" htmlFor={`${id}-category`}>دسته‌بندی</label>
          <Select id={`${id}-category`} value={watch("category")} options={selectOptions({ "": "همه دسته‌ها", ...categories })}
            onChange={(value) => setValue("category", value)} />
        </div>
        {staff && (
          <div>
            <label className="mb-2 block text-sm" htmlFor={`${id}-assignment`}>کارشناس</label>
            <Select id={`${id}-assignment`} value={watch("assigned_to")} searchable
              options={[
                { value: "", label: "همه کارشناسان" },
                { value: "unassigned", label: "بدون کارشناس" },
                { value: userId, label: "ارجاع‌شده به من" },
                ...(members.data?.members ?? []).filter((member) => member.id !== userId)
                  .map((member) => ({ value: member.id, label: member.name })),
              ]}
              onChange={(value) => setValue("assigned_to", value)} />
            {members.isError && <button type="button" className="text-sm text-primary underline"
              onClick={() => void members.refetch()}>تلاش دوباره برای دریافت کارشناسان</button>}
          </div>
        )}
      </div>
      <details className="rounded-lg bg-muted/50 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">بازه‌های تاریخ و تعداد در صفحه</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {dateFields.map(({ key, label, end }) => {
            const value = watch(key);
            return (
              <div key={key}>
                <div className="mb-2 flex flex-wrap justify-between gap-1">
                  <label className="text-sm" htmlFor={`${id}-${key}`}>{label}</label>
                  {value && <button type="button" className="text-xs text-primary underline"
                    aria-label={`پاک‌کردن ${label}`} onClick={() => setValue(key, "")}>پاک‌کردن</button>}
                </div>
                <JalaliPicker id={`${id}-${key}`} value={pickerDate(value, end)} editable={false}
                  onChange={(date) => setValue(key, date?.isValid ? dayBoundary(date, end) : "")}
                  inputClass={inputClass} placeholder={label} />
              </div>
            );
          })}
          <div>
            <label className="mb-2 block text-sm" htmlFor={`${id}-size`}>تعداد در صفحه</label>
            <Select id={`${id}-size`} value={String(watch("page_size"))}
              options={sizes.map((size) => ({ value: String(size), label: size.toLocaleString("fa-IR") }))}
              onChange={(value) => setValue("page_size", Number(value))} />
          </div>
        </div>
      </details>
      {formState.errors.root && <p role="alert" className="text-sm text-red-700">{formState.errors.root.message}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit">اعمال فیلترها</Button>
        <Button type="button" variant="outline" onClick={() => {
          clearTimeout(timer.current);
          reset(inboxSchema.parse({}));
          clear();
        }}>پاک‌کردن فیلترها</Button>
      </div>
    </form>
  );
}
