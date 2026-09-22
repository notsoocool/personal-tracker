import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "pt_owner";

function secret() {
  return process.env.SESSION_SECRET || "personal-tracker-dev-secret";
}

export function ownerPassword() {
  return process.env.OWNER_PASSWORD || "tracker-dev";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export async function createOwnerSession() {
  const jar = await cookies();
  const payload = `owner:${Date.now()}`;
  const token = `${payload}.${sign(payload)}`;
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearOwnerSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isOwnerAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload);
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function passwordsMatch(input: string) {
  const expected = ownerPassword();
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
