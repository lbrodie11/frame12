// The package runs in Node, browsers and bundlers but uses only one host API: the WHATWG URL
// parser (safeUrl). Declaring just that keeps `lib: ["ES2022"]` (no DOM types), so accidental
// uses of `window` or `document` globals fail to type-check instead of crashing at runtime.
declare class URL {
  constructor(input: string, base?: string);
  readonly protocol: string;
  readonly hostname: string;
}
