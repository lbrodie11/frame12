import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_REDACTION_PATTERNS,
  REDACTED,
  createSanitizer,
  formatLink,
  graphemes,
  redactSecrets,
  safeLink,
  sanitizeText,
  stringWidth,
  validateEvent,
} from '@frame12/terminal';
import { createEventFactory, fixture } from '@frame12/terminal/testing';
import { FORBIDDEN_OUTPUT, rng } from './helpers.mjs';

const ESC = '\u001b';
const OSC8 = /\u001b\]8;/;

/** Building blocks for the fuzzer: every escape family, overwrite tricks, and ordinary text. */
const PIECES = [
  `${ESC}[31m`, `${ESC}[0m`, `${ESC}[2J`, `${ESC}[?1049h`, `${ESC}[1;1H`, `${ESC}[38;2;255;214;10m`, `${ESC}[`, '\u009b31m', '\u009b',
  `${ESC}]8;;https://evil.example/${ESC}\\`, `${ESC}]8;;${ESC}\\`, `${ESC}]8;;javascript:alert(1)\u0007`, '\u009d8;;https://c1.example\u009c',
  `${ESC}]52;c;cm0gLXJmIH4=\u0007`, `${ESC}]52;p;?${ESC}\\`, `${ESC}]0;window title\u0007`, `${ESC}]1337;File=x`, `${ESC}]`,
  `${ESC}P1$r0m${ESC}\\`, `${ESC}Pq#0;2;0;0;0`, '\u0090payload\u009c', `${ESC}_apc${ESC}\\`, `${ESC}^pm\u0007`, `${ESC}Xsos${ESC}\\`, '\u009fapc', '\u009epm', '\u0098sos',
  `${ESC}c`, `${ESC}7`, `${ESC}8`, `${ESC}(B`, `${ESC}#8`, `${ESC}`, `${ESC}${ESC}`,
  '\r', '\r\n', '\n', '\b', '\b\b\b', '\u007f', '\u0000', '\u0007', '\u000b', '\u000c', '\u0085', '\u2028', '\u2029', '\t',
  '\u202e', '\u202d', '\u2066', '\u2067', '\u2068', '\u2069', '\u200e', '\u200f', '\u061c', '\u202a', '\u202c',
  '\u200b', '\u200c', '\u200d', '\u2060', '\ufeff', '\u00ad', '\u3164',
  'hello', 'src/a b/c.ts', 'rm -rf /', '漢字', 'ｶﾀｶﾅ', '👨\u200d👩\u200d👧', '🇯🇵', '👍🏽', 'é', '❤️', '─', ' ', '/', 'ghp_' + 'A'.repeat(36),
];

function fuzzString(r) {
  let s = '';
  const n = r.int(0, 12);
  for (let i = 0; i < n; i++) {
    const roll = r.next();
    if (roll < 0.75) s += r.pick(PIECES);
    else if (roll < 0.9) s += String.fromCodePoint(r.int(0, 0x2fff));
    else if (roll < 0.97) s += String.fromCodePoint(r.int(0x1f000, 0x1faff));
    else s += 'x'.repeat(r.int(100, 3000)); // oversized line
  }
  return s;
}

describe('safety: seeded fuzz over every escape family (10,000 cases)', () => {
  it('leaves no raw ESC, BEL, C1 control or bidi control, in every mode, and is idempotent', () => {
    const r = rng(0xf12);
    const modes = [
      { mode: 'text', newlines: 'space' },
      { mode: 'identifier', newlines: 'space' },
      { mode: 'text', newlines: 'keep' },
      { mode: 'identifier', newlines: 'escape', ascii: true },
    ];
    for (let i = 0; i < 10_000; i++) {
      const input = fuzzString(r);
      const opts = modes[i % modes.length];
      const out = sanitizeText(input, opts);
      assert.ok(!FORBIDDEN_OUTPUT.test(out), `case ${i}: ${JSON.stringify(input).slice(0, 200)} → ${JSON.stringify(out).slice(0, 200)}`);
      assert.ok(!out.includes(ESC) && !out.includes('\u0007'), `case ${i}: ESC/BEL survived`);
      assert.ok(!OSC8.test(out), `case ${i}: an OSC 8 link survived`);
      if (opts.newlines !== 'keep') assert.ok(!out.includes('\n'), `case ${i}: newline in single-line mode`);
      assert.ok(!out.includes('\t'), `case ${i}: tab survived`);
      for (const line of out.split('\n')) assert.ok(graphemes(line).length <= 2000 + 20, `case ${i}: line not capped`);
      assert.equal(sanitizeText(out, opts), out, `case ${i}: not idempotent with line caps`);
      const unbounded = { ...opts, maxLineLength: Infinity };
      const once = sanitizeText(input, unbounded);
      assert.equal(sanitizeText(once, unbounded), once, `case ${i}: not idempotent`);
      assert.ok(Number.isFinite(stringWidth(out)));
    }
  });

  it('only package-emitted OSC 8 links survive, and only for safe URLs', () => {
    const r = rng(52);
    const hrefs = ['https://example.com/a', 'http://example.com', 'javascript:alert(1)', 'https://u:p@example.com/x', `https://e.com/${ESC}]52;c;x\u0007`, 'file:///etc/passwd', 'https://exa\u202emple.com', '', 'data:text/html,x'];
    for (let i = 0; i < 2000; i++) {
      const text = sanitizeText(fuzzString(r));
      const href = r.pick(hrefs);
      const out = formatLink(text, href, true);
      const opens = out.split(`${ESC}]8;;`).length - 1;
      if (safeLink(href)) {
        assert.equal(opens, 2, 'one open and one close');
        assert.ok(out.startsWith(`${ESC}]8;;https://`));
        assert.ok(!out.includes('u:p@'));
      } else {
        assert.equal(out, text);
      }
    }
  });
});

