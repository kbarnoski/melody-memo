/**
 * Tiny environment-aware logger.
 *
 * Use instead of raw `console.log` for anything that's diagnostic rather
 * than user-facing. `debug` disappears in production builds; `warn`/`error`
 * always fire so real problems aren't swallowed.
 *
 * Scopes make greps easy: logger.debug("audio-engine", "resume failed", err)
 * prints `[audio-engine] resume failed` + err in dev.
 */

const isDev = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

export const logger = {
  debug(scope: string, message: string, ...rest: unknown[]): void {
    if (!isDev) return;
    // eslint-disable-next-line no-console
    console.log(`[${scope}] ${message}`, ...rest);
  },
  info(scope: string, message: string, ...rest: unknown[]): void {
    // eslint-disable-next-line no-console
    console.info(`[${scope}] ${message}`, ...rest);
  },
  warn(scope: string, message: string, ...rest: unknown[]): void {
    // eslint-disable-next-line no-console
    console.warn(`[${scope}] ${message}`, ...rest);
  },
  error(scope: string, message: string, ...rest: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error(`[${scope}] ${message}`, ...rest);
  },
};
