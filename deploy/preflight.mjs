import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { localOrigin } from "./local-origin.mjs";
import { verifyDeployment } from "./smoke.mjs";

const runtime = fileURLToPath(new URL("./.runtime/", import.meta.url));
let api, nginx;
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await exited;
}
async function ready(address, host) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const r = await fetch(address, { headers: { Host: host } });
      if (r.ok) return;
    } catch {
      /* wait for local startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Local production rehearsal failed to start");
}
async function requireFreePort(port) {
  await new Promise((resolve, reject) => {
    const listener = createServer();
    listener.once("error", reject);
    listener.listen(port, "127.0.0.1", () => listener.close(resolve));
  });
}
try {
  if (process.getuid() === 0)
    throw new Error("Run preflight as the unprivileged project user");
  const settings = parse(
    await readFile(new URL("./.runtime/server.env", import.meta.url)),
  );
  const origin = localOrigin(settings.APP_ORIGIN);
  // Never mistake an already-running production process for this rehearsal.
  await requireFreePort(3001);
  await requireFreePort(8080);
  await mkdir(runtime, { mode: 0o700, recursive: true });
  const site = (
    await readFile(
      new URL("./.runtime/tickets-app.conf", import.meta.url),
      "utf8",
    )
  )
    .replace("listen 80;", "listen 127.0.0.1:8080;")
    .replace("listen [::]:80;", "")
    .replace(
      "root /var/www/tickets-app;",
      `root ${fileURLToPath(new URL("../client/dist", import.meta.url))};`,
    )
    .replaceAll(
      "/etc/nginx/tickets-proxy.conf",
      fileURLToPath(new URL("./nginx-proxy.conf", import.meta.url)),
    )
    .replace(
      "/var/log/nginx/tickets.access.log",
      `${runtime}/preflight.access.log`,
    )
    .replace(
      "/var/log/nginx/tickets.error.log",
      `${runtime}/preflight.error.log`,
    );
  const config = `${runtime}/preflight-nginx.conf`;
  await writeFile(
    config,
    `pid ${runtime}/nginx.pid;\nerror_log stderr;\nevents {}\nhttp {\ninclude /etc/nginx/mime.types;\nclient_body_temp_path ${runtime}/body;\nproxy_temp_path ${runtime}/proxy;\nfastcgi_temp_path ${runtime}/fastcgi;\nuwsgi_temp_path ${runtime}/uwsgi;\nscgi_temp_path ${runtime}/scgi;\n${site}\n}\n`,
    { mode: 0o600 },
  );
  const checked = spawnSync(
    "/usr/sbin/nginx",
    ["-t", "-p", runtime + "/", "-c", config],
    { stdio: "inherit" },
  );
  if (checked.status !== 0) throw new Error("nginx preflight syntax");
  const unit = spawnSync(
    "systemd-analyze",
    [
      "verify",
      "--man=no",
      fileURLToPath(new URL("./tickets-api.service", import.meta.url)),
    ],
    { stdio: "inherit" },
  );
  if (unit.status !== 0) throw new Error("systemd unit verification");
  api = spawn("/usr/bin/node", ["dist/index.js"], {
    cwd: fileURLToPath(new URL("../server/", import.meta.url)),
    env: { ...process.env, ...settings },
    stdio: "ignore",
  });
  nginx = spawn(
    "/usr/sbin/nginx",
    ["-p", runtime + "/", "-c", config, "-g", "daemon off;"],
    { stdio: "ignore" },
  );
  await ready("http://127.0.0.1:3001/api/health", origin.host);
  await ready("http://127.0.0.1:8080/api/health", origin.host);
  await verifyDeployment(origin.origin, "http://127.0.0.1:8080");
  console.log(
    "PASS: unprivileged production-mode rehearsal. Actual port-80/systemd installation still needs the documented manual sudo commands.",
  );
} catch {
  console.error(
    "Local deployment preflight failed; private details withheld. Review syntax/startup output and localhost port availability.",
  );
  process.exitCode = 1;
} finally {
  await stop(nginx);
  await stop(api);
}
