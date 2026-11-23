import { priorities, statuses } from "@/lib/tickets";

export function StatusBadge({ status }: { status: keyof typeof statuses }) {
  return <span className="ticket-badge" data-status={status}>{statuses[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: keyof typeof priorities }) {
  return <span className="ticket-priority" data-priority={priority}>{priorities[priority]}</span>;
}
