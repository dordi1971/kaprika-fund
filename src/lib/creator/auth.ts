import { sessionAddress } from "./store";

export const SESSION_COOKIE = "os_session";

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export function getSessionAddressFromCookies(cookies: CookieReader) {
  const token = cookies.get(SESSION_COOKIE)?.value;
  return sessionAddress(token) ?? null;
}

export function requireSessionAddress(cookies: CookieReader) {
  const address = getSessionAddressFromCookies(cookies);
  if (!address) {
    return { ok: false as const, response: Response.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }
  return { ok: true as const, address };
}
