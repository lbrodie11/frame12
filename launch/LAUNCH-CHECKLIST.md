# FRAME/12 Launch-Day Execution Checklist (`launch/LAUNCH-CHECKLIST.md`)

> **Status: Prepared — Do NOT Execute Automated Publishing.**
> All steps below are documented for manual launch-day execution. Do **not** run `gh repo edit --visibility public`, push release tags, or submit directory listings until you are ready to go live.

---

## Phase 1: Pre-Launch Verification (Local)

- [ ] **1.1 Run full monorepo build, grammar linter, and Playwright suites:**
  ```bash
  npm run lint:frame12
  npm test
  node launch/tests/verify-launch.mjs
  ```
- [ ] **1.2 Verify launch clips and social hero card:**
  - `launch/clips/motion-on-twos.webm` (`1280×720`, ~19s comparison of `60fps` Smooth vs. `12fps` Stepped on twos in Light and Dark flashback themes)
  - `launch/clips/social-hero.png` (`2400×1260` @ 2x DPI / `1200×630` aspect ratio)
  - Optional GIF conversion (if `ffmpeg` is installed): see `launch/clips/README.md`.
- [ ] **1.3 Verify zero named artists, studios, comics, or franchises:**
  Confirm `node launch/tests/verify-launch.mjs` reports `0` forbidden name matches across `launch/` and `templates/next-starter/`.

---

## Phase 2: Production Domain & Vercel Deployment (`frame12.dev`)

- [ ] **2.1 Deploy `@frame12/site` to Vercel:**
  - **Root Directory:** `site`
  - **Framework Preset:** `Next.js`
  - **Install Command:** `npm install --prefix ..`
  - **Build Command:** `npm --prefix .. run build`
  - **Output Directory:** `.next`
- [ ] **2.2 Attach Custom Domain (`frame12.dev`):**
  - Configure DNS `A` (`76.76.21.21`) and `CNAME` (`cname.vercel-dns.com`) records for `frame12.dev` and `www.frame12.dev`.
  - Confirm TLS certificate provisioning on Vercel.
- [ ] **2.3 Verify Production `shadcn` Registry & Open Graph Endpoints:**
  ```bash
  curl -sfI https://frame12.dev/r/registry.json
  curl -sfI https://frame12.dev/r/frame12.json
  curl -sfI https://frame12.dev/r/panel.json
  curl -sfI https://frame12.dev/opengraph-image
  curl -sfI https://frame12.dev/motion/opengraph-image
  ```
- [ ] **2.4 Test Live `shadcn` CLI Installation in a Clean Scratch App:**
  ```bash
  npx shadcn@latest add https://frame12.dev/r/frame12.json
  ```

---

## Phase 3: Flip GitHub Repository to Public & Tag `v0.1.0` (Manual Step)

> **Warning:** Only run these commands at launch time after verifying Phase 1 and Phase 2.

- [ ] **3.1 Merge `m5-launch` into `main` and push:**
  ```bash
  git checkout main
  git merge --ff-only m5-launch
  git push origin main
  ```
- [ ] **3.2 Flip Repository Visibility to Public:**
  ```bash
  gh repo edit lbrodie11/frame12 --visibility public --accept-visibility-change-consequences
  ```
- [ ] **3.3 Tag and Publish `v0.1.0` Release:**
  ```bash
  git tag -a v0.1.0 -m "FRAME/12 v0.1.0 — Interface design language, shadcn registry, and agent skill"
  git push origin v0.1.0
  gh release create v0.1.0 \
    launch/clips/motion-on-twos.webm \
    launch/clips/social-hero.png \
    --title "FRAME/12 v0.1.0 — Designing Interfaces on Twos" \
    --notes-file launch/drafts/show-hn.md
  ```
- [ ] **3.4 Verify Agent Skill CLI Installation from Public GitHub:**
  ```bash
  npx skills add lbrodie11/frame12 --skill frame12
  ```

---

## Phase 4: Announcement Sequence

- [ ] **4.1 Publish Technical Essay:**
  - Publish `launch/drafts/designing-interfaces-on-twos.md` (*"Designing Interfaces on Twos"*) with `launch/clips/motion-on-twos.webm` and `launch/clips/social-hero.png`.
- [ ] **4.2 Submit Show HN (`news.ycombinator.com/submit`):**
  - Use title, URL (`https://frame12.dev`), and first comment from `launch/drafts/show-hn.md`.
- [ ] **4.3 Post X / Bluesky Thread:**
  - Post the 6-part thread in `launch/drafts/x-bluesky-thread.md` with `motion-on-twos.webm` (or `.gif`) on Post 1 and `social-hero.png` on Post 6.
- [ ] **4.4 Post to Reddit (`r/reactjs` and `r/webdev`):**
  - Use the tailored technical write-ups in `launch/drafts/reddit-posts.md`.
- [ ] **4.5 Submit Directory & Marketplace Listings (`launch/LISTINGS.md`):**
  - [ ] Official `shadcn/ui` Registry Directory PR (`apps/v4/registry/directory.json`)
  - [ ] `21st.dev` component submissions via `npx @21st-dev/cli submit`
  - [ ] `skills.sh` / `cursor.directory` agent skill & rule listing
  - [ ] `Godly.website`, `Awwwards`, and `Codrops` showcase submissions
  - [ ] `vercel.com/templates/submit` (`templates/next-starter/`)
