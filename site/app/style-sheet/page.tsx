'use client';

import * as React from 'react';
import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Metric,
  Delta,
  ToneAreaChart,
  ToneBarList,
  ToneSpark,
  Tag,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/frame12';
import {
  SUMMARIES,
  STORE,
  END_LABEL,
  RANGES,
  fmtMoney,
  fmtMoneyShort,
  fmtPP,
  type RangeDays,
} from '@/lib/data';
import { useSiteSettings } from '@/components/site-shell';
import { GrammarDiagram, FilmStripDiagram } from '@/components/diagrams';

const RANGE_OPTIONS = RANGES.map((r) => ({
  value: r,
  label: String(r),
  unit: 'days',
}));

const PALETTE: Array<{
  name: string;
  token: string;
  lightHex: string;
  darkHex: string;
  role: string;
}> = [
  { name: 'Paper', token: '--f-panel', lightHex: 'FFFFFF', darkHex: '19191A', role: 'Panels and sheet' },
  { name: 'Ink', token: '--f-ink', lightHex: '121212', darkHex: 'F1F0EA', role: 'Frames, text, screentone' },
  { name: 'Ink 2', token: '--f-ink-2', lightHex: '4B4B4B', darkHex: 'B9B8B1', role: 'Labels and secondary text' },
  { name: 'Gutter', token: '--f-sheet', lightHex: 'FFFFFF', darkHex: '050505', role: 'Space between panels' },
  { name: 'Grid', token: '--f-grid', lightHex: 'E3E3E3', darkHex: '2C2C2D', role: 'Chart rules, row dividers' },
  {
    name: 'Marker',
    token: '--f-marker',
    lightHex: 'FFD60A',
    darkHex: 'FFD60A',
    role: 'The one accent, always under ink text',
  },
  { name: 'Desk', token: '--f-desk', lightHex: 'E2E3E5', darkHex: '000000', role: 'Outside the sheet' },
];

