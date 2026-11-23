import { Router } from "express";
import { csrfProtection, requireRole } from "../../auth/index.js";
import { list, create, detail, reply, cancel } from "./customer.controller.js";

export const customerTickets = Router();
customerTickets.use(requireRole("customer"));
customerTickets.get("/", list);
customerTickets.post("/", csrfProtection, create);
customerTickets.get("/:id", detail);
customerTickets.post("/:id/replies", csrfProtection, reply);
customerTickets.post("/:id/cancel", csrfProtection, cancel);
