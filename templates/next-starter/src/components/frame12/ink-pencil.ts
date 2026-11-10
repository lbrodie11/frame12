// Deterministic pencil wobble for FRAME/12 line art (InkStroke weight="pencil").
// Pure: no React, no hooks, no 'use client', so server components and build scripts can call it.
// The wobble is a pure function of the geometry and a fixed seed: identical on the server, the
// client and in every screenshot. No Math.random.

/** mulberry32: a small, fast, seeded PRNG. Same seed → same sequence on server, client and CI. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over the rounded geometry, so the wobble is a pure function of geometry + seed. */
function hashGeometry(values: readonly number[]): number {
  let h = 0x811c9dc5;
  for (const v of values) {
    const s = String(Math.round(v * 100));
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= 0x2c;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const r2 = (n: number): string => String(Math.round(n * 100) / 100);

/** A straight segment `[x1, y1, x2, y2]` in user units. */
export type InkSegment = readonly [number, number, number, number];

/**
 * Pencil construction lines: each segment becomes one slightly bowed, slightly overshot stroke.
 * Segments that chain (one ends where the next starts) join into one continuous subpath with no
 * overshoot at the joint. Use chains for line art that draws over poses: SVG restarts the dash
 * pattern on every subpath, so separate subpaths of one path all draw at the same time.
 * The wobble is a pure function of the geometry and `seed` (no `Math.random`), so server, client
 * and every screenshot produce the identical `d` string.
 */
export function inkPencil(segments: readonly InkSegment[], seed = 12, wobble = 0.8): string {
  const rnd = mulberry32(hashGeometry(segments.flat()) ^ Math.imul(seed | 0, 0x9e3779b1));
  const j = () => (rnd() * 2 - 1) * wobble;
  const joins = (a: InkSegment | undefined, b: InkSegment | undefined): boolean =>
    Boolean(a && b && Math.abs(a[2] - b[0]) < 1e-6 && Math.abs(a[3] - b[1]) < 1e-6);
  let out = '';
  segments.forEach(([x1, y1, x2, y2], i) => {
    const fromPrev = joins(segments[i - 1], segments[i]);
    const toNext = joins(segments[i], segments[i + 1]);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    // Free ends overshoot a little and drift sideways; joints stay exact. The middle bows.
    const o1 = fromPrev ? 0 : 1 + rnd() * 2;
    const o2 = toNext ? 0 : 1 + rnd() * 2;
    const bow = j();
    const d1 = fromPrev ? 0 : j() * 0.5;
    const d2 = toNext ? 0 : j() * 0.5;
    const sx = x1 - ux * o1 - uy * d1;
    const sy = y1 - uy * o1 + ux * d1;
    const ex = x2 + ux * o2 - uy * d2;
    const ey = y2 + uy * o2 + ux * d2;
    const cx = (x1 + x2) / 2 - uy * bow;
    const cy = (y1 + y2) / 2 + ux * bow;
    out += `${fromPrev ? '' : `M${r2(sx)} ${r2(sy)}`}Q${r2(cx)} ${r2(cy)} ${r2(ex)} ${r2(ey)}`;
  });
  return out;
}
