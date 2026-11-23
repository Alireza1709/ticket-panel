import type { Express } from "express";
import { databaseHealth, serverHealth } from "./health.controller.js";

export function registerHealthRoutes(app: Express) {
  app.get("/api/health", serverHealth);
  app.get("/api/health/db", databaseHealth);
}
