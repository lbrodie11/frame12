import { Dashboard, Panel, Chart, Interventions, RangeTabs } from './ui.jsx';
import { SUMMARIES } from './data.js';

const { useState, useEffect } = React;
const noop = () => {};

function FontNote() {
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!document.fonts) return;
    // fonts.check() reports true for faces that were never declared, so look for loaded faces instead.
    document.fonts.ready.then(() => {
      const loaded = (name) => [...document.fonts].some((f) => f.family.replace(/["']/g, '') === name && f.status === 'loaded');
      setMissing(!(loaded('Dela Gothic One') && loaded('Zen Kaku Gothic New')));
    });
  }, []);
  if (!missing) return null;
  return <p className="sp-note">The FRAME/12 typefaces didn't load in this view, so stand-in fonts are shown. Open the live page for the real type.</p>;
}

function Grammar() {
  // Panel grammar diagram: gutter widths encode relationships.
  const sx = 0, sy = 44;
  const A = { x: sx + 20, y: sy + 20, w: 420, h: 200 };
  const px = A.x + A.w + 20, pw = 216;
  const d = 14;
  const bBot = A.y + 94;
  const cTop = bBot + 12;
  const D = { x: A.x, y: A.y + A.h + 32, w: px + pw - A.x, h: 72 };
  const ink = 'var(--f-ink)';
  const lab = (x, y, t, anchor = 'start') => <text x={x} y={y} className="g-lab" textAnchor={anchor}>{t}</text>;
  const tag = (x, y, t) => (
    <g>
      <rect x={x} y={y - 15} width={t.length * 7.4 + 16} height="22" className="g-tag" />
      <text x={x + 8} y={y} className="g-tag-t">{t}</text>
    </g>
  );
  return (
    <div className="sp-scroll">
      <svg viewBox="0 0 900 380" className="grammar" role="img" aria-label="Panel grammar: a 12 pixel gutter pairs panels, 20 pixels keeps them in one scene, 32 pixels starts a new scene.">
        <rect x={sx} y={sy} width={px + pw + 20} height={D.y + D.h + 20 - sy} className="g-sheet" />
        <rect x={A.x} y={A.y} width={A.w} height={A.h} className="g-panel" />
        <polygon points={`${px},${A.y} ${px + pw},${A.y} ${px + pw},${bBot - d} ${px},${bBot}`} className="g-panel" />
        <polygon points={`${px},${cTop} ${px + pw},${cTop - d} ${px + pw},${A.y + A.h} ${px},${A.y + A.h}`} className="g-panel" />
        <rect x={D.x} y={D.y} width={D.w} height={D.h} className="g-panel" />
        {lab(A.x + 16, A.y + 28, 'C-01  Primary: the establishing frame')}
        {lab(px + 14, A.y + 28, 'C-02')}
        {lab(px + 14, cTop + 30, 'C-03')}
        {lab(D.x + 16, D.y + 30, 'C-04  New scene')}
        <path d={`M${A.x + A.w + 10} ${A.y - 4}V${sy - 14}`} className="g-lead" />
        {tag(A.x + A.w - 70, sy - 20, '20 px · same scene')}
        <path d={`M${px + pw + 4} ${bBot - d / 2 + 6}H${px + pw + 44}`} className="g-lead" />
        {tag(px + pw + 50, bBot - d / 2 + 11, '12 px · a pair')}
        <path d={`M${px + pw + 4} ${A.y + A.h + 16}H${px + pw + 44}`} className="g-lead" />
        {tag(px + pw + 50, A.y + A.h + 21, '32 px · scene change')}
        <text x={px + pw + 50} y={bBot + 36} className="g-small">Slanted gutter =</text>
        <text x={px + pw + 50} y={bBot + 52} className="g-small">related metrics</text>
      </svg>
    </div>
  );
}

