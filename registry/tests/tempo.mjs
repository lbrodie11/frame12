// F12-08 tempo: resolver, no-provider compatibility, TempoProvider, TempoControl, live safety,
// registry install closure, and performance. Chromium; React 18.3 (registry pin) unless noted.
//   node tests/tempo.mjs
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { launch } from './lib.mjs';
import { bundlePage, loadServerModule, openFixture, reactVersion, sampleAt60Hz, REGISTRY_ROOT, REPO_ROOT } from './harness.mjs';
import { captureNoProvider } from './no-provider-capture.mjs';

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

const FIXTURE = resolve(REGISTRY_ROOT, 'tests/fixtures/tempo-fixture.tsx');
const settle = (page) => page.waitForTimeout(60);

// ------------------------------------------------------------------------------------ resolver
{
  const { mod } = await loadServerModule(resolve(REGISTRY_ROOT, 'hooks/use-tempo.ts'));
  const { resolveMotion, normalizeTempo } = mod;
  // Independent oracle written from the F12-08 rules table.
  const oracle = (base, tempo, ancestorStill, reduced) => {
    const t = ['auto', 'twos', 'ones', 'still'].includes(tempo) ? tempo : 'auto';
    if (reduced) return 'cut';
    if (t === 'still' || ancestorStill) return 'cut';
    const b = base ?? 'stepped';
    if (b === 'cut') return 'cut';
    if (t === 'twos') return 'stepped';
    if (t === 'ones') return 'smooth';
    return b;
  };
  // Bases: explicit props, undefined, and each component's own default.
  const COMPONENT_DEFAULTS = {
    'Metric (default variant)': 'stepped',
    'Metric quiet': 'cut',
    Sheet: 'stepped',
    GhostWire: 'stepped',
    'ToneSpark/ToneAreaChart': 'stepped',
    useOnTwos: 'stepped',
  };
  const bases = [['stepped', 'stepped'], ['smooth', 'smooth'], ['cut', 'cut'], ['undefined', undefined],
    ...Object.entries(COMPONENT_DEFAULTS)];
  const tempos = ['auto', 'twos', 'ones', 'still', 'fast', '', null, undefined, 12];
  let n = 0;
  const bad = [];
  for (const [bname, base] of bases)
    for (const tempo of tempos)
      for (const anc of [false, true])
        for (const reduced of [false, true]) {
          n++;
          const got = resolveMotion({ base, tempo, ancestorStill: anc, reduced });
          const want = oracle(base, tempo, anc, reduced);
          if (got !== want) bad.push(`${bname}/${String(tempo)}/anc=${anc}/reduced=${reduced}: ${got} != ${want}`);
        }
  check(bad.length === 0, `resolver: ${n} combinations (bases × 4 tempos + 5 invalid × ancestorStill × reduced) match the rules table`, bad.slice(0, 5).join('; '));
  const key = [
    resolveMotion({ base: 'cut', tempo: 'twos' }) === 'cut',
    resolveMotion({ base: 'cut', tempo: 'ones' }) === 'cut',
    resolveMotion({ base: COMPONENT_DEFAULTS['Metric quiet'], tempo: 'twos' }) === 'cut',
    resolveMotion({ base: COMPONENT_DEFAULTS['Metric quiet'], tempo: 'ones' }) === 'cut',
    resolveMotion({ base: 'smooth', tempo: 'twos' }) === 'stepped',
    resolveMotion({ base: 'stepped', tempo: 'ones' }) === 'smooth',
    resolveMotion({ base: 'smooth', tempo: 'auto' }) === 'smooth',
    resolveMotion({ base: 'smooth', tempo: 'fast' }) === 'smooth',
    resolveMotion({ base: 'stepped', tempo: 'ones', reduced: true }) === 'cut',
    resolveMotion({ base: 'stepped', tempo: 'auto', ancestorStill: true }) === 'cut',
    resolveMotion({}) === 'stepped',
  ];
  check(key.every(Boolean), 'resolver key cases: explicit cut and quiet Metric stay cut under twos/ones; tempo restyles stepped/smooth; reduced and ancestor still always cut; invalid tempo is auto', key);
  check(
    normalizeTempo('fast') === 'auto' && normalizeTempo(null) === 'auto' && normalizeTempo('still') === 'still',
    'normalizeTempo: invalid runtime values (a stored "fast", null) read as auto',
  );
}

const browser = await launch('chromium');

