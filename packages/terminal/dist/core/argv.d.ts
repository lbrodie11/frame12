/**
 * Command-line flag helpers shared by capability and motion detection. Internal: not exported
 * from the package entry point. Arguments after a `--` terminator are never read.
 */
/** Arguments before a `--` terminator; everything after it belongs to someone else. */
export declare function ownArgs(argv: readonly string[]): readonly string[];
/** Last occurrence wins among mutually exclusive flags (`--color` vs `--no-color`). */
export declare function lastFlag(argv: readonly string[], ...names: string[]): string | undefined;
/** True when a boolean flag is present. */
export declare function hasFlag(argv: readonly string[], name: string): boolean;
/** The value of `--name value` or `--name=value`; the last occurrence wins. */
export declare function flagValue(argv: readonly string[], name: string): string | undefined;
