/** Validation helpers. Every failure throws a `TypeError` naming the function and field. */

export const IDENT_RE = /^[a-z][a-z0-9-]{0,63}$/;

export function fail(where: string, message: string): never {
  throw new TypeError(`[@frame12/static ${where}] ${message}`);
}

/** Identifiers that end up in ids, `data-area` and CSS custom properties. */
export function ident(where: string, field: string, value: unknown): string {
  if (typeof value !== 'string' || !IDENT_RE.test(value)) {
    fail(where, `${field} must match ${IDENT_RE} (got ${JSON.stringify(String(value)).slice(0, 80)})`);
  }
  return value;
}

export function optIdent(where: string, field: string, value: unknown): string | undefined {
  return value === undefined ? undefined : ident(where, field, value);
}

export function num(
  where: string,
  field: string,
  value: unknown,
  min: number,
  max: number,
  opts: { integer?: boolean } = {},
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(where, `${field} must be a finite number (got ${String(value)})`);
  }
  if (value < min || value > max) {
    fail(where, `${field} must be between ${min} and ${max} (got ${value})`);
  }
  if (opts.integer && !Number.isInteger(value)) {
    fail(where, `${field} must be an integer (got ${value})`);
  }
  return value;
}

export function oneOf<T extends string>(
  where: string,
  field: string,
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    fail(where, `${field} must be one of ${allowed.join(', ')} (got ${JSON.stringify(String(value)).slice(0, 80)})`);
  }
  return value as T;
}

export function optString(where: string, field: string, value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') fail(where, `${field} must be a string`);
  return value;
}

export function bool(where: string, field: string, value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') fail(where, `${field} must be a boolean`);
  return value;
}

/** Throws the package's TypeError (not a raw "Cannot read properties of null") for non-objects. */
export function obj<T>(where: string, value: T, field = 'options'): NonNullable<T> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(where, `${field} must be an object (got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value})`);
  }
  return value as NonNullable<T>;
}
