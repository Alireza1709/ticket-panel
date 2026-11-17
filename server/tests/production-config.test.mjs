import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function probe(origin, allow) {
  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "const {cookieOptions}=await import('./dist/auth.js'); console.log(JSON.stringify({secure:cookieOptions.secure,httpOnly:cookieOptions.httpOnly,sameSite:cookieOptions.sameSite})); const {pool}=await import('./dist/db.js'); await pool.end();",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        APP_ORIGIN: origin,
        ALLOW_INSECURE_HTTP: allow,
        SESSION_SECRET: "production-config-test-only-".repeat(4),
        DATABASE_URL: "postgresql://127.0.0.1:1/config_test",
      },
    },
  );
}
test("production HTTP is rejected without explicit opt-in", () => {
  assert.notEqual(probe("http://127.0.0.1", "false").status, 0);
});
test("required demo HTTP enables non-Secure HttpOnly SameSite cookies explicitly", () => {
  const result = probe("http://127.0.0.1", "true");
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    secure: false,
    httpOnly: true,
    sameSite: "lax",
  });
});
test("HTTPS keeps Secure cookies even when the HTTP exception flag is set", () => {
  for (const flag of ["true", "false"]) {
    const result = probe("https://example.test", flag);
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout.trim()).secure, true);
  }
});
test("production rejects a path-bearing application origin", () => {
  assert.notEqual(probe("http://127.0.0.1/path", "true").status, 0);
});
