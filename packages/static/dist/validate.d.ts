/** Validation helpers. Every failure throws a `TypeError` naming the function and field. */
export declare const IDENT_RE: RegExp;
export declare function fail(where: string, message: string): never;
/** Identifiers that end up in ids, `data-area` and CSS custom properties. */
export declare function ident(where: string, field: string, value: unknown): string;
export declare function optIdent(where: string, field: string, value: unknown): string | undefined;
export declare function num(where: string, field: string, value: unknown, min: number, max: number, opts?: {
    integer?: boolean;
}): number;
export declare function oneOf<T extends string>(where: string, field: string, value: unknown, allowed: readonly T[], fallback: T): T;
export declare function optString(where: string, field: string, value: unknown): string | undefined;
export declare function bool(where: string, field: string, value: unknown, fallback: boolean): boolean;
