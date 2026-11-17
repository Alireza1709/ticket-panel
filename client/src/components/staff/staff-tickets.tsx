import { StaffInbox } from "./staff-inbox";
import { StaffDetail } from "./staff-detail";
export function StaffTickets({
  userId,
  path,
  navigate,
}: {
  userId: string;
  path: string;
  navigate: (path: string) => void;
}) {
  const index = path.indexOf("?");
  const pathname = index < 0 ? path : path.slice(0, index);
  const search = index < 0 ? "" : path.slice(index);
  return pathname === "/staff/inbox" ? (
    <StaffInbox userId={userId} search={search} navigate={navigate} />
  ) : (
    <StaffDetail
      key={pathname}
      id={pathname.slice("/staff/tickets/".length)}
      userId={userId}
      search={search}
      navigate={navigate}
    />
  );
}
