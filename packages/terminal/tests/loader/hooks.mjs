/**
 * Module-resolution hook for the boundary test: fails the import if anything resolves React,
 * Ink, their renderer dependencies, or a child-process module, and prints every bare and
 * built-in specifier it saw so the test can assert on the full list.
 */
const DENY = /^(?:react|react-dom|react-reconciler|ink|ink-testing-library|yoga-layout|scheduler)(?:\/|$)|^(?:node:)?child_process$/;

export async function resolve(specifier, context, next) {
  if (!specifier.startsWith('.') && !specifier.startsWith('file:') && !specifier.startsWith('/')) {
    process.stderr.write(`F12-RESOLVE ${specifier}\n`);
  }
  if (DENY.test(specifier)) {
    throw new Error(`Module boundary violated: "${specifier}" was imported by ${context.parentURL ?? 'the entry point'}`);
  }
  return next(specifier, context);
}