// ------------------------------------------------------------ no-provider compatibility (React 18)
// The pre-tempo registry is main at 0e19283 (the commit F12-08 branched from; it stays in main's
// history). Its ui/hooks/blocks/styles are extracted from git and captured in this same browser as
// the current source: layout-measured values differ between Chromium builds and font stacks, so a
// recorded file would only hold on the machine that recorded it.
const PRE_TEMPO = '0e192836f94e74583747c3a1e24177ad80d93fb0';
function extractPreTempo() {
  const git = (args, opts = {}) => execFileSync('git', args, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  try {
    git(['cat-file', '-e', `${PRE_TEMPO}^{commit}`]);
  } catch {
    // Shallow CI checkouts: fetch just that commit (public repository, no credentials needed).
    git(['fetch', '--no-tags', '--depth=1', 'origin', PRE_TEMPO]);
  }
  // Inside the (gitignored) registry/.f12-run so the extracted files resolve node_modules.
  mkdirSync(join(REGISTRY_ROOT, '.f12-run'), { recursive: true });
  const dir = mkdtempSync(join(REGISTRY_ROOT, '.f12-run', 'pre-tempo-'));
  const tar = git(['archive', PRE_TEMPO, 'registry/ui', 'registry/hooks', 'registry/blocks', 'registry/styles'], { maxBuffer: 64 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  return dir;
}
{
  let preDir = null;
  try {
    preDir = extractPreTempo();
    const reg = join(preDir, 'registry');
    const before = await captureNoProvider(browser, {
      dirs: { hooksDir: join(reg, 'hooks'), uiDir: join(reg, 'ui'), blocksDir: join(reg, 'blocks') },
      cssPath: join(reg, 'styles/frame12.css'),
    });
    const now = await captureNoProvider(browser);
    const names = Object.keys(before);
    const diffs = names.filter((n) => JSON.stringify(before[n]) !== JSON.stringify(now[n]));
    const errors = names.flatMap((n) => [...before[n].errors, ...now[n].errors]);
    check(
      names.length === 13 && diffs.length === 0 && Object.keys(now).length === names.length && errors.length === 0,
      `no-provider compatibility: SSR HTML, settled DOM and 60 Hz animation timelines of all ${names.length} fixtures (9 motion consumer files) identical to the pre-tempo source (${PRE_TEMPO.slice(0, 7)})`,
      diffs
        .map((n) => `${n}: ${Object.keys(before[n]).filter((k) => JSON.stringify(before[n][k]) !== JSON.stringify(now[n]?.[k])).join('/')}`)
        .concat(errors)
        .join(', '),
    );
  } catch (err) {
    check(false, 'no-provider compatibility: extract the pre-tempo registry source from git', String(err.message || err).slice(0, 400));
  } finally {
    if (preDir) rmSync(preDir, { recursive: true, force: true });
  }
}

const devHtml = await bundlePage(FIXTURE, { react: 18, nodeEnv: 'development' });
const html = await bundlePage(FIXTURE, { react: 18 });
const probe = (page, id = 'probe') =>
  page.evaluate((i) => ({ ...document.getElementById(i)?.dataset }), id);
const sheetClass = (page, id) =>
  page.evaluate((i) => (document.getElementById(i)?.closest('.f12-dash')?.className ?? document.querySelector(`#${i}`)?.parentElement?.className) || '', id);
const motionClassOf = (page, id) =>
  page.evaluate((i) => {
    const el = document.getElementById(i);
    const dash = el?.classList.contains('f12-dash') ? el : el?.closest('.f12-dash');
    return (dash?.className.match(/f12-m-(\w+)/) || [])[1];
  }, id);

// ------------------------------------------------------------------------------------ provider
{
  // Controlled: selection follows `value`, `onChange` is called; a rejecting parent keeps value.
  const { ctx, page, errors } = await openFixture(browser, html, { clock: false });
  await page.evaluate(() => window.__render('controlled', { initial: 'ones' }));
  await settle(page);
  const start = await probe(page);
  await page.getByRole('radio', { name: '12, on twos' }).check();
  await settle(page);
  const accepted = await probe(page);
  await page.evaluate(() => (window.__accept = false));
  await page.getByRole('radio', { name: '0, no motion' }).click();
  await settle(page);
  const rejected = await probe(page);
  const checkedAfterReject = await page.evaluate(() => document.querySelector('#ctl-twos').checked);
  const changes = await page.evaluate(() => window.__changes);
  const stored = await page.evaluate(() => Object.keys(localStorage).length);
  check(
    start.tempo === 'ones' && accepted.tempo === 'twos' && rejected.tempo === 'twos' && checkedAfterReject &&
      JSON.stringify(changes) === '["twos","still"]' && stored === 0 && errors.length === 0,
    'provider controlled: value drives the tempo, onChange gets each choice, a parent that rejects keeps the value, nothing persisted',
    { start: start.tempo, accepted: accepted.tempo, rejected: rejected.tempo, changes, errors },
  );
  await ctx.close();
}
{
  // Uncontrolled + storageKey: persisted, restored on reload, server/first render uses default.
  const { ctx, page, errors } = await openFixture(browser, html, { clock: false });
  await page.evaluate(() => window.__render('uncontrolled', { defaultValue: 'twos' }));
  await settle(page);
  const first = await probe(page);
  await page.getByRole('radio', { name: '60, smooth' }).check();
  await settle(page);
  const stored = await page.evaluate(() => localStorage.getItem('fx-tempo'));
  const sheetAfter = await motionClassOf(page, 'fx-sheet');
  const wrapperAttr = await page.evaluate(() => {
    const w = document.querySelector('[data-f12-tempo]');
    return { tempo: w.getAttribute('data-f12-tempo'), display: getComputedStyle(w).display, cls: w.className };
  });
  await page.reload();
  await page.evaluate(() => window.__render('uncontrolled', { defaultValue: 'twos' }));
  await settle(page);
  const restored = await probe(page);
  check(
    first.tempo === 'twos' && stored === 'ones' && restored.tempo === 'ones' && sheetAfter === 'smooth' &&
      wrapperAttr.tempo === 'ones' && wrapperAttr.display === 'contents' && wrapperAttr.cls === 'f12-m-smooth' && errors.length === 0,
    'provider uncontrolled: defaultValue first, choice persisted under storageKey and restored on reload; layout-neutral wrapper carries data-f12-tempo and the f12-m-* class',
    { first: first.tempo, stored, restored: restored.tempo, sheetAfter, wrapperAttr },
  );
  await ctx.close();
}
{
  // Both value and defaultValue: value wins, one development warning.
  const { ctx, page, warnings } = await openFixture(browser, devHtml, { clock: false });
  await page.evaluate(() => window.__render('both'));
  await settle(page);
  const p = await probe(page);
  const warned = warnings.filter((w) => w.includes('TempoProvider') && w.includes('defaultValue'));
  check(p.tempo === 'twos' && warned.length === 1, 'provider: value + defaultValue together → value wins with one development warning', { tempo: p.tempo, warned });
  await ctx.close();
}
{
  // localStorage throwing on every access.
  const { ctx, page, errors } = await openFixture(browser, html, {
    clock: false,
    init: () => {
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
    },
  });
  await page.evaluate(() => window.__render('uncontrolled', { defaultValue: 'ones' }));
  await settle(page);
  await page.getByRole('radio', { name: '0, no motion' }).check();
  await settle(page);
  const p = await probe(page);
  check(p.tempo === 'still' && p.stepped === 'cut' && errors.length === 0, 'provider: localStorage that throws → no errors, the choice still applies in memory', { p, errors });
  await ctx.close();
}
{
  // Invalid stored value.
  for (const def of [undefined, 'ones']) {
    const { ctx, page, errors } = await openFixture(browser, html, {
      clock: false,
      init: () => localStorage.setItem('fx-tempo', 'fast'),
    });
    await page.evaluate((d) => window.__render('uncontrolled', { defaultValue: d }), def);
    await settle(page);
    const p = await probe(page);
    check(p.tempo === (def ?? 'auto') && errors.length === 0, `provider: an invalid stored value ("fast") is ignored → ${def ?? 'auto'} (defaultValue ${def ?? 'unset'})`, p.tempo);
    await ctx.close();
  }
}
{
  // Nesting.
  const { ctx, page } = await openFixture(browser, html, { clock: false });
  const cases = [
    ['ones', 'twos', 'smooth', 'stepped'],
    ['still', 'auto', 'cut', 'cut'],
    ['still', 'twos', 'cut', 'cut'],
    ['auto', 'still', 'stepped', 'cut'],
    ['twos', 'auto', 'stepped', 'stepped'],
  ];
  for (const [outer, inner, wantOuter, wantInner] of cases) {
    await page.evaluate(([o, i]) => window.__render('nested', { outer: o, inner: i }), [outer, inner]);
    await settle(page);
    const o = await motionClassOf(page, 'outer-sheet');
    const i = await motionClassOf(page, 'inner-sheet');
    const ip = await probe(page, 'inner');
    check(
      o === wantOuter && i === wantInner && (outer !== 'still' || (ip.ancestorStill === 'true' && ip.effective === 'still')),
      `provider nesting: ${inner} inside ${outer} → outer Sheet ${wantOuter}, inner Sheet ${wantInner}${outer === 'still' ? ' (ancestor still cannot be undone)' : ''}`,
      { o, i, inner: ip },
    );
  }
  await ctx.close();
}
{
  // Only the outermost persisted provider owns <html data-f12-tempo> (set by a first-paint script),
  // and it never rewrites it with its default before the stored value is read.
  const { ctx, page } = await openFixture(browser, html, {
    clock: false,
    init: () => localStorage.setItem('fx-outer', 'still'),
  });
  // What the first-paint script does before React mounts.
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-f12-tempo', localStorage.getItem('fx-outer'));
    window.__htmlTempo = [];
    new MutationObserver(() => window.__htmlTempo.push(document.documentElement.getAttribute('data-f12-tempo')))
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-f12-tempo'] });
  });
  await page.evaluate(() => window.__render('nested-storage'));
  await settle(page);
  const afterMount = await page.evaluate(() => [...window.__htmlTempo]);
  await page.locator('#inner-ones').check();
  await settle(page);
  const afterInner = await page.evaluate(() => document.documentElement.getAttribute('data-f12-tempo'));
  await page.locator('#outer-twos').check();
  await settle(page);
  const afterOuter = await page.evaluate(() => document.documentElement.getAttribute('data-f12-tempo'));
  check(
    afterMount.every((v) => v === 'still') && afterInner === 'still' && afterOuter === 'twos',
    'provider: only the outermost persisted provider updates <html data-f12-tempo>; a stored still is never flipped to the default on mount; a nested persisted provider leaves it alone',
    { afterMount, afterInner, afterOuter },
  );
  await ctx.close();
}
{
  // asChild layout neutrality: child boxes identical with no provider, asChild, and the wrapper.
  const { ctx, page } = await openFixture(browser, html, { clock: false });
  await page.evaluate(() => window.__render('as-child'));
  await settle(page);
  const boxes = await page.evaluate(() =>
    ['bare', 'as-child', 'wrapped'].map((id) => {
      const root = document.getElementById(id);
      const r0 = root.getBoundingClientRect();
      const kids = [...root.querySelectorAll('header, main, footer')].map((k) => {
        const r = k.getBoundingClientRect();
        return [r.x - r0.x, r.y - r0.y, r.width, r.height].map(Math.round).join(',');
      });
      return { w: Math.round(r0.width), h: Math.round(r0.height), kids: kids.join('|'), attr: root.getAttribute('data-f12-tempo'), cls: root.className };
    }),
  );
  const [bare, asChild, wrapped] = boxes;
  check(
    bare.kids === asChild.kids && bare.kids === wrapped.kids && bare.h === asChild.h && bare.h === wrapped.h &&
      asChild.attr === 'twos' && asChild.cls === 'f12-m-stepped',
    'provider asChild and default wrapper are layout-neutral: grid child boxes identical to no provider; asChild puts data-f12-tempo and the class on the child',
    boxes,
  );
  await ctx.close();
}
{
  // Cross-tab sync through the storage event.
  const { ctx, page: a } = await openFixture(browser, html, { clock: false });
  const b = await ctx.newPage();
  await b.route('http://f12.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await b.goto('http://f12.test/index.html');
  for (const p of [a, b]) await p.evaluate(() => window.__render('uncontrolled'));
  await settle(a);
  await a.getByRole('radio', { name: '60, smooth' }).check();
  await b.waitForFunction(() => document.getElementById('probe').dataset.tempo === 'ones', null, { timeout: 3000 }).catch(() => {});
  const pb = await probe(b);
  const bChecked = await b.evaluate(() => document.querySelector('#ctl-ones').checked);
  const bSheet = await motionClassOf(b, 'fx-sheet');
  await a.evaluate(() => localStorage.clear());
  await b.waitForFunction(() => document.getElementById('probe').dataset.tempo === 'auto', null, { timeout: 3000 }).catch(() => {});
  const cleared = await probe(b);
  check(pb.tempo === 'ones' && bChecked && bSheet === 'smooth' && cleared.tempo === 'auto', 'provider cross-tab: a choice in one tab updates the other (control, context and Sheet); clearing storage falls back', { b: pb.tempo, bSheet, cleared: cleared.tempo });
  await ctx.close();
}
{
  // No matchMedia: OS preference reads as "no preference"; nothing throws.
  const { ctx, page, errors } = await openFixture(browser, html, {
    clock: false,
    init: () => {
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined });
    },
  });
  await page.evaluate(() => window.__render('consumers', { tempo: 'twos' }));
  await settle(page);
  await page.evaluate(() => window.__step());
  await page.waitForTimeout(700);
  const p = await probe(page);
  check(p.reduced === 'false' && p.tempo === 'twos' && p.stepped === 'stepped' && errors.length === 0, 'provider without matchMedia: treated as no preference; every consumer renders and steps with no errors', { p, errors });
  await ctx.close();
}

