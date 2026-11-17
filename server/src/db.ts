import pg from "pg";
import { config } from "./config.js";
export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 3000,
  query_timeout: 3000,
});
pool.on("error", () => {
  console.error("خطا در اتصال پایگاه داده");
});
