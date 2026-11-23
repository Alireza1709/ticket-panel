import { TicketFilters } from "@/components/shared/ticket-filters";
import { TicketPagination } from "@/components/shared/ticket-pagination";
import { filterFormKey, inboxSearch, parseInboxSearch, type InboxFilters } from "@/lib/staff-inbox";
import { PriorityBadge, StatusBadge } from "@/components/shared/ticket-badges";
import { Skeleton } from "@/components/feedback/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customerApi } from "@/lib/ticket-api";
import { jalali } from "@/lib/tickets";
import { Failure, useAuthFailure } from "@/components/shared/ticket-form";

export function TicketList({
  userId,
  navigate,
  search = "",
}: {
  search?: string;
  userId: string;
  navigate: (path: string) => void;
}) {
  const parsed = parseInboxSearch(search);
  const clear = () => navigate("/customer/tickets");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="page-heading">
          <h2 className="page-title">تیکت‌های من</h2>
          <p className="text-sm text-slate-600">پیگیری درخواست‌ها و پاسخ‌های پشتیبانی</p>
        </div>
        <Button onClick={() => navigate("/customer/tickets/new")}>
          <Plus size={18} />
          ثبت تیکت جدید
        </Button>
      </div>
      {parsed.success && !parsed.data.assigned_to
        ? <Results userId={userId} filters={parsed.data} navigate={navigate} />
        : <Failure error={new Error("فیلترهای نشانی صفحه معتبر نیستند")} retry={clear} />}
    </div>
  );
}

function Results({ userId, filters, navigate }: {
  userId: string;
  filters: InboxFilters;
  navigate: (path: string) => void;
}) {
  const search = inboxSearch(filters);
  const go = (next: InboxFilters) => navigate(`/customer/tickets?${inboxSearch(next)}`);
  const query = useQuery({
    queryKey: ["tickets", userId, search],
    queryFn: () => customerApi.list(search),
    retry: false,
  });
  useAuthFailure(query.error);
  return (
    <>
      <TicketFilters userId={userId} key={filterFormKey(filters)} filters={filters}
        apply={go} clear={() => navigate("/customer/tickets")} />
      {query.isPending ? (
        <Skeleton kind="list" />
      ) : query.isError ? (
        <Failure
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : query.data.tickets.length === 0 ? (
        <div className="panel border-dashed p-10 text-center">
          <Inbox className="mx-auto mb-3 text-slate-400" size={36} />
          <h3 className="font-semibold">{query.data.total === 0 && !filters.q && !filters.status && !filters.priority && !filters.category && !filters.from && !filters.to && !filters.updated_from && !filters.updated_to
            ? "هنوز تیکتی ثبت نکرده‌اید"
            : "تیکتی با این شرایط در این صفحه پیدا نشد"}</h3>

        </div>
      ) : (
        <div className="panel table-scroll" tabIndex={0} role="region" aria-label="جدول تیکت‌ها">
          <table className="ticket-table w-full text-start text-sm">
            <caption className="sr-only">فهرست تیکت‌های فعال حساب شما</caption>
            <thead className="border-b border-border text-slate-500">
              <tr>
                {[
                  "شماره تیکت",
                  "موضوع",
                  "اولویت",
                  "وضعیت",
                  "آخرین به‌روزرسانی",
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="whitespace-nowrap p-3 font-medium"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.tickets.map((ticket) => (
                <tr key={ticket.id} className="ticket-table-row">
                  <td className="p-3">
                    <a
                      href={`/customer/tickets/${ticket.id}?${search}`}
                      onClick={(event) => {
                        if (
                          !event.metaKey &&
                          !event.ctrlKey &&
                          !event.shiftKey &&
                          !event.altKey &&
                          event.button === 0
                        ) {
                          event.preventDefault();
                          navigate(`/customer/tickets/${ticket.id}?${search}`);
                        }
                      }}
                      className="whitespace-nowrap font-semibold text-primary underline underline-offset-4"
                    >
                      <bdi>{ticket.ticket_number}</bdi>
                    </a>
                  </td>
                  <td className="min-w-48 p-3 break-words">{ticket.subject}</td>
                  <td className="whitespace-nowrap p-3">
                    <PriorityBadge priority={ticket.priority} />
                  </td>
                  <td className="whitespace-nowrap p-3">
                    <StatusBadge status={ticket.status} />
                  </td>
                  <td className="whitespace-nowrap p-3">
                    <time dateTime={ticket.updated_at}>
                      {jalali(ticket.updated_at)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {query.data && <TicketPagination page={filters.page} totalPages={query.data.total_pages}
        go={(page) => go({ ...filters, page })} />}
    </>
  );
}
