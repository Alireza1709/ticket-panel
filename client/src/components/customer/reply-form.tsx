import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { replySchema, successSchema, type ReplyValues } from "@/lib/tickets";
import { CsrfState, Failure, inputClass, useCustomerPost } from "./shared";

export function ReplyForm({
  ticketId,
  userId,
}: {
  ticketId: string;
  userId: string;
}) {
  const state = useCustomerPost();
  const client = useQueryClient();
  const [success, setSuccess] = useState("");
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
      state.post(
        `/api/customer/tickets/${ticketId}/replies`,
        values,
        successSchema,
      ),
    onMutate: () => setSuccess(""),
    onSuccess: async (result) => {
      reset();
      setSuccess(result.message);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["ticket", userId, ticketId] }),
        client.invalidateQueries({ queryKey: ["tickets", userId] }),
      ]);
    },
  });
  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => reply.mutate(values))}
      className="space-y-3 border-t border-border pt-5"
    >
      <label htmlFor="reply-body" className="block font-semibold">
        ارسال پاسخ
      </label>
      <textarea
        id="reply-body"
        rows={4}
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
      {reply.isError && <Failure error={reply.error} />}{" "}
      {success && (
        <p role="status" className="text-sm text-teal-800">
          {success}
        </p>
      )}
      <Button type="submit" disabled={!state.ready || reply.isPending}>
        {reply.isPending ? "در حال ارسال…" : "ارسال پاسخ"}
      </Button>
    </form>
  );
}
