import { getAdminPin } from "@/lib/store-db";

const COOKIE_NAME = "bingwa_admin";
const FALLBACK_PIN = "9898";
const TOKEN_PAYLOAD = "admin";

function secret() {
  return process.env["SESSION_SECRET"]?.trim() || process.env["ADMIN_PIN"]?.trim() || FALLBACK_PIN;
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

export async function isCorrectPin(pin: string) {
  if (!pin) return false;
  const dbPin = await getAdminPin().catch(() => null);
  const envPin = process.env["ADMIN_PIN"]?.trim();
  return pin === (dbPin ?? envPin ?? FALLBACK_PIN) || (!!envPin && pin === envPin);
}

export async function createAdminCookie() {
  const token = await createAdminToken();
  // SameSite=None + Partitioned so the session survives the embedded preview iframe.
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=None; Path=/; Max-Age=28800; Secure; Partitioned`;
}

export async function createAdminToken() {
  return sign(TOKEN_PAYLOAD);
}

async function isValidAdminToken(token: string | undefined) {
  return !!token && token === (await createAdminToken());
}

export async function isAdminRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (await isValidAdminToken(bearerToken)) return true;

  return isValidAdminToken(readCookie(request));
}

export const adminLogoutCookie = `${COOKIE_NAME}=; HttpOnly; SameSite=None; Path=/; Max-Age=0; Secure; Partitioned`;
