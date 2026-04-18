/**
 * Shared helpers for API route handlers. Keep response shapes consistent
 * across /src/app/api/**\/route.ts — always `{ error: string, ... }` for
 * failures, naked object or `{ data: ... }` for success, and never leak
 * internal error messages in production.
 */

const isDev = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

export function successResponse<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

export function errorResponse(
  message: string,
  status = 500,
  opts?: { logScope?: string; cause?: unknown }
): Response {
  if (opts?.cause) {
    // eslint-disable-next-line no-console
    console.error(`[${opts.logScope ?? "api"}] ${message}`, opts.cause);
  }
  const body: Record<string, unknown> = { error: message };
  if (isDev && opts?.cause instanceof Error) {
    body.debug = { name: opts.cause.name, stack: opts.cause.stack };
  }
  return Response.json(body, { status });
}

export const unauthorized = (): Response =>
  Response.json({ error: "Unauthorized" }, { status: 401 });

export const forbidden = (): Response =>
  Response.json({ error: "Forbidden" }, { status: 403 });

export const notFound = (what = "Not found"): Response =>
  Response.json({ error: what }, { status: 404 });

export const badRequest = (what = "Bad request"): Response =>
  Response.json({ error: what }, { status: 400 });
