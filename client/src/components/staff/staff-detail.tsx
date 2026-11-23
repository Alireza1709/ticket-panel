import { MessageThread, StatusHistory } from "@/components/shared/ticket-discussion";
import { TicketSummary } from "@/components/shared/ticket-summary";
import { Skeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReplyForm } from "@/components/shared/reply-form";
import { Failure, useAuthFailure } from "@/components/shared/ticket-form";
import { staffApi } from "@/lib/ticket-api";
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
  const notify = useToast();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["staff-ticket", userId, id],
    queryFn: () => staffApi.detail(id),
    retry: false,
  });
  useAuthFailure(query.error);
  async function refresh(message: string) {
    notify(message);
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
    <div className="space-y-6">
      {back}
      <h2 className="page-title wrap-anywhere">
        {ticket.subject}
      </h2>
      <TicketSummary ticket={ticket} />
      <TicketControls ticket={ticket} onChanged={refresh} />
      <div className="detail-grid">
        <div className="min-w-0 space-y-5">
          <MessageThread messages={messages} />
          <ReplyForm ticketId={id} userId={userId} audience="staff" />
        </div>
        <StatusHistory history={history} />
      </div>
    </div>
  );
}
