import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { randomBytes } from "node:crypto";

// Never print either the database URL or session signing secret.
try {
  const file = await open(
    new URL("../.env", import.meta.url),
    constants.O_RDWR | constants.O_NOFOLLOW,
  );
  try {
    const info = await file.stat();
    if (!info.isFile() || info.uid !== process.getuid()) throw new Error();
    await file.chmod(0o600);
    const original = await file.readFile("utf8");
    const existing = original.match(/^SESSION_SECRET=(.*)$/m);
    if (
      existing &&
      existing[1].length >= 48 &&
      !existing[1].startsWith("REPLACE_")
    ) {
      console.log(
        "Existing session secret preserved; environment permissions set to 0600.",
      );
    } else {
      const line = `SESSION_SECRET=${randomBytes(48).toString("hex")}`;
      const updated = existing
        ? original.replace(/^SESSION_SECRET=.*$/m, line)
        : `${original.trimEnd()}\n${line}\n`;
      await file.write(updated, 0, "utf8");
      await file.truncate(Buffer.byteLength(updated));
      console.log("Session secret configured securely; value withheld.");
    }
  } finally {
    await file.close();
  }
} catch {
  console.error(
    "Could not configure session secret. Create an owner-owned regular server/.env file first.",
  );
  process.exitCode = 1;
}
