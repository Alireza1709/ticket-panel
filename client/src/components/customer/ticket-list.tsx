import { useQuery } from "@tanstack/react-query";
import { Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { listSchema, priorities, statuses, jalali } from "@/lib/tickets";
import { Pending, Failure, useAuthFailure } from "./shared";

export function TicketList({
  userId,
  navigate,
}: {
  userId: string;
  navigate: (path: string) => void;
}) {
  const query = useQuery({
    queryKey: ["tickets", userId],
    queryFn: () => api("/api/customer/tickets", listSchema),
    retry: false,
  });
  useAuthFailure(query.error);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">تیکت‌های من</h2>
        <Button onClick={() => navigate("/customer/tickets/new")}>
          <Plus size={18} />
          ثبت تیکت جدید
        </Button>
      </div>
      {query.isPending ? (
        <Pending />
      ) : query.isError ? (
        <Failure
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : query.data.tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Inbox className="mx-auto mb-3 text-slate-400" size={36} />
          <h3 className="font-semibold">هنوز تیکتی ثبت نکرده‌اید</h3>
          <p className="mt-2 text-sm text-slate-500">
            برای دریافت راهنمایی، یک تیکت جدید ثبت کنید.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
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
                <tr key={ticket.id} className="border-b border-slate-100">
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
                    {priorities[ticket.priority]}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    <span className="rounded-full bg-teal-50 px-2 py-1 text-teal-800">
                      {statuses[ticket.status]}
                    </span>
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
