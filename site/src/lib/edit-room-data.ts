// Deterministic shot list for The Edit Room (/motion/edit-room). Pure data: also used by the
// registry's flash-safety, performance and accessibility fixtures, so they measure the real demos.

export type ShotStage = 'layout' | 'key' | 'ink' | 'color' | 'final';

export interface Shot {
  /** Stable data id: the CutMorph name is built from it, never from an array index. */
  id: string;
  /** Cut label, C-001…, in production order. */
  cut: string;
  scene: number;
  title: string;
  stage: ShotStage;
  /** Length in frames at 24 fps. */
  frames: number;
}

export const SHOT_STAGES: ReadonlyArray<{ value: ShotStage | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'layout', label: 'Layout' },
  { value: 'key', label: 'Key' },
  { value: 'ink', label: 'Ink' },
  { value: 'color', label: 'Color' },
  { value: 'final', label: 'Final' },
];

const STAGE_ORDER: readonly ShotStage[] = ['layout', 'key', 'ink', 'color', 'final'];
const SUBJECTS = ['Rooftop', 'Platform', 'Ferry', 'Archive', 'Signal', 'Kitchen', 'Tunnel', 'Market', 'Stairwell', 'Harbor', 'Studio', 'Bridge'];
const BEATS = ['wide', 'close-up', 'insert', 'reverse', 'two-shot', 'pan', 'tilt', 'hold'];

/** `count` shots, the same on every call (a small LCG, no Math.random). */
export function buildShots(count = 200): Shot[] {
  let seed = 12;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const scene = Math.floor(i / 8) + 1;
    return {
      id: `s${String(n).padStart(3, '0')}`,
      cut: `C-${String(n).padStart(3, '0')}`,
      scene,
      title: `${SUBJECTS[Math.floor(next() * SUBJECTS.length)]} ${BEATS[Math.floor(next() * BEATS.length)]}`,
      stage: STAGE_ORDER[Math.floor(next() * STAGE_ORDER.length)],
      frames: 12 + Math.floor(next() * 21) * 6,
    };
  });
}

export type ShotSort = 'cut' | 'length' | 'stage';

export const SHOT_SORTS: ReadonlyArray<{ value: ShotSort; label: string; unit: string }> = [
  { value: 'cut', label: 'Cut', unit: 'order' },
  { value: 'length', label: 'Length', unit: 'frames' },
  { value: 'stage', label: 'Stage', unit: 'pipeline' },
];

export function sortShots(shots: readonly Shot[], by: ShotSort): Shot[] {
  const out = [...shots];
  if (by === 'length') out.sort((a, b) => b.frames - a.frames || a.cut.localeCompare(b.cut));
  else if (by === 'stage') out.sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.cut.localeCompare(b.cut));
  else out.sort((a, b) => a.cut.localeCompare(b.cut));
  return out;
}

export function filterShots(shots: readonly Shot[], stage: ShotStage | 'all'): Shot[] {
  return stage === 'all' ? [...shots] : shots.filter((s) => s.stage === stage);
}

/** Spike answers for the per-engine table (docs/architecture/cut-morph-spike.json, 2026-11-11). */
export const ENGINE_SUPPORT: ReadonlyArray<{
  engine: string;
  version: string;
  animates: string;
  scoped: string;
  scroll: string;
  clip: string;
}> = [
  { engine: 'Chromium', version: '153', animates: 'Yes: 3 poses, hard swap', scoped: 'Exists, not used: 153 aborts when a subject exits (156 does not)', scroll: 'Snapshot drifts: skipped', clip: 'Not clipped (nested groups can)' },
  { engine: 'Firefox', version: '157', animates: 'Yes: 3 poses, hard swap', scoped: 'No', scroll: 'Snapshot fixed: skipped', clip: 'Not clipped' },
  { engine: 'WebKit (Safari)', version: '27.2', animates: 'Yes: 3 poses, hard swap', scoped: 'No', scroll: 'Snapshot drifts: skipped', clip: 'Not clipped' },
];
