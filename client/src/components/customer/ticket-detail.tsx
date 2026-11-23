import { MessageThread, StatusHistory } from "@/components/shared/ticket-discussion";
import { TicketSummary } from "@/components/shared/ticket-summary";
import { Skeleton } from "@/components/feedback/skeleton";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customerApi } from "@/lib/ticket-api";
import { canCancel } from "@/lib/tickets";
import { Failure, useAuthFailure } from "@/components/shared/ticket-form";
import { ReplyForm } from "@/components/shared/reply-form";
import { CancelTicketDialog } from "./cancel-ticket-dialog";

export function TicketDetail({
  id,
  userId,
  navigate,
  notify,
  search = "",
}: {
  search?: string;
  id: string;
  userId: string;
  navigate: (path: string) => void;
  notify: (message: string) => void;
}) {
  const query = useQuery({
    queryKey: ["ticket", userId, id],
    queryFn: () => customerApi.detail(id),
    retry: false,
  });
  useAuthFailure(query.error);
  const back = (
    <Button variant="outline" onClick={() => navigate(search ? `/customer/tickets?${search}` : "/customer/tickets")}>
      <ArrowRight size={16} />
      انصراف
    </Button>
  );
  if (query.isPending)
    return (
      <>
        {back}
        <Skeleton kind="detail" />
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
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap justify-between gap-3">
        {back}
        {canCancel(ticket.status) && (
          <CancelTicketDialog
            ticketId={id}
            userId={userId}
            onCancelled={(message) => {
              notify(message);
              navigate(search ? `/customer/tickets?${search}` : "/customer/tickets");
            }}
          />
        )}
      </div>
      <h2 className="page-title wrap-anywhere">
        {ticket.subject}
      </h2>
      <TicketSummary ticket={ticket} />
      <div className="detail-grid">
        <div className="min-w-0 space-y-5">
          <MessageThread messages={messages} />
          <ReplyForm key={id} ticketId={id} userId={userId} />
        </div>
        <StatusHistory history={history} />
      </div>
    </div>
  );
}
