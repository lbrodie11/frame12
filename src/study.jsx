import { Dashboard, MotionStage, useSize, useReducedMotion } from './ui.jsx';
import { buildTaskSets, DEFAULT_RANGE } from './data.js';

const { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } = React;

const TASKS = buildTaskSets();
const NAME = { frame: 'FRAME/12', conv: 'Conventional' };
const FRAME_TASK_MOTION = 'stepped';
const VERSION = 1;

const ROLES = [
  ['designer', 'UI or visual designer'],
  ['frontend', 'Frontend developer'],
  ['dashboards', 'I use analytics dashboards regularly'],
  ['other', 'Other'],
];

const STATEMENTS = [
  ['polished', 'This looks polished and professionally made.'],
  ['trust', 'I would trust the numbers in this dashboard.'],
  ['easy', 'It was easy to find what I needed.'],
  ['identity', 'It has its own recognizable visual identity.'],
  ['coherent', 'Every part looks like it belongs to the same design language.'],
  ['want', "I'd want to use this style in a product I work on."],
];

const MOTION_KINDS = [
  ['tabs', 'Switching the date range', 'Watch the selected-range marker and the number below it.'],
  ['chart', 'The chart redrawing', 'Watch the line and its shaded area redraw for the new range.'],
  ['badge', 'A badge appearing', 'Watch the "Top performer" badge when the leader changes.'],
];

const shuffle = (a) => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};

// ---------------------------------------------------------------- encoding
const encode = (obj) => 'F12R' + VERSION + '.' + btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
function decodeAll(text) {
  const out = [];
  const errors = [];
  const parts = text.split(/\s+/).filter(Boolean);
  for (const p of parts) {
    try {
      if (!/^F12R\d+\./.test(p)) throw new Error('not a result code');
      const json = decodeURIComponent(escape(atob(p.slice(p.indexOf('.') + 1))));
      const o = JSON.parse(json);
      if (!o || !o.rid || !Array.isArray(o.tasks)) throw new Error('missing fields');
      out.push(o);
    } catch (e) { errors.push(p.slice(0, 18) + '…'); }
  }
  return { out, errors };
}

async function copyText(text, fallbackEl) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    if (fallbackEl) { fallbackEl.focus(); fallbackEl.select(); }
    return false;
  }
}

async function getCaps() {
  const c = typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function' ? window.claude : null;
  if (!c) return { db: null, user: null };
  const [db, user] = await Promise.all([c.use('db').catch(() => null), c.use('user').catch(() => null)]);
  return { db, user };
}

// ---------------------------------------------------------------- small UI
function Likert({ id, legend, value, onChange }) {
  return (
    <fieldset className="lk">
      <legend>{legend}</legend>
      <div className="lk-row">
        <span className="lk-end" aria-hidden="true">Disagree</span>
        <div className="lk-opts">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <label key={n} className="lk-o" htmlFor={`${id}-${n}`}>
              <input type="radio" id={`${id}-${n}`} name={id} value={n} checked={value === n} onChange={() => onChange(n)} />
              <span aria-hidden="true">{n}</span>
              <span className="sr-only">{n === 1 ? '1, strongly disagree' : n === 7 ? '7, strongly agree' : String(n)}</span>
            </label>
          ))}
        </div>
        <span className="lk-end" aria-hidden="true">Agree</span>
      </div>
    </fieldset>
  );
}

