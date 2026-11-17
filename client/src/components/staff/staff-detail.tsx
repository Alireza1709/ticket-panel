import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MessageThread,
  StatusHistory,
} from "@/components/customer/ticket-detail";
import { ReplyForm } from "@/components/customer/reply-form";
import { Failure, Pending, useAuthFailure } from "@/components/customer/shared";
import { api } from "@/lib/api";
import {
  detailSchema,
  categories,
  priorities,
  statuses,
  jalali,
} from "@/lib/tickets";
import { TicketControls } from "./ticket-controls";

export function StaffDetail({
  id,
  userId,
  search,
  navigate,
}: {
  id: string;
  userId: string;
  search: string;
  navigate: (path: string) => void;
}) {
  const [notice, setNotice] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["staff-ticket", userId, id],
    queryFn: () => api(`/api/staff/tickets/${id}`, detailSchema),
    retry: false,
  });
  useAuthFailure(query.error);
  async function refresh(message: string) {
    setNotice(message);
    await Promise.all([
      client.invalidateQueries({ queryKey: ["staff-ticket", userId, id] }),
      client.invalidateQueries({ queryKey: ["staff-inbox"] }),
      client.invalidateQueries({ queryKey: ["tickets"] }),
      client.invalidateQueries({ queryKey: ["ticket"] }),
    ]);
  }
  const back = (
    <Button variant="outline" onClick={() => navigate(`/staff/inbox${search}`)}>
      <ArrowRight size={16} />
      بازگشت به صندوق
    </Button>
  );
  if (query.isPending)
    return (
      <>
        {back}
        <Pending />
      </>
    );
  if (query.isError)
    return (
      <div className="space-y-4">
        {back}
        <Failure
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      </div>
    );
  const { ticket, messages, history } = query.data;
  const fields = [
    ["شماره تیکت", ticket.ticket_number],
    ["مشتری", ticket.customer_name],
    [
      "کارشناس",
      ticket.assigned_to
        ? (ticket.assignee_name ?? "کارشناس غیرفعال")
        : "تعیین نشده",
    ],
    ["دسته‌بندی", categories[ticket.category]],
    ["وضعیت", statuses[ticket.status]],
    ["اولویت", priorities[ticket.priority]],
    ["تاریخ ثبت", jalali(ticket.created_at)],
    ["آخرین به‌روزرسانی", jalali(ticket.updated_at)],
  ];
  return (
    <div className="space-y-6">
      {back}
      <h2 className="break-words text-2xl font-bold leading-10">
        {ticket.subject}
      </h2>
      {notice && (
        <p role="status" className="rounded-lg bg-teal-50 p-3 text-teal-900">
          {notice}
        </p>
      )}
      <dl className="grid gap-4 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="mb-2 text-slate-500">{label}</dt>
            <dd className="break-words font-medium">
              <bdi>{value}</bdi>
            </dd>
          </div>
        ))}
      </dl>
      <TicketControls ticket={ticket} onChanged={refresh} />
      <MessageThread messages={messages} />
      <ReplyForm ticketId={id} userId={userId} audience="staff" />
      <StatusHistory history={history} />
    </div>
  );
}
