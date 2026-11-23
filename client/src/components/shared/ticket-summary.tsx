import { categories, jalali, type Detail } from "@/lib/tickets";
import { PriorityBadge, StatusBadge } from "./ticket-badges";

export function TicketSummary({ ticket }: { ticket: Detail["ticket"] }) {
  const fields = [
    ["شماره تیکت", <bdi>{ticket.ticket_number}</bdi>],
    ["وضعیت", <StatusBadge status={ticket.status} />],
    ["اولویت", <PriorityBadge priority={ticket.priority} />],
    ["دسته‌بندی", categories[ticket.category]],
    ["مشتری", ticket.customer_name],
    [
      "کارشناس",
      ticket.assigned_to
        ? (ticket.assignee_name ?? "کارشناس غیرفعال")
        : "تعیین نشده",
    ],
    ["تاریخ ثبت", <time dateTime={ticket.created_at}>{jalali(ticket.created_at)}</time>],
    ["آخرین به‌روزرسانی", <time dateTime={ticket.updated_at}>{jalali(ticket.updated_at)}</time>],
  ] as const;
  return (
    <section className="panel p-4 sm:p-5" aria-label="مشخصات تیکت">
      <dl className="grid gap-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="mb-2 text-slate-600">{label}</dt>
            <dd className="wrap-anywhere font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="mb-2 text-sm font-semibold">توضیحات درخواست</h3>
        <p className="wrap-anywhere whitespace-pre-wrap leading-7">{ticket.description}</p>
      </div>
    </section>
  );
}