describe('safety: specific attacks', () => {
  it('shows text hidden by CR and BS overwrite tricks instead of letting it be painted over', () => {
    assert.equal(sanitizeText('rm -rf ~/\rls'), 'rm -rf ~/ ls');
    assert.equal(sanitizeText('rm -rf ~/\rls', { newlines: 'keep' }), 'rm -rf ~/\nls');
    assert.equal(sanitizeText('safe\b\b\b\bevil'), 'safe\\x08\\x08\\x08\\x08evil');
  });

  it('removes OSC 52 clipboard writes entirely (BEL, ST, C1 ST and unterminated)', () => {
    for (const seq of [`${ESC}]52;c;ZXZpbA==\u0007`, `${ESC}]52;c;ZXZpbA==${ESC}\\`, `\u009d52;c;ZXZpbA==\u009c`, `${ESC}]52;c;ZXZpbA==`]) {
      assert.equal(sanitizeText(`a${seq}b`), seq.endsWith('==') ? 'a' : 'ab');
    }
  });

  it('keeps visible link text but drops smuggled OSC 8 targets', () => {
    assert.equal(sanitizeText(`see ${ESC}]8;;https://evil.example${ESC}\\the docs${ESC}]8;;${ESC}\\`), 'see the docs');
  });

  it('makes Trojan Source bidi controls visible', () => {
    const out = sanitizeText('access_level != "user\u202e \u2066// Check if admin\u2069 \u2066"');
    assert.match(out, /\\u\{202e\}/);
    assert.match(out, /\\u\{2066\}/);
    assert.ok(!/[\u202a-\u202e\u2066-\u2069]/.test(out));
  });

  it('shows zero-width characters in identifiers, keeps emoji ZWJ sequences and shaping joiners', () => {
    assert.equal(sanitizeText('src/ad\u200bmin.ts', { mode: 'identifier' }), 'src/ad\\u{200b}min.ts');
    assert.equal(sanitizeText('src/ad\u200bmin.ts', { mode: 'text' }), 'src/admin.ts');
    assert.equal(sanitizeText('family-👨\u200d👩\u200d👧.png', { mode: 'identifier' }), 'family-👨\u200d👩\u200d👧.png');
    assert.equal(sanitizeText('a\u200db', { mode: 'identifier' }), 'a\\u{200d}b');
    assert.equal(sanitizeText('می\u200cخواهم', { mode: 'text' }), 'می\u200cخواهم', 'ZWNJ shapes Persian text');
  });

  it('expands tabs at fixed stops and caps lines with a visible marker', () => {
    assert.equal(sanitizeText('a\tb'), 'a   b');
    assert.equal(sanitizeText('abcd\te'), 'abcd    e');
    assert.equal(sanitizeText('a\tb', { tabWidth: 8 }), 'a       b');
    assert.equal(sanitizeText('漢\tb'), '漢  b', 'tab stops are measured in cells');
    assert.equal(sanitizeText('x'.repeat(30), { maxLineLength: 10 }), `${'x'.repeat(10)}…+20 chars`);
    assert.equal(sanitizeText('x'.repeat(30), { maxLineLength: 10, ascii: true }), `${'x'.repeat(10)}...+20 chars`);
    assert.equal(sanitizeText('👨\u200d👩\u200d👧'.repeat(5), { maxLineLength: 2 }), '👨\u200d👩\u200d👧👨\u200d👩\u200d👧…+3 chars', 'counts graphemes, never splits one');
  });

  it('never throws and turns non-strings into text or nothing', () => {
    assert.equal(sanitizeText(undefined), '');
    assert.equal(sanitizeText(null), '');
    assert.equal(sanitizeText({ toString() { throw new Error('x'); } }), '');
    assert.equal(sanitizeText(42), '42');
    assert.equal(sanitizeText(10n), '10');
  });
});

