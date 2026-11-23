import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-lg border border-border bg-white px-3 py-2.5 focus:outline-primary disabled:opacity-60";

export function TextInput({ className, ...props }: ComponentPropsWithRef<"input">) {
  return <input {...props} className={cn(inputClass, className)} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithRef<"textarea">) {
  return <textarea {...props} className={cn(inputClass, className)} />;
}

export function Field({ id, label, error, children }: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
