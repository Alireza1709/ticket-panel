export type Role = "customer" | "staff";
export function homeFor(role: Role): string {
  return role === "staff" ? "/staff/inbox" : "/customer/tickets";
}
export function routeFor(role: Role | null, path: string): string {
  if (role === null) return path === "/register" ? path : "/login";
  const pathname = path.split("?")[0];
  if (pathname === `/${role}/overview` || pathname === `/${role}/profile`) return path;
  if (
    role === "staff" &&
    /^\/staff\/(?:inbox|tickets\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/.test(
      pathname,
    )
  )
    return path;
  if (
    role === "customer" &&
    /^\/customer\/tickets(?:\/new|\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})?$/.test(
      pathname,
    )
  )
    return path;
  const home = homeFor(role);
  return path === home ? path : home;
}
