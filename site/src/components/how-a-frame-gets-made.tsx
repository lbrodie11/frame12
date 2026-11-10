import type * as React from 'react';
import Link from 'next/link';
import { Panel, Tag } from '@/components/frame12';
import { InkStroke } from '@/components/frame12/ink';
import { InkBeat, InkLand } from '@/components/frame12/ink-sequence';
import { StoryShell } from '@/components/story-shell';
import { COMPONENT_COUNT } from '@/lib/catalog';
import {
  AREA,
  BARS,
  CUTS,
  FRAMES,
  GUTTER_NOTES,
  PENCIL,
  SHEET_H,
  SHEET_W,
  STORY_BEATS,
} from '@/lib/story-geometry';

/** The real screentone: 45° rotated dot pattern with `.f12-tone-dot`, as ToneAreaChart draws it. */
function Tone({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <circle cx="2.5" cy="2.5" r="1.1" className="f12-tone-dot" />
      </pattern>
    </defs>
  );
}

// Finished layers drawn under a panel's own beat. Plain paths (no `.f12-ink`), so they never animate.
// As in production, the pencils stay under the ink (C-02) and are erased once it dries (C-03, C-04).
function StaticPencil() {
  return (
    <g aria-hidden="true">
      <path className="f12-ink-pencil" fill="none" stroke="currentColor" d={PENCIL.columns} />
      <path className="f12-ink-pencil" fill="none" stroke="currentColor" d={PENCIL.rows} />
    </g>
  );
}
function StaticInk() {
  return (
    <g>
      {FRAMES.map((d, i) => (
        <path key={i} className="f12-ink-frame" fill="none" stroke="currentColor" strokeLinejoin="miter" d={d} />
      ))}
    </g>
  );
}
function StaticTone({ tone }: { tone: string }) {
  return (
    <g>
      <path d={AREA.fill} fill={`url(#${tone})`} />
      {BARS.map((d, i) => (
        <path key={i} d={d} fill={`url(#${tone})`} />
      ))}
      <path className="f12-ink-detail" fill="none" stroke="currentColor" d={AREA.line} />
    </g>
  );
}

function Sheet({ beat, children }: { beat: number; children: React.ReactNode }) {
  return (
    <svg
      className="home-story-art"
      viewBox={`0 0 ${SHEET_W} ${SHEET_H}`}
      aria-hidden="true"
      focusable="false"
      data-story-beat={beat}
    >
      {children}
    </svg>
  );
}

const BEATS: {
  key: string;
  tag: string;
  title: string;
  body: React.ReactNode;
  link?: { href: string; id: string; label: string; marker?: boolean };
}[] = [
  {
    key: 'pencil',
    tag: 'C-01 · Pencil',
    title: '12 columns, three gutters: 12 · 20 · 32',
    body: (
      <>
        Gutter width encodes relationships before any label is read: 12px pairs coupled metrics
        across a diagonal slant, 20px groups one scene, and 32px starts a new scene.
      </>
    ),
    link: { href: '/style-sheet', id: 'home-link-style-sheet', label: 'Inspect Style Sheet' },
  },
  {
    key: 'ink',
    tag: 'C-02 · Ink',
    title: 'One mitered 2.5 px line frames every panel',
    body: (
      <>
        Every section is an ink-framed SVG polygon with a 2.5px mitered stroke. Quiet panels drop
        to a 1px rule so the expressive frames keep the hierarchy.
      </>
    ),
  },
  {
    key: 'tone',
    tag: 'C-03 · Tone',
    title: '45° screentone instead of fills',
    body: (
      <>
        Rotated 45° halftone dot patterns replace CSS gradients and arbitrary opacity. Dot density
        carries hierarchy, prints cleanly, and survives grayscale in both themes.
      </>
    ),
    link: { href: '/components', id: 'home-link-components', label: `Browse ${COMPONENT_COUNT} Components` },
  },
  {
    key: 'cut',
    tag: 'C-04 · Cut',
    title: 'Cuts are numbered in reading order',
    body: (
      <>
        <code className="f12-code-inline f12-nowrap">C-01</code>,{' '}
        <code className="f12-code-inline f12-nowrap">C-02</code>… follow reading order, and state
        changes hold each pose for 83.33ms (on twos). Hover, scroll and crosshairs stay immediate.
      </>
    ),
    link: { href: '/motion', id: 'home-link-motion', label: 'Compare 12fps vs 60fps', marker: true },
  },
];

