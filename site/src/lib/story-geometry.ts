// "How a frame gets made": the schematic sheet drawn on the home page. Nothing here is a picture:
// every coordinate comes from FRAME/12's own grammar (12 columns, the 12/20/32px gutter tokens,
// the 2.5px frame, the 16px PanelPair slant, cut labels in reading order) at a fixed scale, so the
// drawing documents the rules it shows. A test asserts the gutters below equal tokens × SCALE.
import { gutters } from '@frame12/tokens';
import { inkPencil, type InkSegment } from '@/components/frame12/ink-pencil';

/** Drawing units per CSS pixel of the real grammar. */
export const SCALE = 0.5;

const px = (v: string): number => parseFloat(v);

/** The three legal gutters, scaled: pair (12px), scene (20px), change (32px). */
export const GUTTER = {
  pair: px(gutters.pair) * SCALE,
  scene: px(gutters.scene) * SCALE,
  change: px(gutters.change) * SCALE,
} as const;

/** Real PanelPair slant (16px), scaled. */
const SLANT = 16 * SCALE;
const PAD = 12;
const COLUMNS = 12;
const COL = 15;
const ROW_A = 96;
const ROW_B = 56;

export const SHEET_W = PAD * 2 + COLUMNS * COL + (COLUMNS - 1) * GUTTER.scene;
export const SHEET_H = PAD * 2 + ROW_A + GUTTER.change + ROW_B;

/** Left edge of column `i` (0-based). */
const colX = (i: number): number => PAD + i * (COL + GUTTER.scene);
/** Width spanned by `n` columns and the scene gutters between them. */
const span = (n: number): number => n * COL + (n - 1) * GUTTER.scene;

type Pt = readonly [number, number];
export interface StoryPanel {
  /** Polygon points, clockwise from the top-left corner (reading order). */
  points: readonly Pt[];
  /** Where its cut label sits. */
  cut: Pt;
}

const rowAy = PAD;
const rowBy = PAD + ROW_A + GUTTER.change;
const pairX = colX(8);
const pairW = span(4);
const pairH = (ROW_A - GUTTER.pair) / 2;

const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** The six panels in reading order: a split scene (8 + 4 columns, the 4 a PanelPair), then three. */
export const PANELS: readonly StoryPanel[] = [
  { points: rect(colX(0), rowAy, span(8), ROW_A), cut: [colX(0) + 6, rowAy] },
  {
    // PanelPair top: slant-bottom (the bottom edge rises toward the right).
    points: [
      [pairX, rowAy],
      [pairX + pairW, rowAy],
      [pairX + pairW, rowAy + pairH - SLANT],
      [pairX, rowAy + pairH],
    ],
    cut: [pairX + 6, rowAy],
  },
  {
    // PanelPair bottom: slant-top, one pair gutter below the top panel's edge.
    points: [
      [pairX, rowAy + pairH + GUTTER.pair],
      [pairX + pairW, rowAy + pairH + GUTTER.pair - SLANT],
      [pairX + pairW, rowAy + ROW_A],
      [pairX, rowAy + ROW_A],
    ],
    cut: [pairX + 6, rowAy + pairH + GUTTER.pair - SLANT / 2],
  },
  { points: rect(colX(0), rowBy, span(4), ROW_B), cut: [colX(0) + 6, rowBy] },
  { points: rect(colX(4), rowBy, span(4), ROW_B), cut: [colX(4) + 6, rowBy] },
  { points: rect(colX(8), rowBy, span(4), ROW_B), cut: [colX(8) + 6, rowBy] },
];

const r = (n: number): number => Math.round(n * 100) / 100;
/** A closed path through `points` (paths only: basic shapes become `d` at author time). */
export const closedPath = (points: readonly Pt[]): string =>
  `M${points.map(([x, y]) => `${r(x)} ${r(y)}`).join('L')}Z`;

/** Measured gaps between neighbouring panels, for the geometry test. */
export const MEASURED_GUTTERS = {
  pair: PANELS[2].points[0][1] - PANELS[1].points[3][1],
  scene: PANELS[1].points[0][0] - PANELS[0].points[1][0],
  change: PANELS[3].points[0][1] - PANELS[0].points[3][1],
} as const;

