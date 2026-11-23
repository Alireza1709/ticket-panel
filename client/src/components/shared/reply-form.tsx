import { replyToTicket } from "@/lib/ticket-api";
import { useMutationSubmit } from "@/lib/mutation-submit";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { replySchema, type ReplyValues } from "@/lib/tickets";
import { CsrfState, Failure, inputClass, useTicketPost } from "./ticket-form";

export function ReplyForm({
  ticketId,
  userId,
  audience = "customer",
}: {
  ticketId: string;
  userId: string;
  audience?: "customer" | "staff";
}) {
  const state = useTicketPost();
  const client = useQueryClient();
  const notify = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReplyValues>({
    resolver: zodResolver(replySchema),
    defaultValues: { body: "" },
  });
  const reply = useMutation({
    mutationFn: (values: ReplyValues) =>
      state.post((token) => replyToTicket(audience, ticketId, values, token)),
    onSuccess: async (result) => {
      reset();
      notify(result.message);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["ticket", userId, ticketId] }),
        client.invalidateQueries({ queryKey: ["tickets", userId] }),
        client.invalidateQueries({
          queryKey: ["staff-ticket", userId, ticketId],
        }),
        client.invalidateQueries({ queryKey: ["staff-inbox"] }),
      ]);
    },
  });
  const submit = useMutationSubmit(handleSubmit, state.ready);
  return (
    <form
      noValidate
      onSubmit={submit((values) => reply.mutateAsync(values))}
      className="panel space-y-3 p-4 sm:p-5"
    >
      <label htmlFor="reply-body" className="block font-semibold">
        ارسال پاسخ
      </label>
      <textarea
        id="reply-body"
        rows={4}
        placeholder="پاسخ خود را بنویسید…"
        maxLength={10000}
        disabled={reply.isPending}
        {...register("body")}
        className={inputClass}
        aria-invalid={Boolean(errors.body)}
        aria-describedby={errors.body ? "reply-error" : undefined}
      />
      {errors.body && (
        <p id="reply-error" role="alert" className="text-sm text-red-700">
          {errors.body.message}
        </p>
      )}
      <CsrfState state={state} />
      {reply.isError && <Failure error={reply.error} />}
      <Button type="submit" disabled={!state.ready || reply.isPending}>
        {reply.isPending && <span className="button-skeleton" aria-hidden="true" />}
        {reply.isPending ? "در حال ارسال…" : "ارسال پاسخ"}
      </Button>
    </form>
  );
}
