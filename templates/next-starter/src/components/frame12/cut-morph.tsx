'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import { useResolvedMotion } from '@/hooks/use-tempo';

/**
 * CutMorph: state changes as film edits, on the platform's View Transitions.
 *
 * - `match`: a match cut. The named subject keeps its identity from one shot to the next: its
 *   geometry moves on twos (or smooth at 60), its old and new images hard-swap at the geometric
 *   midpoint, never crossfade.
 * - `cut`: the shot changes instantly. No View Transition at all.
 *
 * Opt-in only. Calling `useCutMorph` is the opt-in; nothing in FRAME/12 animates through it by
 * default. The grammar lives in `frame12.css` (`f12-match`, `f12-cut`, `f12-vt-stepped`,
 * `f12-vt-smooth`), so React 19.3's `<ViewTransition>` can use it too (see `withCutMorphMode`).
 */
export type CutMorphKind = 'match' | 'cut';
/** The transition-scoped mode key: `stepped` (12, on twos) or `smooth` (60). */
export type CutMorphMode = 'stepped' | 'smooth';

export interface UseCutMorphOptions {
  /**
   * Run element-scoped transitions on this element where the engine supports
   * `Element.prototype.startViewTransition` (Chromium): the snapshots then scroll and clip with
   * it and the rest of the page is untouched. Elsewhere, a document transition with the root
   * excluded.
   */
  scope?: React.RefObject<HTMLElement | null>;
}

export interface CutMorphCallOptions {
  /** `match` (default) animates the named subjects; `cut` updates immediately. */
  kind?: CutMorphKind;
}

/**
 * Runs `update` (synchronous; it must not return a promise) exactly once, in call order. Resolves
 * once the edit is on screen; rejects only with what `update` threw.
 */
export type CutMorph = (update: () => void, opts?: CutMorphCallOptions) => Promise<void>;

export interface CutMorphNameProps {
  /** The `view-transition-name`: `^[a-z][a-z0-9-]{0,63}$`, from a stable data id (never an array index). */
  name: string;
  /** The `view-transition-class`: `f12-match` (default), `f12-cut`, or your own space-separated classes. */
  className?: 'f12-match' | string;
  /** One DOM host element, or a component that forwards `style` and `ref` to one. */
  children: React.ReactElement;
}

/** What the current engine supports (all false on the server). */
export interface CutMorphSupport {
  /** Same-document View Transitions with `view-transition-class`: CutMorph animates. */
  viewTransitions: boolean;
  /** `Element.prototype.startViewTransition`: `scope` runs element-scoped transitions. */
  elementScoped: boolean;
  /** `document.activeViewTransition`: transitions CutMorph does not own are detected and left alone. */
  activeViewTransition: boolean;
}

// Bundlers (Next.js, webpack, Vite) statically replace `process.env.NODE_ENV`. Declared locally so
// browser-only TypeScript consumers without @types/node still compile (as in panel.tsx).
declare const process: { env: { NODE_ENV?: string } };

// Development checks test `process.env.NODE_ENV` inline and unguarded, so a bundler's production
// define folds them away with their messages. Safe wherever React from npm runs: React's own
// entry point reads process.env.NODE_ENV unguarded too.

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

interface VtLike {
  ready: Promise<unknown>;
  finished: Promise<unknown>;
  updateCallbackDone: Promise<unknown>;
  skipTransition(): void;
}
type VtStarter = { startViewTransition?: (cb: () => void) => VtLike };

interface CutMorphRecord {
  gen: number;
  root: Element;
  scoped: boolean;
  update: () => void;
  updateRan: boolean;
  error: { value: unknown } | null;
  vt: VtLike | null;
  hook: object;
  detach: () => void;
}

interface CutMorphOwner {
  version: 1;
  gen: number;
  /** Owned transitions in flight, oldest first. */
  active: CutMorphRecord[];
  /** Which generation set the mode class on a transition root. */
  classes: WeakMap<Element, { gen: number; cls: string }>;
  /** Development only: live CutMorphName registrations by name. */
  names: Map<string, Array<{ stack: string }>>;
}

const OWNER_KEY = Symbol.for('frame12.cutmorph');
const MODE_CLASS: Record<CutMorphMode, string> = {
  stepped: 'f12-vt-stepped',
  smooth: 'f12-vt-smooth',
};
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** One owner per document, shared by every React root and every copied-in copy of this file. */
function getOwner(): CutMorphOwner {
  const g = globalThis as unknown as Record<symbol, CutMorphOwner | undefined>;
  let owner = g[OWNER_KEY];
  if (!owner) {
    owner = { version: 1, gen: 0, active: [], classes: new WeakMap(), names: new Map() };
    g[OWNER_KEY] = owner;
  }
  return owner;
}