// ------------------------------------------------------------------------------------ control
{
  const { ctx, page, errors } = await openFixture(browser, html, { clock: false });
  await page.evaluate(() => window.__render('uncontrolled'));
  await settle(page);
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('input[type=radio]')].map((r) => r.labels[0].innerText.replace(/\s+/g, ' ')),
  );
  const named = [];
  for (const n of ["AUTO, each component's own motion", '12, on twos', '60, smooth', '0, no motion']) {
    named.push((await page.getByRole('radio', { name: n, exact: true }).count()) === 1);
  }
  const group = await page.getByRole('group', { name: 'Animation tempo' }).count();
  check(named.every(Boolean) && group === 1, 'control: a fieldset group named "Animation tempo" with four native radios whose accessible names include their meaning ("12, on twos")', { named, names });

  // Native keyboard: Tab enters on the checked radio, arrows move AND select, Tab leaves as one stop.
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.id = 'before';
    b.textContent = 'before';
    document.body.prepend(b);
    const a = document.createElement('button');
    a.id = 'after';
    a.textContent = 'after';
    document.body.append(a);
  });
  await page.focus('#before');
  await page.keyboard.press('Tab');
  const entered = await page.evaluate(() => document.activeElement.id);
  await page.keyboard.press('ArrowRight');
  await settle(page);
  const afterRight = { focus: await page.evaluate(() => document.activeElement.id), tempo: (await probe(page)).tempo };
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await settle(page);
  const wrapped = { focus: await page.evaluate(() => document.activeElement.id), tempo: (await probe(page)).tempo };
  await page.keyboard.press('Tab');
  const left = await page.evaluate(() => document.activeElement.id);
  await page.keyboard.press('Shift+Tab');
  const back = await page.evaluate(() => document.activeElement.id);
  check(
    entered === 'ctl-auto' && afterRight.focus === 'ctl-twos' && afterRight.tempo === 'twos' &&
      wrapped.focus === 'ctl-still' && wrapped.tempo === 'still' && left === 'after' && back === 'ctl-still' && errors.length === 0,
    'control keyboard: Tab enters on the checked radio, arrow keys move and select (wrapping), Tab/Shift+Tab treat the group as one stop',
    { entered, afterRight, wrapped, left, back },
  );
  await ctx.close();
}
{
  // Without a provider: disabled, explained, development warning; never inert-but-clickable.
  const { ctx, page, warnings } = await openFixture(browser, devHtml, { clock: false });
  await page.evaluate(() => window.__render('no-provider-control'));
  await settle(page);
  const st = await page.evaluate(() => ({
    disabled: [...document.querySelectorAll('input[type=radio]')].every((r) => r.matches(':disabled')),
    fieldset: document.querySelector('fieldset').disabled,
    note: document.querySelector('.f12-tempo-note')?.textContent || '',
  }));
  await page.locator('label[for=ctl-twos]').click({ force: true });
  await settle(page);
  const p = await probe(page);
  const warned = warnings.some((w) => w.includes('TempoControl') && w.includes('TempoProvider'));
  check(st.disabled && st.fieldset && /Unavailable/.test(st.note) && p.tempo === 'auto' && p.inProvider === 'false' && warned,
    'control without a provider: fieldset and radios disabled, visible explanation, development warning, clicks do nothing', { st, warned });
  await ctx.close();
}
{
  // OS reduced motion: show the effective state honestly, keep the stored choice selectable.
  const { ctx, page } = await openFixture(browser, html, { clock: false, reduced: 'reduce' });
  await page.evaluate(() => window.__render('uncontrolled'));
  await settle(page);
  await page.getByRole('radio', { name: '12, on twos' }).check();
  await settle(page);
  const st = await page.evaluate(() => ({
    note: document.querySelector('.f12-tempo-note')?.textContent || '',
    effective: document.querySelector('fieldset').dataset.effective,
    checked: document.querySelector('#ctl-twos').checked,
    describedBy: document.querySelector('#ctl-twos').getAttribute('aria-describedby'),
    stored: localStorage.getItem('fx-tempo'),
  }));
  const p = await probe(page);
  check(
    st.note.includes('0 · your system setting') && st.note.includes('applies when your system allows motion') &&
      st.effective === 'still' && st.checked && st.stored === 'twos' && st.describedBy && p.stepped === 'cut',
    'control under OS reduced motion: shows "0 · your system setting", keeps 12 selectable and stored, never overrides the OS',
    st,
  );
  await ctx.close();
}
for (const scheme of ['light', 'dark']) {
  for (const reduced of ['no-preference', 'reduce']) {
    const { ctx, page } = await openFixture(browser, html, { clock: false, scheme, reduced });
    await page.evaluate(() => window.__render('uncontrolled'));
    await settle(page);
    const res = await new AxeBuilder({ page }).include('.f12-tempo').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    check(res.violations.length === 0, `control axe (${scheme}, ${reduced}): zero violations`, res.violations.map((v) => v.id).join(','));
    await ctx.close();
  }
  const { ctx, page } = await openFixture(browser, html, { clock: false, scheme });
  await page.evaluate(() => window.__render('no-provider-control'));
  await settle(page);
  const res = await new AxeBuilder({ page }).include('.f12-tempo').analyze();
  check(res.violations.length === 0, `control axe (${scheme}, disabled without provider): zero violations`, res.violations.map((v) => v.id).join(','));
  await ctx.close();
}
for (const [label, w] of [['320px', 320], ['390px', 390], ['200% zoom of 1280px (640 CSS px)', 640], ['400% zoom of 1280px (320 CSS px)', 320]]) {
  const { ctx, page } = await openFixture(browser, html, { clock: false, w, h: 700 });
  await page.evaluate(() => window.__render('uncontrolled'));
  await settle(page);
  const m = await page.evaluate(() => {
    const fs = document.querySelector('.f12-tempo');
    const rng = fs.querySelector('.f12-rng').getBoundingClientRect();
    const targets = [...fs.querySelectorAll('label')].map((l) => l.getBoundingClientRect()).map((r) => [Math.round(r.width), Math.round(r.height)]);
    return { width: Math.round(rng.width), targets, docOverflow: document.documentElement.scrollWidth > window.innerWidth };
  });
  // The site header insets its content 10px on each side at 320px (site/tests/tempo.mjs measures it).
  const fitsHeader = m.width <= 320 - 20;
  check(fitsHeader && !m.docOverflow && m.targets.every(([tw, th]) => tw >= 44 && th >= 44),
    `control layout at ${label}: ${m.width}px wide (fits a 320px header with 10px insets), no overflow, every target ≥ 44×44 (SC 2.5.5; ≥ 24×24 SC 2.5.8)`, m);
  await ctx.close();
}

