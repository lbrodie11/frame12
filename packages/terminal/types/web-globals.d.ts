/*
 * Minimal declarations for the web-standard globals core uses, for tsconfig.core.json only. Core
 * deliberately compiles without @types/node, so a Node global (Buffer, process.stdout) cannot slip
 * in; tests/boundaries.test.mjs catches Node imports.
 */
declare class URL {
  constructor(input: string, base?: string);
  href: string;
  protocol: string;
  hostname: string;
  username: string;
  password: string;
}
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
declare var process: { platform?: string } | undefined;
declare function setTimeout(fn: () => void, ms?: number): { unref?(): void };
declare function clearTimeout(handle: unknown): void;
declare var performance: { now(): number };
declare class AbortController {
  readonly signal: { readonly aborted: boolean; readonly reason: unknown };
  abort(reason?: unknown): void;
}