function setModeClass(root: Element, cls: string, gen: number): void {
  const owner = getOwner();
  const prev = owner.classes.get(root);
  if (prev && prev.cls !== cls) root.classList.remove(prev.cls);
  root.classList.add(cls);
  owner.classes.set(root, { gen, cls });
}

/** Generation-guarded: a stale `finally` never strips a newer generation's class. */
function clearModeClass(root: Element, gen: number): void {
  const owner = getOwner();
  const cur = owner.classes.get(root);
  if (!cur || cur.gen !== gen) return;
  root.classList.remove(cur.cls);
  owner.classes.delete(root);
}

export function getCutMorphSupport(): CutMorphSupport {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { viewTransitions: false, elementScoped: false, activeViewTransition: false };
  }
  let classes = false;
  try {
    classes = typeof CSS !== 'undefined' && CSS.supports('view-transition-class', 'f12-match');
  } catch {
    classes = false;
  }
  const doc = document as unknown as VtStarter;
  return {
    viewTransitions: typeof doc.startViewTransition === 'function' && classes,
    elementScoped:
      typeof Element !== 'undefined' &&
      typeof (Element.prototype as unknown as VtStarter).startViewTransition === 'function',
    activeViewTransition: 'activeViewTransition' in document,
  };
}

function callUpdate(update: () => void): void {
  const result: unknown = update();
  if (
    process.env.NODE_ENV !== 'production' &&
    result != null &&
    typeof (result as { then?: unknown }).then === 'function'
  ) {
    console.warn(
      '[frame12] useCutMorph: `update` returned a promise. It must be synchronous: CutMorph snapshots the DOM right after it returns. Await your data first, then call the cut.',
    );
  }
}

/** Runs every owned update that has not run yet, oldest first, so call order is kept. */
function flushPending(owner: CutMorphOwner, sync: boolean): void {
  for (const rec of owner.active) {
    if (rec.updateRan) continue;
    rec.updateRan = true;
    try {
      if (sync) flushSync(() => callUpdate(rec.update));
      else callUpdate(rec.update);
    } catch (e) {
      rec.error = { value: e };
    }
  }
}

function skipOwned(owner: CutMorphOwner, keep: (rec: CutMorphRecord) => boolean): void {
  for (const rec of owner.active.slice()) {
    if (keep(rec)) continue;
    try {
      rec.vt?.skipTransition();
    } catch {
      /* already finished */
    }
  }
}

function finish(rec: CutMorphRecord): void {
  const owner = getOwner();
  const i = owner.active.indexOf(rec);
  if (i >= 0) owner.active.splice(i, 1);
  rec.detach();
  clearModeClass(rec.root, rec.gen);
}

