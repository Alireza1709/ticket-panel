import { PriorityBadge, StatusBadge } from "@/components/shared/ticket-badges";
import { Skeleton } from "@/components/feedback/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Failure, useAuthFailure } from "@/components/shared/ticket-form";
import { staffApi } from "@/lib/ticket-api";
import { jalali } from "@/lib/tickets";
import {
  inboxSearch,
  filterFormKey,
  parseInboxSearch,
  type InboxFilters,
} from "@/lib/staff-inbox";
import { TicketFilters } from "@/components/shared/ticket-filters";
import { TicketPagination } from "@/components/shared/ticket-pagination";

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
    queryFn: () => staffApi.list(search),
    retry: false,
  });
  useAuthFailure(query.error);
  const go = (next: InboxFilters) =>
    navigate(`/staff/inbox?${inboxSearch(next)}`);
  return (
    <div className="space-y-5">
      <TicketFilters staff userId={userId} key={filterFormKey(filters)}
        filters={filters}
        apply={go}
        clear={() => navigate("/staff/inbox")}
      />
      {query.isPending ? (
        <Skeleton kind="inbox" />
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
            <div className="panel border-dashed p-8 text-center">
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
            <div className="panel table-scroll" tabIndex={0} role="region" aria-label="جدول تیکت‌ها">
              <table className="ticket-table w-full text-start text-sm">
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
                      <tr key={ticket.id} className="ticket-table-row">
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
                          <StatusBadge status={ticket.status} />
                        </td>
                        <td className="whitespace-nowrap p-3">
                          <PriorityBadge priority={ticket.priority} />
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
          <TicketPagination page={filters.page} totalPages={query.data.total_pages}
            go={(page) => go({ ...filters, page })} />
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
      <header className="page-heading">
        <h2 className="page-title">صندوق پشتیبانی</h2>
        <p className="text-sm text-slate-600">پیگیری درخواست‌های مشتریان و ارجاع به کارشناسان</p>
      </header>
      {parsed.success ? (
        <Results
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