function FilmStrip() {
  // The range marker moving 7 → 90 days "on twos": four held poses, 83 ms apart.
  const fw = 196, fh = 96, gap = 14, top = 34;
  const poses = [0, 1 / 3, 2 / 3, 1];
  const cell = 52, cx0 = 22, cy = 34, ch = 34;
  const labels = ['7', '30', '90'];
  return (
    <div className="sp-scroll">
      <svg viewBox={`0 0 ${poses.length * (fw + gap) + gap} ${fh + top * 2 + 24}`} className="film" role="img" aria-label="Four frames of the range marker moving from 7 to 90 days, each pose held 83 milliseconds.">
        <defs>
          {poses.map((p, i) => (
            <clipPath key={i} id={`fm-${i}`}><rect x={cx0 + p * cell * 2} y={cy} width={cell} height={ch} /></clipPath>
          ))}
        </defs>
        <rect x="0" y="0" width={poses.length * (fw + gap) + gap} height={fh + top * 2} className="film-base" />
        {Array.from({ length: Math.floor((poses.length * (fw + gap) + gap) / 18) }, (_, k) => (
          <g key={k}>
            <rect x={8 + k * 18} y="9" width="9" height="12" rx="2" className="film-hole" />
            <rect x={8 + k * 18} y={fh + top * 2 - 21} width="9" height="12" rx="2" className="film-hole" />
          </g>
        ))}
        {poses.map((p, i) => (
          <g key={i} transform={`translate(${gap + i * (fw + gap)}, ${top})`}>
            <rect x="0" y="0" width={fw} height={fh} className="film-frame" />
            <text x="10" y="18" className="film-n">{`F${i * 2 + 1}–${i * 2 + 2}`}</text>
            <rect x={cx0} y={cy} width={cell * 3} height={ch} className="fm-ctl" />
            <line x1={cx0 + cell} x2={cx0 + cell} y1={cy} y2={cy + ch} className="fm-sep" />
            <line x1={cx0 + cell * 2} x2={cx0 + cell * 2} y1={cy} y2={cy + ch} className="fm-sep" />
            {labels.map((t, k) => <text key={k} x={cx0 + cell * k + cell / 2} y={cy + 23} textAnchor="middle" className="fm-t">{t}</text>)}
            <rect x={cx0 + p * cell * 2} y={cy} width={cell} height={ch} className="fm-ind" />
            <g clipPath={`url(#fm-${i})`}>
              {labels.map((t, k) => <text key={k} x={cx0 + cell * k + cell / 2} y={cy + 23} textAnchor="middle" className="fm-t inv">{t}</text>)}
            </g>
          </g>
        ))}
        {poses.map((p, i) => (
          <text key={i} x={gap + i * (fw + gap) + fw / 2} y={fh + top * 2 + 18} textAnchor="middle" className="film-cap">{`${Math.round(i * 83.3)} ms`}</text>
        ))}
      </svg>
    </div>
  );
}

const PALETTE = [
  ['Paper', '#FFFFFF', '#19191A', 'Panels and sheet'],
  ['Ink', '#121212', '#F1F0EA', 'Frames, text, screentone'],
  ['Ink 2', '#4B4B4B', '#B9B8B1', 'Labels and secondary text'],
  ['Gutter', '#FFFFFF', '#050505', 'Space between panels'],
  ['Grid', '#E3E3E3', '#2C2C2D', 'Chart rules, row dividers'],
  ['Marker', '#FFD60A', '#FFD60A', 'The one accent, always under ink text'],
  ['Desk', '#E2E3E5', '#000000', 'Outside the sheet'],
];

