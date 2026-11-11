// Unit tests for the site's navigation-continuity helpers (no browser, no server):
//   - src/lib/nav-ownership.ts   route → nav item ownership table
//   - src/lib/return-context.ts  `?from=` origin-token grammar and return-target table
//   - src/lib/history-focus.ts   focus-record parsing
//   - src/lib/ansi.ts            ANSI → styled segments for /terminal
//   - src/lib/terminal-run.ts    /terminal's data, from the committed recording
import { build } from 'esbuild';
import { mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(SITE_ROOT, '.f12-run');
mkdirSync(OUT_DIR, { recursive: true });

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
}

async function load(rel) {
  const outfile = resolve(OUT_DIR, rel.replace(/[/.]/g, '_') + '.mjs');
  await build({
    entryPoints: [resolve(SITE_ROOT, rel)],
    bundle: true,
    platform: 'neutral',
    format: 'esm',
    outfile,
    logLevel: 'error',
    alias: { '@': resolve(SITE_ROOT, 'src') },
  });
  return import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
}

const nav = await load('src/lib/nav-ownership.ts');
const ret = await load('src/lib/return-context.ts');
const hf = await load('src/lib/history-focus.ts');
const ansi = await load('src/lib/ansi.ts');
const term = await load('src/lib/terminal-run.ts');

// ---------------------------------------------------------------- nav ownership (table-driven)
{
  const cases = [
    ['/', 'nav-home', 'page'],
    ['/motion', 'nav-motion', 'page'],
    ['/components', 'nav-components', 'page'],
    ['/components/', 'nav-components', 'page'],
    ['/components/use-on-twos', 'nav-components', 'true'],
    ['/components/use-on-twos?from=catalog.layout', 'nav-components', 'true'],
    ['/components/use-on-twos/extra', null, null],
    ['/blocks/developer-console', 'nav-developer-console', 'page'],
    ['/blocks/developer-console?section=request-logs', 'nav-developer-console', 'page'],
    ['/blocks/workspace-settings', 'nav-workspace-settings', 'page'],
    ['/blocks/analytics-dashboard', 'nav-analytics-dashboard', 'page'],
    ['/blocks', null, null],
    ['/blocks/unknown', null, null],
    ['/agents', 'nav-agents', 'page'],
    ['/experiments/agent-approval', 'nav-agents', 'true'],
    ['/experiments', null, null],
    ['/experiments/other', null, null],
    ['/static', 'nav-static', 'page'],
    ['/terminal', 'nav-terminal', 'page'],
    ['/terminal/docs', 'nav-terminal', 'true'],
    ['/terminal/docs/extra', null, null],
    ['/static/report.html', null, null],
    ['/style-sheet', 'nav-style-sheet', 'page'],
    ['/get-started', 'nav-get-started', 'page'],
    ['/get-started-now', null, null],
    ['/componentsx', null, null],
    ['/nope', null, null],
    ['', 'nav-home', 'page'],
  ];
  const bad = [];
  for (const [path, id, current] of cases) {
    const got = nav.resolveNavOwnership(path);
    const ok = id === null ? got === null : got?.id === id && got?.current === current;
    if (!ok) bad.push(`${path} → ${JSON.stringify(got)} (want ${id}/${current})`);
  }
  check(bad.length === 0, `nav-ownership: ${cases.length} table-driven route cases`, bad.join('; '));

  const ids = new Set(nav.NAV_ITEMS.map((n) => n.id));
  check(
    nav.NAV_ITEMS.length === 11 && nav.NAV_OWNERSHIP.every((r) => ids.has(r.id)),
    'nav-ownership: 11 nav items, every ownership row points at a real nav item',
  );
  check(
    nav.NAV_ITEMS.every((item) => nav.resolveNavOwnership(item.href)?.current === 'page'),
    'nav-ownership: every nav item is aria-current="page" on its own href',
  );
}

