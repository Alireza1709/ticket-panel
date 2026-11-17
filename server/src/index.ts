import { app } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";
const server = app.listen(config.PORT, "127.0.0.1", () => {
  console.log(`سرور روی درگاه ${config.PORT} فعال است`);
});
function shutdown() {
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
