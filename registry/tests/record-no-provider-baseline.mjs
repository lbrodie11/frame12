// Re-records registry/tests/fixtures/no-provider-baseline.json. The committed file was recorded
// BEFORE tempo existed (F12-08); only re-record when a deliberate, reviewed visual change lands.
//   node registry/tests/record-no-provider-baseline.mjs
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
