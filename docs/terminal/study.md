# Study kit: plain vs rich vs live (`@frame12/terminal`)

**Status: NOT RUN / NEEDS HUMAN.** This kit is ready to run; no sessions have been held. Nothing
in the package's documentation claims a result from it.

**Question.** Should `rich` be the documented default for people at a terminal? Today `rich` is
the CLI's default, `plain` is what CI, pipes and screen readers get, and `live` is the keyboard
view. This study decides what the docs recommend to people. It does not change what machines get.

**Adapted from:**
- **PR #2's 8-developer protocol** (`experiments/terminal-storyboard/README.md` at `480da4e`). From
  it: a counterbalanced within-subject design, a verbatim moderator prompt, the "cite evidence"
  task, and the rule that the new presentation must be no slower and no less accurate.
- **Repo Archaeology's hallway kit** (`docs/map-hallway-test.md` in
  [lbrodie11/repo-archaeology](https://github.com/lbrodie11/repo-archaeology)). From it: 3–5
  people new to the repository, no coaching on the vocabulary, timing every task, and scoring
  whether people state historical uncertainty correctly ("historical evidence to investigate, not
  proof").

## Material

Three real runs of the `repo-archaeology` reference app on [honojs/hono](https://github.com/honojs/hono),
recorded with `--record` (repo-archaeology 0.10.0). Each run has three findings, so the tasks are
comparable. Run A is the `/terminal` page's recording; B and C are in `study/`.

| Run | Recording | Range |
| --- | --- | --- |
| A | `packages/terminal/examples/repo-archaeology/fixtures/hono-61f7c59.f12rec` | `61f7c59~6..61f7c59` |
| B | `study/run-b-hono-61f7c59-12.f12rec` | `61f7c59~17..61f7c59~12` |
| C | `study/run-c-hono-61f7c59-25.f12rec` | `61f7c59~30..61f7c59~25` |

Each condition is the same CLI on a recording. Run these from the repository root after
`npm ci`, in a terminal at least 100×30 (macOS Terminal, iTerm2, Windows Terminal or GNOME
Terminal), with the person's usual font and theme:

```sh
node packages/terminal/dist/cli/bin.js render --from packages/terminal/examples/repo-archaeology/fixtures/hono-61f7c59.f12rec --plain   # plain
node packages/terminal/dist/cli/bin.js render --from packages/terminal/examples/repo-archaeology/fixtures/hono-61f7c59.f12rec           # rich
node packages/terminal/dist/cli/bin.js render --from packages/terminal/examples/repo-archaeology/fixtures/hono-61f7c59.f12rec --format live
```

- `live` needs the dev dependencies (`ink`, `react`), which `npm ci` installs.
- Clear the screen before each task. The person may scroll, but not search (no Cmd-F) and not run
  other commands.
- For `live`, show the key help once (`?`) before the first task. Explain no other vocabulary
  (cut, finding, receipt, interval).

## Participants and order

- **At least 5 people** (6 balances the order fully; 8 if you can). Developers who use a terminal
  daily, who have not seen `@frame12/terminal` or Repo Archaeology output, and who have not worked
  on hono's history.
- Each person reads all three conditions, one run per condition. The order is counterbalanced:
  - each condition comes first, second and third equally often;
  - each condition is paired with each run equally often.
- Assign people to rows at random: shuffle the row numbers (draw them from a hat, or
  `node -e "console.log([1,2,3,4,5,6].sort(() => Math.random() - 0.5))"`) and give person P*n* the
  *n*-th row drawn. With 7 or 8 people, rows 1 and 2 (in the drawn order) are used twice.

| Row | First | Second | Third |
| --- | --- | --- | --- |
| 1 | plain · A | rich · B | live · C |
| 2 | rich · A | live · B | plain · C |
| 3 | live · A | plain · B | rich · C |
| 4 | plain · C | live · B | rich · A |
| 5 | rich · C | plain · B | live · A |
| 6 | live · C | rich · B | plain · A |

Run B is always second, so B's results also measure the middle of the session; compare B only
within a position.

## Moderator prompt (read verbatim before each run)

> "This is the output of a tool that looked at a repository's history to suggest which files
> usually change together. Using only what is in front of you, please answer three questions
> aloud. Take the time you need; I am timing each answer, and there are no trick questions.
> 1. Which pair of files should be looked at first?
> 2. How much evidence is that based on, and how sure is the tool?
> 3. Show me one piece of evidence for it: tell me what it is."

Start a timer when you finish reading each question, and stop it when the person finishes
answering. Write the answer down as said.

## Tasks and scoring

| Task | Correct when the person… |
| --- | --- |
| **T1 · Top finding** | names both files of the run's top finding (`F-01`). |
| **T2 · Evidence count and uncertainty** | gives the shared-change count with its denominator (for example "20 of 39 changes"), **and** states the uncertainty correctly: the interval (or "between X and Y percent"), and that it is how often the files changed together in the past, not a guarantee that a change to one needs the other. |
| **T3 · Open one receipt** | reads out one evidence commit for the top finding (its hash, or its date and message), which is one of the finding's own receipts. In `live` that means opening it (`Enter`); in `rich` and `plain` it means finding its `E-` line. |

**Errors.** Count each wrong answer: the wrong pair; a count without its denominator; a cut label
(`C-02`) given as a finding; a receipt from another finding; and the percentage read as accuracy,
correctness or probability of a bug. If the person gives up, that task scores as an error with
its time at the give-up point.

**Uncertainty is its own measure** (the T2 second half). Score it Y only when the person says, in
their own words, both the range and that it describes past co-changes. Saying "76%" alone is N.

### Answer key

| Run | T1: top finding | T2: evidence | T2: uncertainty | T3: receipts of `F-01` |
| --- | --- | --- | --- | --- |
| A | `src/helper/ssg/index.ts` with `src/helper/ssg/ssg.test.tsx` | 20 of 39 changes to `ssg.test.tsx` (the other way 20 of 27) | 51%, interval 36–66% | `00b405a` (2026-02-19, redirect plugin), `58175a1`, `8ef9b7b` |
| B | `src/client/utils.ts` with `src/client/utils.test.ts` | 16 of 21 changes to `utils.test.ts` (the other way 16 of 18) | 76%, interval 55–89% | `2059584` (2026-08-22, undefined entry in a query array), and the next two `E-` lines |
| C | `src/middleware/jwk/index.test.ts` with `src/middleware/jwk/jwk.ts` | 7 of 8 changes to `jwk.ts` (the other way 7 of 9) | 88%, interval 53–98% | `30277ae` (2026-08-03, WWW-Authenticate realm), and the next two `E-` lines |

Run C is the uncertainty probe: its point estimate is the highest, but it rests on 8 changes, so
its interval is the widest. Note whether people say so.

`packages/terminal/tests/examples.test.mjs` checks this key against the recordings, so it cannot
drift from them.

## Worksheet

One row per person per run. Times in seconds. Y/N for correctness.

| Person | Row | Position | Condition | Run | T1 s | T1 ✓ | T2 s | T2 count ✓ | T2 uncertainty ✓ | T3 s | T3 ✓ | Errors | Notes (confusions, quotes) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | | 1 | | | | | | | | | | | |
| P1 | | 2 | | | | | | | | | | | |
| P1 | | 3 | | | | | | | | | | | |
| P2 | | 1 | | | | | | | | | | | |
| P2 | | 2 | | | | | | | | | | | |
| P2 | | 3 | | | | | | | | | | | |
| P3 | | 1 | | | | | | | | | | | |
| P3 | | 2 | | | | | | | | | | | |
| P3 | | 3 | | | | | | | | | | | |
| P4 | | 1 | | | | | | | | | | | |
| P4 | | 2 | | | | | | | | | | | |
| P4 | | 3 | | | | | | | | | | | |
| P5 | | 1 | | | | | | | | | | | |
| P5 | | 2 | | | | | | | | | | | |
| P5 | | 3 | | | | | | | | | | | |

After the three runs, ask: "Which of the three would you want by default, and why?" Record it, but
it does not enter the decision.

## Decision rule

Compare `rich` with each of `plain` and `live`, task by task, using medians across people.
**`rich` becomes the documented default for people only if all three hold:**

1. **Not slower on any task.** For each of T1, T2 and T3, `rich`'s median time is no greater than
   `plain`'s and no greater than `live`'s.
2. **No more errors.** `rich`'s total error count is no greater than `plain`'s and no greater than `live`'s.
3. **Uncertainty stated correctly at least as often.** `rich`'s count of T2-uncertainty Y is at
   least `plain`'s and at least `live`'s.

If any one fails, the docs keep `plain` as the recommendation for people and say why, citing the
worksheet. If `live` passes all three against both others instead, report that separately; this
study does not make `live` a default.

With 5–8 people this is a hallway test, not a significance test: report every person's numbers
and the medians, and say so. Record the date, the terminals and the package commit used.

## After the study

- Put the filled worksheet and the decision in `docs/terminal/study-results.md`.
- If the decision changes what the docs recommend, update `packages/terminal/README.md`
  ("Rendering"), the `/terminal/docs` page and `skills/frame12/SKILL.md` in the same change.
