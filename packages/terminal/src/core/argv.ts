/**
 * Command-line flag helpers shared by capability and motion detection. Internal: not exported
 * from the package entry point. Arguments after a `--` terminator are never read.
 */

/** Arguments before a `--` terminator; everything after it belongs to someone else. */
export function ownArgs(argv: readonly string[]): readonly string[] {
  const end = argv.indexOf('--');
  return end === -1 ? argv : argv.slice(0, end);
}

/** Last occurrence wins among mutually exclusive flags (`--color` vs `--no-color`). */
export function lastFlag(argv: readonly string[], ...names: string[]): string | undefined {
  const own = ownArgs(argv);
  for (let i = own.length - 1; i >= 0; i--) {
    if (names.includes(own[i]!)) return own[i];
  }
  return undefined;
}

/** True when a boolean flag is present. */
export function hasFlag(argv: readonly string[], name: string): boolean {
  return ownArgs(argv).includes(name);
}

/** The value of `--name value` or `--name=value`; the last occurrence wins. */
export function flagValue(argv: readonly string[], name: string): string | undefined {
  const own = ownArgs(argv);
  let found: string | undefined;
  for (let i = 0; i < own.length; i++) {
    const a = own[i]!;
    if (a === name && i + 1 < own.length) found = own[i + 1];
    else if (a.startsWith(`${name}=`)) found = a.slice(name.length + 1);
  }
  return found;
}
