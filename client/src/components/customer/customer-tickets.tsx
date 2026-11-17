import { useState } from "react";
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
  const [notice, setNotice] = useState("");
  const id = path.slice("/customer/tickets/".length);
  const go = (destination: string) => {
    setNotice("");
    navigate(destination);
  };
  return (
    <div className="space-y-5">
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900"
        >
          {notice}
        </p>
      )}
      {path === "/customer/tickets/new" ? (
        <CreateTicket navigate={navigate} notify={setNotice} />
      ) : path === "/customer/tickets" ? (
        <TicketList userId={userId} navigate={go} />
      ) : (
        <TicketDetail
          key={id}
          id={id}
          userId={userId}
          navigate={navigate}
          notify={setNotice}
        />
      )}
    </div>
  );
}
