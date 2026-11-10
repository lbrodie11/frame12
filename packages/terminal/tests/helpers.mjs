/** Shared test helpers: a seeded PRNG and a small JSON Schema (2020-12 subset) validator. */

/** Mulberry32: tiny, fast, deterministic. */
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

/**
 * Validates `value` against the subset of JSON Schema the generated contract schema uses:
 * $ref, type, const, enum, required, properties, items, minimum, maximum, minLength,
 * maxLength, maxItems, pattern, not, oneOf. Returns a list of error strings.
 */
export function schemaErrors(schema, value, root = schema, path = '$') {
  const errs = [];
  if (schema.$ref) {
    const name = schema.$ref.replace('#/$defs/', '');
    return schemaErrors(root.$defs[name], value, root, path);
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((s) => schemaErrors(s, value, root, path).length === 0).length;
    if (matches !== 1) errs.push(`${path}: matched ${matches} of oneOf`);
    return errs;
  }
  if (schema.not && schemaErrors(schema.not, value, root, path).length === 0) errs.push(`${path}: matched "not"`);
  if (schema.const !== undefined && value !== schema.const) errs.push(`${path}: const`);
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${path}: enum`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const ok = types.some((t) =>
      t === 'integer'
        ? Number.isInteger(value)
        : t === 'number'
          ? typeof value === 'number' && Number.isFinite(value)
          : t === 'array'
            ? Array.isArray(value)
            : t === 'object'
              ? typeof value === 'object' && value !== null && !Array.isArray(value)
              : typeof value === t,
    );
    if (!ok) return [`${path}: type ${types.join('|')}`];
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errs.push(`${path}: minLength`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errs.push(`${path}: maxLength`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errs.push(`${path}: pattern`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errs.push(`${path}: minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errs.push(`${path}: maximum`);
  }
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errs.push(`${path}: maxItems`);
    if (schema.items) value.forEach((v, i) => errs.push(...schemaErrors(schema.items, v, root, `${path}[${i}]`)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const k of schema.required ?? []) if (value[k] === undefined) errs.push(`${path}.${k}: required`);
    for (const [k, s] of Object.entries(schema.properties ?? {})) {
      if (value[k] !== undefined) errs.push(...schemaErrors(s, value[k], root, `${path}.${k}`));
    }
  }
  return errs;
}

/** Characters that must never survive sanitization. */
export const FORBIDDEN_OUTPUT = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