describe('safety: review regressions (PR #31)', () => {
  it('an unterminated escape string never hides the lines after it', () => {
    for (const intro of [`${ESC}]0;title`, `${ESC}]52;c;ZXZpbA==`, `${ESC}Pq#0;2`, `${ESC}_apc`, '\u009d8;;https://x', '\u0090dcs']) {
      assert.equal(sanitizeText(`a${intro}\nline2\nline3`, { newlines: 'keep' }), 'a\nline2\nline3', JSON.stringify(intro));
      assert.equal(sanitizeText(`a${intro}\r\nline2`, { newlines: 'keep' }), 'a\nline2');
      assert.equal(sanitizeText(`a${intro}\nline2`), 'a line2', 'single-line mode keeps the following text too');
    }
  });

  it('is idempotent with line caps, and never trusts a count from the input', () => {
    const once = sanitizeText('x'.repeat(30), { maxLineLength: 10 });
    assert.equal(once, `${'x'.repeat(10)}…+20 chars`);
    assert.equal(sanitizeText(once, { maxLineLength: 10 }), once);
    assert.equal(sanitizeText(once, { maxLineLength: 4 }), `${'x'.repeat(4)}…+16 chars`, 'a recap counts the old marker as text');
    // Forged markers in untrusted text are plain text (second review).
    assert.equal(sanitizeText('short …+999 chars', { maxLineLength: 3 }), 'sho…+14 chars');
    assert.equal(sanitizeText(`${'y'.repeat(10)}…+${'9'.repeat(23)} chars`, { maxLineLength: 5 }), `yyyyy…+${10 + 8 + 23 - 5} chars`);
    const ascii = sanitizeText('y'.repeat(30), { maxLineLength: 10, ascii: true });
    assert.equal(sanitizeText(ascii, { maxLineLength: 10, ascii: true }), ascii);
  });

  it('never copies __proto__ even from an unvalidated object', () => {
    const hostile = JSON.parse('{"type":"cut-progress","cut":"c","__proto__":{"done":"NaNstr","total":-5}}');
    const clean = createSanitizer().event(hostile);
    assert.equal(Object.getPrototypeOf(clean), Object.prototype);
    assert.equal(clean.done, undefined);
    assert.equal(clean.total, undefined);
  });
});

describe('safety: source hygiene', () => {
  it('no source file contains literal bidi, invisible or control characters (use \\u escapes)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
    const root = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
    for (const file of walk(root)) {
      const src = fs.readFileSync(file, 'utf8');
      assert.ok(!/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u180e\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2069\u3164\ufeff\uffa0]/.test(src), file);
    }
  });
});

describe('safety: links', () => {
  it('allows https only, plus http to localhost when asked', () => {
    assert.equal(safeLink('https://github.com/a/b/commit/abc'), 'https://github.com/a/b/commit/abc');
    assert.equal(safeLink('http://example.com'), undefined);
    assert.equal(safeLink('http://localhost:3000/x'), undefined);
    assert.equal(safeLink('http://localhost:3000/x', { allowLocalhostHttp: true }), 'http://localhost:3000/x');
    assert.equal(safeLink('http://127.0.0.1/', { allowLocalhostHttp: true }), 'http://127.0.0.1/');
    assert.equal(safeLink('http://[::1]/', { allowLocalhostHttp: true }), 'http://[::1]/');
    assert.equal(safeLink('http://localhost.evil.com/', { allowLocalhostHttp: true }), undefined);
    for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'data:,x', 'vscode://x', 'ftp://x', '//example.com', 'https://', 'not a url', 42, undefined]) {
      assert.equal(safeLink(bad), undefined, String(bad));
    }
  });

  it('strips credentials and rejects control, bidi and zero-width characters', () => {
    assert.equal(safeLink('https://user:hunter2@example.com/p?q=1#f'), 'https://example.com/p?q=1#f');
    assert.equal(safeLink('https://token@example.com/'), 'https://example.com/');
    for (const bad of [`https://e.com/${ESC}]52;c;x`, 'https://e.com/\u0007', 'https://exa\u202emple.com', 'https://e\u200bxample.com', 'https://e.com/a b', `https://e.com/${'a'.repeat(2100)}`]) {
      assert.equal(safeLink(bad), undefined, JSON.stringify(bad).slice(0, 60));
    }
  });

  it('emits OSC 8 only when links are enabled', () => {
    assert.equal(formatLink('abc1234', 'https://e.com/c/abc', false), 'abc1234');
    assert.equal(formatLink('abc1234', 'https://e.com/c/abc', true), `${ESC}]8;;https://e.com/c/abc${ESC}\\abc1234${ESC}]8;;${ESC}\\`);
    assert.equal(stringWidth(formatLink('abc1234', 'https://e.com/c/abc', true)), 7, 'links take no width');
  });
});