function Specimen() {
  const [range, setRange] = useState(30);
  const s7 = SUMMARIES[7];
  const s30 = SUMMARIES[30];
  return (
    <div className="spec">
      <header className="sp-hd">
        <p className="sp-eyebrow">Style sheet · Phase 1 · <span className="sp-tag">Example data</span></p>
        <h1 className="sp-title">FRAME/12</h1>
        <p className="sp-lede">An interface language taken from animation and manga production: ink-framed panels, gutters whose width means something, screentone instead of gradients, and motion held on twos.</p>
        <FontNote />
      </header>

      <section className="sp-sec" aria-labelledby="h-sheet">
        <h2 id="h-sheet" className="sp-h">The sheet</h2>
        <div className="theme-light f12-theme-light sp-shot"><Dashboard variant="frame" motion="cut" range={30} setRange={noop} focus={null} setFocus={noop} idPrefix="spA" /></div>
      </section>

      <section className="sp-sec" aria-labelledby="h-variants">
        <h2 id="h-variants" className="sp-h">Same language, dark and phone</h2>
        <div className="sp-two">
          <figure className="sp-fig">
            <div className="theme-dark f12-theme-dark sp-shot"><Dashboard variant="frame" motion="cut" range={7} setRange={noop} focus="exit" setFocus={noop} idPrefix="spB" /></div>
            <figcaption>Dark: gutters turn black, the manga convention for flashback pages. Shown on 7 days with one intervention selected.</figcaption>
          </figure>
          <figure className="sp-fig sp-phone-fig">
            <div className="theme-light f12-theme-light sp-shot sp-phone"><Dashboard variant="frame" motion="cut" range={90} setRange={noop} focus={null} setFocus={noop} idPrefix="spC" /></div>
            <figcaption>Phone: panels stack in reading order; the gutters keep their meaning.</figcaption>
          </figure>
        </div>
      </section>

      <section className="sp-sec" aria-labelledby="h-grammar">
        <h2 id="h-grammar" className="sp-h">Panel grammar</h2>
        <p className="sp-p">Gutter width tells the reader how panels relate before any label is read. Panel size tells them what matters most.</p>
        <Grammar />
      </section>

      <section className="sp-sec" aria-labelledby="h-details">
        <h2 id="h-details" className="sp-h">Construction details</h2>
        <div className="sp-grid">
          <div className="sp-card">
            <div className="theme-light f12-theme-light sp-live"><div className="dash frame m-cut"><Panel cut="C-07"><p className="sp-mini">Panel content</p></Panel></div></div>
            <h3>Cut numbers</h3>
            <p>Set into the frame line, numbered in reading order. Visual order, reading order and code order always match.</p>
          </div>
          <div className="sp-card">
            <div className="theme-light f12-theme-light sp-live">
              <div className="dash frame m-cut sp-pair">
                <Panel cut="C-02" shape="slant-bottom"><p className="sp-mini">Profit</p></Panel>
                <Panel cut="C-03" shape="slant-top"><p className="sp-mini">Conversion lift</p></Panel>
              </div>
            </div>
            <h3>Diagonal pair</h3>
            <p>Two related metrics share one slanted 12 px gutter, the manga cue for "these belong together".</p>
          </div>
          <div className="sp-card">
            <div className="theme-light f12-theme-light sp-live sp-tones">
              <span className="tone t1" /><span className="tone t2" /><span className="tone t3" />
            </div>
            <h3>Screentone</h3>
            <p>Halftone dots replace gradients and transparency. Density carries emphasis; it prints and survives grayscale.</p>
          </div>
          <div className="sp-card">
            <div className="theme-light f12-theme-light sp-live sp-chart"><div className="dash frame m-cut"><Chart summary={s7} focus={null} variant="frame" motion="cut" height={170} /></div></div>
            <h3>Speech balloon</h3>
            <p>Annotations are balloons with a tail to the point they describe, not floating tooltips.</p>
          </div>
          <div className="sp-card">
            <div className="theme-light f12-theme-light sp-live sp-marker">
              <div className="dash frame m-cut sp-marker-row">
                <span className="tag">Example data</span>
                <p className="delta up"><span className="delta-sym" aria-hidden="true">▲</span>11.4%<span className="delta-ref"> vs prior 30 days</span></p>
                <span className="badge"><span className="badge-t">Top performer</span></span>
              </div>
            </div>
            <h3>Marker</h3>
            <p>One flat yellow, always under ink text. It flags; it never colors a line or a chart.</p>
          </div>
          <div className="sp-card">
            <div className="theme-light f12-theme-light sp-live sp-rng">
              <div className="dash frame m-stepped"><RangeTabs value={range} onChange={setRange} variant="frame" idPrefix="spR" /></div>
            </div>
            <h3>Range control</h3>
            <p>Cells like an exposure sheet. The marker inverts what it covers, so labels stay legible at every pose. Try it.</p>
          </div>
        </div>
      </section>

      <section className="sp-sec" aria-labelledby="h-motion">
        <h2 id="h-motion" className="sp-h">Motion on twos</h2>
        <p className="sp-p">Discrete changes hold each pose for two frames at 24 fps: 12 poses a second, 83 ms each. Hover, scrolling and typing stay immediate.</p>
        <FilmStrip />
        <div className="sp-scroll">
          <table className="sp-table">
            <thead><tr><th scope="col">Grammar</th><th scope="col">Timing</th><th scope="col">Used for</th></tr></thead>
            <tbody>
              <tr><th scope="row">Stepped</th><td>3–4 held poses, 250–333 ms</td><td>Range switch, list reveal, chart redraw, badge pop with a two-frame impact burst</td></tr>
              <tr><th scope="row">Cut</th><td>Instant</td><td>Reduced-motion settings; editorial scene changes</td></tr>
              <tr><th scope="row">Smooth</th><td>Continuous easing</td><td>Only where the hand is moving: hover, crosshair, scrolling</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="sp-sec" aria-labelledby="h-type">
        <h2 id="h-type" className="sp-h">Type</h2>
        <div className="sp-type">
          <div><p className="ty-d">$120,054</p><p className="ty-n">Dela Gothic One · display numbers and titles, used sparingly</p></div>
          <div><p className="ty-b">Abandoned-cart email recovered the most revenue this month.</p><p className="ty-n">Zen Kaku Gothic New · body and names</p></div>
          <div><p className="ty-m">INCREMENTAL PROFIT · C-02 · ▲ 8.7%</p><p className="ty-n">M PLUS 1 Code · labels, cut numbers, values</p></div>
        </div>
      </section>

      <section className="sp-sec" aria-labelledby="h-palette">
        <h2 id="h-palette" className="sp-h">Palette</h2>
        <div className="sp-scroll">
          <table className="sp-table sp-pal">
            <thead><tr><th scope="col">Token</th><th scope="col">Light</th><th scope="col">Dark</th><th scope="col">Role</th></tr></thead>
            <tbody>
              {PALETTE.map(([n, l, d, r]) => (
                <tr key={n}>
                  <th scope="row">{n}</th>
                  <td><span className="sw-chip" style={{ background: l }} />{l}</td>
                  <td><span className="sw-chip" style={{ background: d }} />{d}</td>
                  <td>{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="sp-foot">Fernwood Supply Co. and all figures are fictional. No named artist's work is reproduced; every element is original.</footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Specimen />);
