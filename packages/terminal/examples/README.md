# Reference apps

Three small programs built only on the package's public API (`@frame12/terminal`, `/ink`,
`/process`). They are not published (the package ships `dist/` only). Each runs in all four
renderers with `--format rich|plain|json|live` (default `live` when the terminal allows it) and can
record its run with `--record run.f12rec`. Each has a VHS tape (`demo.tape`; run from
`packages/terminal` with `vhs examples/<app>/demo.tape`).

| App | What it shows |
| --- | --- |
| [`repo-archaeology/`](repo-archaeology/) | A long-running CLI wrapped as a child process, its JSON mapped to findings with receipts |
| [`build-pipeline/`](build-pipeline/) | Real steps through `spawnLogged`; a failure becomes a `danger` panel with its evidence |
| [`agent-approval/`](agent-approval/) | A tool call presented for an explicit y/N decision that never approves by itself |

## Repo Archaeology investigation

```sh
node examples/repo-archaeology/app.mjs --fixture                           # offline, the committed hono fixture
npm i repo-archaeology@0.10.0                                              # or pass --ra <path to its dist/cli.js>
node examples/repo-archaeology/app.mjs --repo ../hono --base 61f7c59~6 --head 61f7c59
```

It wraps the published `repo-archaeology` CLI (pinned **0.10.0**) and reimplements no analysis.
1. `diff --base … --json-out <tmp>` runs with its own progress lines streaming into the log
   (`spawnLogged`).
2. `explain <from> <to> --json` adds counterexamples for the top pair.
3. `adapter.mjs` maps the v1 JSON to one finding per suggestion. The finding's strength is Repo
   Archaeology's co-change confidence with its 95% interval. Its receipts are the evidence
   commits. Its summary quotes the track record as **historical activity, not correctness**,
   within the window Repo Archaeology evaluated.

Repo Archaeology runs with this Node, never through a shell.

**Fixture.** `fixtures/hono-61f7c59.{diff,explain}.json` were generated from
[honojs/hono](https://github.com/honojs/hono) at `61f7c59e50244ab4d2dd83c151928cf7ea448510`
(v4.13.17) with repo-archaeology 0.10.0:

```sh
git clone https://github.com/honojs/hono && cd hono && git checkout 61f7c59
repo-archaeology diff --no-cache --base 61f7c59~6 --head 61f7c59 --json > hono-61f7c59.diff.json
repo-archaeology explain --no-cache --head 61f7c59 src/helper/ssg/ssg.test.tsx src/helper/ssg/index.ts --json > hono-61f7c59.explain.json
```

Absolute paths (`meta.root`) were replaced with `hono`. The adapter tests run against these files.

**Recording.** `fixtures/hono-61f7c59.f12rec` is a real run of this app on the same commit, made
with `--repo hono --base 61f7c59~6 --head 61f7c59 --record` (it contains no local paths). It is
the run on [frame12.dev/terminal](https://frame12.dev/terminal) and run A of the study kit
(`docs/terminal/study.md`). Replay it with
`node dist/cli/bin.js render --from examples/repo-archaeology/fixtures/hono-61f7c59.f12rec --replay`.

## Build pipeline

```sh
node examples/build-pipeline/app.mjs                  # lint → typecheck → test → build, all pass
node examples/build-pipeline/app.mjs --break test     # lint | typecheck | test | build
```

The steps are the scripts of `project/` (a tiny money-formatting module with three tests). Each
step runs for real through `spawnLogged`, with this Node and never a shell, so npm's `.cmd` shims
on Windows don't matter.

A failing step ends its cut as `error` and becomes a `danger` finding. Its receipts are the
evidence: the failing test names and the assertion's expected and actual values, or the lint or
syntax error. They're a keypress away in the live view's Inspector. Later steps are skipped.

**Recording.** `fixtures/break-test.f12rec` is a real run with `--break test --record` (no local
paths). It is the CI run on frame12.dev's `/components/exposure-scrubber` page.

## Agent approval

```sh
node examples/agent-approval/app.mjs                                  # apr-misleading-2500, 30 s to answer
node examples/agent-approval/app.mjs --scenario apr-ordinary-25 --timeout 10
```

The scenarios are FRAME/12's own fixtures (`site/app/experiments/agent-approval/fixtures.ts`),
read as they are, and judged by their own `evaluateApprovalRequest`. The app shows the call's
real arguments, every field that differs from the agent's claims or the trusted records, and
those records. Then it asks.

- **It never approves by itself.** Only `y` approves, and only once; any other key denies.
- **When it denies:** a timeout (`--timeout`, default 30 s), no terminal to ask (stdin isn't a
  TTY, CI, a pipe), or an expired or superseded request. Each says why.
- **Untrusted free text in the arguments (the audit memo) is withheld;** only its length is shown.
  Tokens are masked everywhere else.
- **Exit codes:** 0 approved, 1 denied. When approved, one line of JSON goes to stdout:
  `{"approvalId":…,"approved":true}`.

## Twelve lines

[`hello.ndjson`](hello.ndjson) is a complete run in twelve NDJSON lines (start, two cuts, a
metric, a finding with receipts, a warning, the end, the snapshot), for the `/terminal` page's
Build section: `node dist/cli/bin.js render --from examples/hello.ndjson --strict`.

## Tests

`tests/examples.test.mjs` covers:
- the adapter against the fixture;
- the Repo Archaeology app through a stand-in CLI (the child-process path without network or git);
- every app in the linear formats;
- the approval rules;
- the committed recording and `hello.ndjson` (`--strict`), and the study kit's answer key.

`tests/examples.pty.test.mjs` runs the live views and the approval prompt in a real pty.
