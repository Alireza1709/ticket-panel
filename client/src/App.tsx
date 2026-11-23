import { lazy, Suspense, useEffect, useRef, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Login } from "@/components/auth/login";
import { Register } from "@/components/auth/register";
import { Failure } from "@/components/feedback/failure";
import { Skeleton } from "@/components/feedback/skeleton";
import { useClearToasts } from "@/components/feedback/toast";
import { getSession } from "@/lib/auth";
import { homeFor, routeFor } from "@/lib/auth-routing";
import { navigate, subscribe } from "@/lib/navigation";

const Landing = lazy(() =>
  import("@/components/layout/landing").then((module) => ({ default: module.Landing })),
);

export function App() {
  const queryClient = useQueryClient();
  const clearToasts = useClearToasts();
  const path = useSyncExternalStore(
    subscribe,
    () => window.location.pathname + window.location.search,
  );
  const me = useQuery({
    queryKey: ["me"],
    queryFn: getSession,
    retry: false,
    staleTime: 30000,
  });
  const user = me.data?.user ?? null;
  const previousAccount = useRef<string | null>(null);
  useEffect(() => {
    if (!me.isSuccess) return;
    if (previousAccount.current && previousAccount.current !== user?.id) {
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
    }
    previousAccount.current = user?.id ?? null;
  }, [me.isSuccess, user?.id, queryClient]);
  const target = routeFor(user?.role ?? null, path);
  useEffect(() => {
    if (me.isSuccess) navigate(target);
  }, [me.isSuccess, path, target]);
  const signedOut = () => {
    queryClient.clear();
    clearToasts();
    queryClient.setQueryData(["me"], { user: null });
    navigate("/login");
  };
  const loading = <div className="login-page"><Skeleton kind="session" /></div>;
  return (
    <Suspense fallback={loading}>
      {me.isPending ? (
        loading
      ) : me.isError ? (
        <div className="login-page">
          <Failure
            error={me.error}
            retry={() => {
              void me.refetch();
            }}
          />
        </div>
      ) : path !== target ? (
        loading
      ) : user ? (
        <Landing key={user.id} user={user} onLogout={signedOut} path={path} />
      ) : path === "/register" ? (
        <Register />
      ) : (
        <Login
          onLogin={(account, csrfToken) => {
            queryClient.clear();
            clearToasts();
            queryClient.setQueryData(["csrf"], { csrfToken });
            queryClient.setQueryData(["me"], { user: account });
            navigate(homeFor(account.role));
          }}
        />
      )}
    </Suspense>
  );
}
