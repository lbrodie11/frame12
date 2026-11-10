/*
 * Minimal declarations for the web-standard globals core uses. Core deliberately compiles without
 * @types/node so it cannot import Node built-ins by accident (see tests/boundaries.test.mjs).
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
