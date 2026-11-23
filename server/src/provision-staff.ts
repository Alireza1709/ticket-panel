import { createInterface } from "node:readline/promises";
import argon2 from "argon2";
import { pool } from "./db.js";
import { createAccount } from "./models/user.model.js";
import { registrationSchema } from "./modules/auth/auth.validator.js";

const [, , name, email] = process.argv;
const input = createInterface({ input: process.stdin, terminal: false });
try {
  if (process.stdin.isTTY) throw new Error("Pass the password through standard input.");
  const { value: password } = await input[Symbol.asyncIterator]().next();
  const account = registrationSchema.parse({ name, email, password, confirmation: password });
  const hash = await argon2.hash(account.password, { type: argon2.argon2id });
  const user = await createAccount({ name: account.name, email: account.email, hash }, "staff");
  if (!user) throw new Error("Email is already registered.");
  console.log(`Staff account created: ${user.id}`);
} catch (error) {
  console.error(error instanceof Error && error.message === "Email is already registered."
    ? error.message
    : "Staff provisioning failed. Verify input and database configuration.");
  process.exitCode = 1;
} finally {
  input.close();
  await pool.end();
}
