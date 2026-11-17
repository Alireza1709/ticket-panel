import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";
import { api, ApiError, csrfSchema, postOptions } from "@/lib/api";
import { Button } from "@/components/ui/button";

export const inputClass =
  "w-full rounded-lg border border-border bg-white px-3 py-2.5 focus:outline-primary disabled:opacity-60";
export function Pending() {
  return (
    <p role="status" className="flex items-center gap-2 py-8">
      <LoaderCircle className="animate-spin" size={20} />
      در حال دریافت اطلاعات…
    </p>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
    >
      <p>{error.message}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          تلاش دوباره
        </Button>
      )}
    </div>
  );
}
export function useAuthFailure(error: Error | null) {
  const client = useQueryClient();
  useEffect(() => {
    if (error instanceof ApiError && [401, 403].includes(error.status))
      void client.invalidateQueries({ queryKey: ["me"] });
  }, [error, client]);
}
export function useCustomerPost() {
  const client = useQueryClient();
  const csrf = useQuery({
    queryKey: ["csrf"],
    queryFn: () => api("/api/auth/csrf", csrfSchema),
    staleTime: Infinity,
    retry: false,
  });
  async function post<T>(
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
  ): Promise<T> {
    if (!csrf.data)
      throw new ApiError("ورود به سامانه آماده نیست؛ دوباره تلاش کنید", 0);
    try {
      return await api(path, schema, postOptions(body, csrf.data.csrfToken));
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
  state: ReturnType<typeof useCustomerPost>;
}) {
  if (state.csrf.isPending)
    return (
      <p role="status" className="text-sm">
        در حال آماده‌سازی فرم…
      </p>
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