describe('safety: redaction', () => {
  // Token-shaped samples are assembled at runtime so no secret-looking literal appears in the
  // source (secret scanners would flag it, and it must never be mistaken for a real credential).
  const join = (...parts) => parts.join('');
  const shapes = {
    'github-token': [join('ghp', '_', 'a1B2'.repeat(9)), join('gho', '_', 'Z'.repeat(36)), join('ghs', '_', '0'.repeat(40))],
    'github-fine-grained-token': [join('github', '_pat_', '11', 'ABCDEFG', '0123456789', '_', 'abcdefghij'.repeat(4))],
    'openai-or-anthropic-key': [join('sk', '-', 'aB3dE5'.repeat(8)), join('sk', '-proj-', 'Ab9_'.repeat(10)), join('sk', '-ant-api03-', 'Xy7-Qz2_'.repeat(5))],
    'slack-token': [join('xox', 'b-', '1'.repeat(12), '-', '2'.repeat(13), '-', 'abcdefgh'.repeat(2)), join('xox', 'p-1-2-3-', 'abcdef0123'), join('xox', 'a-2-', 'abcdefghij'), join('xox', 'r-', 'abcdefghijkl')],
    'aws-access-key-id': [join('AK', 'IA', 'TESTONLY'.repeat(2)), join('AS', 'IA', 'ABCDEFGHIJKLMNOP')],
    jwt: [join('eyJ', 'hbGciOiJub25lIn0', '.', 'eyJ', 'zdWIiOiJ0ZXN0In0', '.', 'c2lnbmF0dXJlLW5vdC1yZWFs')],
  };

  for (const [name, samples] of Object.entries(shapes)) {
    it(`masks ${name}`, () => {
      assert.ok(DEFAULT_REDACTION_PATTERNS.some((p) => p.name === name));
      for (const s of samples) {
        const out = redactSecrets(`--token ${s} --next`);
        assert.equal(out, `--token ${REDACTED} --next`, s);
      }
    });
  }

  it('masks URL credentials but keeps the host', () => {
    assert.equal(redactSecrets('git clone https://bot:s3cret@github.com/a/b.git'), `git clone https://${REDACTED}@github.com/a/b.git`);
  });

  it('has no false positives on Git SHAs, UUIDs, paths and ordinary words', () => {
    const benign = [
      'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      'A1B2C3D4E5F60718293A4B5C6D7E8F9012345678',
      '0123456789abcdef0123456789abcdef01234567',
      '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
      'src/sk-tests/ghp_helpers.ts',
      'task-runner skeleton xox',
      'packages/sk-experimental-feature-flags.ts',
      'risk-sk-assessment-for-payments-module',
      'sk-lowercase-words-only-and-long-enough',
      'AKIA is a prefix',
      'eyJ alone',
    ];
    for (const b of benign) assert.equal(redactSecrets(b), b, b);
  });

  it('runs the default redactor and the hook on every field: commands, errors and warnings leak secrets too', () => {
    const token = ['ghp', '_', 'q'.repeat(36)].join('');
    const seen = [];
    const s = createSanitizer({ redact: (text, ctx) => (seen.push(ctx.field), text.replaceAll('ACME-INTERNAL', '[internal]')) });
    const f = createEventFactory();
    const log = s.event(f.next('log', { level: 'error', text: `auth failed for ${token}\nACME-INTERNAL host`, stream: 'stderr' }));
    assert.equal(log.text, `auth failed for ${REDACTED}\n[internal] host`, 'logs keep their line breaks');
    assert.equal(s.event(f.next('warning', { message: `token ${token} ACME-INTERNAL` })).message, `token ${REDACTED} [internal]`);
    assert.equal(s.event(f.next('run-start', { title: 'Deploy', command: `deploy --token ${token}` })).command, `deploy --token ${REDACTED}`);
    assert.equal(s.event(f.next('run-end', { status: 'failed', error: `401 for ${token}` })).error, `401 for ${REDACTED}`);
    const snap = s.snapshot({ ...fixture('failed').snapshot, error: `bad credentials ${token}`, warnings: [`retry with ${token}`] });
    assert.equal(snap.error, `bad credentials ${REDACTED}`);
    assert.equal(snap.warnings[0], `retry with ${REDACTED}`);
    const receipt = s.event(f.next('receipt', { finding: 'f', receipt: { kind: 'tool-call', value: `curl -H "Authorization: Bearer ${token}"`, note: `with ${token}` } }));
    assert.equal(receipt.receipt.value, `curl -H "Authorization: Bearer ${REDACTED}"`);
    assert.equal(receipt.receipt.note, `with ${REDACTED}`);
    assert.ok(seen.includes('log') && seen.includes('receipt') && seen.includes('text') && seen.includes('identifier'));
  });

  it('does not run the default redactor on ids and paths, so links between findings and receipts survive', () => {
    const f = createEventFactory();
    const token = ['ghp', '_', 'q'.repeat(36)].join('');
    const ev = createSanitizer().event(f.next('finding', { finding: { id: 'pair-1', title: `uses ${token}`, subject: [{ kind: 'file', label: 'packages/sk-experimental-feature-flags.ts' }], prominence: 'hero', status: 'review' } }));
    assert.equal(ev.finding.subject[0].label, 'packages/sk-experimental-feature-flags.ts');
    assert.equal(ev.finding.title, `uses ${REDACTED}`, 'text fields are still masked');
    const seen = [];
    createSanitizer({ redact: (t, ctx) => (seen.push(ctx.field), t) }).event(ev);
    assert.ok(seen.includes('identifier'), 'the hook still sees identifiers');
  });

  it('cannot be undone by a hook: hook output is sanitized again, and a throwing hook redacts everything', () => {
    const evil = createSanitizer({ redact: () => `${ESC}]52;c;ZXZpbA==\u0007\u202e` });
    assert.equal(evil.text('x'), '\\u{202e}');
    const broken = createSanitizer({ redact: () => { throw new Error('bug'); } });
    assert.equal(broken.text('secret'), REDACTED);
    const off = createSanitizer({ defaultRedaction: false });
    assert.equal(off.text('ghp_' + 'q'.repeat(36), 'log'), 'ghp_' + 'q'.repeat(36));
  });
});

