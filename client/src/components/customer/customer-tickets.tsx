import { useToast } from "@/components/feedback/toast";
import { TicketList } from "./ticket-list";
import { CreateTicket } from "./create-ticket";
import { TicketDetail } from "./ticket-detail";

export function CustomerTickets({
  userId,
  path,
  navigate,
}: {
  userId: string;
  path: string;
  navigate: (path: string) => void;
}) {
  const notify = useToast();
  const [pathname, search] = path.split("?");
  const id = pathname!.slice("/customer/tickets/".length);
  if (pathname === "/customer/tickets/new") return <CreateTicket navigate={navigate} notify={notify} />;
  if (pathname === "/customer/tickets") return <TicketList userId={userId} navigate={navigate} search={search} />;
  return <TicketDetail search={search} key={id} id={id} userId={userId} navigate={navigate} notify={notify} />;
}