export default function StyleSheetPage() {
  const { theme, motion } = useSiteSettings();
  const [range, setRange] = React.useState<RangeDays>(30);
  const s7 = SUMMARIES[7];
  const s30 = SUMMARIES[30];
  const s90 = SUMMARIES[90];

  return (
    <Sheet pegs motion={motion} theme={theme}>
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            Style sheet · Phase 1 Specimen
            <Tag>Example data</Tag>
          </p>
          <h1 className="f12-title">FRAME/12 Style Sheet</h1>
          <p className="f12-muted-copy">
            An interface language taken from page composition and cel-animation production:
            ink-framed panels, gutters whose width means something, screentone instead of gradients,
            and motion held on twos.
          </p>
        </div>
      </header>

      <Scene gutter="scene" layout="stack">
        <Panel cut="C-01" label="The sheet in light mode">
          <div className="f12-stack-scene">
            <div className="f12-row-between">
              <div className="f12-stack-pair">
                <div className="f12-row-pair">
                  <Tag>The Sheet · 30 Days</Tag>
                  <span className="f12-mono-note">{STORE} · Through {END_LABEL}</span>
                </div>
                <h2 className="f12-section-title">The sheet</h2>
              </div>
            </div>

            <div className="f12-preview-frame f12-theme-light f12-m-cut">
              <div className="f12-preview-sheet">
                <Scene gutter="scene" layout="split">
                  <Panel label="Specimen primary revenue chart">
                    <Metric
                      label="Recovered revenue"
                      value={s30.revenue}
                      format={fmtMoney}
                      delta={s30.revenueDelta}
                      deltaKind="pct"
                      range={30}
                      motion="cut"
                      big
                    />
                    <ToneAreaChart
                      data={s30.days.map((d) => ({
                        label: d.label,
                        longLabel: d.long,
                        value: d.total,
                      }))}
                      seriesLabel="Recovered revenue"
                      labelColumnHeader="Date"
                      formatValue={fmtMoney}
                      formatShort={fmtMoneyShort}
                      motion="cut"
                      height={240}
                      tableSummary="Show 30-day specimen data table"
                    />
                  </Panel>
                  <PanelPair
                    top={{
                      label: 'Specimen incremental profit',
                      children: (
                        <Metric
                          label="Incremental profit"
                          value={s30.profit}
                          format={fmtMoney}
                          delta={s30.profitDelta}
                          deltaKind="pct"
                          range={30}
                          note="Margin on recovered orders, after offer costs"
                          motion="cut"
                          spark={
                            <ToneSpark
                              values={s30.days.map((d) => d.profit)}
                              label="Daily profit"
                              rangeKey={30}
                              motion="cut"
                            />
                          }
                        />
                      ),
                    }}
                    bottom={{
                      label: 'Specimen conversion lift',
                      children: (
                        <Metric
                          label="Conversion lift"
                          value={s30.lift}
                          format={fmtPP}
                          delta={s30.liftDelta}
                          deltaKind="pp"
                          range={30}
                          note="Checkout conversion vs. holdout group"
                          motion="cut"
                          spark={
                            <ToneSpark
                              values={s30.days.map((d) => d.lift)}
                              label="Daily lift"
                              rangeKey={30}
                              motion="cut"
                            />
                          }
                        />
                      ),
                    }}
                  />
                </Scene>
              </div>
            </div>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel cut="C-02" label="Dark theme flashback variant">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>Dark · 7 Days</Tag>
              <span className="f12-mono-note">Exit-intent offer selected</span>
            </div>
            <h2 className="f12-section-title">Dark: flashback gutters</h2>
            <p className="f12-muted-copy">
              Gutters turn black, the print convention for flashback pages. Shown on 7 days with one
              intervention selected.
            </p>
            <div className="f12-preview-frame f12-theme-dark f12-m-cut">
              <div className="f12-preview-sheet">
                <Metric
                  label="Recovered revenue (7 days)"
                  value={s7.revenue}
                  format={fmtMoney}
                  delta={s7.revenueDelta}
                  deltaKind="pct"
                  range={7}
                  motion="cut"
                />
                <ToneAreaChart
                  data={s7.days.map((d) => ({
                    label: d.label,
                    longLabel: d.long,
                    value: d.total,
                    compareValue: d.byId.exit,
                  }))}
                  seriesLabel="Recovered revenue"
                  labelColumnHeader="Date"
                  compareLabel="Exit-intent offer"
                  formatValue={fmtMoney}
                  formatShort={fmtMoneyShort}
                  motion="cut"
                  height={190}
                  tableSummary="Show 7-day dark specimen data table"
                />
              </div>
            </div>
          </div>
        </Panel>

        <Panel cut="C-03" label="Phone 390px stack variant">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>Phone · 390px</Tag>
              <span className="f12-mono-note">90-day stack</span>
            </div>
            <h2 className="f12-section-title">Phone: single-column reading order</h2>
            <p className="f12-muted-copy">
              Panels stack in reading order below 760px; the gutters keep their meaning.
            </p>
            <div className="sp-phone-box f12-theme-light f12-m-cut">
              <div className="f12-preview-sheet">
                <Metric
                  label="Recovered revenue (90 days)"
                  value={s90.revenue}
                  format={fmtMoney}
                  delta={s90.revenueDelta}
                  deltaKind="pct"
                  range={90}
                  motion="cut"
                />
                <ToneBarList
                  title="Revenue by intervention"
                  subtitle="Last 90 days · stacked mobile layout"
                  items={s90.rows.slice(0, 3).map((r, i) => ({
                    id: r.id,
                    name: r.name,
                    value: r.value,
                    formattedValue: fmtMoney(r.value),
                    share: r.share,
                    badge: i === 0 ? 'Top performer' : undefined,
                  }))}
                  motion="cut"
                  idPrefix="sp-phone"
                />
              </div>
            </div>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel cut="C-04" label="Panel grammar diagram">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>Panel Grammar</Tag>
              <span className="f12-mono-note">
                20 px · same scene | 12 px · a pair | 32 px · scene change
              </span>
            </div>
            <h2 className="f12-section-title">Panel grammar</h2>
            <p className="f12-body-copy">
              Gutter width tells the reader how panels relate before any label is read. Panel size
              tells them what matters most.
            </p>
            <GrammarDiagram />
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel cut="C-05" label="Six construction details">
          <div className="f12-stack-scene">
            <div className="f12-stack-pair">
              <div className="f12-row-pair">
                <Tag>Construction Details</Tag>
                <span className="f12-mono-note">6 foundational vocabulary primitives</span>
              </div>
              <h2 className="f12-section-title">Construction details</h2>
            </div>

            <Scene gutter="scene" layout="three">
              <div className="f12-stack-pair">
                <div className="f12-preview-frame f12-theme-light f12-m-cut">
                  <Panel label="Cut number example">
                    <p className="f12-body-copy">Panel content framed with 2.5px mitered ink.</p>
                  </Panel>
                </div>
                <h3 className="f12-section-title">1. Cut numbers</h3>
                <p className="f12-muted-copy">
                  Set into the frame line, numbered in reading order. Visual order, reading order,
                  and code order always match.
                </p>
              </div>

              <div className="f12-stack-pair">
                <div className="f12-preview-frame f12-theme-light f12-m-cut">
                  <PanelPair
                    top={{ label: 'Paired profit', children: <p className="f12-body-copy">Profit</p> }}
                    bottom={{
                      label: 'Paired conversion lift',
                      children: <p className="f12-body-copy">Conversion lift</p>,
                    }}
                  />
                </div>
                <h3 className="f12-section-title">2. Diagonal pair</h3>
                <p className="f12-muted-copy">
                  Two related metrics share one slanted 12 px gutter, the visual cue for &ldquo;these
                  belong together&rdquo;.
                </p>
              </div>

              <div className="f12-stack-pair">
                <div className="f12-preview-frame f12-theme-light f12-m-cut">
                  <div className="sp-tones" aria-hidden="true">
                    <span className="tone t1" />
                    <span className="tone t2" />
                    <span className="tone t3" />
                  </div>
                </div>
                <h3 className="f12-section-title">3. Screentone</h3>
                <p className="f12-muted-copy">
                  Halftone dots replace gradients and transparency. Density carries emphasis; it
                  prints and survives grayscale.
                </p>
              </div>
            </Scene>

            <Scene gutter="scene" layout="three">
              <div className="f12-stack-pair">
                <div className="f12-preview-frame f12-theme-light f12-m-cut">
                  <ToneAreaChart
                    data={s7.days.map((d) => ({
                      label: d.label,
                      longLabel: d.long,
                      value: d.total,
                    }))}
                    seriesLabel="Recovered revenue"
                    labelColumnHeader="Date"
                    formatValue={fmtMoney}
                    formatShort={fmtMoneyShort}
                    motion="cut"
                    height={165}
                    tableSummary="Show construction detail chart data table"
                  />
                </div>
                <h3 className="f12-section-title">4. Speech balloon</h3>
                <p className="f12-muted-copy">
                  Annotations are balloons with a tail to the point they describe, not floating
                  tooltips.
                </p>
              </div>

              <div className="f12-stack-pair">
                <div className="f12-preview-frame f12-theme-light f12-m-cut">
                  <div className="f12-preview-sheet">
                    <div className="f12-stack-pair">
                      <div>
                        <Tag>Example data</Tag>
                      </div>
                      <Delta value={0.114} kind="pct" range={30} />
                      <div>
                        <Badge burst={false}>Top performer</Badge>
                      </div>
                    </div>
                  </div>
                </div>
                <h3 className="f12-section-title">5. Marker</h3>
                <p className="f12-muted-copy">
                  One flat yellow, always under ink text. It flags; it never colors a line or a
                  chart.
                </p>
              </div>

              <div className="f12-stack-pair">
                <div className="f12-preview-frame f12-theme-light f12-m-stepped">
                  <div className="f12-preview-sheet">
                    <SegmentedControl
                      idPrefix="sp-detail-rng"
                      ariaLabel="Specimen range control"
                      options={RANGE_OPTIONS}
                      value={range}
                      onChange={setRange}
                    />
                  </div>
                </div>
                <h3 className="f12-section-title">6. Range control</h3>
                <p className="f12-muted-copy">
                  Cells like an exposure sheet. The marker inverts what it covers, so labels stay
                  legible at every pose. Try it.
                </p>
              </div>
            </Scene>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel cut="C-06" label="Motion on twos specimen">
          <div className="f12-stack-scene">
            <div className="f12-stack-pair">
              <div className="f12-row-pair">
                <Tag>Motion on Twos</Tag>
                <span className="f12-mono-note">12 poses/second · 83.33ms per drawing</span>
              </div>
              <h2 className="f12-section-title">Motion on twos</h2>
              <p className="f12-body-copy">
                Discrete changes hold each pose for two frames at 24 fps: 12 poses a second, 83 ms
                each. Hover, scrolling, and typing stay immediate.
              </p>
            </div>

            <FilmStripDiagram idPrefix="sp-film" />

            <Table>
              <TableCaption>Motion grammar summary</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Grammar</TableHead>
                  <TableHead scope="col">Timing</TableHead>
                  <TableHead scope="col">Used for</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <strong>Stepped</strong>
                  </TableCell>
                  <TableCell>3–4 held poses, 250–333 ms</TableCell>
                  <TableCell>
                    Range switch, list reveal, chart redraw, badge pop with a two-frame impact burst
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Cut</strong>
                  </TableCell>
                  <TableCell>Instant</TableCell>
                  <TableCell>Reduced-motion settings; editorial scene changes</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Smooth</strong>
                  </TableCell>
                  <TableCell>Continuous easing</TableCell>
                  <TableCell>Only where the hand is moving: hover, crosshair, scrolling</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="split">
        <Panel cut="C-07" label="Typography specimen">
          <div className="f12-stack-scene">
            <div className="f12-row-pair">
              <Tag>Type Specimen</Tag>
              <span className="f12-mono-note">Self-hosted via next/font/google</span>
            </div>
            <h2 className="f12-section-title">Type</h2>
            <div className="sp-type">
              <div className="sp-type-item">
                <p className="ty-d">$120,054</p>
                <p className="ty-n">--font-f-display · display numbers and titles, used sparingly</p>
              </div>
              <div className="sp-type-item">
                <p className="ty-b">
                  Abandoned-cart email recovered the most revenue this month.
                </p>
                <p className="ty-n">--font-f-body · body copy and intervention names</p>
              </div>
              <div className="sp-type-item">
                <p className="ty-m">INCREMENTAL PROFIT · CUT 02 · ▲ 8.7%</p>
                <p className="ty-n">--font-f-mono · labels, cut numbers, tabular values</p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel cut="C-08" label="Palette token table">
          <div className="f12-stack-pair">
            <div className="f12-row-pair">
              <Tag>Palette Tokens</Tag>
              <span className="f12-mono-note">styles/frame12.css</span>
            </div>
            <h2 className="f12-section-title">Palette</h2>
            <Table>
              <TableCaption>Surface, ink, rule, and marker tokens in Light and Dark themes</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Token</TableHead>
                  <TableHead scope="col">Light</TableHead>
                  <TableHead scope="col">Dark</TableHead>
                  <TableHead scope="col">Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PALETTE.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell>
                      <div className="f12-comp-cell">
                        <strong>{item.name}</strong>
                        <code className="f12-code-inline f12-nowrap">{item.token}</code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className="sw-chip f12-theme-light"
                        style={
                          item.token === '--f-marker'
                            ? {
                                backgroundColor: 'var(--f-marker)',
                                color: 'var(--f-marker-ink)',
                              }
                            : { backgroundColor: `var(${item.token})` }
                        }
                        aria-hidden="true"
                      />
                      {`#${item.lightHex}`}
                    </TableCell>
                    <TableCell>
                      <span
                        className="sw-chip f12-theme-dark"
                        style={
                          item.token === '--f-marker'
                            ? {
                                backgroundColor: 'var(--f-marker)',
                                color: 'var(--f-marker-ink)',
                              }
                            : { backgroundColor: `var(${item.token})` }
                        }
                        aria-hidden="true"
                      />
                      {`#${item.darkHex}`}
                    </TableCell>
                    <TableCell>{item.role}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </Scene>
    </Sheet>
  );
}
