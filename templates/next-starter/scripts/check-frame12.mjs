#!/usr/bin/env node
// Thin CLI and module wrapper around @frame12/lint.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RULES,
  FORBIDDEN_SHADCN_MODULES,
  FORBIDDEN_EXTERNAL_PACKAGES,
  lintSource,
  collectFiles,
  lintFiles,
  lintHtml,
  runCli,
} from '@frame12/lint';

export {
  RULES,
  FORBIDDEN_SHADCN_MODULES,
  FORBIDDEN_EXTERNAL_PACKAGES,
  lintSource,
  collectFiles,
  lintFiles,
  lintHtml,
  runCli,
};

const isMain =
  process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isMain) {
  process.exit(runCli());
}
