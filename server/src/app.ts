import express from "express";
import helmet from "helmet";
import session from "express-session";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";
import { registerHealthRoutes } from "./modules/health/index.js";
import { config } from "./config.js";
import { PostgresSessionStore } from "./session-store.js";
import { customerTickets } from "./modules/tickets/customer/index.js";
import { staffRouter } from "./modules/tickets/staff/index.js";
import {
  authRouter,
  cookieOptions,
  registerOverviewRoutes,
  sessionCookieName,
} from "./modules/auth/index.js";
export const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    strictTransportSecurity: config.APP_ORIGIN.startsWith("https://")
      ? undefined
      : false,
    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests: config.APP_ORIGIN.startsWith("https://")
          ? []
          : null,
      },
    },
  }),
);
app.use(express.json({ limit: "100kb" }));
registerHealthRoutes(app);
// Only the local reverse proxy is trusted; remote clients cannot choose their IP.
app.set("trust proxy", "loopback");
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(
  "/api",
  session({
    name: sessionCookieName,
    secret: config.SESSION_SECRET,
    store: new PostgresSessionStore(),
    resave: false,
    saveUninitialized: false,
    cookie: { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 },
  }),
);
app.use("/api/auth", authRouter);
app.use("/api/customer/tickets", customerTickets);
app.use("/api/staff", staffRouter);
registerOverviewRoutes(app);
app.use(notFound);
app.use(errorHandler);
