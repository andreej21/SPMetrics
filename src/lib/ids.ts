import { randomUUID, createHash } from "node:crypto";

// Prefixed, URL-safe ids. The prefix makes ids self-describing in logs & the DB.
function rid(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export const newSiteId = () => rid("site");
export const newVisitorId = () => rid("vis");
export const newSessionId = () => rid("ses");
export const newIdentityId = () => rid("idn");
export const newEventId = () => rid("evt");
export const newOrderId = () => rid("ord");
export const newSpendId = () => rid("spd");

// Public token embedded in the browser (safe to expose).
export const newPixelToken = () => `pk_${randomUUID().replace(/-/g, "")}`;
// Secret key for server-to-server / webhook auth (never sent to the browser).
export const newS2sKey = () => `sk_${randomUUID().replace(/-/g, "")}`;

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// Hash an email after normalizing, for privacy-safe identity matching.
export function hashEmail(email: string): string {
  return sha256(email.trim().toLowerCase());
}

// Hash an IP with a rotating daily salt so we can rate-limit / dedupe without storing raw IPs.
export function hashIp(ip: string, salt: string): string {
  return sha256(`${ip}|${salt}`);
}
