'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SegmentedControl, Tag } from '@/components/frame12';
import { type MotionMode } from '@/hooks/use-on-twos';

export type ThemeMode = 'light' | 'dark';

export interface SiteSettingsContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  motion: MotionMode;
  setMotion: (motion: MotionMode) => void;
}

const SiteSettingsContext = React.createContext<SiteSettingsContextValue>({
  theme: 'light',
  setTheme: () => {},
  motion: 'stepped',
  setMotion: () => {},
});

export function useSiteSettings(): SiteSettingsContextValue {
  return React.useContext(SiteSettingsContext);
}

const NAV_ITEMS = [
  { href: '/', label: 'Home', id: 'nav-home' },
  { href: '/motion', label: 'Motion', id: 'nav-motion' },
  { href: '/components', label: 'Components', id: 'nav-components' },
  { href: '/blocks/developer-console', label: 'Developer Console', id: 'nav-developer-console' },
  { href: '/agents', label: 'Agents', id: 'nav-agents' },
  { href: '/style-sheet', label: 'Style Sheet', id: 'nav-style-sheet' },
  { href: '/get-started', label: 'Get Started', id: 'nav-get-started' },
];

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; unit: string }> = [
  { value: 'light', label: 'Light', unit: 'paper' },
  { value: 'dark', label: 'Dark', unit: 'ink' },
];

const MOTION_OPTIONS: Array<{ value: MotionMode; label: string; unit: string }> = [
  { value: 'stepped', label: '12', unit: 'fps' },
  { value: 'smooth', label: '60', unit: 'fps' },
  { value: 'cut', label: '0', unit: 'cut' },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const [theme, setThemeState] = React.useState<ThemeMode>('light');
  const [hydrated, setHydrated] = React.useState(false);
  const [motion, setMotion] = React.useState<MotionMode>('stepped');

  React.useEffect(() => {
    const mq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    const resolveInitial = (): ThemeMode => {
      try {
        const stored = localStorage.getItem('color-scheme');
        if (stored === 'dark' || stored === 'light') return stored;
      } catch {
        // Ignore storage errors
      }
      return mq && mq.matches ? 'dark' : 'light';
    };

    const applyThemeToDom = (next: ThemeMode) => {
      document.documentElement.setAttribute('data-theme', next);
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) {
        try {
          const stored = localStorage.getItem('color-scheme');
          meta.setAttribute('content', stored === 'light' || stored === 'dark' ? stored : 'light dark');
        } catch {
          meta.setAttribute('content', next);
        }
      }
    };

    const initial = resolveInitial();
    setThemeState(initial);
    setHydrated(true);
    applyThemeToDom(initial);

    const onSystemChange = (e: MediaQueryListEvent) => {
      try {
        const stored = localStorage.getItem('color-scheme');
        if (stored === 'light' || stored === 'dark') return;
      } catch {
        // Ignore storage errors
      }
      const next: ThemeMode = e.matches ? 'dark' : 'light';
      setThemeState(next);
      applyThemeToDom(next);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'color-scheme') {
        const next = resolveInitial();
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
        if (meta) meta.setAttribute('content', 'light dark');
      } else {
        localStorage.setItem('color-scheme', next);
        if (meta) meta.setAttribute('content', next);
      }
    } catch {
      if (meta) meta.setAttribute('content', next);
    }
  }, []);

  const ctxValue = React.useMemo(
    () => ({ theme, setTheme, motion, setMotion }),
    [theme, setTheme, motion],
  );

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="listbox"], [role="menu"], dialog[open]')) return;
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
        return;
      }
      if (e.key === 't' || e.key === 'T') {
        setTheme(theme === 'light' ? 'dark' : 'light');
      } else if (e.key === 'm' || e.key === 'M') {
        setMotion((prev) => (prev === 'stepped' ? 'smooth' : prev === 'smooth' ? 'cut' : 'stepped'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [theme, setTheme]);

  return (
    <SiteSettingsContext.Provider value={ctxValue}>
      <div
        className={`site-root f12-m-${motion}`}
        data-hydrated={hydrated ? 'true' : undefined}
      >
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        <header className="site-header">
          <div className="site-header-inner">
            <div className="site-brand-row">
              <Link href="/" className="site-brand" id="site-brand-link">
                <span className="site-brand-mark">FRAME/12</span>
                <Tag>v0.1 · On Twos</Tag>
              </Link>

              <div className="site-controls" role="group" aria-label="Theme and motion controls">
                <SegmentedControl
                  idPrefix="site-theme"
                  ariaLabel="Color theme"
                  options={THEME_OPTIONS}
                  value={theme}
                  onChange={setTheme}
                />
                <SegmentedControl
                  idPrefix="site-motion"
                  ariaLabel="Motion grammar"
                  options={MOTION_OPTIONS}
                  value={motion}
                  onChange={setMotion}
                />
              </div>
            </div>

            <nav aria-label="Primary" className="site-nav">
              <ul className="site-nav-list" role="list">
                {NAV_ITEMS.map((item) => {
                  const active =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        id={item.id}
                        className={`site-nav-link${active ? ' active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
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
      </div>
    </SiteSettingsContext.Provider>
  );
}
