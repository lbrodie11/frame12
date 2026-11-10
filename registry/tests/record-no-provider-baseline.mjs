// Re-records registry/tests/fixtures/no-provider-baseline.json. The committed file must come from
// the PRE-tempo source (F12-08), so record it from a worktree of the commit before the change,
// with this harness (fonts are inlined, so the result is the same on any machine or CI image):
//   git worktree add --detach /tmp/pre-tempo 7d638b1
//   cp registry/tests/{harness,no-provider-capture,record-no-provider-baseline,lib}.mjs /tmp/pre-tempo/registry/tests/
//   ln -s "$PWD/node_modules" /tmp/pre-tempo/node_modules
//   ln -s "$PWD/registry/node_modules" /tmp/pre-tempo/registry/node_modules
//   (cd /tmp/pre-tempo && node registry/tests/record-no-provider-baseline.mjs)
//   cp /tmp/pre-tempo/registry/tests/fixtures/no-provider-baseline.json registry/tests/fixtures/
// Only re-record when a deliberate, reviewed visual change lands.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch } from './lib.mjs';
import { captureNoProvider } from './no-provider-capture.mjs';
import { REGISTRY_ROOT } from './harness.mjs';

const browser = await launch('chromium');
const result = await captureNoProvider(browser);
await browser.close();
const out = resolve(REGISTRY_ROOT, 'tests/fixtures/no-provider-baseline.json');
writeFileSync(out, JSON.stringify(result, null, 1) + '\n');
for (const [name, r] of Object.entries(result)) {
  console.log(`${name}: ssr ${r.ssr} · ${r.timeline.length} timeline poses · ${r.animations.length} animations · ${r.errors.length} errors`);
}
