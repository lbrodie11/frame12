'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SegmentedControl, Tag, TempoProvider, TempoControl, TEMPO_OPTIONS } from '@/components/frame12';
import { TEMPOS, useResolvedMotion, useTempo, type Tempo } from '@/hooks/use-tempo';
import { NAV_ITEMS, resolveNavOwnership } from '@/lib/nav-ownership';
import { TEMPO_STORAGE_KEY } from '@/lib/tempo-storage';
import { startFocusRestoration, startFocusTracking } from '@/lib/history-focus';

export type ThemeMode = 'light' | 'dark';

export interface SiteSettingsContextValue {
  theme: ThemeMode;
  themeOverride?: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const SiteSettingsContext = React.createContext<SiteSettingsContextValue>({
  theme: 'light',
  themeOverride: undefined,
  setTheme: () => {},
});

export function useSiteSettings(): SiteSettingsContextValue {
  return React.useContext(SiteSettingsContext);
}

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; unit: string }> = [
  { value: 'light', label: 'Light', unit: 'paper' },
  { value: 'dark', label: 'Dark', unit: 'ink' },
];


/** `M` cycles auto → twos → ones → still. */
export function nextTempo(t: Tempo): Tempo {
  return TEMPOS[(TEMPOS.indexOf(t) + 1) % TEMPOS.length];
}

function tempoAnnouncement(t: Tempo): string {
  const opt = TEMPO_OPTIONS.find((o) => o.value === t)!;
  return `Animation tempo: ${opt.label}, ${opt.meaning}`;
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

/** Single-key shortcuts never fire while typing, in a menu/listbox, or in an open dialog. */
function isShortcutEvent(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return false;
  if (document.querySelector('[role="listbox"], [role="menu"], dialog[open]')) return false;
  const target = e.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable ||
      Boolean(
        target.closest(
          'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="textbox"], [role="listbox"], [role="menu"]',
        ),
      ))
  ) {
    return false;
  }
  return true;
}

/**
 * The site's root element, rendered inside the site TempoProvider (`asChild` puts the provider's
 * `data-f12-tempo` and class here, so the root's grid, spacing and scrolling are unchanged). Its
 * own motion class is the resolved FRAME/12 default (`stepped`), so CSS-only consumers anywhere
 * on the site follow the tempo. Owns the `M` shortcut and its polite announcement.
 */
