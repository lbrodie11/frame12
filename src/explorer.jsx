import { Dashboard } from './ui.jsx';
import { DEFAULT_RANGE } from './data.js';

const { useState, useRef, useEffect } = React;

function Seg({ label, value, options, onChange, id }) {
  return (
    <div className="seg" role="group" aria-labelledby={`${id}-l`}>
      <span className="seg-l" id={`${id}-l`}>{label}</span>
      <div className="seg-opts">
        {options.map(([v, t]) => (
          <button key={v} id={`${id}-${v}`} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{t}</button>
        ))}
      </div>
    </div>
  );
}

function getTheme() {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'light' || t === 'dark' ? t : 'system';
}

function Explorer() {
  const [design, setDesign] = useState('frame');
  const [motion, setMotion] = useState('stepped');
  const [theme, setThemeState] = useState(getTheme);
  const [gray, setGray] = useState(false);
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [focus, setFocus] = useState(null);
  const [playing, setPlaying] = useState(false);
  const timers = useRef([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('f12-explorer') || 'null');
      if (saved) { setDesign(saved.design || 'frame'); setMotion(saved.motion || 'stepped'); }
    } catch (e) { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem('f12-explorer', JSON.stringify({ design, motion })); } catch (e) { /* ignore */ }
  }, [design, motion]);

  const setTheme = (t) => {
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    setThemeState(t);
  };

  const play = () => {
    timers.current.forEach(clearTimeout);
    setPlaying(true);
    setFocus(null);
    const steps = [[7, 200], [90, 1400], [90, 2600, 'exit'], [30, 3800, null]];
    timers.current = steps.map(([r, t, f]) => setTimeout(() => { setRange(r); if (f !== undefined) setFocus(f); }, t));
    timers.current.push(setTimeout(() => setPlaying(false), 4600));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const motionNote = {
    smooth: 'Continuous easing on every transition.',
    stepped: 'Discrete changes hold each pose for 2 frames at 24fps (12 poses per second). Hover and scrolling stay smooth.',
    cut: 'Instant change. The editorial hard cut.',
  }[motion];

  const designs = design === 'both' ? ['conv', 'frame'] : [design];

  return (
    <div className="shell">
      <header className="bar">
        <div className="bar-id">
          <h1>FRAME/12 Prototype</h1>
          <p>Phase 1 · one dashboard section, two design languages, identical example data</p>
        </div>
        <div className="bar-ctl">
          <Seg id="ds" label="Design" value={design} onChange={setDesign} options={[['conv', 'Conventional'], ['frame', 'FRAME/12'], ['both', 'Both']]} />
          <Seg id="mo" label="Motion" value={motion} onChange={setMotion} options={[['smooth', 'Smooth'], ['stepped', 'Stepped'], ['cut', 'Cut']]} />
          <Seg id="th" label="Theme" value={theme} onChange={setTheme} options={[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} />
          <div className="bar-row">
            <label className="chk" htmlFor="gray">
              <input id="gray" type="checkbox" checked={gray} onChange={(e) => setGray(e.target.checked)} />
              Grayscale test
            </label>
            <button id="play" type="button" className="btn" onClick={play} disabled={playing}>
              {playing ? 'Playing…' : 'Replay transitions'}
            </button>
          </div>
        </div>
        <p className="bar-note">{motionNote}</p>
      </header>

      <main className={`stage-wrap${gray ? ' gray' : ''}`}>
        {designs.map((d) => (
          <section key={d} className="specimen" aria-label={d === 'conv' ? 'Conventional design' : 'FRAME/12 design'}>
            {design === 'both' && <h2 className="spec-l">{d === 'conv' ? 'Conventional' : 'FRAME/12'}</h2>}
            <Dashboard
              variant={d}
              motion={d === 'conv' && design === 'both' ? 'smooth' : motion}
              range={range}
              setRange={setRange}
              focus={focus}
              setFocus={setFocus}
              idPrefix={`x${d}`}
            />
          </section>
        ))}
      </main>

      <footer className="foot">
        <p>Fernwood Supply Co. and every number here are fictional. Fonts load from Google Fonts. Motion follows your device's reduced-motion setting.</p>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Explorer />);