describe('safety: event and snapshot sanitizer', () => {
  it('cleans every string of a hostile but schema-valid finding event and drops unsafe links', () => {
    const f = createEventFactory();
    const ev = f.next('finding', {
      finding: {
        id: 'pair-1',
        title: `Deploy ${ESC}[2J${ESC}]52;c;cm0gLXJm\u0007\u202eevil`,
        summary: 'line one\rline two',
        subject: [
          { kind: 'file', label: 'src/ad\u200bmin.ts', href: 'javascript:alert(1)' },
          { kind: 'file', label: 'src/ok.ts', href: 'https://user:pw@example.com/src/ok.ts' },
        ],
        strength: { value: 0.5, label: `rate${ESC}[33m` },
        prominence: 'hero',
        status: 'review',
        receipts: [{ kind: 'link', value: 'docs', href: 'http://example.com' }],
      },
    });
    assert.ok(validateEvent(ev).ok, 'the hostile event is schema-valid');
    const clean = createSanitizer().event(ev);
    const all = JSON.stringify(clean);
    assert.ok(!all.includes('\\u001b') && !all.includes('\\u0007') && !all.includes('\u202e'), all);
    assert.equal(clean.finding.title, 'Deploy \\u{202e}evil');
    assert.equal(clean.finding.summary, 'line one line two');
    assert.equal(clean.finding.subject[0].label, 'src/ad\\u{200b}min.ts', 'subject labels are identifiers');
    assert.equal(clean.finding.subject[0].href, undefined);
    assert.equal(clean.finding.subject[1].href, 'https://example.com/src/ok.ts');
    assert.equal(clean.finding.receipts[0].href, undefined, 'http links are dropped');
    assert.equal(clean.finding.strength.value, 0.5, 'numbers pass through');
    assert.notEqual(clean, ev, 'a copy, not the input');
    assert.ok(ev.finding.title.includes(ESC), 'the input is not mutated (json output stays verbatim)');
  });

  it('keeps every number, id and path of a clean snapshot intact', () => {
    const snap = fixture('repo-archaeology').snapshot;
    assert.deepEqual(createSanitizer().snapshot(snap), snap);
  });
});
