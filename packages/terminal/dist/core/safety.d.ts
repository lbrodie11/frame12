/**
 * One sanitizer for every untrusted string, merged from Repo Archaeology (RA-13) and the PR #2
 * storyboard experiment. Renderers only ever see its output.
 *
 * It removes CSI, OSC (including smuggled OSC 8 links and OSC 52 clipboard writes), DCS, SOS,
 * PM, APC and two-byte ESC sequences, in both 7-bit and C1 forms. It turns CR and BS overwrite
 * tricks into visible text, shows bidi controls (Trojan Source) as `\u{202e}` escapes, shows
 * zero-width characters as escapes in identifiers and paths, expands tabs at fixed stops, and
 * caps lines with a visible `…+N chars`.
 *
 * Links are `https:` only (plus `http:` to localhost when allowed) with credentials removed.
 * A redaction hook runs on every field. The default redactor masks common token shapes in every
 * text field (commands, errors, warnings, titles, logs and receipts), but not in ids and paths.
 */
import { type TerminalEvent, type Snapshot } from './contract.js';
import { type WidthOptions } from './width.js';
export interface SanitizeOptions extends WidthOptions {
    /**
     * `text` (titles, notes, prose) or `identifier` (ids, paths, SHAs, labels). Identifiers show
     * zero-width characters as visible escapes; text drops the invisible spacing ones.
     */
    mode?: 'text' | 'identifier';
    /** What to do with line breaks: `space` (default), `keep` (multi-line logs) or `escape` (`\n`). */
    newlines?: 'space' | 'keep' | 'escape';
    /** Tab stop width in cells. Default 4. */
    tabWidth?: number;
    /** Maximum graphemes per line before `…+N chars`. Default 2000. */
    maxLineLength?: number;
    /** Use `...` instead of `…` in the overflow marker. */
    ascii?: boolean;
}
export declare const DEFAULT_MAX_LINE_LENGTH = 2000;
export declare const DEFAULT_TAB_WIDTH = 4;
/** `\x07` for code points below 0x100, `\u{202e}` above. */
export declare function visibleEscape(ch: string): string;
/**
 * Makes untrusted text safe to print. The result contains no ESC, BEL, C1 control or bidi
 * control, and no line break unless `newlines: 'keep'`. Never throws; non-strings become ''.
 * Idempotent: sanitizing sanitized text changes nothing.
 */
export declare function sanitizeText(input: unknown, options?: SanitizeOptions): string;
export interface LinkPolicy {
    /** Allow `http:` links to localhost, 127.0.0.1 and [::1]. Default false. */
    allowLocalhostHttp?: boolean;
}
/**
 * Returns a normalized URL safe to put in an OSC 8 link, or `undefined`. Only `https:` (and,
 * when allowed, `http:` to localhost). User names and passwords are removed.
 */
export declare function safeLink(href: unknown, policy?: LinkPolicy): string | undefined;
/**
 * Wraps already-sanitized `text` in an OSC 8 hyperlink when links are enabled and the URL passes
 * `safeLink`; otherwise returns `text` unchanged. This is the only OSC 8 the package emits.
 */
export declare function formatLink(text: string, href: unknown, enabled: boolean, policy?: LinkPolicy): string;
export type RedactField = 'log' | 'receipt' | 'text' | 'identifier';
export interface RedactContext {
    /** What kind of field this string came from. */
    field: RedactField;
    /** The event type, or `snapshot`. */
    source: string;
}
/** A redaction hook. Receives sanitized text; its output is sanitized again. */
export type Redactor = (text: string, context: RedactContext) => string;
export declare const REDACTED = "[redacted]";
/** Token shapes masked by default in every text field an event or snapshot carries. */
export declare const DEFAULT_REDACTION_PATTERNS: ReadonlyArray<{
    name: string;
    pattern: RegExp;
}>;
/** Masks every default token shape with `[redacted]`. */
export declare function redactSecrets(text: string): string;
export interface SafetyOptions extends WidthOptions {
    /** Extra redaction, run on every string field after the default redactor. */
    redact?: Redactor;
    /** Mask common token shapes in every text field (not ids or paths). Default true. */
    defaultRedaction?: boolean;
    maxLineLength?: number;
    tabWidth?: number;
    ascii?: boolean;
    links?: LinkPolicy;
}
export interface Sanitizer {
    /** Sanitizes (and redacts) one string. */
    text(value: unknown, field?: RedactField, source?: string): string;
    /** Returns a safe link or `undefined`. */
    href(value: unknown): string | undefined;
    /** A deep, sanitized copy of a validated event. Unsafe links are removed. */
    event<E extends TerminalEvent>(event: E): E;
    /** A deep, sanitized copy of a validated snapshot. */
    snapshot(snapshot: Snapshot): Snapshot;
}
/**
 * Builds the sanitizer every renderer and the director use. Each string is sanitized, redacted
 * (defaults on `log`/`receipt` fields, then the hook on all fields), and sanitized again, so a
 * hook can never reintroduce control sequences.
 */
export declare function createSanitizer(options?: SafetyOptions): Sanitizer;
