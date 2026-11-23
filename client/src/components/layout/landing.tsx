import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "./dashboard-shell";
import { Failure } from "@/components/feedback/failure";
import { useToast } from "@/components/feedback/toast";
import { JalaliPicker } from "@/components/ui/jalali-picker";
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
      if (error instanceof ApiError && error.status === 403)
        void client.invalidateQueries({ queryKey: ["csrf"] });
    },
  });
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
        {user.role === "customer" ? (
          <CustomerTickets userId={user.id} path={path} navigate={openPage} />
        ) : (
          <StaffTickets userId={user.id} path={path} navigate={openPage} />
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-slate-600">
          <span>
            {new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
              dateStyle: "long",
              timeZone: "Asia/Tehran",
            }).format(new Date())}
          </span>
          <div className="flex items-center gap-2">
            <label htmlFor="sample-date">تقویم شمسی</label>
            <JalaliPicker
              id="sample-date"
              inputClass="w-32 rounded-md border border-border bg-white px-2 py-1"
              placeholder="انتخاب تاریخ"
            />
          </div>
        </footer>
      </div>
    </DashboardShell>
  );
}

