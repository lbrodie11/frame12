# FRAME/12 Domain Candidates (`site/DOMAIN.md`)

This document records the five primary domain candidates for hosting the FRAME/12 documentation site and public `shadcn` component registry (`https://<domain>/r/<item>.json`).

> **Note:** No external registrar lookups or purchases have been executed.

---

## 1. Candidate Domains

| Rank | Domain | Registry Endpoint Example | Rationale & Fit |
| --- | --- | --- | --- |
| **1 (Recommended)** | **`frame12.dev`** | `https://frame12.dev/r/frame12.json` | Exact match for the **FRAME/12** name and `.dev` developer TLD (`HSTS` preloaded by default). Short (11 chars), unambiguous in CLI commands (`npx shadcn@latest add https://frame12.dev/r/panel.json`), and already configured as the canonical `homepage` in `registry/registry.json`. |
| **2** | **`ontwos.dev`** | `https://ontwos.dev/r/frame12.json` | Directly references the signature 12fps motion grammar (*animating on twos*). Memorable and distinctive for the `/motion` showcase page. |
| **3** | **`frame12.design`** | `https://frame12.design/r/frame12.json` | Emphasizes that FRAME/12 is a complete visual and interaction language (panel grammar, screentone, and exposure-sheet timing) in addition to a code registry. |
| **4** | **`frame12ui.com`** | `https://frame12ui.com/r/frame12.json` | Clear `.com` fallback if `.dev` is unavailable; explicitly signals UI components and design system tooling. |
| **5** | **`screentone.dev`** | `https://screentone.dev/r/frame12.json` | Highlights the rotated 45° SVG halftone surface system that replaces CSS gradients and arbitrary opacity across charts and backdrops. |

---

## 2. Registry URL Structure

Regardless of which domain is selected at deployment time, the static registry artifacts in `site/public/r/` are served from the root `/r/` path:

- **Full kit bundle:** `https://<domain>/r/frame12.json`
- **Token stylesheet:** `https://<domain>/r/frame12-styles.json`
- **Motion hooks:** `https://<domain>/r/use-on-twos.json`
- **Individual components & adapters:** `https://<domain>/r/<slug>.json` (e.g., `/r/sheet.json`, `/r/scene.json`, `/r/panel.json`, `/r/panel-pair.json`, `/r/tone-area-chart.json`, `/r/dialog.json`)
- **Registry manifest:** `https://<domain>/r/registry.json`

---

## 3. Selection Criteria

1. **CLI ergonomics:** Developers and AI coding agents paste the full registry URL into `npx shadcn@latest add https://<domain>/r/<item>.json`. Shorter domains without hyphens reduce transcription errors.
2. **HTTPS enforcement:** `.dev` domains sit on the HSTS preload list, guaranteeing HTTPS-only fetches from `shadcn` CLI and agent tools.
3. **Craft alignment:** The domain name must refer strictly to the production craft (`frame12`, `ontwos`, `screentone`) and never reference any artist, studio, or franchise.
