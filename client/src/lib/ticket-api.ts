import { api, postOptions } from "./api";
import { inboxResponseSchema, membersSchema } from "./staff-tickets";
import {
  createdSchema,
  detailSchema,
  listSchema,
  successSchema,
  type CreateTicketValues,
  type ReplyValues,
  type Detail,
} from "./tickets";

const customerRoot = "/api/customer/tickets";
const staffRoot = "/api/staff/tickets";

export const customerApi = {
  list: () => api(customerRoot, listSchema),
  detail: (id: string) => api(`${customerRoot}/${id}`, detailSchema),
  create: (values: CreateTicketValues, token: string) =>
    api(customerRoot, createdSchema, postOptions(values, token)),
  cancel: (id: string, token: string) =>
    api(`${customerRoot}/${id}/cancel`, successSchema, postOptions({}, token)),
};

export const staffApi = {
  list: (search: string) => api(`${staffRoot}?${search}`, inboxResponseSchema),
  detail: (id: string) => api(`${staffRoot}/${id}`, detailSchema),
  members: () => api("/api/staff/members", membersSchema),
  changeStatus: (id: string, status: Detail["ticket"]["status"], token: string) =>
    api(`${staffRoot}/${id}/status`, successSchema, postOptions({ status }, token)),
  assign: (id: string, assigned_to: string, token: string) =>
    api(`${staffRoot}/${id}/assignment`, successSchema, postOptions({ assigned_to }, token)),
};

export function replyToTicket(
  audience: "customer" | "staff",
  id: string,
  values: ReplyValues,
  token: string,
) {
  const root = audience === "customer" ? customerRoot : staffRoot;
  return api(`${root}/${id}/replies`, successSchema, postOptions(values, token));
}
