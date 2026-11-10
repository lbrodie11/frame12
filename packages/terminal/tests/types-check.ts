// Consumer type test: compiled against the built .d.ts files (tests/boundaries.test.mjs).
import {
  createSanitizer,
  createStreamValidator,
  detectCapabilities,
  resolveTerminalMotion,
  validateEvent,
  type Capabilities,
  type Finding,
  type TerminalEvent,
  type Tempo,
} from '@frame12/terminal';
import { createEventFactory, fixture } from '@frame12/terminal/testing';

const caps: Capabilities = detectCapabilities({ NO_COLOR: '1' }, { stdout: { isTTY: true } }, ['--ascii']);
const tempo: Tempo = resolveTerminalMotion({ caps }).tempo;

const f = createEventFactory();
const start = f.next('cut-start', { cut: 'read-history', title: 'Read history' });
// @ts-expect-error: cut-end requires a status
f.next('cut-end', { cut: 'read-history' });
// @ts-expect-error: unknown event types are not part of the contract
f.next('cut-teleport', {});

const r = validateEvent(JSON.parse('{}'));
if (r.ok) {
  const ev: TerminalEvent = r.value;
  if (ev.type === 'finding') {
    const finding: Finding = ev.finding;
    // @ts-expect-error: prominence is a closed set
    finding.prominence = 'top';
  }
} else {
  const ignorable: boolean = r.ignorable;
  void ignorable;
}

const v = createStreamValidator();
v.push(start);
const clean = createSanitizer({ redact: (text) => text }).snapshot(fixture('success').snapshot);
export const out = [caps.columns, tempo, clean.findings.length];
