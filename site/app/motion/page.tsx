'use client';

import * as React from 'react';
import {
  Sheet,
  Scene,
  Panel,
  SegmentedControl,
  Button,
  Metric,
  ToneAreaChart,
  ToneBarList,
  Tag,
  Badge,
  Table,
  TempoProvider,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/frame12';
import {
  useOnTwos,
  useChanged,
  type MotionMode,
} from '@/hooks/use-on-twos';
import { useResolvedMotion, useTempo } from '@/hooks/use-tempo';
import { REGISTRY_BASE_URL } from '@/lib/config';
import {
  SUMMARIES,
  RANGES,
  DEFAULT_RANGE,
  fmtMoney,
  fmtMoneyShort,
  type RangeDays,
} from '@/lib/data';
import { FilmStripDiagram } from '@/components/diagrams';
import { CopyCommand } from '@/components/copy-command';

type StageFocusMode = 'all' | 'tabs' | 'chart' | 'badge';

const STAGE_FOCUS_OPTIONS: Array<{ value: StageFocusMode; label: string; unit: string }> = [
  { value: 'all', label: 'Full', unit: 'scene' },
  { value: 'tabs', label: 'Tabs', unit: '+ kpi' },
  { value: 'chart', label: 'Chart', unit: 'wipe' },
  { value: 'badge', label: 'Badge', unit: 'burst' },
];

const RANGE_OPTIONS = RANGES.map((r) => ({
  value: r,
  label: String(r),
  unit: 'days',
}));

const COMPARE_MODE_OPTIONS: Array<{ value: MotionMode; label: string; unit: string }> = [
  { value: 'smooth', label: '60', unit: 'smooth' },
  { value: 'cut', label: '0', unit: 'cut' },
];

const POSES = [
  { frame: 'F1–2', ms: '0 ms', ratio: 'Pose 1 / 4' },
  { frame: 'F3–4', ms: '83 ms', ratio: 'Pose 2 / 4' },
  { frame: 'F5–6', ms: '167 ms', ratio: 'Pose 3 / 4' },
  { frame: 'F7–8', ms: '250 ms', ratio: 'Settled' },
];

/**
 * A comparison stage's scene. It sits inside `<TempoProvider value="auto">`, so it shows its
 * declared mode whatever the viewer's 12/60 choice; `still` and OS reduced motion still stop it.
 */
function StageScene({ base, children }: { base: MotionMode; children: React.ReactNode }) {
  const resolved = useResolvedMotion(base);
  return (
    <div className={`f12-stack-scene f12-m-${resolved}`} data-stage-motion={resolved}>
      {children}
    </div>
  );
}

/** Exposure-sheet readout driven by the stepped stage's own (resolved) progress. */
function PoseStrip({ tweenKey }: { tweenKey: string }) {
  const steppedProgress = useOnTwos(tweenKey, 333, 'stepped');
  const activePoseIndex =
    steppedProgress < 0.45 ? 0 : steppedProgress < 0.78 ? 1 : steppedProgress < 0.99 ? 2 : 3;
  return (
    <div className="pose-strip" role="status" aria-label="Exposure sheet pose readout">
      {POSES.map((pose, idx) => (
        <div key={pose.frame} className={`pose-cell${idx === activePoseIndex ? ' active' : ''}`}>
          <span className="pose-cell-frame">{pose.frame}</span>
          <span className="pose-cell-val">{pose.ms}</span>
          <span className="pose-cell-ms">{pose.ratio}</span>
        </div>
      ))}
    </div>
  );
}

export default function MotionPage() {
  const [range, setRange] = React.useState<RangeDays>(DEFAULT_RANGE);
  const [stageKind, setStageKind] = React.useState<StageFocusMode>('all');
  const [compareMotion, setCompareMotion] = React.useState<MotionMode>('smooth');
  const [playCount, setPlayCount] = React.useState(0);
  const timersRef = React.useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const changed = useChanged(`${range}-${playCount}`);
  // `still` (anywhere above) or OS reduced motion stops both stages: say so on the page.
  const { effectiveTempo } = useTempo();
  const motionOff = effectiveTempo === 'still';

  const triggerPlayComparison = () => {
    timersRef.current.forEach(clearTimeout);
    setPlayCount((n) => n + 1);
    const sequence: RangeDays[] = [7, 90, 30];
    timersRef.current = sequence.map((r, i) =>
      setTimeout(() => {
        setRange(r);
      }, 80 + i * 950),
    );
  };

  React.useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  const s = SUMMARIES[range];

  const chartData = React.useMemo(
    () =>
      s.days.map((d) => ({
        label: d.label,
        longLabel: d.long,
        value: d.total,
      })),
    [s.days],
  );

  const topThreeItems = React.useMemo(
    () =>
      s.rows.slice(0, 3).map((r, idx) => ({
        id: r.id,
        name: r.name,
        value: r.value,
        formattedValue: fmtMoney(r.value),
        share: r.share,
        badge: idx === 0 ? 'Top performer' : undefined,
      })),
    [s.rows],
  );

  return (
    <Sheet autoCut pegs motion="stepped">
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            Motion Grammar · Exposure Sheet Timing
            <Tag>12fps · 83.33ms poses</Tag>
          </p>
          <h1 className="f12-title">Motion on twos</h1>
          <p className="f12-muted-copy">
            In hand-drawn animation, most action is shot &ldquo;on twos&rdquo;—each drawing is held
            for two frames at 24fps (12 poses per second, 83.33ms per pose). FRAME/12 applies the
            same spacing chart to discrete UI state changes while keeping pointer tracking instant.
          </p>
        </div>

        <div className="f12-row-pair" role="group" aria-label="Synchronized stage controls">
          <SegmentedControl
            idPrefix="motion-kind"
            ariaLabel="Isolated interaction focus"
            options={STAGE_FOCUS_OPTIONS}
            value={stageKind}
            onChange={setStageKind}
          />
          <Button
            type="button"
            id="motion-play-btn"
            variant="marker"
            onClick={triggerPlayComparison}
          >
            Play comparison (7 → 90 → 30)
          </Button>
        </div>
        {motionOff && (
          <p className="f12-mono-note" id="motion-off-note" role="note">
            Motion is off (your setting). The timing values below still apply.
          </p>
        )}
      </header>

      <Scene gutter="scene" layout="equal">
        <Panel label="Stepped on twos (12fps)">
          <TempoProvider value="auto">
            <StageScene base="stepped">
              <div className="f12-row-between">
                <div className="f12-stack-pair">
                  <div className="f12-row-pair">
                    <Badge pop={changed} burst>
                      Stepped · 12fps
                    </Badge>
                    <span className="f12-mono-note">83.33ms per held pose · steps(3, end)</span>
                  </div>
                  <h2 className="f12-section-title">On twos (FRAME/12 default)</h2>
                </div>
                <SegmentedControl
                  idPrefix="stage-stepped-rng"
                  ariaLabel="Stepped stage date range"
                  options={RANGE_OPTIONS}
                  value={range}
                  onChange={setRange}
                />
              </div>

              <PoseStrip tweenKey={`${range}-${playCount}`} />

              {(stageKind === 'all' || stageKind === 'tabs') && (
                <Metric
                  label="Recovered revenue (stepped count-up)"
                  value={s.revenue}
                  format={fmtMoney}
                  delta={s.revenueDelta}
                  deltaKind="pct"
                  range={range}
                  motion="stepped"
                  big
                />
              )}

              {(stageKind === 'all' || stageKind === 'chart') && (
                <ToneAreaChart
                  data={chartData}
                  seriesLabel="Stepped revenue wipe"
                  labelColumnHeader="Date"
                  formatValue={fmtMoney}
                  formatShort={fmtMoneyShort}
                  motion="stepped"
                  height={200}
                  tableSummary="Show stepped stage data table"
                />
              )}

              {(stageKind === 'all' || stageKind === 'badge') && (
                <ToneBarList
                  title="Top interventions (two-frame impact burst)"
                  subtitle={`Last ${s.range} days · 4-pose popStep + 2-frame SVG burst`}
                  items={topThreeItems}
                  motion="stepped"
                  changed={changed}
                  idPrefix="stepped-stage"
                />
              )}
            </StageScene>
          </TempoProvider>
        </Panel>

        <Panel label="Comparison stage: Smooth (60fps) or Cut (0ms)">
          <TempoProvider value="auto">
            <StageScene base={compareMotion}>
              <div className="f12-row-between">
                <div className="f12-stack-pair">
                  <div className="f12-row-pair">
                    <Tag>
                      {compareMotion === 'smooth' ? 'Smooth · 60fps' : 'Cut · 0ms Instant'}
                    </Tag>
                    <SegmentedControl
                      idPrefix="stage-compare-mode"
                      ariaLabel="Comparison motion mode"
                      options={COMPARE_MODE_OPTIONS}
                      value={compareMotion}
                      onChange={setCompareMotion}
                    />
                  </div>
                  <h2 className="f12-section-title">
                    {compareMotion === 'smooth'
                      ? 'Continuous 60fps easing'
                      : 'Editorial hard cut (0ms)'}
                  </h2>
                </div>
                <SegmentedControl
                  idPrefix="stage-compare-rng"
                  ariaLabel="Comparison stage date range"
                  options={RANGE_OPTIONS}
                  value={range}
                  onChange={setRange}
                />
              </div>

              <div className="pose-strip" aria-label="Comparison timing readout">
                <div className="pose-cell">
                  <span className="pose-cell-frame">SAMPLING</span>
                  <span className="pose-cell-val">
                    {compareMotion === 'smooth' ? '16.7 ms' : '0 ms'}
                  </span>
                  <span className="pose-cell-ms">
                    {compareMotion === 'smooth' ? 'Continuous RAF' : 'Immediate state'}
                  </span>
                </div>
                <div className="pose-cell">
                  <span className="pose-cell-frame">INDICATOR</span>
                  <span className="pose-cell-val">
                    {compareMotion === 'smooth' ? 'cubic-bezier' : 'none'}
                  </span>
                  <span className="pose-cell-ms">
                    {compareMotion === 'smooth' ? '260ms glide' : 'Instant snap'}
                  </span>
                </div>
                <div className="pose-cell">
                  <span className="pose-cell-frame">CHART WIPE</span>
                  <span className="pose-cell-val">
                    {compareMotion === 'smooth' ? '45 frames' : '1 frame'}
                  </span>
                  <span className="pose-cell-ms">
                    {compareMotion === 'smooth' ? '750ms easeOut' : 'No wipe'}
                  </span>
                </div>
                <div className="pose-cell">
                  <span className="pose-cell-frame">REDUCED MOTION</span>
                  <span className="pose-cell-val">Auto Cut</span>
                  <span className="pose-cell-ms">OS preference</span>
                </div>
              </div>

              {(stageKind === 'all' || stageKind === 'tabs') && (
                <Metric
                  label={`Recovered revenue (${compareMotion} mode)`}
                  value={s.revenue}
                  format={fmtMoney}
                  delta={s.revenueDelta}
                  deltaKind="pct"
                  range={range}
                  motion={compareMotion}
                  big
                />
              )}

              {(stageKind === 'all' || stageKind === 'chart') && (
                <ToneAreaChart
                  data={chartData}
                  seriesLabel="Comparison revenue wipe"
                  labelColumnHeader="Date"
                  formatValue={fmtMoney}
                  formatShort={fmtMoneyShort}
                  motion={compareMotion}
                  height={200}
                  tableSummary="Show comparison stage data table"
                />
              )}

              {(stageKind === 'all' || stageKind === 'badge') && (
                <ToneBarList
                  title="Top interventions (comparison)"
                  subtitle={`Last ${s.range} days · ${compareMotion} transition`}
                  items={topThreeItems}
                  motion={compareMotion}
                  changed={changed}
                  idPrefix="compare-stage"
                />
              )}
            </StageScene>
          </TempoProvider>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel label="Exposure sheet film strip">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>Exposure Sheet</Tag>
              <span className="f12-mono-note">
                F1–2 (0ms) → F3–4 (83ms) → F5–6 (167ms) → F7–8 (250ms)
              </span>
            </div>
            <h2 className="f12-section-title">Four held drawings across 250 milliseconds</h2>
            <p className="f12-body-copy">
              When the range selector moves from 7 to 90 days, the active cell indicator steps
              through three intermediate poses held for 83.33ms each. Because the indicator uses
              <code className="f12-code-inline">mix-blend-mode: difference</code>, any numeral it
              crosses inverts cleanly at every held drawing without blurry sub-pixel anti-aliasing.
            </p>
            <FilmStripDiagram idPrefix="motion-film" />
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel label="Tempo precedence">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>Tempo</Tag>
              <span className="f12-mono-note">AUTO · 12 · 60 · 0 in the header, or press M</span>
            </div>
            <h2 className="f12-section-title">One motion preference for every animation</h2>
            <p className="f12-body-copy">
              The header&rsquo;s tempo applies to every FRAME/12 animation on the site. AUTO keeps
              each component&rsquo;s own motion; 12 holds poses on twos; 60 is smooth, continuous
              motion (it follows your display, so &ldquo;60&rdquo; names the style); 0 turns
              non-essential motion off. The two stages above always show their declared modes.
            </p>
            <Table>
              <TableCaption>
                How a component&rsquo;s motion is resolved, first matching rule wins.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Rule</TableHead>
                  <TableHead scope="col">When</TableHead>
                  <TableHead scope="col">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>1</TableCell>
                  <TableCell>Your system asks for reduced motion</TableCell>
                  <TableCell>Cut (no motion)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>2</TableCell>
                  <TableCell>Tempo 0, here or anywhere above</TableCell>
                  <TableCell>Cut (no motion)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>3</TableCell>
                  <TableCell>The component says cut (a prop, a quiet Metric)</TableCell>
                  <TableCell>Cut: tempo never turns motion on</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>4</TableCell>
                  <TableCell>Tempo 12 or 60</TableCell>
                  <TableCell>Stepped on twos, or smooth</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>5</TableCell>
                  <TableCell>Tempo AUTO</TableCell>
                  <TableCell>The component&rsquo;s own motion</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="f12-muted-copy">
              Never stepped at any tempo: pointer tracking, dragging, scrolling, typing and focus
              movement. Static HTML reports (@frame12/static) have no motion to set.
            </p>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="split">
        <Panel label="Motion grammar rules and timing table">
          <div className="f12-stack-pair">
            <h2 className="f12-section-title">Where each motion grammar belongs</h2>
            <p className="f12-muted-copy">
              Stepped motion is strictly for discrete state changes triggered by a decision. Never
              step pointer tracking, scrolling, or typing.
            </p>
            <Table>
              <TableCaption>
                FRAME/12 timing rules enforced across all registry components and hooks.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Grammar</TableHead>
                  <TableHead scope="col">Timing</TableHead>
                  <TableHead scope="col">Used for</TableHead>
                  <TableHead scope="col">Never used for</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <strong>Stepped (on twos)</strong>
                  </TableCell>
                  <TableCell>12fps · 83.33ms per pose (250–750ms)</TableCell>
                  <TableCell>
                    SegmentedControl cell jump, Metric count-up, ToneAreaChart clip wipe,
                    ToneBarList reveal, Badge impact burst
                  </TableCell>
                  <TableCell>Pointer hover, scroll, drag, crosshair, text input</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Immediate (hand)</strong>
                  </TableCell>
                  <TableCell>0ms latency (1:1 pointer)</TableCell>
                  <TableCell>
                    Button offset shadow on hover, chart pointer/keyboard crosshair, scrolling,
                    typing in fields
                  </TableCell>
                  <TableCell>Delayed or stepped cursor followers</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Cut (instant)</strong>
                  </TableCell>
                  <TableCell>0ms hard cut</TableCell>
                  <TableCell>
                    prefers-reduced-motion: reduce (automatic override), initial page render at
                    rest, modal open/close
                  </TableCell>
                  <TableCell>Unrequested entrance animations on first paint</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Panel>

        <Panel label="useOnTwos hook implementation">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>Hook API</Tag>
              <span className="f12-mono-note">@/hooks/use-on-twos</span>
            </div>
            <h2 className="f12-section-title">Sampling an easing curve on twos</h2>
            <p className="f12-body-copy">
              Instead of linear steps, <code className="f12-code-inline">useOnTwos</code> quantizes
              time into 83.33ms buckets and evaluates a cubic ease-out spacing chart at each held
              pose—giving fast initial spacing and a crisp settle.
            </p>
            <CopyCommand
              id="motion-copy-hook"
              label="Install motion hooks"
              command={`npx shadcn@latest add ${REGISTRY_BASE_URL}/use-on-twos.json`}
            />
            <div className="f12-cmd-box">
              <div className="f12-cmd-head">
                <span className="f12-cmd-label">hooks/use-on-twos.ts</span>
              </div>
              <pre
                className="f12-cmd-pre"
                tabIndex={0}
                role="region"
                aria-label="hooks/use-on-twos.ts code"
              >
                <code>{`export const FRAME_MS = 1000 / 12; // 83.33ms ("on twos")
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Inside requestAnimationFrame:
const k = Math.min(frames, Math.floor(elapsed / FRAME_MS) + 1);
const progress = easeOut(k / frames);`}</code>
              </pre>
            </div>
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}
