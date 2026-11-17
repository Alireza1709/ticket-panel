import DateObjectExport from "react-date-object";
import gregorian from "react-date-object/calendars/gregorian";
import gregorianEn from "react-date-object/locales/gregorian_en";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";
import { z } from "zod";
import { statusSchema, prioritySchema } from "./tickets";

export const CalendarDate =
  (DateObjectExport as unknown as { default?: typeof DateObjectExport })
    .default ?? DateObjectExport;
export type CalendarValue = InstanceType<typeof DateObjectExport>;
const localDay = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function dateParts(instant: number) {
  const parts = localDay.formatToParts(new Date(instant));
  return {
    year: Number(parts.find((part) => part.type === "year")!.value),
    month: Number(parts.find((part) => part.type === "month")!.value),
    day: Number(parts.find((part) => part.type === "day")!.value),
  };
}
function ordinal(parts: { year: number; month: number; day: number }) {
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}
export function dayBoundary(value: CalendarValue, end = false): string {
  const date = new CalendarDate(value);
  if (end) date.add(1, "day");
  date.convert(gregorian, gregorianEn);
  const target = ordinal({
    year: date.year,
    month: date.month.number,
    day: date.day,
  });
  // Find the first instant of the Tehran day. No browser-local timezone or fixed
  // offset assumptions; historical midnight DST gaps are handled by the IANA zone.
  let low = target - 86400000,
    high = target + 86400000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (ordinal(dateParts(middle)) < target) low = middle + 1;
    else high = middle;
  }
  return new Date(low).toISOString();
}
export function pickerDate(iso: string, end = false): CalendarValue | null {
  if (!iso) return null;
  const parts = dateParts(Date.parse(iso));
  const value = new CalendarDate({
    ...parts,
    calendar: gregorian,
    locale: gregorianEn,
  });
  if (end) value.subtract(1, "day");
  return value.convert(persian, persianFa);
}

const integer = (max: number) => z.coerce.number().int().min(1).max(max);
const timestamp = z.iso
  .datetime({ offset: true })
  .refine(
    (value) => !value.startsWith("0000-") && Number.isFinite(Date.parse(value)),
  );
export const inboxSchema = z
  .object({
    page: integer(1000000).default(1),
    page_size: integer(100).default(20),
    q: z
      .string()
      .trim()
      .max(100, "جست‌وجو نباید بیشتر از صد نویسه باشد")
      .default(""),
    status: statusSchema.or(z.literal("")).default(""),
    priority: prioritySchema.or(z.literal("")).default(""),
    from: timestamp.or(z.literal("")).default(""),
    to: timestamp.or(z.literal("")).default(""),
  })
  .strict()
  .refine(
    (value) =>
      !value.from || !value.to || Date.parse(value.from) < Date.parse(value.to),
    { message: "تاریخ پایان نباید قبل از تاریخ شروع باشد", path: ["to"] },
  );
export type InboxFilters = z.output<typeof inboxSchema>;
export function parseInboxSearch(search: string) {
  return inboxSchema.safeParse(Object.fromEntries(new URLSearchParams(search)));
}
export function inboxSearch(filters: InboxFilters): string {
  const params = new URLSearchParams({
    page: String(filters.page),
    page_size: String(filters.page_size),
  });
  for (const key of ["q", "status", "priority", "from", "to"] as const)
    if (filters[key]) params.set(key, filters[key]);
  return params.toString();
}
