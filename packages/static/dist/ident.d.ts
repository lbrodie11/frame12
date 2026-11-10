/**
 * Turns any string (a file path, a branch name, a title) into a valid identifier for `area`,
 * `idPrefix`, `selectedId` or tone-bar item ids: `^[a-z][a-z0-9-]{0,63}$`.
 *
 * A string that is already a valid identifier is returned unchanged. Anything else is slugged
 * (lower-cased, accents stripped, other characters replaced by `-`) and suffixed with a short
 * hash of the original, so distinct inputs stay distinct (`src/Foo.ts` and `src/foo.ts` don't
 * collide). Deterministic: the same input always gives the same identifier.
 */
export declare function toIdent(value: string): string;
