// Cut grammar, geometry, determinism, ids, document() and validation.
import { S, check, finish, throws } from './lib.mjs';

const cuts = (html) => [...html.matchAll(/<span class="f12-cut"( data-autocut="")? aria-hidden="true">([^<]*)<\/span>/g)].map((m) => (m[1] ? 'AUTO' : m[2]));

// ------------------------------------------------------------------------------- cut grammar
{
  const auto = S.sheet({ autoCut: true, children: S.fragment(S.panel({ children: 'a' }), S.panel({ children: 'b' })) });
  check(auto.includes('<div class="f12-sheet" data-autocut="" style="--f12-autocut-display:block">'), 'sheet({ autoCut: true }) emits data-autocut and --f12-autocut-display:block exactly like Sheet');
  check(S.sheet({ children: 'x' }).includes('<div class="f12-sheet" style="--f12-autocut-display:none">'), 'sheet() without autoCut emits --f12-autocut-display:none and no data-autocut');
  check(JSON.stringify(cuts(auto)) === '["AUTO","AUTO"]', 'auto: panels with cut unset emit the empty .f12-cut[data-autocut] span');
  check(JSON.stringify(cuts(S.panel({ cut: 'C-07', children: 'x' }))) === '["C-07"]', 'explicit: cut "C-07" renders that text');
  check(cuts(S.panel({ cut: false, children: 'x' })).length === 0, 'cut: false renders no cut');
  check(cuts(S.panel({ variant: 'quiet', children: 'x' })).length === 0 && JSON.stringify(cuts(S.panel({ variant: 'quiet', cut: 'C-02', children: 'x' }))) === '["C-02"]', 'quiet panels: no auto cut, explicit cut kept');
  const mixed = S.fragment(S.panel({ children: '1' }), S.panel({ cut: false, children: '2' }), S.panel({ cut: 'C-09', children: '3' }), S.panel({ children: '4' }));
  check(JSON.stringify(cuts(mixed)) === '["AUTO","C-09","AUTO"]', 'mixed: auto, false, explicit and auto keep DOM order');
  const pair = S.panelPair({ top: {}, bottom: {}, topCut: 'C-04', bottomCut: false });
  check(JSON.stringify(cuts(pair)) === '["C-04"]', 'panelPair: topCut/bottomCut follow PanelPair rules');
  const pairAuto = S.panelPair({ top: {}, bottom: { cut: 'C-08' }, bottomCut: 'C-01' });
  check(JSON.stringify(cuts(pairAuto)) === '["AUTO","C-08"]', 'panelPair: slot cut wins over bottomCut; unset top cut is auto');
  check(!/C-0[1-9]/.test(auto), 'the static kit never computes cut numbers (only the CSS counter does)');
}

// ---------------------------------------------------------------------------------- geometry
{
  const ssr = {
    rect: '0.35,0.35 99.65,0.35 99.65,99.65 0.35,99.65',
    'slant-bottom': '0.35,0.35 99.65,0.35 99.65,93.2 0.35,99.65',
    'slant-top': '0.35,6.8 99.65,0.35 99.65,99.65 0.35,99.65',
  };
  for (const shape of Object.keys(ssr)) {
    const out = S.panel({ shape, children: 'x' });
    check(
      out.includes(`<svg class="f12-panel-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon vector-effect="non-scaling-stroke" points="${ssr[shape]}"></polygon></svg>`),
      `geometry SSR ${shape}: viewBox 0 0 100 100, preserveAspectRatio none, non-scaling-stroke, ssrPts`,
    );
  }
  const exact = {
    rect: '1.25,1.25 318.75,1.25 318.75,198.75 1.25,198.75',
    'slant-bottom': '1.25,1.25 318.75,1.25 318.75,182.75 1.25,198.75',
    'slant-top': '1.25,17.25 318.75,1.25 318.75,198.75 1.25,198.75',
  };
  for (const shape of Object.keys(exact)) {
    const out = S.panel({ shape, width: 320, height: 200, children: 'x' });
    check(out.includes(`<svg class="f12-panel-frame" width="320" height="200" aria-hidden="true"><polygon points="${exact[shape]}"></polygon></svg>`), `geometry exact ${shape} 320×200: inset 1.25, slant rise 16 (panel.tsx formula)`);
  }
  check(S.panel({ shape: 'slant-top', width: 640.5, height: 33, children: 'x' }).includes('points="1.25,17.25 639.25,1.25 639.25,31.75 1.25,31.75"'), 'geometry exact: fractional sizes follow the same formula');
  check(!S.panel({ variant: 'quiet', children: 'x' }).includes('<svg') && S.panel({ variant: 'quiet', shape: 'slant-top', children: 'x' }).includes('<svg'), 'geometry: quiet rect panels draw no SVG frame; quiet slanted panels do');
  const bad = [
    { width: 320 },
    { height: 200 },
    { width: 0, height: 200 },
    { width: 19, height: 200 },
    { width: 320, height: -1 },
    { width: NaN, height: 200 },
    { width: Infinity, height: 200 },
    { width: 320, height: 100001 },
    { width: '320', height: 200 },
  ];
  check(bad.every((d) => throws(() => S.panel({ ...d, children: 'x' }))), `geometry: ${bad.length} invalid dimension combinations throw a TypeError`);
}

