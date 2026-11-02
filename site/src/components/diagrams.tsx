import * as React from 'react';

export function GrammarDiagram() {
  const sx = 0;
  const sy = 44;
  const A = { x: sx + 20, y: sy + 20, w: 420, h: 200 };
  const px = A.x + A.w + 20;
  const pw = 216;
  const d = 14;
  const bBot = A.y + 94;
  const cTop = bBot + 12;
  const D = { x: A.x, y: A.y + A.h + 32, w: px + pw - A.x, h: 72 };

  const lab = (x: number, y: number, t: string, anchor: 'start' | 'middle' | 'end' = 'start') => (
    <text x={x} y={y} className="g-lab" textAnchor={anchor}>
      {t}
    </text>
  );
  const tag = (x: number, y: number, t: string) => (
    <g>
      <rect x={x} y={y - 15} width={t.length * 7.4 + 16} height="22" className="f12-g-tag" />
      <text x={x + 8} y={y} className="g-tag-t">
        {t}
      </text>
    </g>
  );

  return (
    <div className="sp-scroll">
      <svg
        viewBox="0 0 900 380"
        className="grammar"
        role="img"
        aria-label="Panel grammar: a 12 pixel gutter pairs panels, 20 pixels keeps them in one scene, 32 pixels starts a new scene."
      >
        <rect x={sx} y={sy} width={px + pw + 20} height={D.y + D.h + 20 - sy} className="g-sheet" />
        <rect x={A.x} y={A.y} width={A.w} height={A.h} className="g-panel" />
        <polygon
          points={`${px},${A.y} ${px + pw},${A.y} ${px + pw},${bBot - d} ${px},${bBot}`}
          className="g-panel"
        />
        <polygon
          points={`${px},${cTop} ${px + pw},${cTop - d} ${px + pw},${A.y + A.h} ${px},${A.y + A.h}`}
          className="g-panel"
        />
        <rect x={D.x} y={D.y} width={D.w} height={D.h} className="g-panel" />
        {lab(A.x + 16, A.y + 28, 'C-01  Primary: the establishing frame')}
        {lab(px + 14, A.y + 28, 'C-02')}
        {lab(px + 14, cTop + 30, 'C-03')}
        {lab(D.x + 16, D.y + 30, 'C-04  New scene')}
        <path d={`M${A.x + A.w + 10} ${A.y - 4}V${sy - 14}`} className="g-lead" />
        {tag(A.x + A.w - 70, sy - 20, '20 px · same scene')}
        <path d={`M${px + pw + 4} ${bBot - d / 2 + 6}H${px + pw + 44}`} className="g-lead" />
        {tag(px + pw + 50, bBot - d / 2 + 11, '12 px · a pair')}
        <path d={`M${px + pw + 4} ${A.y + A.h + 16}H${px + pw + 44}`} className="g-lead" />
        {tag(px + pw + 50, A.y + A.h + 21, '32 px · scene change')}
        <text x={px + pw + 50} y={bBot + 36} className="g-small">
          Slanted gutter =
        </text>
        <text x={px + pw + 50} y={bBot + 52} className="g-small">
          related metrics
        </text>
      </svg>
    </div>
  );
}

export function FilmStripDiagram({ idPrefix = 'fm' }: { idPrefix?: string }) {
  const fw = 196;
  const fh = 96;
  const gap = 14;
  const top = 34;
  const poses = [0, 1 / 3, 2 / 3, 1];
  const cell = 52;
  const cx0 = 22;
  const cy = 34;
  const ch = 34;
  const labels = ['7', '30', '90'];

  return (
    <div className="sp-scroll">
      <svg
        viewBox={`0 0 ${poses.length * (fw + gap) + gap} ${fh + top * 2 + 24}`}
        className="film"
        role="img"
        aria-label="Four frames of the range marker moving from 7 to 90 days, each pose held 83 milliseconds."
      >
        <defs>
          {poses.map((p, i) => (
            <clipPath key={i} id={`${idPrefix}-${i}`}>
              <rect x={cx0 + p * cell * 2} y={cy} width={cell} height={ch} />
            </clipPath>
          ))}
        </defs>
        <rect
          x="0"
          y="0"
          width={poses.length * (fw + gap) + gap}
          height={fh + top * 2}
          className="film-base"
        />
        {Array.from(
          { length: Math.floor((poses.length * (fw + gap) + gap) / 18) },
          (_, k) => (
            <g key={k}>
              <rect x={8 + k * 18} y="9" width="9" height="12" rx="2" className="film-hole" />
              <rect
                x={8 + k * 18}
                y={fh + top * 2 - 21}
                width="9"
                height="12"
                rx="2"
                className="film-hole"
              />
            </g>
          ),
        )}
        {poses.map((p, i) => (
          <g key={i} transform={`translate(${gap + i * (fw + gap)}, ${top})`}>
            <rect x="0" y="0" width={fw} height={fh} className="film-frame" />
            <text x="10" y="18" className="film-n">{`F${i * 2 + 1}–${i * 2 + 2}`}</text>
            <rect x={cx0} y={cy} width={cell * 3} height={ch} className="fm-ctl" />
            <line x1={cx0 + cell} x2={cx0 + cell} y1={cy} y2={cy + ch} className="fm-sep" />
            <line x1={cx0 + cell * 2} x2={cx0 + cell * 2} y1={cy} y2={cy + ch} className="fm-sep" />
            {labels.map((t, k) => (
              <text key={k} x={cx0 + cell * k + cell / 2} y={cy + 23} textAnchor="middle" className="fm-t">
                {t}
              </text>
            ))}
            <rect x={cx0 + p * cell * 2} y={cy} width={cell} height={ch} className="fm-ind" />
            <g clipPath={`url(#${idPrefix}-${i})`}>
              {labels.map((t, k) => (
                <text
                  key={k}
                  x={cx0 + cell * k + cell / 2}
                  y={cy + 23}
                  textAnchor="middle"
                  className="fm-t inv"
                >
                  {t}
                </text>
              ))}
            </g>
          </g>
        ))}
        {poses.map((_, i) => (
          <text
            key={i}
            x={gap + i * (fw + gap) + fw / 2}
            y={fh + top * 2 + 18}
            textAnchor="middle"
            className="film-cap"
          >{`${Math.round(i * 83.3)} ms`}</text>
        ))}
      </svg>
    </div>
  );
}
