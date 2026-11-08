export type RuleId =
  | 'color-literal'
  | 'illegal-gutter'
  | 'marker-misuse'
  | 'cut-order'
  | 'explicit-cut-in-autocut'
  | 'raw-shadcn-import'
  | 'unsafe-html';

export interface Violation {
  rule: RuleId;
  message: string;
  file: string;
  line: number;
  column: number;
  snippet?: string;
}

export interface LintHtmlOptions {
  /**
   * File name reported in returned `Violation` entries.
   * @default "input.html"
   */
  file?: string;
  /**
   * `<style id="...">` element IDs whose contents define design tokens and
   * should be exempt from CSS literal rules (in addition to `<style data-f12-tokens>`).
   */
  tokenStyleIds?: string[];
}

export interface LintSourceOptions {
  /**
   * Force fallback behavior as if the optional `typescript` peer dependency is not installed.
   */
  disableTypeScript?: boolean;
}

export declare const RULES: Readonly<Record<RuleId, string>>;
export declare const FORBIDDEN_SHADCN_MODULES: ReadonlySet<string>;
export declare const FORBIDDEN_EXTERNAL_PACKAGES: ReadonlySet<string>;

export declare function lintSource(
  content: string,
  filePath?: string,
  opts?: LintSourceOptions
): Violation[];

export declare function collectFiles(targetPaths: string[]): string[];

export declare function lintFiles(targetPaths: string[]): {
  files: string[];
  violations: Violation[];
};

export declare function lintHtml(
  html: string,
  opts?: LintHtmlOptions
): Violation[];

export declare function runCli(argv?: string[], cwd?: string): number;