function Choice({ id, legend, options, value, onChange }) {
  return (
    <fieldset className="ch">
      <legend>{legend}</legend>
      <div className="ch-opts">
        {options.map(([v, t], i) => (
          <label key={v} className="ch-o" htmlFor={`${id}-${i}`}>
            <input type="radio" id={`${id}-${i}`} name={id} checked={value === v} onChange={() => onChange(v)} />
            <span>{t}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Thumb({ variant, label }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const { w } = useSize(outer);
  const { h } = useSize(inner);
  const W = 1080;
  const scale = w ? w / W : 0;
  return (
    <figure className="thumb">
      <div ref={outer} className="thumb-frame" style={{ height: h * scale || 240 }} role="img" aria-label={`${label} preview`}>
        <div ref={inner} className="thumb-inner" style={{ width: W, transform: `scale(${scale})` }} inert="" aria-hidden="true">
          <Dashboard variant={variant} motion="cut" range={DEFAULT_RANGE} setRange={() => {}} focus={null} setFocus={() => {}} idPrefix={`th${variant}`} />
        </div>
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------- task screen
function TaskScreen({ design, motion, task, index, total, onDone }) {
  const options = useMemo(() => [...shuffle(task.options), "I'm not sure"], [task.id]);
  const [choice, setChoice] = useState(null);
  const [range, setRangeRaw] = useState(DEFAULT_RANGE);
  const [focus, setFocusRaw] = useState(null);
  const clicks = useRef(0);
  const t0 = useRef(performance.now());
  const setRange = (r) => { clicks.current++; setRangeRaw(r); };
  const setFocus = (f) => { clicks.current++; setFocusRaw(f); };
  const submit = (e) => {
    e.preventDefault();
    if (!choice) return;
    onDone({
      design, set: task.id[0], q: task.id, kind: task.kind, answer: choice,
      correct: choice === task.answer, ms: Math.round(performance.now() - t0.current), clicks: clicks.current,
    });
  };
  return (
    <div className="task">
      <form className="task-q card" onSubmit={submit}>
        <p className="kicker">Question {index + 1} of {total}</p>
        <Choice id={`ans-${task.id}`} legend={task.prompt} options={options.map((o) => [o, o])} value={choice} onChange={setChoice} />
        <button id="task-submit" className="btn primary" type="submit" disabled={!choice}>Submit answer</button>
        <p className="hint">Use the dashboard to find the answer. You can switch the date range and select interventions.</p>
      </form>
      <div className="task-dash">
        <Dashboard variant={design} motion={motion} range={range} setRange={setRange} focus={focus} setFocus={setFocus} idPrefix={`t${task.id}`} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- motion screen
function MotionScreen({ kind, title, help, order, value, onChange, idx }) {
  const [plays, setPlays] = useState({ a: 0, b: 0 });
  const labels = { a: 'Version X', b: 'Version Y' };
  const motionOf = (slot) => (slot === 'a' ? order[0] : order[1]);
  const v = value || {};
  return (
    <div className="mo">
      <div className="mo-intro">
        <p className="kicker">Motion {idx + 1} of 3</p>
        <h2>{title}</h2>
        <p>{help} Press Play on each version, or use the range buttons yourself. Watch as many times as you like.</p>
      </div>
      <div className="mo-grid">
        {['a', 'b'].map((slot) => (
          <div className="mo-col" key={slot}>
            <div className="mo-col-hd">
              <h3>{labels[slot]}</h3>
              <button id={`play-${kind}-${slot}`} type="button" className="btn" onClick={() => setPlays((p) => ({ ...p, [slot]: p[slot] + 1 }))}>Play</button>
            </div>
            <MotionStage kind={kind} motion={motionOf(slot)} playKey={plays[slot]} idPrefix={`m${kind}${slot}`} />
          </div>
        ))}
      </div>
      <div className="card mo-q">
        <Choice
          id={`mo-pref-${kind}`}
          legend="Which version feels better made?"
          options={[['a', 'Version X'], ['b', 'Version Y'], ['none', 'No real difference']]}
          value={v.prefer}
          onChange={(p) => onChange({ ...v, prefer: p })}
        />
        <fieldset className="ch">
          <legend>Did either version feel broken, laggy or glitchy? (optional)</legend>
          <div className="ch-opts">
            {['a', 'b'].map((slot) => (
              <label key={slot} className="ch-o" htmlFor={`mo-broken-${kind}-${slot}`}>
                <input
                  type="checkbox"
                  id={`mo-broken-${kind}-${slot}`}
                  checked={!!(v.broken && v.broken[slot])}
                  onChange={(e) => onChange({ ...v, broken: { ...(v.broken || {}), [slot]: e.target.checked } })}
                />
                <span>{labels[slot]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- participant flow
function Study() {
  const reduced = useReducedMotion();
  const plan = useMemo(() => {
    const frameFirst = Math.random() < 0.5;
    const frameSet = Math.random() < 0.5 ? 'A' : 'B';
    const order = frameFirst ? ['frame', 'conv'] : ['conv', 'frame'];
    const setFor = { frame: frameSet, conv: frameSet === 'A' ? 'B' : 'A' };
    const motionOrder = Math.random() < 0.5 ? ['stepped', 'smooth'] : ['smooth', 'stepped'];
    return { order, setFor, motionOrder, rid: Math.random().toString(36).slice(2, 10) + Date.now().toString(36) };
  }, []);

  const steps = useMemo(() => {
    const s = ['welcome'];
    plan.order.forEach((d, di) => {
      s.push(`intro-${di}`);
      [0, 1, 2].forEach((q) => s.push(`task-${di}-${q}`));
      s.push(`rate-${di}`);
    });
    s.push('compare', 'motion-0', 'motion-1', 'motion-2', 'comments', 'done');
    return s;
  }, [plan]);

  const [i, setI] = useState(0);
  const [role, setRole] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [ratings, setRatings] = useState({ frame: {}, conv: {} });
  const [compare, setCompare] = useState({});
  const [motion, setMotion] = useState({});
  const [motionOverride, setMotionOverride] = useState(false);
  const [motionSkipped, setMotionSkipped] = useState(false);
  const [comments, setComments] = useState({ stood: '', bothered: '' });
  const [save, setSave] = useState({ state: 'idle' });
  const started = useRef(new Date().toISOString());
  const top = useRef(null);
  const codeRef = useRef(null);

  const step = steps[i];
  const next = () => { setI((n) => Math.min(steps.length - 1, n + 1)); };
  useLayoutEffect(() => {
    if (i > 0 && top.current) { top.current.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }, [i]);

  const buildPayload = () => ({
    v: VERSION,
    rid: plan.rid,
    startedAt: started.current,
    finishedAt: new Date().toISOString(),
    role,
    order: plan.order,
    setFor: plan.setFor,
    frameTaskMotion: FRAME_TASK_MOTION,
    tasks,
    ratings,
    compare: { distinct: compare.distinct ? (compare.distinct === 'same' ? 'same' : plan.order[+compare.distinct]) : null, prefer: compare.prefer ? (compare.prefer === 'none' ? 'none' : plan.order[+compare.prefer]) : null },
    motion: motionSkipped ? { skipped: true } : {
      order: plan.motionOrder,
      items: MOTION_KINDS.map(([k]) => {
        const m = motion[k] || {};
        const map = (slot) => (slot === 'a' ? plan.motionOrder[0] : plan.motionOrder[1]);
        return {
          kind: k,
          prefer: m.prefer ? (m.prefer === 'none' ? 'none' : map(m.prefer)) : null,
          broken: { stepped: !!(m.broken && m.broken[plan.motionOrder[0] === 'stepped' ? 'a' : 'b']), smooth: !!(m.broken && m.broken[plan.motionOrder[0] === 'smooth' ? 'a' : 'b']) },
        };
      }),
    },
    comments,
    device: { w: window.innerWidth, h: window.innerHeight, touch: matchMedia('(pointer: coarse)').matches, reducedMotion: reduced, dpr: window.devicePixelRatio || 1 },
  });

  const submit = async () => {
    const payload = buildPayload();
    const code = encode(payload);
    setSave({ state: 'saving', code });
    next();
    try {
      const { db, user } = await getCaps();
      const uid = user ? await user.id() : null;
      if (!db || !uid) throw new Error('no-store');
      await db.doc('responses/' + uid).set({ ...payload, savedVia: 'db' });
      setSave({ state: 'saved', code });
    } catch (e) {
      setSave({ state: 'manual', code });
    }
  };

  const progress = Math.round((i / (steps.length - 1)) * 100);

  let body = null;
  if (step === 'welcome') {
    body = (
      <div className="card narrow">
        <h1>Two dashboard designs</h1>
        <p>You'll use two versions of the same analytics dashboard to answer six short questions, then tell us what you think of each. It takes about 10 minutes.</p>
        <p>The store and every number are made up. There are no trick questions, and we're testing the designs, not you.</p>
        <p className="fine">We record your answers, how long each question takes, your role and your screen size. We don't ask for your name. If you're signed in to Claude, your response is stored under an anonymous account ID.</p>
        <Choice id="role" legend="Which describes you best?" options={ROLES} value={role} onChange={setRole} />
        <button id="start" className="btn primary" type="button" disabled={!role} onClick={next}>Start</button>
      </div>
    );
  } else if (step.startsWith('intro-')) {
    const di = +step.split('-')[1];
    body = (
      <div className="card narrow">
        <p className="kicker">Part {di + 1} of 2</p>
        <h1>Design {di + 1}</h1>
        <p>Answer three questions using this dashboard. Work at your normal pace; we time each question.</p>
        <button id={`intro-go-${di}`} className="btn primary" type="button" onClick={next}>Show Design {di + 1}</button>
      </div>
    );
  } else if (step.startsWith('task-')) {
    const [, di, q] = step.split('-').map((x, k) => (k ? +x : x));
    const d = plan.order[di];
    const task = TASKS[plan.setFor[d]][q];
    body = (
      <TaskScreen
        key={step}
        design={d}
        motion={d === 'frame' ? FRAME_TASK_MOTION : 'smooth'}
        task={task}
        index={q}
        total={3}
        onDone={(r) => { setTasks((t) => [...t, r]); next(); }}
      />
    );
  } else if (step.startsWith('rate-')) {
    const di = +step.split('-')[1];
    const d = plan.order[di];
    const r = ratings[d];
    const done = STATEMENTS.every(([k]) => r[k]);
    body = (
      <div className="card narrow">
        <p className="kicker">Design {di + 1}</p>
        <h1>What did you think of Design {di + 1}?</h1>
        <p className="fine">1 means strongly disagree, 7 means strongly agree.</p>
        {STATEMENTS.map(([k, text]) => (
          <Likert key={k} id={`r${di}-${k}`} legend={text} value={r[k]} onChange={(n) => setRatings((all) => ({ ...all, [d]: { ...all[d], [k]: n } }))} />
        ))}
        <button id={`rate-next-${di}`} className="btn primary" type="button" disabled={!done} onClick={next}>Continue</button>
      </div>
    );
  } else if (step === 'compare') {
    body = (
      <div className="cmp">
        <div className="cmp-hd">
          <p className="kicker">Compare</p>
          <h1>Side by side</h1>
          <p>Here are the two designs you used.</p>
        </div>
        <div className="cmp-grid">
          <Thumb variant={plan.order[0]} label="Design 1" />
          <Thumb variant={plan.order[1]} label="Design 2" />
        </div>
        <div className="card narrow">
          <Choice id="cmp-distinct" legend="Which design has a more distinctive, recognizable identity?" options={[['0', 'Design 1'], ['1', 'Design 2'], ['same', 'About the same']]} value={compare.distinct} onChange={(v) => setCompare((c) => ({ ...c, distinct: v }))} />
          <Choice id="cmp-prefer" legend="Which would you rather use in a product you work on?" options={[['0', 'Design 1'], ['1', 'Design 2'], ['none', 'No preference']]} value={compare.prefer} onChange={(v) => setCompare((c) => ({ ...c, prefer: v }))} />
          <button id="cmp-next" className="btn primary" type="button" disabled={!compare.distinct || !compare.prefer} onClick={next}>Continue</button>
        </div>
      </div>
    );
  } else if (step.startsWith('motion-')) {
    const mi = +step.split('-')[1];
    const [kind, title, help] = MOTION_KINDS[mi];
    if (reduced && !motionOverride) {
      body = (
        <div className="card narrow">
          <h1>Motion comparison</h1>
          <p>Your device is set to reduce motion. The next three questions compare short animations of up to one second, which play only when you press Play.</p>
          <div className="btn-row">
            <button id="mo-allow" className="btn primary" type="button" onClick={() => setMotionOverride(true)}>Show the animations</button>
            <button id="mo-skip" className="btn" type="button" onClick={() => { setMotionSkipped(true); setI(steps.indexOf('comments')); }}>Skip this section</button>
          </div>
        </div>
      );
    } else {
      const v = motion[kind] || {};
      body = (
        <div>
          <MotionScreen key={kind} kind={kind} title={title} help={help} order={plan.motionOrder} idx={mi} value={v} onChange={(nv) => setMotion((m) => ({ ...m, [kind]: nv }))} />
          <div className="next-row"><button id={`mo-next-${mi}`} className="btn primary" type="button" disabled={!v.prefer} onClick={next}>Continue</button></div>
        </div>
      );
    }
  } else if (step === 'comments') {
    body = (
      <div className="card narrow">
        <h1>Anything else?</h1>
        <label className="ta" htmlFor="c-stood">
          <span>What stood out to you, good or bad? (optional)</span>
          <textarea id="c-stood" rows={4} value={comments.stood} onChange={(e) => setComments((c) => ({ ...c, stood: e.target.value }))} />
        </label>
        <label className="ta" htmlFor="c-bothered">
          <span>Did anything confuse or slow you down? (optional)</span>
          <textarea id="c-bothered" rows={4} value={comments.bothered} onChange={(e) => setComments((c) => ({ ...c, bothered: e.target.value }))} />
        </label>
        <button id="submit" className="btn primary" type="button" onClick={submit}>Submit responses</button>
      </div>
    );
  } else if (step === 'done') {
    body = (
      <div className="card narrow">
        {save.state === 'saving' && <><h1>Saving…</h1><p>One moment.</p></>}
        {save.state === 'saved' && <><h1>Thank you</h1><p>Your responses are saved. You can close this page.</p></>}
        {save.state === 'manual' && (
          <>
            <h1>Thank you</h1>
            <p>This page couldn't save your responses automatically. Copy the code below and send it to the person who invited you. It contains only your answers.</p>
            <textarea id="code" ref={codeRef} className="code" readOnly rows={5} value={save.code} />
            <button id="copy" className="btn primary" type="button" onClick={async () => { const ok = await copyText(save.code, codeRef.current); setSave((s) => ({ ...s, copied: ok ? 'Copied' : 'Selected. Press Ctrl+C or ⌘C to copy.' })); }}>Copy code</button>
            {save.copied && <p className="fine" role="status">{save.copied}</p>}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="shell study">
      <header className="sbar">
        <p className="sbar-t" ref={top} tabIndex={-1}>Design study</p>
        <div className="prog" role="progressbar" aria-label="Study progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span style={{ width: progress + '%' }} />
        </div>
      </header>
      <main className="smain">{body}</main>
    </div>
  );
}

// ---------------------------------------------------------------- analysis
const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const pct = (v) => (v == null ? '—' : (v * 100).toFixed(0) + '%');
const num = (v, d = 1) => (v == null ? '—' : v.toFixed(d));
const secs = (ms) => (ms == null ? '—' : (ms / 1000).toFixed(1) + 's');

export function analyze(rs, checks) {
  const n = rs.length;
  const T = rs.flatMap((r) => r.tasks || []);
  const tf = T.filter((t) => t.design === 'frame');
  const tc = T.filter((t) => t.design === 'conv');
  const succ = (a) => (a.length ? a.filter((t) => t.correct).length / a.length : null);
  const sf = succ(tf);
  const sc = succ(tc);
  const mf = median(tf.map((t) => t.ms));
  const mc = median(tc.map((t) => t.ms));
  const distinct = n ? rs.filter((r) => r.compare && r.compare.distinct === 'frame').length / n : null;
  const prefer = n ? rs.filter((r) => r.compare && r.compare.prefer === 'frame').length / n : null;
  const designers = rs.filter((r) => r.role === 'designer');
  const coh = mean(designers.map((r) => r.ratings && r.ratings.frame && r.ratings.frame.coherent).filter(Boolean));
  const motionRs = rs.filter((r) => r.motion && !r.motion.skipped && r.motion.items);
  const motionByKind = MOTION_KINDS.map(([k, title]) => {
    const items = motionRs.map((r) => r.motion.items.find((x) => x.kind === k)).filter((x) => x && x.prefer);
    const m = items.length;
    const ok = m ? items.filter((x) => x.prefer === 'stepped' || x.prefer === 'none').length / m : null;
    const stepPref = m ? items.filter((x) => x.prefer === 'stepped').length / m : null;
    const broken = m ? items.filter((x) => x.broken && x.broken.stepped).length / m : null;
    return { k, title, m, ok, stepPref, broken, pass: m > 0 && ok >= 0.6 && broken <= 0.2 };
  });
  const st = (cond, have) => (!have ? 'pending' : cond ? 'pass' : 'fail');

  const rows = [
    { key: 'distinct', name: 'Visual distinctiveness', rule: '≥70% pick FRAME/12 as more distinctive', value: pct(distinct), status: st(distinct >= 0.7, n > 0) },
    { key: 'prefer', name: 'Overall visual preference', rule: '≥60% would rather use FRAME/12', value: pct(prefer), status: st(prefer >= 0.6, n > 0) },
    { key: 'success', name: 'Usability: task success', rule: 'FRAME/12 within 10 points of Conventional', value: `${pct(sf)} vs ${pct(sc)}`, status: st(sf >= sc - 0.1, tf.length > 0 && tc.length > 0) },
    { key: 'time', name: 'Interaction efficiency', rule: 'Median task time no more than 15% slower', value: `${secs(mf)} vs ${secs(mc)}`, status: st(mf <= mc * 1.15, mf != null && mc != null) },
    { key: 'coherent', name: 'Design consistency', rule: 'Designers rate FRAME/12 coherence ≥5.0 of 7 (needs 3+ designers)', value: designers.length ? `${num(coh)} (${designers.length} designer${designers.length === 1 ? '' : 's'})` : '—', status: designers.length >= 3 ? (coh >= 5 ? 'pass' : 'fail') : 'pending' },
    { key: 'mobile', name: 'Mobile responsiveness', rule: 'No critical layout or interaction defects (team check)', value: checks.mobile || 'unchecked', status: checks.mobile === 'pass' ? 'pass' : checks.mobile === 'fail' ? 'fail' : 'pending', team: true },
    { key: 'a11y', name: 'Accessibility', rule: 'No known critical failures (team check)', value: checks.a11y || 'unchecked', status: checks.a11y === 'pass' ? 'pass' : checks.a11y === 'fail' ? 'fail' : 'pending', team: true },
    { key: 'motion', name: 'Animation quality', rule: 'For at least one interaction, ≥60% prefer stepped or see no difference, and ≤20% call it broken', value: motionByKind.filter((x) => x.pass).map((x) => x.title).join(', ') || (motionRs.length ? 'None yet' : '—'), status: st(motionByKind.some((x) => x.pass), motionRs.length > 0) },
  ];

  const S = Object.fromEntries(rows.map((r) => [r.key, r.status]));
  let decision = 'Collecting';
  let why = 'Not enough responses yet to apply the decision rule.';
  if (n > 0) {
    if (S.distinct === 'fail') { decision = 'Stop or change direction'; why = 'FRAME/12 is not reliably seen as more distinctive. Run one focused design revision; if it still fails, change direction.'; }
    else if (S.distinct === 'pass' && S.prefer === 'pass' && S.success === 'pass' && S.time === 'pass' && S.a11y === 'pass' && S.mobile === 'pass') {
      decision = 'Proceed'; why = S.motion === 'fail' ? 'Distinctive, preferred and usable. Keep the visual language but drop stepped motion as the default.' : 'Distinctive, preferred and usable, with no critical accessibility or mobile defects.';
    } else if (S.distinct === 'pass') {
      decision = 'Revise';
      const failing = rows.filter((r) => r.status === 'fail').map((r) => r.name.toLowerCase());
      const pending = rows.filter((r) => r.status === 'pending').map((r) => r.name.toLowerCase());
      why = failing.length ? `Distinctive, but failing: ${failing.join(', ')}.` : `Distinctive so far. Still waiting on: ${pending.join(', ')}.`;
    }
  }
  const desire = { frame: mean(rs.map((r) => r.ratings && r.ratings.frame && r.ratings.frame.want).filter(Boolean)), conv: mean(rs.map((r) => r.ratings && r.ratings.conv && r.ratings.conv.want).filter(Boolean)) };
  const roles = Object.fromEntries(ROLES.map(([k]) => [k, rs.filter((r) => r.role === k).length]));
  return { n, rows, decision, why, desire, roles, motionByKind, provisional: n < 16 };
}

function toCSV(rs) {
  const head = ['rid', 'role', 'order', 'frame_set', 'distinct', 'prefer'];
  STATEMENTS.forEach(([k]) => head.push(`frame_${k}`, `conv_${k}`));
  ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'].forEach((q) => head.push(`${q}_design`, `${q}_correct`, `${q}_ms`));
  MOTION_KINDS.forEach(([k]) => head.push(`motion_${k}_prefer`, `motion_${k}_stepped_broken`));
  head.push('width', 'touch', 'reduced_motion', 'stood_out', 'bothered');
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [head.join(',')];
  for (const r of rs) {
    const row = [r.rid, r.role, (r.order || []).join('>'), r.setFor && r.setFor.frame, r.compare && r.compare.distinct, r.compare && r.compare.prefer];
    STATEMENTS.forEach(([k]) => row.push(r.ratings && r.ratings.frame && r.ratings.frame[k], r.ratings && r.ratings.conv && r.ratings.conv[k]));
    ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'].forEach((q) => { const t = (r.tasks || []).find((x) => x.q === q); row.push(t && t.design, t && (t.correct ? 1 : 0), t && t.ms); });
    MOTION_KINDS.forEach(([k]) => { const m = r.motion && r.motion.items && r.motion.items.find((x) => x.kind === k); row.push(m && m.prefer, m && m.broken && (m.broken.stepped ? 1 : 0)); });
    row.push(r.device && r.device.w, r.device && (r.device.touch ? 1 : 0), r.device && (r.device.reducedMotion ? 1 : 0), r.comments && r.comments.stood, r.comments && r.comments.bothered);
    lines.push(row.map(esc).join(','));
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------- results view
function Results() {
  const [store, setStore] = useState({ state: 'loading' });
  const [dbRows, setDbRows] = useState([]);
  const [local, setLocal] = useState([]);
  const [checks, setChecks] = useState({ mobile: '', a11y: '', notes: '' });
  const [importText, setImportText] = useState('');
  const [msg, setMsg] = useState('');
  const caps = useRef({ db: null, user: null });
  const csvRef = useRef(null);
  const [csv, setCsv] = useState('');

  useEffect(() => {
    let unsubs = [];
    let timer = setTimeout(() => setStore((s) => (s.state === 'loading' ? { state: 'slow' } : s)), 10000);
    getCaps().then(async (c) => {
      caps.current = c;
      if (!c.db) { clearTimeout(timer); setStore({ state: 'none' }); return; }
      const canEdit = c.user ? await c.user.canEdit() : null;
      unsubs.push(c.db.collection('responses').onSnapshot(
        (snap) => {
          if (!snap.metadata.fromCache) clearTimeout(timer);
          setDbRows(snap.docs.filter((d) => d.exists).map((d) => d.data()));
          setStore({ state: 'live', canEdit, fromCache: snap.metadata.fromCache });
        },
        () => { clearTimeout(timer); setStore({ state: 'error', canEdit }); },
      ));
      unsubs.push(c.db.doc('config/checks').onSnapshot(
        (d) => { if (d.exists) setChecks((x) => ({ ...x, ...d.data() })); },
        () => {},
      ));
    });
    return () => { clearTimeout(timer); unsubs.forEach((u) => u()); };
  }, []);

  const all = useMemo(() => {
    const seen = new Set();
    return [...dbRows, ...local].filter((r) => (seen.has(r.rid) ? false : (seen.add(r.rid), true)));
  }, [dbRows, local]);
  const A = useMemo(() => analyze(all, checks), [all, checks]);

  const saveChecks = async (patch) => {
    const nextC = { ...checks, ...patch };
    setChecks(nextC);
    const { db } = caps.current;
    if (db && store.canEdit) {
      try { await db.doc('config/checks').set(nextC); } catch (e) { setMsg('Team check saved on this page only; you need edit access to store it.'); }
    }
  };

  const doImport = async () => {
    const { out, errors } = decodeAll(importText);
    const { db } = caps.current;
    let stored = 0;
    if (db && store.canEdit) {
      for (const o of out) {
        try { await db.doc('responses/import-' + o.rid.replace(/[^A-Za-z0-9_-]/g, '')).set({ ...o, savedVia: 'import' }); stored++; } catch (e) { /* keep locally */ }
      }
    }
    if (stored < out.length) setLocal((l) => [...l, ...out]);
    setImportText('');
    setMsg(`${out.length} response${out.length === 1 ? '' : 's'} imported${stored ? `, ${stored} saved to this page` : ' for this visit only'}${errors.length ? `. ${errors.length} code${errors.length === 1 ? '' : 's'} could not be read.` : '.'}`);
  };

  const decisionClass = { Proceed: 'ok', Revise: 'warn', 'Stop or change direction': 'bad', Collecting: 'muted' }[A.decision];

  return (
    <div className="shell results">
      <header className="sbar">
        <p className="sbar-t">Design study · Results</p>
        <a className="lnk" href="#">Back to the study</a>
      </header>
      <main className="smain wide">
        <section className="card">
          <p className="kicker">Phase 1 decision</p>
          <h1 className={`dec ${decisionClass}`}>{A.decision}</h1>
          <p>{A.why}</p>
          <p className="fine">
            {A.n} response{A.n === 1 ? '' : 's'}
            {A.n ? ` · ${ROLES.map(([k, t]) => `${A.roles[k]} ${k === 'dashboards' ? 'dashboard users' : k === 'designer' ? 'designers' : k === 'frontend' ? 'frontend devs' : 'other'}`).join(' · ')}` : ''}
            {A.provisional ? ' · Provisional until 16 responses' : ''}
          </p>
          {store.state === 'none' && <p className="fine">Stored responses aren't available in this view. Imported codes are analysed for this visit only.</p>}
          {store.state === 'slow' && <p className="fine">Stored responses can't be reached yet.</p>}
          {store.state === 'error' && <p className="fine">Stored responses couldn't be loaded. Imported codes still work.</p>}
          {store.state === 'live' && store.canEdit === false && <p className="fine">Only the owner and editors can see stored responses.</p>}
        </section>

        <section className="card">
          <h2>Acceptance criteria</h2>
          <div className="tbl-wrap">
            <table className="crit">
              <thead><tr><th scope="col">Criterion</th><th scope="col">Passing rule</th><th scope="col">Result</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {A.rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row">{r.name}</th>
                    <td>{r.rule}</td>
                    <td className="num">
                      {r.team ? (
                        <select id={`chk-${r.key}`} aria-label={`${r.name} team check`} value={checks[r.key] || ''} onChange={(e) => saveChecks({ [r.key]: e.target.value })}>
                          <option value="">Unchecked</option>
                          <option value="pass">Pass</option>
                          <option value="fail">Fail</option>
                        </select>
                      ) : r.value}
                    </td>
                    <td><span className={`pill ${r.status}`}>{r.status === 'pass' ? 'Pass' : r.status === 'fail' ? 'Fail' : 'Pending'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fine">Reported without a threshold: "I'd want this style" averages {num(A.desire.frame)} for FRAME/12 and {num(A.desire.conv)} for Conventional (1–7).</p>
        </section>

        <section className="card">
          <h2>Motion detail</h2>
          <div className="tbl-wrap">
            <table className="crit">
              <thead><tr><th scope="col">Interaction</th><th scope="col">Answers</th><th scope="col">Prefer stepped</th><th scope="col">Stepped or no difference</th><th scope="col">Stepped felt broken</th></tr></thead>
              <tbody>
                {A.motionByKind.map((m) => (
                  <tr key={m.k}><th scope="row">{m.title}</th><td className="num">{m.m}</td><td className="num">{pct(m.stepPref)}</td><td className="num">{pct(m.ok)}</td><td className="num">{pct(m.broken)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2>Comments</h2>
          {all.filter((r) => r.comments && (r.comments.stood || r.comments.bothered)).length === 0 ? (
            <p className="fine">No written comments yet.</p>
          ) : (
            <ul className="cmts">
              {all.filter((r) => r.comments && (r.comments.stood || r.comments.bothered)).map((r) => (
                <li key={r.rid}>
                  <p className="fine">{(ROLES.find(([k]) => k === r.role) || [, 'Unknown'])[1]}</p>
                  {r.comments.stood && <p><strong>Stood out:</strong> {r.comments.stood}</p>}
                  {r.comments.bothered && <p><strong>Slowed down:</strong> {r.comments.bothered}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Add responses from codes</h2>
          <p className="fine">Participants who couldn't save automatically get a code starting with F12R. Paste one or more codes, separated by spaces or new lines.</p>
          <label className="ta" htmlFor="imp"><span>Result codes</span>
            <textarea id="imp" rows={4} value={importText} onChange={(e) => setImportText(e.target.value)} />
          </label>
          <div className="btn-row">
            <button id="imp-go" className="btn primary" type="button" disabled={!importText.trim()} onClick={doImport}>Import</button>
            <button id="csv" className="btn" type="button" disabled={!all.length} onClick={async () => { const c = toCSV(all); setCsv(c); const ok = await copyText(c, csvRef.current); setMsg(ok ? 'CSV copied.' : 'CSV shown below. Select it and copy.'); }}>Copy all as CSV</button>
          </div>
          {msg && <p className="fine" role="status">{msg}</p>}
          {csv && <textarea ref={csvRef} className="code" readOnly rows={5} value={csv} aria-label="CSV export" />}
        </section>
      </main>
    </div>
  );
}

function App() {
  const [view, setView] = useState(location.hash === '#results' ? 'results' : 'study');
  useEffect(() => {
    const on = () => setView(location.hash === '#results' ? 'results' : 'study');
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return view === 'results' ? <Results /> : <Study />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
