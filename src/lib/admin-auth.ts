const COOKIE_NAME = "bingwa_admin";
const FALLBACK_PIN = "9898";

function secret() {
  return process.env.SESSION_SECRET?.trim() || process.env.ADMIN_PIN?.trim() || FALLBACK_PIN;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function readCookie(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
}

export function isCorrectPin(pin: string) {
  return pin === (process.env.ADMIN_PIN?.trim() || FALLBACK_PIN);
}

export async function createAdminCookie() {
  const token = await sign("admin");
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800; Secure`;
}

export async function isAdminRequest(request: Request) {
  const token = readCookie(request);
  return token === (await sign("admin"));
}

export const adminLogoutCookie = `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure`;
