import { networkInterfaces } from "node:os";
import { isIP } from "node:net";

// Deployment checks must never probe other employer network machines.
export function localOrigin(value) {
  const url = new URL(value);
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter(Boolean)
    .map((item) => item.address);
  if (
    url.protocol !== "http:" ||
    url.origin !== value ||
    (url.port && url.port !== "80") ||
    isIP(url.hostname) !== 4 ||
    !addresses.includes(url.hostname)
  ) {
    throw new Error(
      "Use http://<this VM's own IPv4 address> without a path or non-80 port.",
    );
  }
  return url;
}
