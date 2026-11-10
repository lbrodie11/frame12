'use client';

import * as React from 'react';
import {
  TempoContext,
  normalizeTempo,
  isTempo,
  useReducedMotion,
  type Tempo,
  type TempoContextValue,
} from '@/hooks/use-tempo';

export interface TempoProviderProps {
  /** Controlled tempo. Pair with `onChange`. Wins over `defaultValue` (with a development warning). */
  value?: Tempo;
  /** Called with the new tempo whenever a TempoControl (or `setTempo`) inside changes it. */
  onChange?: (tempo: Tempo) => void;
  /** Uncontrolled starting tempo. Server render and first client render use it (or `auto`). */
  defaultValue?: Tempo;
  /** Uncontrolled only: persists the tempo in `localStorage` under this key and syncs across tabs. */
  storageKey?: string;
  /** Puts the `data-f12-tempo` attribute and motion class on the single child element instead of a wrapper. */
  asChild?: boolean;
  children?: React.ReactNode;
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

// Bundlers (Next.js, webpack, Vite) statically replace `process.env.NODE_ENV`. Declared locally so
// browser-only TypeScript consumers without @types/node still compile (as in panel.tsx).
declare const process: { env: { NODE_ENV?: string } };

const isDev = (): boolean => {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
};

function readStored(key: string | undefined): Tempo | undefined {
  if (!key) return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    return isTempo(raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}

function writeStored(key: string | undefined, tempo: Tempo): void {
  if (!key) return;
  try {
    window.localStorage.setItem(key, tempo);
  } catch {
    // Storage can be full, disabled or blocked: the choice still applies for this page.
  }
}

/** Keeps `<html data-f12-tempo>` (set before first paint by the first-paint script) current. */
function syncDocumentTempo(tempo: Tempo): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (root.hasAttribute('data-f12-tempo') && root.getAttribute('data-f12-tempo') !== tempo) {
    root.setAttribute('data-f12-tempo', tempo);
  }
}

/**
 * Provides the viewer's animation tempo to every FRAME/12 animation below it.
 *
 * - The nearest provider sets `twos`/`ones`/`auto` for its subtree; `still` from any ancestor
 *   propagates down and cannot be undone by a nested provider. OS reduced motion always applies.
 * - Renders a layout-neutral `<div style="display: contents">` (or, with `asChild`, decorates its
 *   one child) carrying `data-f12-tempo` and, when the tempo forces a mode, the matching
 *   `f12-m-*` class so CSS-only consumers follow it.
 */
export function TempoProvider({
  value,
  onChange,
  defaultValue,
  storageKey,
  asChild = false,
  children,
}: TempoProviderProps) {
  const parent = React.useContext(TempoContext);
  const reduced = useReducedMotion();
  const controlled = value !== undefined;

  const warnedRef = React.useRef(false);
  if (controlled && defaultValue !== undefined && !warnedRef.current && isDev()) {
    warnedRef.current = true;
    console.warn(
      'TempoProvider: both `value` and `defaultValue` were given. `value` wins; remove `defaultValue` (or `value` to make it uncontrolled).',
    );
  }

  const [internal, setInternal] = React.useState<Tempo>(() => normalizeTempo(defaultValue));

  // The server and the hydrating client render `defaultValue` (or `auto`); the stored choice is
  // read before the first paint, so there is no hydration mismatch and no flash of the default.
  useIsoLayoutEffect(() => {
    if (controlled || !storageKey) return;
    const stored = readStored(storageKey);
    if (stored) setInternal(stored);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== storageKey) return;
      setInternal(readStored(storageKey) ?? normalizeTempo(defaultValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [controlled, storageKey, defaultValue]);

  const tempo: Tempo = controlled ? normalizeTempo(value) : internal;

  useIsoLayoutEffect(() => {
    if (storageKey) syncDocumentTempo(tempo);
  }, [storageKey, tempo]);

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const setTempo = React.useCallback(
    (next: Tempo) => {
      const t = normalizeTempo(next);
      if (!controlled) {
        setInternal(t);
        writeStored(storageKey, t);
      }
      onChangeRef.current?.(t);
    },
    [controlled, storageKey],
  );

  const ancestorStill = parent.ancestorStill || (parent.inProvider && parent.tempo === 'still');

  const ctx = React.useMemo<TempoContextValue>(
    () => ({ tempo, setTempo, ancestorStill, inProvider: true }),
    [tempo, setTempo, ancestorStill],
  );

  // The resolved mode for a context with no component base: `auto` adds no class.
  const forced =
    reduced || ancestorStill || tempo === 'still'
      ? 'cut'
      : tempo === 'twos'
        ? 'stepped'
        : tempo === 'ones'
          ? 'smooth'
          : null;
  const motionClass = forced ? `f12-m-${forced}` : '';

  let content: React.ReactElement;
  if (asChild) {
    const child = React.Children.only(children) as React.ReactElement<{
      className?: string;
      'data-f12-tempo'?: string;
    }>;
    const childClass = child.props.className ?? '';
    content = React.cloneElement(child, {
      className: [childClass, motionClass].filter(Boolean).join(' ') || undefined,
      'data-f12-tempo': tempo,
    });
  } else {
    content = (
      <div style={{ display: 'contents' }} data-f12-tempo={tempo} className={motionClass || undefined}>
        {children}
      </div>
    );
  }

  return <TempoContext.Provider value={ctx}>{content}</TempoContext.Provider>;
}