function run(
  update: () => void,
  kind: CutMorphKind,
  mode: 'stepped' | 'smooth' | 'cut',
  scopeEl: HTMLElement | null,
  hook: object,
): Promise<void> {
  const owner = getOwner();
  const gen = ++owner.gen;

  const immediate = (): Promise<void> => {
    // Earlier edits first (exactly once, in order), then the latest edit supersedes them.
    flushPending(owner, false);
    skipOwned(owner, (rec) => rec.scoped && rec.root !== scopeEl);
    try {
      callUpdate(update);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  };

  const support = getCutMorphSupport();
  if (
    kind === 'cut' ||
    mode === 'cut' ||
    !support.viewTransitions ||
    document.visibilityState === 'hidden'
  ) {
    return immediate();
  }
  // Never cancel a transition CutMorph does not own (React's <ViewTransition>, a router, the app).
  const current = (document as unknown as { activeViewTransition?: VtLike | null })
    .activeViewTransition;
  if (current && !owner.active.some((rec) => rec.vt === current)) return immediate();

  const scoped = !!scopeEl && support.elementScoped && scopeEl.isConnected;
  const root: Element = scoped ? (scopeEl as Element) : document.documentElement;

  flushPending(owner, true);
  // A new document transition supersedes every owned one; a scoped one supersedes the document
  // transition and any on the same scope. Scoped transitions on other scopes keep running.
  skipOwned(owner, (rec) => scoped && rec.scoped && rec.root !== root);

  const rec: CutMorphRecord = {
    gen,
    root,
    scoped,
    update,
    updateRan: false,
    error: null,
    vt: null,
    hook,
    detach: () => {},
  };
  const listeners: Array<() => void> = [];
  rec.detach = () => {
    for (const off of listeners.splice(0)) off();
  };

  setModeClass(root, MODE_CLASS[mode], gen);
  owner.active.push(rec);

  const onUpdate = () => {
    if (rec.updateRan) return;
    rec.updateRan = true;
    try {
      flushSync(() => callUpdate(update));
    } catch (e) {
      rec.error = { value: e };
      throw e;
    }
  };

  let vt: VtLike;
  try {
    vt = scoped
      ? (root as unknown as Required<VtStarter>).startViewTransition(onUpdate)
      : (document as unknown as Required<VtStarter>).startViewTransition(onUpdate);
  } catch {
    finish(rec);
    if (rec.updateRan) return rec.error ? Promise.reject(rec.error.value) : Promise.resolve();
    rec.updateRan = true;
    return immediate();
  }
  rec.vt = vt;

  const skip = () => {
    try {
      vt.skipTransition();
    } catch {
      /* already finished */
    }
  };
  // Reduced motion turning on mid-transition: skip now (the CSS also stops it).
  if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = () => {
      if (mq.matches) skip();
    };
    mq.addEventListener?.('change', onChange);
    listeners.push(() => mq.removeEventListener?.('change', onChange));
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      finish(rec);
      if (rec.error) reject(rec.error.value);
      else resolve();
    };
    vt.updateCallbackDone.catch(() => {});
    vt.ready.then(
      () => {
        if (settled || scoped) return;
        // Document snapshots stay where they were captured: a scroll, resize or pointer drag
        // would detach them from the content, so the edit lands at once (the DOM is updated).
        const sx = window.scrollX;
        const sy = window.scrollY;
        const onScroll = (e: Event) => {
          const t = e.target;
          if (t === document || t === window || t === document.documentElement) {
            if (window.scrollX !== sx || window.scrollY !== sy) skip();
          } else skip();
        };
        const opts = { capture: true, passive: true } as const;
        window.addEventListener('scroll', onScroll, opts);
        window.addEventListener('resize', skip);
        window.addEventListener('pointerdown', skip, opts);
        listeners.push(() => {
          window.removeEventListener('scroll', onScroll, opts);
          window.removeEventListener('resize', skip);
          window.removeEventListener('pointerdown', skip, opts);
        });
      },
      () => {
        /* skipped (superseded, duplicate name, hidden document): not an error */
      },
    );
    vt.finished.then(settle, settle);
  });
}

/**
 * Returns `cutMorph(update, { kind })`. Resolution is from THIS component's tempo context
 * (`useResolvedMotion('stepped')`), so a nested `TempoProvider value="still"` stays still:
 *
 * | Request | Effective mode                                       | Result                             |
 * |---------|------------------------------------------------------|------------------------------------|
 * | `cut`   | any                                                  | `update()` now, no View Transition |
 * | `match` | `cut` (reduced motion, still, still ancestor)        | `update()` now                     |
 * | `match` | no API / no `view-transition-class` / SSR / hidden   | `update()` now                     |
 * | `match` | a transition CutMorph does not own is active         | `update()` now, never cancels it   |
 * | `match` | `stepped`                                            | View Transition, 3 poses on twos   |
 * | `match` | `smooth`                                             | View Transition, 260ms smooth      |
 *
 * Never wrap pointer drag, typing, focus movement, playback or continuous scrubbing.
 */
export function useCutMorph(opts?: UseCutMorphOptions): CutMorph {
  const mode = useResolvedMotion('stepped');
  const modeRef = React.useRef(mode);
  const scopeRef = React.useRef(opts?.scope);
  const [hook] = React.useState(() => ({}));
  useIsoLayoutEffect(() => {
    modeRef.current = mode;
    scopeRef.current = opts?.scope;
    // Tempo became still (or reduced motion turned on) here: this component's edits land now.
    if (mode === 'cut') {
      const owner = getOwner();
      skipOwned(owner, (rec) => rec.hook !== hook);
    }
  });
  return React.useCallback<CutMorph>(
    (update, callOpts) =>
      run(
        update,
        callOpts?.kind ?? 'match',
        modeRef.current,
        scopeRef.current?.current ?? null,
        hook,
      ),
    [hook],
  );
}

/**
 * For React 19.3 `<ViewTransition default="f12-match">` users: sets the CutMorph mode key on
 * `<html>` around `fn` (which calls `startTransition`) and removes it when the transition React
 * starts has finished (or after ~1s if none starts). Pass the mode from `useResolvedMotion`; when
 * it resolves to `cut`, update outside a Transition instead.
 */
