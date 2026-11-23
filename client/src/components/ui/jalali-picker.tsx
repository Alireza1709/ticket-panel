import { useRef } from "react";
import DatePickerExport, {
  type CalendarProps,
  type DatePickerProps,
  type DatePickerRef,
} from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";

// Preserve the interop fix for the shared ticket date filters.
const DatePicker =
  (DatePickerExport as unknown as { default?: typeof DatePickerExport })
    .default ?? DatePickerExport;
type Props = Omit<
  CalendarProps<false, false> & DatePickerProps<false, false>,
  "calendar" | "locale"
>;
export function JalaliPicker({ onChange, ...props }: Props) {
  const picker = useRef<DatePickerRef>(null);
  return (
    <DatePicker
      calendar={persian}
      locale={persianFa}
      calendarPosition="bottom-right"
      onOpenPickNewDate={false}
      mobileLabels={{ OK: "تأیید", CANCEL: "انصراف" }}
      {...props}
      ref={picker}
      onChange={(date, options) => {
        if (onChange?.(date, options) === false) return false;
        if (date?.isValid) queueMicrotask(() => picker.current?.closeCalendar());
      }}
    />
  );
}
