/**
 * Focus restoration for Back/Forward.
 *
 * Links that opt in with `data-f12-return-focus` (dependency and catalog links, optionally with
 * `data-f12-focus-fallback="<heading id>"`) record `{ f12Focus: { url, id, fallbackId } }` on the
 * *current* history entry just before they navigate. Any other in-site link navigation clears
 * that record, so a later Back after leaving some other way (e.g. through the primary nav) never
 * pulls focus to a stale target. Modified clicks (new tab/window) record nothing.
 *
 * The record is merged into `history.state` with `replaceState`, keeping every key Next.js
 * already stored there (`__NA`, `__PRIVATE_NEXTJS_INTERNALS_TREE`). Passing a state object that
 * still carries `__NA` makes the Next.js `replaceState` patch hand it straight to the browser
 * untouched. These keys are Next.js internals: `site/tests/navigation-continuity.mjs` ("history
 * hygiene") asserts they survive, so a Next.js upgrade that changes them fails CI instead of
 * silently breaking focus restoration.
 *
 * `startFocusRestoration()` listens for `popstate` only, so a fresh navigation or a reload never
 * moves focus. When a traversal lands on an entry whose record matches the entry's own URL, it
 * waits for the target to be mounted and rendered (the tab restored, the element connected and
 * laid out), then focuses it with `preventScroll` so native scroll restoration stays in charge.
 * A target outside the viewport is never focused (focus must stay visible). A missing target
 * falls back to the section heading; if that is missing too, nothing happens. Any key press or
 * pointer press while waiting cancels the restore.
 */

export const FOCUS_STATE_KEY = 'f12Focus';

export interface FocusRecord {
  /** Full URL of the entry the record belongs to; Next.js may copy state into later entries. */
  url: string;
  id: string;
  fallbackId?: string;
}

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,127}$/;

export function readFocusRecord(state: unknown): FocusRecord | null {
  if (!state || typeof state !== 'object') return null;
  const rec = (state as Record<string, unknown>)[FOCUS_STATE_KEY];
  if (!rec || typeof rec !== 'object') return null;
  const { url, id, fallbackId } = rec as Record<string, unknown>;
  if (typeof url !== 'string' || typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
  if (fallbackId !== undefined && (typeof fallbackId !== 'string' || !ID_PATTERN.test(fallbackId))) {
    return null;
  }
  return { url, id, fallbackId: fallbackId as string | undefined };
}

function writeFocusRecord(record: FocusRecord | null): void {
  try {
    const current = window.history.state;
    const base: Record<string, unknown> = current && typeof current === 'object' ? { ...current } : {};
    if (record) base[FOCUS_STATE_KEY] = record;
    else if (FOCUS_STATE_KEY in base) delete base[FOCUS_STATE_KEY];
    else return;
    window.history.replaceState(base, '', window.location.href);
  } catch {
    // History state can be unavailable (sandboxed frames); focus restoration is best effort.
  }
}

export function rememberFocusForBack(id: string, fallbackId?: string): void {
  if (typeof window === 'undefined') return;
  writeFocusRecord({ url: window.location.href, id, fallbackId });
}

/** Props that opt a link into Back/Forward focus restoration. */
export function returnFocusProps(fallbackId?: string): Record<string, string> {
  return fallbackId
    ? { 'data-f12-return-focus': '', 'data-f12-focus-fallback': fallbackId }
    : { 'data-f12-return-focus': '' };
}

/**
 * One document-level listener (bubble phase, so it runs after React/Next.js link handlers and is
 * skipped when a guard such as WorkspaceSettings' unsaved-changes dialog stops the click) that
 * records or clears the focus record for every plain in-site link navigation.
 */
export function startFocusTracking(): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
    let dest: URL;
    try {
      dest = new URL(anchor.href, window.location.href);
    } catch {
      return;
    }
    if (dest.origin !== window.location.origin) return;
    // An in-page hash jump keeps the same entry's context; leave the record alone.
    const here = new URL(window.location.href);
    if (dest.pathname === here.pathname && dest.search === here.search && dest.hash) return;
    const fallback = anchor.getAttribute('data-f12-focus-fallback') ?? undefined;
    if (anchor.hasAttribute('data-f12-return-focus') && anchor.id && ID_PATTERN.test(anchor.id)) {
      writeFocusRecord({
        url: window.location.href,
        id: anchor.id,
        fallbackId: fallback && ID_PATTERN.test(fallback) ? fallback : undefined,
      });
    } else {
      writeFocusRecord(null);
    }
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}

