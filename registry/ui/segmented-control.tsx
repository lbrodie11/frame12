'use client';

import * as React from 'react';

export interface SegmentedOption<T extends string | number = string | number> {
  value: T;
  label: string;
  unit?: string;
}

export interface SegmentedControlProps<T extends string | number = string | number> {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  idPrefix?: string;
  className?: string;
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export function SegmentedControl<T extends string | number = string | number>({
  options,
  value,
  onChange,
  ariaLabel = 'Options',
  idPrefix,
  className = '',
}: SegmentedControlProps<T>) {
  const autoId = React.useId().replace(/:/g, '');
  const resolvedPrefix = idPrefix ?? `seg-${autoId}`;
  const wrap = React.useRef<HTMLDivElement | null>(null);
  const [ind, setInd] = React.useState<{ x: number; w: number } | null>(null);
  const [focusedValue, setFocusedValue] = React.useState<T>(value);

  React.useEffect(() => {
    if (typeof document !== 'undefined' && wrap.current?.contains(document.activeElement)) {
      return;
    }
    setFocusedValue(value);
  }, [value]);

  const activeFocusValue = options.some((o) => o.value === focusedValue)
    ? focusedValue
    : (options.find((o) => o.value === value)?.value ?? options[0]?.value);

  useIsoLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!el) return;
    const x = el.offsetLeft + el.clientLeft;
    const w = el.clientWidth;
    setInd((s) => (s && s.x === x && s.w === w ? s : { x, w }));
  });

  // Re-measure when fonts finish loading or the control resizes.
  const [, bump] = React.useState(0);
  React.useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => bump((n) => n + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={`f12-rng${className ? ` ${className}` : ''}`}
      ref={wrap}
      role="group"
      aria-label={ariaLabel}
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node | null)) {
          setFocusedValue(value);
        }
      }}
    >
      {ind && (
        <span
          className="f12-rng-ind"
          aria-hidden="true"
          style={{ transform: `translateX(${ind.x}px)`, width: ind.w }}
        />
      )}
      {options.map((opt, idx) => (
        <button
          key={String(opt.value)}
          id={`${resolvedPrefix}-${opt.value}`}
          type="button"
          className="f12-rng-btn"
          aria-pressed={value === opt.value}
          aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End"
          tabIndex={opt.value === activeFocusValue ? 0 : -1}
          onFocus={() => setFocusedValue(opt.value)}
          onClick={() => onChange(opt.value)}
          onKeyDown={(e) => {
            if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || options.length === 0) return;
            let nextIdx = -1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              nextIdx = (idx + 1) % options.length;
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              nextIdx = (idx - 1 + options.length) % options.length;
            } else if (e.key === 'Home') {
              nextIdx = 0;
            } else if (e.key === 'End') {
              nextIdx = options.length - 1;
            }
            if (nextIdx !== -1) {
              e.preventDefault();
              const nextOpt = options[nextIdx];
              setFocusedValue(nextOpt.value);
              const buttons = wrap.current?.querySelectorAll<HTMLButtonElement>('.f12-rng-btn');
              buttons?.[nextIdx]?.focus();
            }
          }}
        >
          <span className="f12-rng-n">{opt.label}</span>
          {opt.unit && <span className="f12-rng-u">{opt.unit}</span>}
        </button>
      ))}
    </div>
  );
}