function Art({ beat }: { beat: number }) {
  const tone = `home-story-tone-${beat}`;
  if (beat === 0) {
    return (
      <Sheet beat={0}>
        <InkBeat beat={0}>
          <InkStroke weight="pencil" d={PENCIL.columns} />
          <InkStroke weight="pencil" d={PENCIL.rows} at={4} poses={8} />
          {GUTTER_NOTES.map((n, i) => (
            <InkLand key={n.text} at={8 + i}>
              <text x={n.x} y={n.y} className="home-story-note" textAnchor="middle">
                {n.text}
              </text>
            </InkLand>
          ))}
        </InkBeat>
      </Sheet>
    );
  }
  if (beat === 1) {
    return (
      <Sheet beat={1}>
        <StaticPencil />
        <InkBeat beat={1}>
          {FRAMES.map((d, i) => (
            <InkStroke key={i} weight="frame" d={d} at={i} poses={6} />
          ))}
        </InkBeat>
      </Sheet>
    );
  }
  if (beat === 2) {
    return (
      <Sheet beat={2}>
        <Tone id={tone} />
        <StaticInk />
        <InkBeat beat={2}>
          <InkLand reveal="wipe" poses={6}>
            <path d={AREA.fill} fill={`url(#${tone})`} />
          </InkLand>
          <InkStroke weight="detail" d={AREA.line} poses={6} />
          {BARS.map((d, i) => (
            <InkLand key={i} reveal="wipe" at={6 + i * 2} poses={4}>
              <path d={d} fill={`url(#${tone})`} />
            </InkLand>
          ))}
        </InkBeat>
      </Sheet>
    );
  }
  return (
    <Sheet beat={3}>
      <Tone id={tone} />
      <StaticTone tone={tone} />
      <StaticInk />
      <InkBeat beat={3}>
        {CUTS.map((c, i) => (
          <InkLand key={c.label} at={i * 2}>
            <path d={c.box} className="home-story-cut-box" />
            <text x={c.x} y={c.y} className="home-story-cut" textAnchor="middle">
              {c.label}
            </text>
          </InkLand>
        ))}
      </InkBeat>
    </Sheet>
  );
}

/**
 * "How a frame gets made": pencil → ink → tone → cut, as a four-panel storyboard strip. A server
 * component: the drawing and the captions are HTML. At rest (SSR, no JS, print, forced colors,
 * still tempo, reduced motion) every panel is finished. Scroll drives the poses where
 * `animation-timeline: view()` is supported; "Watch it get made" plays all 48 poses (4.0 s on
 * twos) everywhere. Captions and links never animate.
 */
export function HowAFrameGetsMade({ nextId }: { nextId: string }) {
  return (
    <section className="home-story" aria-labelledby="home-story-title">
      <StoryShell beats={STORY_BEATS}>
        <ol className="home-story-strip">
          {BEATS.map((b, i) => (
            <li key={b.key} className="home-story-beat">
              <Panel label={b.tag} cut={false}>
                <div className="f12-stack-pair">
                  <div className="f12-row-pair">
                    <Tag>{b.tag}</Tag>
                  </div>
                  <Art beat={i} />
                  <h3 className="home-story-title">{b.title}</h3>
                  <p className="f12-body-copy">{b.body}</p>
                  {b.link ? (
                    <div className="f12-row-pair">
                      <Link
                        href={b.link.href}
                        className={`f12-link-btn${b.link.marker ? ' marker' : ''}`}
                        id={b.link.id}
                      >
                        {b.link.label}
                      </Link>
                    </div>
                  ) : null}
                </div>
              </Panel>
            </li>
          ))}
        </ol>
        <a className="home-story-skip f12-mono-note" href={`#${nextId}`} id="home-story-skip">
          Skip the story
        </a>
      </StoryShell>
    </section>
  );
}
