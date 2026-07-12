// Client for the Flask backend running at http://localhost:5000
// Change VITE_API_BASE in .env to point elsewhere.
export const API_BASE =
  (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE ||
  "http://localhost:5000";

const TOKEN_KEY = "assetflow_token";
const USER_KEY = "assetflow_user";

export type Role = "employee" | "department_head" | "asset_manager" | "admin";
export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  department_id: number | null;
  status: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: CurrentUser) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (body && (body.message || body.error)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}