function SiteRoot({
  hydrated,
  className,
  children,
  ...rest
}: {
  hydrated: boolean;
  className?: string;
  children: React.ReactNode;
  'data-f12-tempo'?: string;
}) {
  const motion = useResolvedMotion('stepped');
  const { tempo, setTempo } = useTempo();
  const [announcement, setAnnouncement] = React.useState('');
  const tempoRef = React.useRef(tempo);
  tempoRef.current = tempo;

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isShortcutEvent(e)) return;
      if (e.key === 'm' || e.key === 'M') {
        const next = nextTempo(tempoRef.current);
        setTempo(next);
        setAnnouncement(tempoAnnouncement(next));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setTempo]);

  return (
    <div
      {...rest}
      className={`site-root f12-m-${motion}${className ? ` ${className}` : ''}`}
      data-hydrated={hydrated ? 'true' : undefined}
    >
      {children}
      <p className="f12-sr-only" role="status" aria-live="polite" id="site-tempo-status">
        {announcement}
      </p>
    </div>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const [theme, setThemeState] = React.useState<ThemeMode>('light');
  const [themeOverride, setThemeOverride] = React.useState<ThemeMode | undefined>(undefined);
  const [hydrated, setHydrated] = React.useState(false);
  const navListRef = React.useRef<HTMLUListElement | null>(null);
  const ownership = resolveNavOwnership(pathname);
  const [navOverflow, setNavOverflow] = React.useState({ start: false, end: false });

  // Back/Forward only: return focus to the link that was activated on that history entry.
  React.useEffect(() => {
    const stopTracking = startFocusTracking();
    const stopRestoring = startFocusRestoration();
    return () => {
      stopTracking();
      stopRestoring();
    };
  }, []);

  // Overflow cue for the narrow, horizontally scrolling nav row (its scrollbar is hidden): show
  // an edge fade + chevron at each edge that still has links beyond it, and nothing otherwise.
  useIsomorphicLayoutEffect(() => {
    const list = navListRef.current;
    if (!list) return;
    const update = () => {
      const max = list.scrollWidth - list.clientWidth;
      const next = { start: max > 1 && list.scrollLeft > 1, end: max > 1 && list.scrollLeft < max - 1 };
      setNavOverflow((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    update();
    // Keep a keyboard-focused link fully visible and clear of the cue strips. The native focus
    // scroll alone can be undone by scroll snapping (seen in Chromium), leaving the focused link
    // off-screen. Only the row's scrollLeft changes, never the page scroll.
    let focusRaf = 0;
    const onFocusIn = (event: FocusEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.<HTMLElement>('.site-nav-link');
      if (!link) return;
      window.cancelAnimationFrame(focusRaf);
      focusRaf = window.requestAnimationFrame(() => {
        const max = list.scrollWidth - list.clientWidth;
        if (max <= 1) return;
        const parsedPad = parseFloat(getComputedStyle(list).scrollPaddingLeft);
        const pad = Number.isFinite(parsedPad) ? parsedPad : 32;
        const lr = list.getBoundingClientRect();
        const r = link.getBoundingClientRect();
        if (r.left >= lr.left + pad - 1 && r.right <= lr.right - pad + 1) return;
        // Align the link's start to the scroll padding: that is a snap position, so snapping
        // keeps it there (a partial nudge would be snapped back).
        list.scrollLeft = Math.max(0, Math.min(list.scrollLeft + r.left - (lr.left + pad), max));
      });
    };
    list.addEventListener('focusin', onFocusIn);
    list.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(update);
      ro.observe(list);
    }
    return () => {
      window.cancelAnimationFrame(focusRaf);
      list.removeEventListener('focusin', onFocusIn);
      list.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, [pathname]);

  // On narrow screens the nav is a single horizontally scrolling row: keep the current page's link
  // visible on route change and when the viewport resizes into the horizontal-scroll layout. Only
  // the list's own scrollLeft changes, so the page never jumps, and manual horizontal scrolling
  // (which does not change clientWidth) is never overridden.
  useIsomorphicLayoutEffect(() => {
    const list = navListRef.current;
    if (!list) return;
    let settleRaf = 0;
    const centerActive = (settle = true) => {
      if (list.scrollWidth <= list.clientWidth) return;
      const active = list.querySelector<HTMLElement>('[aria-current]');
      if (!active) return;
      const offset = active.getBoundingClientRect().left - list.getBoundingClientRect().left;
      const target = list.scrollLeft + offset - (list.clientWidth - active.offsetWidth) / 2;
      list.scrollLeft = Math.max(0, Math.min(target, list.scrollWidth - list.clientWidth));
      if (!settle) return;
      // Centering can switch the overflow cue on, which widens the scroll padding and makes the
      // browser re-snap the row to the nearest link start. For a link near either end that can
      // leave it partly off-screen (seen with the 10th nav item), so check once more after the
      // padding has changed. Only a snap-sized nudge (at most half a link) is undone: any larger
      // change came from someone else (a user or a script scrolling the row) and is left alone,
      // as is everything after user input.
      const placed = list.scrollLeft;
      window.cancelAnimationFrame(settleRaf);
      settleRaf = window.requestAnimationFrame(() => {
        if (Math.abs(list.scrollLeft - placed) > 48) return;
        const lr = list.getBoundingClientRect();
        const r = active.getBoundingClientRect();
        if (r.left < lr.left || r.right > lr.right) centerActive(false);
      });
    };
    const cancelSettle = () => window.cancelAnimationFrame(settleRaf);
    const userInput = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const;
    for (const type of userInput) list.addEventListener(type, cancelSettle, { passive: true });
    centerActive();
    let prevWidth = list.clientWidth;
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => {
        if (list.clientWidth !== prevWidth) {
          prevWidth = list.clientWidth;
          centerActive();
        }
      });
      ro.observe(list);
      return () => {
        cancelSettle();
        for (const type of userInput) list.removeEventListener(type, cancelSettle);
        ro.disconnect();
      };
    }
    return () => {
      cancelSettle();
      for (const type of userInput) list.removeEventListener(type, cancelSettle);
    };
  }, [pathname]);

  useIsomorphicLayoutEffect(() => {
    const mq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    const readStoredOverride = (): ThemeMode | undefined => {
      try {
        const stored = localStorage.getItem('color-scheme');
        if (stored === 'dark' || stored === 'light') return stored;
      } catch {
        // Ignore storage errors
      }
      return undefined;
    };
    const resolveInitial = (): ThemeMode => {
      const stored = readStoredOverride();
      if (stored) return stored;
      return mq && mq.matches ? 'dark' : 'light';
    };

    const applyThemeToDom = (next: ThemeMode) => {
      document.documentElement.setAttribute('data-theme', next);
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) {
        const stored = readStoredOverride();
        meta.setAttribute('content', stored ?? 'light dark');
      }
    };

    const initialOverride = readStoredOverride();
    const initial = resolveInitial();
    setThemeOverride(initialOverride);
    setThemeState(initial);
    setHydrated(true);
    applyThemeToDom(initial);

    const onSystemChange = (e: MediaQueryListEvent) => {
      if (readStoredOverride()) return;
      const next: ThemeMode = e.matches ? 'dark' : 'light';
      setThemeOverride(undefined);
      setThemeState(next);
      applyThemeToDom(next);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'color-scheme') {
        const nextOverride = readStoredOverride();
        const next = resolveInitial();
        setThemeOverride(nextOverride);
        setThemeState(next);
        applyThemeToDom(next);
      }
    };

    if (mq && mq.addEventListener) mq.addEventListener('change', onSystemChange);
    window.addEventListener('storage', onStorage);
    return () => {
      if (mq && mq.removeEventListener) mq.removeEventListener('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setTheme = React.useCallback((next: ThemeMode) => {
    setThemeState(next);
    document.documentElement.setAttribute('data-theme', next);
    const sysDark =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const sysTheme: ThemeMode = sysDark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="color-scheme"]');
    try {
      if (next === sysTheme) {
        localStorage.removeItem('color-scheme');
        setThemeOverride(undefined);
        if (meta) meta.setAttribute('content', 'light dark');
      } else {
        localStorage.setItem('color-scheme', next);
        setThemeOverride(next);
        if (meta) meta.setAttribute('content', next);
      }
    } catch {
      setThemeOverride(next === sysTheme ? undefined : next);
      if (meta) meta.setAttribute('content', next);
    }
  }, []);

  const ctxValue = React.useMemo(
    () => ({ theme, themeOverride, setTheme }),
    [theme, themeOverride, setTheme],
  );

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isShortcutEvent(e)) return;
      if (e.key === 't' || e.key === 'T') {
        setTheme(theme === 'light' ? 'dark' : 'light');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [theme, setTheme]);

  return (
    <SiteSettingsContext.Provider value={ctxValue}>
      <TempoProvider asChild storageKey={TEMPO_STORAGE_KEY}>
        <SiteRoot hydrated={hydrated}>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>

          <header className="site-header">
            <div className="site-header-inner">
              <div className="site-brand-row">
                <Link href="/" className="site-brand" id="site-brand-link">
                  <span className="site-brand-mark">FRAME/12</span>
                  <Tag>v0.2 · On Twos</Tag>
                </Link>

                <div className="site-controls" role="group" aria-label="Theme and motion controls">
                  <SegmentedControl
                    idPrefix="site-theme"
                    ariaLabel="Color theme"
                    options={THEME_OPTIONS}
                    value={theme}
                    onChange={setTheme}
                  />
                  <TempoControl idPrefix="site-tempo" />
                </div>
              </div>

              <nav
                aria-label="Primary"
                className="site-nav"
                data-overflow-start={navOverflow.start ? 'true' : undefined}
                data-overflow-end={navOverflow.end ? 'true' : undefined}
              >
                <ul className="site-nav-list" role="list" ref={navListRef}>
                  {NAV_ITEMS.map((item) => {
                    const current = ownership?.id === item.id ? ownership.current : undefined;
                    const className = [
                      'site-nav-link',
                      current ? 'active' : '',
                      current === 'page' ? 'is-page' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          id={item.id}
                          className={className}
                          aria-current={current}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <span className="site-nav-cue site-nav-cue-start" aria-hidden="true">
                  <span className="site-nav-cue-glyph">‹</span>
                </span>
                <span className="site-nav-cue site-nav-cue-end" aria-hidden="true">
                  <span className="site-nav-cue-glyph">›</span>
                </span>
              </nav>
            </div>
          </header>

          <main id="main-content" className="site-main" tabIndex={-1}>
            {children}
          </main>

          <footer className="site-footer">
            <div className="site-footer-inner">
              <p className="site-footer-copy">
                <strong>FRAME/12</strong> · Interface design system built from page composition and
                cel-animation production craft: ink-framed panels, 12/20/32px gutter grammar, 45° SVG
                screentone, and motion held on twos (12fps, 83.33ms per pose).
              </p>
              <p className="site-footer-meta">
                Fernwood Supply Co. and all figures are fictional. No named artist, studio, or
                franchise work is reproduced; every element is original.
              </p>
            </div>
          </footer>
        </SiteRoot>
      </TempoProvider>
    </SiteSettingsContext.Provider>
  );
}
