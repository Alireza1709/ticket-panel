import { readFile, mkdir, writeFile, chmod, lstat } from "node:fs/promises";
import { parse } from "dotenv";
import { localOrigin } from "./local-origin.mjs";

try {
  const origin = localOrigin(process.argv[2]);
  const source = new URL("../server/.env", import.meta.url);
  const info = await lstat(source);
  if (
    !info.isFile() ||
    (info.mode & 0o777) !== 0o600 ||
    info.uid !== process.getuid()
  )
    throw new Error("Expected owner-only regular server/.env");
  const values = parse(await readFile(source));
  const database = new URL(values.DATABASE_URL);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(database.hostname) ||
    !values.SESSION_SECRET ||
    values.SESSION_SECRET.length < 48
  )
    throw new Error("Invalid local database/session settings");
  const directory = new URL("./.runtime/", import.meta.url);
  await mkdir(directory, { mode: 0o700, recursive: true });
  if ((await lstat(directory)).isSymbolicLink())
    throw new Error("Runtime directory must not be a symlink");
  await chmod(directory, 0o700);
  const settings = {
    NODE_ENV: "production",
    PORT: "3001",
    APP_ORIGIN: origin.origin,
    ALLOW_INSECURE_HTTP: "true",
    DATABASE_URL: values.DATABASE_URL,
    SESSION_SECRET: values.SESSION_SECRET,
  };
  const lines = Object.entries(settings).map(([key, value]) => {
    if (/[\r\n\0]/.test(value))
      throw new Error("Multiline environment value rejected");
    return `${key}="${value.replace(/[\\"]/g, "\\$&")}"`;
  });
  for (const name of ["server.env", "tickets-app.conf"]) {
    const path = new URL(name, directory);
    const old = await lstat(path).catch(() => null);
    if (old && (!old.isFile() || old.uid !== process.getuid()))
      throw new Error("Unsafe generated file target");
  }
  await writeFile(new URL("server.env", directory), lines.join("\n") + "\n", {
    mode: 0o600,
  });
  await chmod(new URL("server.env", directory), 0o600);
  const template = await readFile(
    new URL("nginx.conf.template", import.meta.url),
    "utf8",
  );
  await writeFile(
    new URL("tickets-app.conf", directory),
    template.replaceAll("__VM_HOST__", origin.hostname),
    { mode: 0o600 },
  );
  console.log(
    "Prepared ignored deploy/.runtime/server.env (0600) and nginx site. No secrets displayed.",
  );
  console.log(
    `Production origin: ${origin.origin}; API: 127.0.0.1:3001. HTTP is demonstration-only and has no TLS.`,
  );
} catch {
  console.error(
    "Deployment preparation failed; check the local origin and private environment file. Secret details withheld.",
  );
  process.exitCode = 1;
}