// ------------------------------------------------------------------------------ determinism
{
  const make = () =>
    S.document({
      title: 'Determinism',
      body: S.sheet({
        autoCut: true,
        children: S.fragment(
          S.scene({ areas: ['a b'], breakpoint: 960, children: S.fragment(S.panel({ area: 'a', children: 'x' }), S.panel({ area: 'b', children: S.metric({ label: 'L', value: 1234.5, delta: 0.1 }) })) }),
          S.ghostWire({ from: 'a.ts', to: 'b.ts' }),
          S.ghostWire({ from: 'a.ts', to: 'b.ts' }),
          S.ghostWire({ from: 'a.ts', to: 'b.ts', label: 'other' }),
          S.toneBarList({ items: [{ id: 'x', name: 'X', value: 1 }] }),
          S.toneBarList({ items: [{ id: 'x', name: 'X', value: 1 }] }),
        ),
      }),
    });
  const a = make();
  const b = make();
  check(a === b, 'determinism: two renders are byte-identical');
  check(!/\d{13}|Math\.random|Date/.test(a), 'determinism: no timestamps');
  const ids = [...a.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  check(ids.length === new Set(ids).size && ids.length === 5, 'ids: identical components in one document get unique ids', ids.join(', '));
  const masks = [...a.matchAll(/<mask id="([^"]+)"[\s\S]*?mask="url\(#([^)]+)\)"/g)];
  check(masks.length === 3 && masks.every((m) => m[1] === m[2]), 'ids: every mask url(#…) reference resolves to its own (renamed) mask');
  check(/id="(f12-gw-mask-a-ts-b-ts-s[0-9a-z]+)"[\s\S]*id="\1-2"/.test(a), 'ids: the second identical ghostWire is renamed with a document-scoped counter (-2)');
  check(make() === a && S.ghostWire({ from: 'a.ts', to: 'b.ts' }) === S.ghostWire({ from: 'a.ts', to: 'b.ts' }), 'ids: stable across calls (fragments too)');
  const explicit = S.document({ title: 't', body: S.fragment(S.toneBarList({ items: [{ id: 'x', name: 'X', value: 1 }], idPrefix: 'hot' }), S.toneBarList({ items: [{ id: 'y', name: 'Y', value: 1 }], idPrefix: 'hot' })) });
  check(explicit.includes('id="int-hot-x"') && explicit.includes('id="int-hot-y"'), 'ids: idPrefix is respected');
}

// --------------------------------------------------------------------------------- document
{
  const d = S.document({ title: 'Report <&>', body: S.fragment('hi') });
  check(d.startsWith('<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Report &lt;&amp;&gt;</title><style data-f12-tokens>'), 'document(): doctype, lang, charset, viewport, escaped title, then <style data-f12-tokens>');
  const iTok = d.indexOf('<style data-f12-tokens>');
  const iStatic = d.indexOf('<style data-f12-static>');
  check(iTok > 0 && iStatic > iTok && d.indexOf('<body>') > iStatic && d.endsWith('<body>hi</body></html>\n'), 'document(): tokens CSS, then static CSS, then the body');
  check(d.includes('--f-ink:') && d.includes('.f12-panel-frame polygon'), 'document(): inlines @frame12/tokens cssText and static.css');
  check(!/<script|<link|@import|https?:\/\//i.test(d.replace(/<style[\s\S]*?<\/style>/g, (m) => m.replace(/https?:\/\/[^\s"')]*/g, (u) => (u.includes('w3.org') ? '' : u)))), 'document(): no scripts, links, @import or external URLs');
  check(!/url\((?!#)/.test(d), 'document(): no url() requests in inlined CSS');
  const csp = S.document({ title: 't', body: S.fragment('x'), inlineCss: false });
  check(!csp.includes('<style') && csp.includes('<body>x</body>'), 'document({ inlineCss: false }): no inline styles (load tokens.css + static.css under the host CSP)');
  check(S.document({ title: 't', body: S.fragment(''), theme: 'dark' }).includes('<html lang="en" data-theme="dark">') && S.document({ title: 't', body: S.fragment(''), theme: 'light' }).includes('data-theme="light"') && S.document({ title: 't', body: S.fragment('') }).includes('<html lang="en"><head>'), 'document(): theme light/dark sets data-theme; auto follows prefers-color-scheme');
  check(S.document({ title: 't', body: S.fragment(''), variant: 'quiet' }).includes('data-f12-variant="quiet"'), 'document(): variant is recorded on <html> (semantics arrive in F12-06)');
  const langs = { 'en-US': 'en-US', 'pt-BR': 'pt-BR', 'zh-Hant-TW': 'zh-Hant-TW', ar: 'ar', 'x"><script>': 'en', '': 'en', 'english language': 'en', e: 'en' };
  check(Object.entries(langs).every(([i, o]) => S.document({ title: 't', lang: i, body: S.fragment('') }).includes(`<html lang="${o}"`)), 'document(): lang must be a BCP 47-shaped tag, otherwise "en"');
  check(throws(() => S.document({ title: 't', body: S.fragment(''), theme: 'sepia' })) && throws(() => S.document({ title: 1, body: S.fragment('') })), 'document(): invalid theme or title throws');
}

// ------------------------------------------------------------------------------- validation
{
  const cases = [
    ['scene gutter', () => S.scene({ gutter: 'wide', children: 'x' })],
    ['scene layout', () => S.scene({ layout: 'grid', children: 'x' })],
    ['scene columns 0', () => S.scene({ columns: 0, children: 'x' })],
    ['scene columns 2.5', () => S.scene({ columns: 2.5, children: 'x' })],
    ['scene columns 25', () => S.scene({ columns: 25, children: 'x' })],
    ['scene columns≠areas', () => S.scene({ areas: ['a b'], columns: 3, children: 'x' })],
    ['panel shape', () => S.panel({ shape: 'circle', children: 'x' })],
    ['panel variant', () => S.panel({ variant: 'loud', children: 'x' })],
    ['panel cut type', () => S.panel({ cut: 7, children: 'x' })],
    ['balloon tailOffset 37', () => S.balloon({ tailOffset: 37, children: 'x' })],
    ['balloon tailOffset NaN', () => S.balloon({ tailOffset: NaN, children: 'x' })],
    ['tag status', () => S.tag({ status: 'ok', children: 'x' })],
    ['tag variant', () => S.tag({ variant: 'pill', children: 'x' })],
    ['metric value NaN', () => S.metric({ label: 'l', value: NaN })],
    ['metric value Infinity', () => S.metric({ label: 'l', value: Infinity })],
    ['metric delta NaN', () => S.metric({ label: 'l', value: 1, delta: NaN })],
    ['metric headingLevel', () => S.metric({ label: 'l', value: 1, headingLevel: 'h1' })],
    ['toneBar value -1', () => S.toneBarList({ items: [{ id: 'a', name: 'n', value: -1 }] })],
    ['toneBar share 1.5', () => S.toneBarList({ items: [{ id: 'a', name: 'n', value: 1, share: 1.5 }] })],
    ['toneBar duplicate ids', () => S.toneBarList({ items: [{ id: 'a', name: 'n', value: 1 }, { id: 'a', name: 'm', value: 2 }] })],
    ['ghostWire strength 2', () => S.ghostWire({ from: 'a', to: 'b', strength: 2 })],
    ['ghostWire orientation', () => S.ghostWire({ from: 'a', to: 'b', orientation: 'diagonal' })],
    ['receipt kind', () => S.receipt({ kind: 'pr', value: 'x' })],
    ['receipt origin', () => S.receipt({ kind: 'file', value: 'x', origin: 'robot' })],
  ];
  const notThrowing = cases.filter(([, fn]) => !throws(fn)).map(([n]) => n);
  check(notThrowing.length === 0, `validation: ${cases.length} invalid enum/number/identifier inputs throw a TypeError`, notThrowing.join(', '));
  check(S.metric({ label: 'Huge', value: 9.99e300, format: (v) => v.toExponential(2), big: true }).includes('--f12-m-chars:9'), 'huge numbers render with --f12-m-chars from the settled value');
}

// --------------------------------------------------------------------------------- textContent
{
  const t = S.tag({ status: 'danger', children: S.fragment(S.unsafeRaw('<span aria-hidden="true">!</span>'), 'Error budget') });
  check(!t.includes('Error: '), 'srLabel is skipped when Html child text already starts with it (aria-hidden ignored)');
  const g = S.ghostWire({ from: S.tag({ status: 'info', children: 'a.ts' }), to: 'b.ts' });
  check(g.includes('aria-label="Info: a.ts usually changes with b.ts'), 'ghostWire aria-label uses the visible text of Html endpoints, like extractTextContent');
}

finish('render');
