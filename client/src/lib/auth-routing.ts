export type Role = "customer" | "staff";
export function homeFor(role: Role): string {
  return role === "staff" ? "/staff/inbox" : "/customer/tickets";
}
export function routeFor(role: Role | null, path: string): string {
  if (role === null) return "/login";
  if (
    role === "customer" &&
    /^\/customer\/tickets(?:\/new|\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i.test(
      path,
    )
  )
    return path;
  const home = homeFor(role);
  return path === home ? path : home;
}