// ------------------------------------------------------------------------------- beat 1: pencil
// Each guide set is ONE continuous pencil meander, so it draws over the beat's poses (SVG restarts
// the dash pattern on every subpath; separate subpaths would all appear in the same pose).
const TOP = 4;
const BOTTOM = SHEET_H - 4;
/** The 12 columns: down one edge, across, up the other edge, across the gutter, and so on. */
const columnGuides: InkSegment[] = [];
for (let i = 0; i < COLUMNS; i++) {
  const [a, b] = [colX(i), colX(i) + COL];
  columnGuides.push([a, TOP, a, BOTTOM], [a, BOTTOM, b, BOTTOM], [b, BOTTOM, b, TOP]);
  if (i < COLUMNS - 1) columnGuides.push([b, TOP, colX(i + 1), TOP]);
}
/** The scene rows: across, down the edge, back across, and so on. */
const rowYs = [rowAy, rowAy + ROW_A, rowBy, rowBy + ROW_B];
const rowGuides: InkSegment[] = [];
rowYs.forEach((y, i) => {
  const [x0, x1] = i % 2 === 0 ? [4, SHEET_W - 4] : [SHEET_W - 4, 4];
  rowGuides.push([x0, y, x1, y]);
  if (i < rowYs.length - 1) rowGuides.push([x1, y, x1, rowYs[i + 1]]);
});
export const PENCIL = {
  columns: inkPencil(columnGuides, 12, 0.6),
  rows: inkPencil(rowGuides, 20, 0.6),
} as const;

/** Gutter annotations pencilled beside the gaps they measure (labels in real px). */
export const GUTTER_NOTES: readonly { x: number; y: number; text: string }[] = [
  { x: pairX + pairW / 2, y: rowAy + pairH + GUTTER.pair / 2 + 1, text: gutters.pair },
  { x: pairX - GUTTER.scene / 2, y: rowAy + ROW_A / 2, text: gutters.scene },
  { x: colX(4) - GUTTER.scene / 2 + 40, y: rowAy + ROW_A + GUTTER.change / 2 + 2, text: gutters.change },
];

// --------------------------------------------------------------------------------- beat 2: ink
export const FRAMES: readonly string[] = PANELS.map((p) => closedPath(p.points));

// -------------------------------------------------------------------------------- beat 3: tone
const [bx, by] = PANELS[0].points[0];
const bw = span(8);
const series = [0.3, 0.42, 0.38, 0.55, 0.5, 0.68, 0.62, 0.8, 0.74];
const areaTop: Pt[] = series.map((v, i) => [
  bx + 8 + (i * (bw - 16)) / (series.length - 1),
  by + ROW_A - 8 - v * (ROW_A - 24),
]);
/** The area chart in C-01: tone fill and its inked top line. */
export const AREA = {
  fill: closedPath([...areaTop, [bx + bw - 8, by + ROW_A - 8], [bx + 8, by + ROW_A - 8]]),
  line: `M${areaTop.map(([x, y]) => `${r(x)} ${r(y)}`).join('L')}`,
} as const;
const bars = (x: number, y: number, w: number, h: number, values: number[]): string =>
  values
    .map((v, i) => {
      const bh = h / values.length - 3;
      return closedPath(rect(x, y + i * (bh + 3), w * v, bh));
    })
    .join('');
/** A bar list in C-02 and C-05. */
export const BARS: readonly string[] = [
  bars(pairX + 8, rowAy + 12, pairW - 16, pairH - SLANT - 16, [0.9, 0.6, 0.4]),
  bars(colX(4) + 8, rowBy + 14, span(4) - 16, ROW_B - 20, [0.8, 0.55, 0.3]),
];

// --------------------------------------------------------------------------------- beat 4: cut
const CUT_W = 28;
const CUT_H = 10;
export const CUTS: readonly { box: string; x: number; y: number; label: string }[] = PANELS.map(
  (p, i) => {
    const [x, y] = p.cut;
    return {
      box: closedPath(rect(x, y - CUT_H / 2, CUT_W, CUT_H)),
      x: x + CUT_W / 2,
      y: y + 2.6,
      label: `C-${String(i + 1).padStart(2, '0')}`,
    };
  },
);

/** Pose counts per beat: 4 × 12 = 48 poses = 4.0 s on twos. */
export const STORY_BEATS = [12, 12, 12, 12] as const;
