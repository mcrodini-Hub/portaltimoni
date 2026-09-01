import { timingSafeEqual } from "node:crypto";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function hasLeadsMonitorAccess(request: Request) {
  const configuredToken = process.env.LEADS_MONITOR_TOKEN?.trim();
  if (!configuredToken) return false;

  const authorization = request.headers.get("authorization") ?? "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const queryToken = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  const providedToken = bearerToken || queryToken;

  return Boolean(providedToken) && safeEqual(providedToken, configuredToken);
}
