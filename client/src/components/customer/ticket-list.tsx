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
}: {
  userId: string;
  navigate: (path: string) => void;
}) {
  const query = useQuery({
    queryKey: ["tickets", userId],
    queryFn: customerApi.list,
    retry: false,
  });
  useAuthFailure(query.error);
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
          <h3 className="font-semibold">هنوز تیکتی ثبت نکرده‌اید</h3>
          <p className="mt-2 text-sm text-slate-500">
            برای دریافت راهنمایی، یک تیکت جدید ثبت کنید.
          </p>
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
                      href={`/customer/tickets/${ticket.id}`}
                      onClick={(event) => {
                        if (
                          !event.metaKey &&
                          !event.ctrlKey &&
                          !event.shiftKey &&
                          !event.altKey &&
                          event.button === 0
                        ) {
                          event.preventDefault();
                          navigate(`/customer/tickets/${ticket.id}`);
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
    </div>
  );
}
