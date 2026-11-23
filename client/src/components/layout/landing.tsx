import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "./dashboard-shell";
import { Failure } from "@/components/feedback/failure";
import { useToast } from "@/components/feedback/toast";
import { Overview, Profile } from "@/components/shared/overview";
import { CustomerTickets } from "@/components/customer/customer-tickets";
import { StaffTickets } from "@/components/staff/staff-tickets";
import { ApiError, type User } from "@/lib/api";
import { getCsrf, logoutSession } from "@/lib/auth";
import { navigate } from "@/lib/navigation";

const openPage = (path: string) => navigate(path, false);

export function Landing({
  user,
  onLogout,
  path,
}: {
  user: User;
  onLogout: () => void;
  path: string;
}) {
  const client = useQueryClient();
  const notify = useToast();
  const csrf = useQuery({
    queryKey: ["csrf"],
    queryFn: getCsrf,
    staleTime: Infinity,
    retry: false,
  });
  const logout = useMutation({
    mutationFn: () => logoutSession(csrf.data?.csrfToken ?? ""),
    onSuccess: ({ message }) => {
      onLogout();
      notify(message);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 403) {
        void client.invalidateQueries({ queryKey: ["csrf"] });
        void client.invalidateQueries({ queryKey: ["me"] });
      }
    },
  });
  const pathname = path.split("?")[0];
  return (
    <DashboardShell
      user={user}
      path={path}
      navigate={openPage}
      logout={() => logout.mutate()}
      logoutDisabled={!csrf.data || csrf.isFetching || logout.isPending}
      logoutPending={logout.isPending}
    >
      <div className="space-y-5">
        {logout.isError && <Failure error={logout.error} />}
        {csrf.isError && <Failure error={csrf.error} retry={() => void csrf.refetch()} />}
        {pathname === `/${user.role}/overview` ? <Overview user={user} />
          : pathname === `/${user.role}/profile` ? <Profile user={user} />
          : user.role === "customer" ? (
          <CustomerTickets userId={user.id} path={path} navigate={openPage} />
        ) : (
          <StaffTickets userId={user.id} path={path} navigate={openPage} />
        )}
      </div>
    </DashboardShell>
  );
}