function isRendered(el: HTMLElement): boolean {
  return el.isConnected && el.getClientRects().length > 0;
}

function isInViewport(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
}

/** Focus without scrolling, but only if the element is on screen: off-screen focus is lost focus. */
function focusIfVisible(el: HTMLElement): void {
  if (isInViewport(el)) el.focus({ preventScroll: true });
}

/** Frames to keep waiting for the target once the fallback heading is already on screen. */
const FALLBACK_GRACE_FRAMES = 10;
const MAX_WAIT_MS = 3000;
/** Frames to wait for scroll restoration to bring a mounted target on screen. */
const OFFSCREEN_GRACE_FRAMES = 10;

function restore(record: FocusRecord): () => void {
  let raf = 0;
  let done = false;
  let fallbackFrames = 0;
  let offscreenFrames = 0;
  const start = performance.now();

  const stop = () => {
    done = true;
    window.cancelAnimationFrame(raf);
    window.removeEventListener('keydown', stop, true);
    window.removeEventListener('pointerdown', stop, true);
  };

  const tick = () => {
    if (done) return;
    // A later traversal or navigation moved on: never focus into a page we are not on.
    if (window.location.href !== record.url) return stop();
    const target = document.getElementById(record.id);
    if (target && isRendered(target)) {
      // Give native scroll restoration a few frames to bring the target on screen; if it still
      // is not visible, leave focus alone rather than strand it off-screen.
      if (isInViewport(target) || ++offscreenFrames > OFFSCREEN_GRACE_FRAMES) {
        focusIfVisible(target);
        return stop();
      }
      raf = window.requestAnimationFrame(tick);
      return;
    }
    const fallback = record.fallbackId ? document.getElementById(record.fallbackId) : null;
    if (fallback && isRendered(fallback)) {
      fallbackFrames += 1;
      if (fallbackFrames > FALLBACK_GRACE_FRAMES) {
        // Only a heading that opted in with tabIndex={-1} is a valid fallback target.
        if (fallback.hasAttribute('tabindex')) focusIfVisible(fallback);
        return stop();
      }
    }
    if (performance.now() - start > MAX_WAIT_MS) return stop();
    raf = window.requestAnimationFrame(tick);
  };

  // The visitor acting during the wait always wins over the restore.
  window.addEventListener('keydown', stop, true);
  window.addEventListener('pointerdown', stop, true);
  raf = window.requestAnimationFrame(tick);
  return stop;
}

export function startFocusRestoration(): () => void {
  let cancel: (() => void) | null = null;
  const onPopState = (event: PopStateEvent) => {
    cancel?.();
    cancel = null;
    const record = readFocusRecord(event.state);
    if (!record || record.url !== window.location.href) return;
    cancel = restore(record);
  };
  window.addEventListener('popstate', onPopState);
  return () => {
    window.removeEventListener('popstate', onPopState);
    cancel?.();
  };
}

/**
 * Mirrors a block section into `?section=` with `replaceState` (never `pushState`, so tab
 * switches add no history entries). Next.js's own state keys are stripped from the object we pass
 * so its `replaceState` patch re-attaches them and syncs `useSearchParams`; any other custom keys
 * on the entry are kept.
 */
export function replaceSectionParam(section: string | null, defaultSection: string): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (!section || section === defaultSection) url.searchParams.delete('section');
    else url.searchParams.set('section', section);
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
    const current = window.history.state;
    const custom: Record<string, unknown> = {};
    if (current && typeof current === 'object') {
      for (const [key, value] of Object.entries(current)) {
        if (key !== '__NA' && key !== '__PRIVATE_NEXTJS_INTERNALS_TREE' && key !== FOCUS_STATE_KEY) {
          custom[key] = value;
        }
      }
    }
    window.history.replaceState(custom, '', next);
  } catch {
    // Best effort: the tab still works without the URL mirror.
  }
}