export function withCutMorphMode<T>(mode: 'stepped' | 'smooth', fn: () => T): T {
  if (typeof document === 'undefined' || !MODE_CLASS[mode]) return fn();
  const owner = getOwner();
  const gen = ++owner.gen;
  const root = document.documentElement;
  const before = (document as unknown as { activeViewTransition?: VtLike | null })
    .activeViewTransition;
  setModeClass(root, MODE_CLASS[mode], gen);
  let result: T;
  try {
    result = fn();
  } catch (e) {
    clearModeClass(root, gen);
    throw e;
  }
  let frames = 0;
  const raf =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb: () => void) => setTimeout(cb, 16);
  const tick = () => {
    if (owner.classes.get(root)?.gen !== gen) return;
    const vt = (document as unknown as { activeViewTransition?: VtLike | null })
      .activeViewTransition;
    if (vt && vt !== before) {
      const done = () => clearModeClass(root, gen);
      vt.finished.then(done, done);
      return;
    }
    if (++frames > 60) {
      clearModeClass(root, gen);
      return;
    }
    raf(tick);
  };
  raf(tick);
  return result;
}

// ------------------------------------------------------------------------------------- names

const NAME_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
// Not valid view-transition names: the property's own keywords, the root's UA name, the
// CSS-wide keywords and `default` (reserved for every <custom-ident>).
const RESERVED_NAMES = new Set([
  'none',
  'auto',
  'match-element',
  'root',
  'initial',
  'inherit',
  'unset',
  'revert',
  'revert-layer',
  'default',
]);

/** True for a name `CutMorphName` accepts. */
export function isCutMorphName(name: unknown): name is string {
  return typeof name === 'string' && NAME_PATTERN.test(name) && !RESERVED_NAMES.has(name);
}

function classList(value: string): string | null {
  const parts = value.trim().split(/\s+/);
  for (const p of parts) {
    if (!/^-?[a-z_][a-z0-9_-]*$/i.test(p) || p === 'none' || RESERVED_NAMES.has(p)) return null;
  }
  return parts.join(' ');
}

function captureStack(): string {
  const r = React as unknown as { captureOwnerStack?: () => string | null };
  try {
    const owner = typeof r.captureOwnerStack === 'function' ? r.captureOwnerStack() : null;
    if (owner) return owner;
  } catch {
    /* not available in this build */
  }
  return (new Error('CutMorphName').stack || '').split('\n').slice(2, 8).join('\n');
}

/**
 * Names one subject for match cuts: sets `view-transition-name` (and `view-transition-class`,
 * `f12-match` by default) on its single DOM host child, merging the child's own `style`,
 * `className`, `ref` and handlers. The name is removed on unmount. Invalid names and children
 * that cannot carry a style (Fragment, text, arrays) are a development error and render
 * unchanged in production.
 */
export function CutMorphName({
  name,
  className = 'f12-match',
  children,
}: CutMorphNameProps): React.ReactElement {
  const isHost =
    React.isValidElement(children) && (children as React.ReactElement).type !== React.Fragment;
  const validName = isCutMorphName(name);
  const vtClass = typeof className === 'string' ? classList(className) : null;
  const usable = isHost && validName && vtClass !== null;

  const stackRef = React.useRef('');
  if (process.env.NODE_ENV !== 'production' && !stackRef.current) stackRef.current = captureStack();
  const registered = usable ? name : null;
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !registered) return;
    const owner = getOwner();
    const list = owner.names.get(registered) ?? [];
    const entry = { stack: stackRef.current };
    if (list.length > 0) {
      console.warn(
        `[frame12] CutMorphName: "${registered}" is already on screen. view-transition-name must be unique among live elements; with a duplicate the browser skips the transition (the update still lands). Use a stable data id.\n--- first owner ---\n${list[0].stack}\n--- second owner ---\n${entry.stack}`,
      );
    }
    list.push(entry);
    owner.names.set(registered, list);
    return () => {
      const cur = owner.names.get(registered);
      if (!cur) return;
      const i = cur.indexOf(entry);
      if (i >= 0) cur.splice(i, 1);
      if (cur.length === 0) owner.names.delete(registered);
    };
  }, [registered]);

  if (!usable) {
    if (process.env.NODE_ENV !== 'production') {
      if (!isHost) {
        console.error(
          '[frame12] CutMorphName needs one DOM host element child (or a component that forwards `style` and `ref`), not a Fragment, text or an array.',
        );
      } else if (!validName) {
        console.error(
          `[frame12] CutMorphName: invalid name ${JSON.stringify(name)}. Use ^[a-z][a-z0-9-]{0,63}$ from a stable data id; none, auto, match-element, root, default and the CSS-wide keywords are reserved.`,
        );
      } else {
        console.error(
          `[frame12] CutMorphName: invalid className ${JSON.stringify(className)} (a view-transition-class list).`,
        );
      }
    }
    return isHost ? (children as React.ReactElement) : <>{children}</>;
  }
  const child = children as React.ReactElement<{ style?: React.CSSProperties }>;
  const style = {
    ...(child.props.style || {}),
    viewTransitionName: name,
    viewTransitionClass: vtClass,
  } as React.CSSProperties;
  return React.cloneElement(child, { style });
}
