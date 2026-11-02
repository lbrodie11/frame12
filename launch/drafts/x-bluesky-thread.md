# X / Bluesky Launch Thread (`launch/drafts/x-bluesky-thread.md`)

A 6-post launch thread built around `launch/clips/motion-on-twos.webm` (or `.gif`) on Post 1 and `launch/clips/social-hero.png` on Post 6. Every post fits within 280 characters (excluding media attachments and code blocks).

---

## Post 1 / 6 — Hook + Motion Comparison Video

**Attachment:** `launch/clips/motion-on-twos.webm` (or `launch/clips/motion-on-twos.gif`)
**Alt text:** Side-by-side comparison of a revenue dashboard switching between 7, 90, and 30 days. Phase A shows 60fps continuous easing; Phase B shows 12fps stepped motion on twos (83.33ms per held pose) with an inverting difference-blend indicator, stepped screentone chart wipe, and 2-frame SVG burst; Phase C replays both side-by-side in light paper and dark flashback themes.

```text
What happens when you build a React UI system from print page layout and 12fps cel-animation timing instead of soft cards and 60fps easing?

Meet FRAME/12: mitered ink panels, 12/20/32px semantic gutters, 45° SVG screentone, and motion held "on twos" (83.33ms per pose).
```

---

## Post 2 / 6 — Why "On Twos" Works in Interfaces

```text
In hand-drawn animation, most action is shot "on twos"—each drawing is held for 2 frames at 24fps (83.33ms).

FRAME/12 splits UI motion in two:
• Decisions (range switch, chart wipe, KPI count-up) step at 12fps via useOnTwos.
• Hand tracking (hover, scroll, crosshair, typing) stays 0ms instant.
```

```ts
export const FRAME_MS = 1000 / 12; // 83.33ms ("on twos")
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Quantize elapsed time into held drawings:
const k = Math.min(frames, Math.floor(elapsed / FRAME_MS) + 1);
const progress = easeOut(k / frames);
```

---

## Post 3 / 6 — Structural Panel Grammar & Flashback Dark Mode

```text
Instead of arbitrary spacing tokens, gutter width encodes narrative structure:

• 12px (--f-gutter-pair): couples two panels across a 16px diagonal SVG slant
• 20px (--f-gutter-scene): groups panels in one scene
• 32px (--f-gutter-change): starts a new scene

Dark mode turns the gutters solid black (#070708)—the print convention for a flashback page.
```

---

## Post 4 / 6 — Zero-Dependency Screentone Charts & Difference Blending

```text
Zero framer-motion, zero recharts, zero d3.

• Charts fill with a 45° rotated SVG halftone <pattern> instead of alpha gradients.
• Peak values get inked speech-balloon callouts (<Balloon>).
• SegmentedControl steps a solid ink bar in 3 poses with mix-blend-mode: difference so crossed numerals invert cleanly without blur.
```

---

## Post 5 / 6 — Built for Humans and AI Coding Agents (`SKILL.md` + Linter)

```text
Why do AI coding agents drift back to generic rounded cards after two prompts? Because "make it sleek" can't be linted.

FRAME/12 ships with skills/frame12/SKILL.md + scripts/check-frame12.mjs enforcing:
• 0 color literals
• 12/20/32px gutters only
• Sequential C-01..C-0N cuts in DOM order
• Marker yellow (#ffd60a) only under #121212 ink
```

---

## Post 6 / 6 — Install via `shadcn` CLI & Open Source Links

**Attachment:** `launch/clips/social-hero.png`
**Alt text:** FRAME/12 social hero card showing registration pegs at top, C-01 recovered revenue area chart filled with 45-degree halftone screentone and a speech-balloon peak annotation, C-02 and C-03 diagonal panel pair separated by a 12px slanted gutter, and C-04 exposure-sheet film strip illustrating 4 held poses across 250ms.

```text
FRAME/12 is MIT-licensed and live now with 19 copy-in registry items (14 core components, 5 primitive adapters, hooks, and CSS tokens).

Install in any Next.js / React app:
npx shadcn@latest add https://frame12.dev/r/frame12.json

Interactive motion studio: https://frame12.dev/motion
GitHub: https://github.com/lbrodie11/frame12
```
