import { api, csrfSchema, loginResponseSchema, meSchema, postOptions } from "./api";
import { successSchema } from "./tickets";

export const getSession = () => api("/api/auth/me", meSchema);
export const getCsrf = () => api("/api/auth/csrf", csrfSchema);
export const loginWithPassword = (values: { email: string; password: string }, token: string) =>
  api("/api/auth/login", loginResponseSchema, postOptions(values, token));
export const logoutSession = (token: string) =>
  api("/api/auth/logout", successSchema, postOptions({}, token));
