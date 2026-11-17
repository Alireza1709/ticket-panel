export type Role = "customer" | "staff";
export function homeFor(role: Role): string {
  return role === "staff" ? "/staff/inbox" : "/customer/tickets";
}
export function routeFor(role: Role | null, path: string): string {
  if (role === null) return "/login";
  const home = homeFor(role);
  return path === home ? path : home;
}
