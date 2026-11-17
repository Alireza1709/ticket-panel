import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Failure, Pending, useAuthFailure } from "@/components/customer/shared";
import { api } from "@/lib/api";
import { jalali, priorities, statuses } from "@/lib/tickets";
import {
  inboxSearch,
  parseInboxSearch,
  type InboxFilters,
} from "@/lib/staff-inbox";
import { inboxResponseSchema } from "@/lib/staff-tickets";
import { InboxFilterForm } from "./inbox-filters";

function Results({
  userId,
  filters,
  navigate,
}: {
  userId: string;
  filters: InboxFilters;
  navigate: (path: string) => void;
}) {
  const search = inboxSearch(filters);
  const query = useQuery({
    queryKey: ["staff-inbox", userId, search],
    queryFn: () => api(`/api/staff/tickets?${search}`, inboxResponseSchema),
    retry: false,
  });
  useAuthFailure(query.error);
  const go = (next: InboxFilters) =>
    navigate(`/staff/inbox?${inboxSearch(next)}`);
  return (
    <div className="space-y-5">
      <InboxFilterForm
        filters={filters}
        apply={go}
        clear={() => navigate("/staff/inbox")}
      />
      {query.isPending ? (
        <Pending />
      ) : query.isError ? (
        <Failure
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <p role="status" className="text-sm text-slate-600">
            {query.data.total.toLocaleString("fa-IR")} تیکت یافت شد
          </p>
          {query.data.tickets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Inbox size={32} className="mx-auto mb-3 text-slate-400" />
              <p>
                {query.data.total === 0
                  ? "تیکتی با این شرایط پیدا نشد."
                  : "در صفحه درخواستی تیکتی وجود ندارد."}
              </p>
              {filters.page > 1 && (
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => go({ ...filters, page: 1 })}
                >
                  بازگشت به صفحه اول
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <caption className="sr-only">صندوق تیکت‌های پشتیبانی</caption>
                <thead>
                  <tr>
                    {[
                      "شماره تیکت",
                      "موضوع",
                      "مشتری",
                      "وضعیت",
                      "اولویت",
                      "کارشناس",
                      "آخرین به‌روزرسانی",
                    ].map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className="whitespace-nowrap border-b border-border p-3 text-slate-500"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {query.data.tickets.map((ticket) => {
                    const href = `/staff/tickets/${ticket.id}?${search}`;
                    return (
                      <tr key={ticket.id} className="border-b border-slate-100">
                        <td className="p-3">
                          <a
                            href={href}
                            className="whitespace-nowrap font-semibold text-primary underline underline-offset-4"
                            onClick={(event) => {
                              if (
                                event.button === 0 &&
                                !event.ctrlKey &&
                                !event.metaKey &&
                                !event.shiftKey &&
                                !event.altKey
                              ) {
                                event.preventDefault();
                                navigate(href);
                              }
                            }}
                          >
                            <bdi>{ticket.ticket_number}</bdi>
                          </a>
                        </td>
                        <td className="min-w-44 break-words p-3">
                          {ticket.subject}
                        </td>
                        <td className="whitespace-nowrap p-3">
                          {ticket.customer_name}
                        </td>
                        <td className="whitespace-nowrap p-3">
                          {statuses[ticket.status]}
                        </td>
                        <td className="whitespace-nowrap p-3">
                          {priorities[ticket.priority]}
                        </td>
                        <td className="whitespace-nowrap p-3">
                          {ticket.assigned_to
                            ? (ticket.assignee_name ?? "کارشناس غیرفعال")
                            : "تعیین نشده"}
                        </td>
                        <td className="whitespace-nowrap p-3">
                          <time dateTime={ticket.updated_at}>
                            {jalali(ticket.updated_at)}
                          </time>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <nav
            aria-label="صفحه‌بندی تیکت‌ها"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <Button
              variant="outline"
              disabled={filters.page <= 1}
              onClick={() => go({ ...filters, page: filters.page - 1 })}
            >
              صفحه قبل
            </Button>
            <p className="text-sm">
              صفحه {filters.page.toLocaleString("fa-IR")} از{" "}
              {query.data.total_pages.toLocaleString("fa-IR")}
            </p>
            <Button
              variant="outline"
              disabled={filters.page >= query.data.total_pages}
              onClick={() => go({ ...filters, page: filters.page + 1 })}
            >
              صفحه بعد
            </Button>
          </nav>
        </>
      )}
    </div>
  );
}
export function StaffInbox({
  userId,
  search,
  navigate,
}: {
  userId: string;
  search: string;
  navigate: (path: string) => void;
}) {
  const parsed = parseInboxSearch(search);
  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold">صندوق پشتیبانی</h2>
      {parsed.success ? (
        <Results
          key={search}
          userId={userId}
          filters={parsed.data}
          navigate={navigate}
        />
      ) : (
        <Failure
          error={new Error("فیلترهای نشانی صفحه معتبر نیستند")}
          retry={() => navigate("/staff/inbox")}
        />
      )}
    </div>
  );
}
