import { Router } from "express";
import { csrfProtection, requireRole } from "../../auth/index.js";
import { members, list, detail, reply, changeStatus, assign } from "./staff.controller.js";
import { validateTicketId } from "./staff.validator.js";

export const staffRouter = Router();
staffRouter.use(requireRole("staff"));
staffRouter.param("id", validateTicketId);
staffRouter.get("/members", members);
staffRouter.get("/tickets", list);
staffRouter.get("/tickets/:id", detail);
staffRouter.post("/tickets/:id/replies", csrfProtection, reply);
staffRouter.post("/tickets/:id/status", csrfProtection, changeStatus);
staffRouter.post("/tickets/:id/assignment", csrfProtection, assign);
