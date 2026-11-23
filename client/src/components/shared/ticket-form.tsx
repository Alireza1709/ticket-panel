import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { getCsrf } from "@/lib/auth";
import { Skeleton } from "@/components/feedback/skeleton";
import { Failure } from "@/components/feedback/failure";
export { Failure };

export { inputClass } from "@/components/ui/field";
export function useAuthFailure(error: Error | null) {
  const client = useQueryClient();
  useEffect(() => {
    if (error instanceof ApiError && [401, 403].includes(error.status))
      void client.invalidateQueries({ queryKey: ["me"] });
  }, [error, client]);
}
export function useTicketPost() {
  const client = useQueryClient();
  const csrf = useQuery({
    queryKey: ["csrf"],
    queryFn: getCsrf,
    staleTime: Infinity,
    retry: false,
  });
  async function post<T>(
    request: (token: string) => Promise<T>,
  ): Promise<T> {
    if (!csrf.data)
      throw new ApiError("ورود به سامانه آماده نیست؛ دوباره تلاش کنید", 0);
    try {
      return await request(csrf.data.csrfToken);
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        void client.invalidateQueries({ queryKey: ["me"] });
        void client.invalidateQueries({ queryKey: ["csrf"] });
      }
      throw error;
    }
  }
  return { post, ready: Boolean(csrf.data) && !csrf.isFetching, csrf };
}
export function CsrfState({
  state,
}: {
  state: ReturnType<typeof useTicketPost>;
}) {
  if (state.csrf.isPending)
    return (
      <Skeleton kind="form" />
    );
  if (state.csrf.isError)
    return (
      <Failure
        error={state.csrf.error}
        retry={() => {
          void state.csrf.refetch();
        }}
      />
    );
  return null;
}