// -------------------------------------------------------------------------------- live safety
const metricValue = (page) => page.evaluate(() => document.querySelector('#root .f12-m-value [aria-hidden="true"]').textContent.replace(/[^0-9]/g, ''));
{
  const { ctx, page } = await openFixture(browser, html);
  await page.evaluate(() => window.__render('metric-live'));
  await page.clock.runFor(500);
  await settle(page);
  await page.evaluate(() => window.__step());
  await settle(page);
  await page.clock.runFor(170);
  const mid = await metricValue(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await settle(page);
  const afterReduce = await metricValue(page);
  const later = await sampleAt60Hz(page, 400, () => metricValue(page));
  check(Number(mid) > 0 && Number(mid) < 10000 && afterReduce === '10000' && later.every((v) => v === '10000'),
    'live safety: enabling OS reduced motion mid-tween settles the count-up immediately (no further frames)', { mid, afterReduce });

  await page.getByRole('radio', { name: '12, on twos' }).check();
  await settle(page);
  const stored = await page.evaluate(() => localStorage.getItem('fx-tempo'));
  await page.evaluate(() => window.__step());
  await settle(page);
  const whileReduced = await sampleAt60Hz(page, 700, () => metricValue(page));
  check(stored === 'twos' && new Set(whileReduced).size === 1 && whileReduced[0] === '0',
    'live safety: selecting 12 while reduced motion is on stores the preference but a state change produces no motion', { stored, distinct: [...new Set(whileReduced)] });

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await settle(page);
  const noReplay = await sampleAt60Hz(page, 300, () => metricValue(page));
  await page.evaluate(() => window.__step());
  await settle(page);
  const resumed = await sampleAt60Hz(page, 700, () => metricValue(page));
  const poses = new Set(resumed).size;
  check(new Set(noReplay).size === 1 && poses >= 6 && poses <= 8 && resumed.at(-1) === '10000',
    'live safety: turning reduced motion off replays nothing; the next state change steps on twos (7 held poses over 600 ms)', { noReplay: [...new Set(noReplay)], poses });
  await ctx.close();
}
{
  // still → twos animates nothing until the next real state change; twos → still mid-tween settles.
  const { ctx, page } = await openFixture(browser, html);
  await page.evaluate(() => window.__render('metric-live', { tempo: 'still' }));
  await page.clock.runFor(500);
  await settle(page);
  await page.evaluate(() => window.__step());
  await settle(page);
  const underStill = await sampleAt60Hz(page, 300, () => metricValue(page));
  await page.evaluate(() => window.__setTempo('twos'));
  await settle(page);
  const afterSwitch = await sampleAt60Hz(page, 700, () => metricValue(page));
  await page.evaluate(() => window.__step());
  await settle(page);
  const next = await sampleAt60Hz(page, 700, () => metricValue(page));
  check(new Set(underStill).size === 1 && underStill[0] === '10000' && new Set(afterSwitch).size === 1 && new Set(next).size >= 6,
    'live: under still a change cuts; switching still → twos animates nothing; the next change steps', { afterSwitch: [...new Set(afterSwitch)], nextPoses: new Set(next).size });

  await page.evaluate(() => window.__step());
  await settle(page);
  await page.clock.runFor(170);
  const mid = await metricValue(page);
  await page.getByRole('radio', { name: '0, no motion' }).check();
  await settle(page);
  const cut = await metricValue(page);
  const settled = await sampleAt60Hz(page, 300, () => metricValue(page));
  check(Number(mid) > 0 && Number(mid) < 10000 && cut === '10000' && settled.every((v) => v === '10000'),
    'live: selecting 0 mid-tween settles the count-up at its final value immediately', { mid, cut });
  await ctx.close();
}
{
  // Propagation across every consumer in the fixture: still stops JS and CSS motion; 12 and 60
  // give stepped and smooth computed styles and progressions.
  const { ctx, page } = await openFixture(browser, html);
  await page.evaluate(() => window.__render('consumers'));
  await page.clock.runFor(1500);
  await settle(page);
  const sampleState = () =>
    page.evaluate(() => ({
      metric: document.querySelector('[data-consumer=metric] .f12-m-value').textContent,
      wire: document.querySelector('[data-consumer=ghost-wire] path, [data-consumer=ghost-wire] line')?.getAttribute('stroke-dashoffset') ?? '',
      area: document.querySelector('[data-consumer=tone-area-chart] svg')?.innerHTML.length ?? 0,
    }));
  const result = {};
  for (const tempo of ['still', 'twos', 'ones']) {
    await page.evaluate((t) => window.__setTempo(t), tempo);
    await settle(page);
    await page.evaluate(() => window.__step());
    await settle(page);
    const css = await page.evaluate(() => ({
      // The fixture's 'tone-bar-list' sits in a hand-written `<div class="f12-m-stepped">`: app
      // markup that does not resolve the tempo. Those are counted separately.
      anims: document.getAnimations().filter((a) => !a.effect.target.closest('[data-consumer=tone-bar-list]')).length,
      handWritten: document.getAnimations().filter((a) => a.effect.target.closest('[data-consumer=tone-bar-list]')).length,
      barsInSheet: document.getAnimations().filter((a) => a.effect.target.closest('[data-consumer=tone-bar-list-in-sheet]')).length,
      ind: getComputedStyle(document.querySelector('[data-consumer=sheet-smooth] .f12-rng-ind')).transitionTimingFunction,
      skel: getComputedStyle(document.querySelector('[data-consumer=sheet-stepped] .f12-skeleton')).animationName,
      sheets: [...document.querySelectorAll('[data-consumer^=sheet] .f12-dash')].map((d) => (d.className.match(/f12-m-(\w+)/) || [])[1]).join(','),
    }));
    const frames = await sampleAt60Hz(page, 800, () => sampleState().then((s) => JSON.stringify(s)));
    result[tempo] = { ...css, distinctFrames: new Set(frames).size };
  }
  check(result.twos.barsInSheet > 0 && result.still.barsInSheet === 0 && result.still.handWritten > 0,
    'propagation: CSS-only ToneBarList (enter, Badge pop, burst) follows its resolved Sheet; a hand-written f12-m-stepped class does not resolve the tempo (documented: emit useResolvedMotion)', { twos: result.twos.barsInSheet, still: result.still.barsInSheet, handWritten: result.still.handWritten });
  check(result.still.anims === 0 && result.still.skel === 'none' && result.still.distinctFrames === 1 && result.still.sheets === 'cut,cut,cut',
    'propagation: still stops JS-driven (Metric count-up, GhostWire, charts) and CSS-driven (segmented indicator, Skeleton, Badge pop) motion', result.still);
  check(/steps/.test(result.twos.ind) && result.twos.skel === 'f12SkeletonStep' && result.twos.sheets === 'stepped,stepped,cut' && result.twos.distinctFrames > 3,
    'propagation: 12 gives stepped computed styles (even on a smooth Sheet) and stepped progressions; an explicit cut Sheet stays cut', result.twos);
  check(/cubic-bezier/.test(result.ones.ind) && result.ones.skel === 'f12SkeletonSmooth' && result.ones.sheets === 'smooth,smooth,cut' && result.ones.distinctFrames > result.twos.distinctFrames,
    'propagation: 60 gives smooth computed styles and continuous (more distinct frames) progressions', result.ones);
  await ctx.close();
}

// ---------------------------------------------------------------------------------- performance
{
  const { ctx, page, errors } = await openFixture(browser, html, { clock: false });
  await page.addInitScript(() => {});
  await page.evaluate(() => window.__render('perf'));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__chartNode = document.querySelector('.f12-tone-area svg, svg');
    window.__long = [];
    new PerformanceObserver((list) => window.__long.push(...list.getEntries().map((e) => e.duration))).observe({ type: 'longtask' });
  });
  const before = await page.evaluate(() => ({ mounts: { ...window.__mounts }, renders: { ...window.__renders } }));
  const order = ['twos', 'ones', 'still', 'auto'];
  for (let i = 0; i < 20; i++) {
    await page.locator(`#ctl-${order[i % 4]}`).check();
  }
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({
    mounts: { ...window.__mounts },
    renders: { ...window.__renders },
    sameNode: window.__chartNode?.isConnected === true,
    long: window.__long.filter((d) => d > 50),
  }));
  check(
    after.mounts.chart === 1 && before.mounts.chart === 1 && after.sameNode && after.renders.unrelated === before.renders.unrelated &&
      after.long.length === 0 && errors.length === 0,
    'performance: 20 tempo switches never remount the chart or re-render unrelated memoized work; no long task > 50 ms',
    { before, after },
  );
  await ctx.close();
}

