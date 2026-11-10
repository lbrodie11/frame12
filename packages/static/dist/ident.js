import { hash } from './hash.js';
import { IDENT_RE } from './validate.js';
/**
 * Turns any string (a file path, a branch name, a title) into a valid identifier for `area`,
 * `idPrefix`, `selectedId` or tone-bar item ids: `^[a-z][a-z0-9-]{0,63}$`.
 *
 * A string that is already a valid identifier is returned unchanged. Anything else is slugged
 * (lower-cased, accents stripped, other characters replaced by `-`) and suffixed with a short
 * hash of the original, so distinct inputs stay distinct (`src/Foo.ts` and `src/foo.ts` don't
 * collide). Deterministic: the same input always gives the same identifier.
 */
export function toIdent(value) {
    const s = String(value);
    if (IDENT_RE.test(s))
        return s;
    const suffix = `-${hash(s)}`;
    let slug = s
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (!/^[a-z]/.test(slug))
        slug = `x${slug ? `-${slug}` : ''}`;
    slug = slug.slice(0, 64 - suffix.length).replace(/-+$/, '');
    return `${slug}${suffix}`;
}