// ---------------------------------------------------------------- every app page is owned
{
  // Pages that deliberately highlight no nav item. Adding a page means adding it to
  // NAV_OWNERSHIP in src/lib/nav-ownership.ts or listing it here.
  const UNOWNED = new Set([]);
  const appDir = resolve(SITE_ROOT, 'app');
  const pages = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/^page\.(tsx|ts|jsx|js|mdx)$/.test(ent.name)) pages.push(p);
    }
  };
  walk(appDir);
  const routes = pages.map((p) => {
    const segs = relative(appDir, dirname(p))
      .split(sep)
      .filter((x) => x && !/^\(.*\)$/.test(x)) // route groups don't appear in URLs
      .map((x) => (/^\[.*\]$/.test(x) ? 'sample' : x));
    return `/${segs.join('/')}`;
  });
  const orphans = routes.filter((r) => !UNOWNED.has(r) && nav.resolveNavOwnership(r) === null);
  check(
    routes.length >= 10 && orphans.length === 0,
    `nav-ownership: all ${routes.length} app pages are owned by a nav item (or explicitly unowned)`,
    orphans.join(', '),
  );
}

// ---------------------------------------------------------------- origin tokens
{
  const valid = [
    [
      'block.developer-console.request-logs.dependencies',
      '/blocks/developer-console?section=request-logs#block-doc-developer-console-dependencies',
      '← Back to Developer Console · Dependencies',
    ],
    [
      'block.developer-console.overview.dependencies',
      '/blocks/developer-console#block-doc-developer-console-dependencies',
      '← Back to Developer Console · Dependencies',
    ],
    [
      'block.workspace-settings.team.dependencies',
      '/blocks/workspace-settings?section=team#block-doc-workspace-settings-dependencies',
      '← Back to Workspace Settings · Dependencies',
    ],
    [
      'block.analytics-dashboard.dependencies',
      '/blocks/analytics-dashboard#block-doc-analytics-dashboard-dependencies',
      '← Back to Analytics Block · Dependencies',
    ],
    ['catalog.layout', '/components#catalog-layout', '← Back to Components · Layout'],
    ['catalog.hooks-adapters', '/components#catalog-hooks-adapters', '← Back to Components · Hooks & Adapters'],
  ];
  const bad = [];
  for (const [token, href, label] of valid) {
    const t = ret.resolveReturnTarget(token);
    if (!t || t.href !== href || t.label !== label) bad.push(`${token} → ${JSON.stringify(t)}`);
  }
  check(bad.length === 0, `return-context: ${valid.length} valid tokens build the tabled return targets`, bad.join('; '));

  const trail = ret.resolveReturnTarget('block.developer-console.request-logs.dependencies').trail;
  check(
    trail.map((c) => c.label).join(' / ') === 'Blocks / Developer Console / Dependencies' &&
      trail[1].href === '/blocks/developer-console?section=request-logs',
    'return-context: block trail is "Blocks / Developer Console / Dependencies"',
    JSON.stringify(trail),
  );

  const invalid = [
    undefined,
    null,
    42,
    '',
    'https://evil.example',
    '//evil.example',
    'http:evil.example',
    'javascript:alert(1)',
    '%2F%2Fevil.example',
    'block.../../',
    'block.developer-console.request-logs.dependencies/../',
    'block.developer-console.request-logs.dependencies/',
    'block.developer-console.request-logs.dependencies?x=1',
    'block.developer-console.request-logs.dependencies#x',
    'block.developer-console..dependencies',
    'block.developer-console.request-logs',
    'block.developer-console.bogus.dependencies',
    'block.developer-console.request-logs.props',
    'block.developer-console.request-logs.dependencies.extra',
    'block.developer-console.dependencies',
    'block.analytics-dashboard.overview.dependencies',
    'block.unknown-block.overview.dependencies',
    'block.__proto__.overview.dependencies',
    'block.constructor.overview.dependencies',
    'catalog.__proto__',
    'catalog.constructor',
    'catalog.toString',
    'catalog.nope',
    'catalog',
    'catalog.layout.extra',
    'CATALOG.layout',
    'Block.developer-console.request-logs.dependencies',
    'catalog.layout ',
    ' catalog.layout',
    'catalog.layout\n',
    'catalog.-layout',
    'catalog.layout-',
    'catalog.lay--out',
    'block.developer-console.request-logs.dependencies'.padEnd(97, 'x'),
    'catalog.' + 'a'.repeat(200),
    'b'.repeat(10_000),
    'catalog.ｌayout',
  ];
  const leaked = invalid.filter((raw) => ret.resolveReturnTarget(raw) !== null);
  check(
    leaked.length === 0,
    `return-context: ${invalid.length} malformed/unknown/oversized/encoded tokens give no return target`,
    leaked.map((x) => JSON.stringify(x)).join(', '),
  );

  // Every target the grammar can produce is a same-origin absolute path: no scheme, no
  // protocol-relative `//`, no backslashes, no traversal.
  const all = [];
  for (const [slug, info] of Object.entries(ret.BLOCK_RETURN_TABLE)) {
    for (const s of info.sections ?? [null]) all.push(ret.blockOriginToken(slug, s));
  }
  for (const g of Object.keys(ret.CATALOG_GROUPS)) all.push(ret.catalogOriginToken(g));
  const unsafe = all
    .map((tok) => [tok, ret.resolveReturnTarget(tok)])
    .filter(([, t]) => !t || !/^\/(?!\/)[a-z0-9/-]*(\?section=[a-z-]+)?#[a-z0-9-]+$/.test(t.href));
  check(
    all.length === 4 + 7 + 1 + 4 && unsafe.length === 0,
    `return-context: all ${all.length} producible tokens round-trip to same-origin paths`,
    JSON.stringify(unsafe),
  );

  const sections = [
    ['developer-console', 'request-logs', 'request-logs'],
    ['developer-console', 'bogus', null],
    ['developer-console', '', null],
    ['developer-console', null, null],
    ['developer-console', '__proto__', null],
    ['workspace-settings', 'danger-zone', 'danger-zone'],
    ['workspace-settings', 'request-logs', null],
    ['analytics-dashboard', 'overview', null],
  ];
  const badSections = sections.filter(([b, raw, want]) => ret.parseBlockSection(b, raw) !== want);
  check(
    badSections.length === 0,
    'return-context: ?section= is validated per block (unknown → block default)',
    JSON.stringify(badSections),
  );
  check(
    ret.blockHref('developer-console', 'overview') === '/blocks/developer-console' &&
      ret.blockHref('developer-console', 'services') === '/blocks/developer-console?section=services' &&
      ret.blockHref('workspace-settings', 'profile') === '/blocks/workspace-settings',
    'return-context: the default section is omitted from block URLs',
  );
}

// ---------------------------------------------------------------- focus records
{
  const good = { __NA: true, f12Focus: { url: 'http://x/a', id: 'comp-link-panel', fallbackId: 'catalog-layout' } };
  const r = hf.readFocusRecord(good);
  check(
    r?.id === 'comp-link-panel' && r?.fallbackId === 'catalog-layout' && r?.url === 'http://x/a',
    'history-focus: reads a well-formed f12Focus record',
  );
  const bad = [
    null,
    'x',
    {},
    { f12Focus: null },
    { f12Focus: { url: 'u', id: '' } },
    { f12Focus: { url: 'u', id: 'a b' } },
    { f12Focus: { url: 'u', id: '#x' } },
    { f12Focus: { url: 'u', id: 'ok', fallbackId: 7 } },
    { f12Focus: { id: 'ok' } },
  ];
  check(
    bad.every((s) => hf.readFocusRecord(s) === null),
    'history-focus: malformed records are ignored',
  );
}

// ---------------------------------------------------------------- /terminal: ANSI → segments
{
  const E = '\u001b';
  const r = ansi.ansiToLines(`${E}[2mC-01 · ${E}[22m${E}[1mREAD${E}[22m\n${E}[1;103;30m F-01 ${E}[22;39;49m  x\n`);
  check(
    JSON.stringify(r.lines) ===
      JSON.stringify([
        [{ dim: true, text: 'C-01 · ' }, { bold: true, text: 'READ' }],
        [{ bold: true, bg: 103, fg: 30, text: ' F-01 ' }, { text: '  x' }],
      ]) && r.unsupported.length === 0,
    'ansi: SGR attributes and 16 colors become segments; a final newline adds no empty line',
    JSON.stringify(r),
  );
  const hostile = ansi.ansiToLines(`a${E}]8;;https://evil.example${E}\\link${E}]8;;${E}\\b${E}]52;c;ZXZpbA==\u0007c${E}[2Jd${E}[?25le\u0008f\u009b31mg<script>`);
  const text = hostile.lines.map((l) => l.map((s) => s.text).join('')).join('\n');
  check(
    text === 'alinkbcdef31mg<script>' && hostile.lines[0].every((s) => Object.keys(s).length === 1),
    'ansi: OSC links and clipboard writes, cursor CSI, C0/C1 controls are removed, never interpreted; markup stays text',
    JSON.stringify(text),
  );
  const unterminated = ansi.ansiToLines(`a${E}]0;title\nb`);
  check(unterminated.lines.map((l) => l.map((s) => s.text).join('')).join('|') === 'a|b', 'ansi: an unterminated OSC ends at the line break');
  const rgb = ansi.ansiToLines(`${E}[38;5;220;1mx${E}[48;2;1;2;3my`);
  check(
    rgb.unsupported.join(',') === '38;5;220,48;2;1;2;3' && rgb.lines[0][0].bold === true && rgb.lines[0][0].fg === undefined,
    'ansi: 256-color and truecolor parameters are consumed (not read as codes) and reported',
    JSON.stringify(rgb),
  );
  check(
    ansi.segmentClass({ bold: true, dim: true, bg: 103 }) === 'f12-term-b f12-term-d f12-term-bg103' && ansi.segmentClass({}) === undefined,
    'ansi: segment classes',
  );
}

// ---------------------------------------------------------------- /terminal: the recorded run
{
  const steps = term.watchSteps();
  const all = steps.flatMap((s) => s.lines.map((l) => l.map((x) => x.text).join(''))).join('\n');
  check(
    steps.length > 3 && steps.every((s) => s.waitMs >= 0 && s.waitMs <= 1100) && steps.some((s) => s.stream === 'stderr') && steps.at(-1).stream === 'stdout',
    'terminal: Watch is narration (stderr) then results (stdout), with the CLI’s capped waits',
  );
  check(/REPLAY · FRAME\/12/.test(all) && /F-01 +src\/helper\/ssg\/index\.ts usually changes with/.test(all), 'terminal: Watch is the replay of the hono run, labelled REPLAY');
  check(!/\/(home|tmp|Users|root)\//.test(all + term.HELLO_NDJSON), 'terminal: no local paths reach the page');
  check(term.watchUnsupportedSgr().length === 0, 'terminal: every SGR parameter in Watch is styled', term.watchUnsupportedSgr().join(','));
  // Every color the data uses has a rule in site.css (only the marker chip has one).
  const css = (await import('node:fs')).readFileSync(resolve(SITE_ROOT, 'app/site.css'), 'utf8');
  const colors = new Set(steps.flatMap((s) => s.lines.flat().flatMap((x) => [x.fg === 30 && x.bg === 103 ? undefined : x.fg !== undefined ? `fg${x.fg}` : undefined, x.bg !== undefined ? `bg${x.bg}` : undefined])).filter(Boolean));
  const unstyled = [...colors].filter((c) => !css.includes(`.f12-term-${c} {`));
  check(unstyled.length === 0, 'terminal: every color in Watch has a .f12-term-* rule', unstyled.join(','));

  const ex = term.exploreDemo();
  const events = term.recordingEvents();
  check(
    ex.frames.length === events.length && ex.frames.every((f, i) => f.id === events[i].id) && ex.primaryMarker === events.find((e) => e.type === 'finding').id,
    'terminal: Explore has one frame per recorded event, marked at the top finding',
  );
  check(
    ex.topFinding.evidence === 3 && Math.abs(ex.topFinding.strength.value - 0.5128) < 0.001,
    'terminal: the top finding’s evidence count and strength come from the snapshot',
    JSON.stringify(ex.topFinding),
  );
  check(term.HELLO_NDJSON.trim().split('\n').length === 12, 'terminal: the Build example is twelve lines');
}

console.log(failures ? `\n${failures} unit check(s) failed` : '\nAll site unit checks passed');
process.exitCode = failures ? 1 : 0;