// ------------------------------------------------------- registry install closure (React 18 + 19)
{
  const registry = JSON.parse(readFileSync(resolve(REGISTRY_ROOT, 'registry.json'), 'utf8'));
  const byUrl = (u) => registry.items.find((i) => `https://frame12.dev/r/${i.name}.json` === u);
  const closure = (name, seen = new Map()) => {
    const item = registry.items.find((i) => i.name === name);
    if (!item || seen.has(name)) return seen;
    seen.set(name, item);
    for (const d of item.registryDependencies || []) closure(byUrl(d)?.name, seen);
    return seen;
  };
  const metricOnly = closure('metric');
  const files = [...metricOnly.values()].flatMap((i) => i.files || []);
  check(
    metricOnly.has('use-tempo') && metricOnly.has('use-on-twos') && files.some((f) => f.target === 'hooks/use-tempo.ts'),
    '`npx shadcn add @frame12/metric` closure installs hooks/use-tempo.ts (and use-on-twos)',
    [...metricOnly.keys()].join(','),
  );
  const motionItems = registry.items.filter((i) => (i.registryDependencies || []).some((d) => d.endsWith('/use-on-twos.json')));
  check(motionItems.every((i) => (i.registryDependencies || []).some((d) => d.endsWith('/use-tempo.json'))) &&
    registry.items.find((i) => i.name === 'use-on-twos').registryDependencies?.some((d) => d.endsWith('/use-tempo.json')),
    `registry: use-on-twos and every item that uses it (${motionItems.map((i) => i.name).join(', ')}) list use-tempo`);

  // Install metric (+ tempo for the provider) into a temp project at the registry targets, then
  // bundle a consumer on React 18 and 19: one TempoContext, and the provider drives the Metric.
  const dir = mkdtempSync(join(tmpdir(), 'f12-tempo-install-'));
  const install = (name) => {
    for (const item of closure(name).values())
      for (const f of item.files || []) {
        mkdirSync(dirname(join(dir, f.target)), { recursive: true });
        cpSync(resolve(REGISTRY_ROOT, f.path), join(dir, f.target));
      }
  };
  install('metric');
  install('tempo');
  writeFileSync(join(dir, 'consumer.tsx'), `
    import * as React from 'react';
    import { createRoot } from 'react-dom/client';
    import { Metric } from '@/components/frame12/metric';
    import { TempoProvider } from '@/components/frame12/tempo';
    function App() {
      const [step, setStep] = React.useState(0);
      const [tempo, setTempo] = React.useState('still');
      (window as any).__step = () => setStep((s) => s + 1);
      (window as any).__tempo = setTempo;
      return <TempoProvider value={tempo as any}><Metric label="m" value={step % 2 ? 10000 : 0} range={step} format={(v) => String(Math.round(v))} /></TempoProvider>;
    }
    createRoot(document.getElementById('root')!).render(<App />);
  `);
  const dirs = { hooksDir: join(dir, 'hooks'), uiDir: join(dir, 'components/frame12') };
  for (const react of [18, 19]) {
    const js = await bundlePage(join(dir, 'consumer.tsx'), { react, dirs, returnJs: true });
    const contexts = (js.match(/displayName = "TempoContext"/g) || []).length;
    const page_ = await bundlePage(join(dir, 'consumer.tsx'), { react, dirs });
    const { ctx, page, errors } = await openFixture(browser, page_);
    await page.clock.runFor(300);
    await settle(page);
    await page.evaluate(() => window.__step());
    await settle(page);
    const still = await sampleAt60Hz(page, 700, () => metricValue(page));
    await page.evaluate(() => window.__tempo('ones'));
    await settle(page);
    await page.evaluate(() => window.__step());
    await settle(page);
    const ones = await sampleAt60Hz(page, 700, () => metricValue(page));
    check(contexts === 1 && new Set(still).size === 1 && new Set(ones).size > 15 && errors.length === 0,
      `registry consumer on React ${reactVersion(react)}: metric installed alone + tempo → one TempoContext; still cuts the count-up, 60 makes it continuous`,
      { contexts, stillFrames: new Set(still).size, onesFrames: new Set(ones).size, errors });
    await ctx.close();
  }
  rmSync(dir, { recursive: true, force: true });
}

await browser.close();
console.log(failures ? `\n${failures} tempo check(s) failed` : '\nAll tempo checks passed');
process.exit(failures ? 1 : 0);
