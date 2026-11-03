import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export type FixtureVariant = 'A' | 'B';

export interface FixtureRepoOptions {
  variant?: FixtureVariant;
  includeAdversarial?: boolean;
  includeBulkAndHub?: boolean;
}

export interface FixtureRepoHandle {
  variant: FixtureVariant;
  repoDir: string;
  cleanup: () => void;
  expectedTopPairs: Array<[string, string, number]>;
}

function runGitSync(cwd: string, args: string[], envOverrides?: Record<string, string>): void {
  const res = spawnSync('git', args, {
    cwd,
    shell: false,
    stdio: 'pipe',
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      ...envOverrides,
    },
  });
  if (res.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed (${String(res.status)}): ${res.stderr?.toString('utf8') ?? ''}`,
    );
  }
}

function writeRepoFile(repoDir: string, relPath: string, content: string): void {
  const abs = join(repoDir, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
}

/**
 * Creates a deterministic temporary git repository (Fixture A or Fixture B) with scripted
 * co-change commits, mixed coupling/Jaccard ratios, and optional adversarial filenames/messages:
 *
 * Fixture A (default):
 * - F-01: src/checkout/session.ts + src/checkout/webhook.ts (6 shared, 6/6 & 6/6 -> 100% overlap, 100% Jaccard)
 * - F-02: src/billing/invoice.ts + src/billing/ledger.ts (4 shared, 4/4 & 4/5 -> 100% overlap, 80% Jaccard)
 * - F-03: src/styles/tokens.css + src/ui/panel.tsx (3 shared, 3/4 & 3/4 -> 75% overlap, 60% Jaccard)
 *
 * Fixture B (for counterbalanced usability tasks):
 * - F-01: src/auth/middleware.ts + src/auth/token.ts (5 shared, 5/5 & 5/5 -> 100% overlap, 100% Jaccard)
 * - F-02: src/db/migrations.ts + src/db/schema.ts (4 shared, 4/4 & 4/5 -> 100% overlap, 80% Jaccard)
 * - F-03: src/api/openapi.ts + src/api/router.ts (3 shared, 3/4 & 3/4 -> 75% overlap, 60% Jaccard)
 */
export function createFixtureRepo(
  optionsOrVariant: FixtureRepoOptions | FixtureVariant = {},
): FixtureRepoHandle {
  const options: FixtureRepoOptions =
    typeof optionsOrVariant === 'string'
      ? { variant: optionsOrVariant }
      : optionsOrVariant;
  const variant: FixtureVariant = options.variant ?? 'A';
  const repoDir = mkdtempSync(join(tmpdir(), `f12-storyboard-fixture-${variant.toLowerCase()}-`));

  runGitSync(repoDir, ['init']);
  runGitSync(repoDir, ['config', 'user.name', 'FRAME12 Fixture Bot']);
  runGitSync(repoDir, ['config', 'user.email', 'fixture@frame12.local']);
  runGitSync(repoDir, ['config', 'commit.gpgsign', 'false']);
  runGitSync(repoDir, ['config', 'core.quotepath', 'false']);
  runGitSync(repoDir, ['config', 'core.precomposeUnicode', 'true']);

  const commitPlanA: Array<{
    files: string[];
    subject: string;
    date: string;
  }> = [
    // 6 commits touching src/checkout/session.ts + src/checkout/webhook.ts (100% overlap, 100% Jaccard)
    {
      files: ['src/checkout/session.ts', 'src/checkout/webhook.ts'],
      subject: 'feat(checkout): initialize checkout session and webhook signature handler',
      date: '2026-10-01T10:00:00Z',
    },
    {
      files: ['src/checkout/session.ts', 'src/checkout/webhook.ts'],
      subject: 'fix(checkout): align session metadata with webhook idempotency key',
      date: '2026-10-02T10:00:00Z',
    },
    {
      files: ['src/checkout/session.ts', 'src/checkout/webhook.ts'],
      subject: 'refactor(checkout): sync session expiration state in webhook retry handler',
      date: '2026-10-03T10:00:00Z',
    },
    {
      files: ['src/checkout/session.ts', 'src/checkout/webhook.ts'],
      subject: 'feat(checkout): support multi-currency session totals in webhook payload',
      date: '2026-10-04T10:00:00Z',
    },
    {
      files: ['src/checkout/session.ts', 'src/checkout/webhook.ts'],
      subject: 'fix(checkout): handle delayed webhook settlement for expired sessions',
      date: '2026-10-05T10:00:00Z',
    },
    {
      files: ['src/checkout/session.ts', 'src/checkout/webhook.ts'],
      subject: options.includeAdversarial
        ? 'fix(checkout): \x1b[31mRED_ALERT\x1b[0m \x1b]8;;https://evil.example\x07click-here\x1b]8;;\x07 spoof\roverwrite\b \u202Eevil <script>alert(1)</script>'
        : 'chore(checkout): tighten session and webhook schema validation',
      date: '2026-10-06T10:00:00Z',
    },

    // 4 shared commits touching src/billing/invoice.ts + src/billing/ledger.ts
    {
      files: ['src/billing/invoice.ts', 'src/billing/ledger.ts'],
      subject: 'feat(billing): record double-entry ledger rows on invoice finalization',
      date: '2026-10-07T10:00:00Z',
    },
    {
      files: ['src/billing/invoice.ts', 'src/billing/ledger.ts'],
      subject: 'fix(billing): reconcile invoice credit notes with ledger balance',
      date: '2026-10-08T10:00:00Z',
    },
    {
      files: ['src/billing/invoice.ts', 'src/billing/ledger.ts'],
      subject: 'refactor(billing): unify tax rounding between invoice lines and ledger entries',
      date: '2026-10-09T10:00:00Z',
    },
    {
      files: ['src/billing/invoice.ts', 'src/billing/ledger.ts'],
      subject: 'fix(billing): prevent voided invoices from posting duplicate ledger debits',
      date: '2026-10-10T10:00:00Z',
    },

    // 3 shared commits touching src/ui/panel.tsx + src/styles/tokens.css
    {
      files: ['src/ui/panel.tsx', 'src/styles/tokens.css'],
      subject: 'feat(ui): add manga panel border rules and token variables',
      date: '2026-10-11T10:00:00Z',
    },
    {
      files: ['src/ui/panel.tsx', 'src/styles/tokens.css'],
      subject: 'fix(ui): adjust slanted panel gutter spacing tokens',
      date: '2026-10-12T10:00:00Z',
    },
    {
      files: ['src/ui/panel.tsx', 'src/styles/tokens.css'],
      subject: 'chore(ui): sync dark mode panel surface token with SVG frame stroke',
      date: '2026-10-13T10:00:00Z',
    },
  ];

  const commitPlanB: Array<{
    files: string[];
    subject: string;
    date: string;
  }> = [
    // 5 shared commits: src/auth/middleware.ts + src/auth/token.ts (100% overlap, 100% Jaccard)
    {
      files: ['src/auth/middleware.ts', 'src/auth/token.ts', 'package-lock.json'],
      subject: 'feat(auth): verify JWT claims in route middleware and token helper',
      date: '2026-10-01T10:00:00Z',
    },
    {
      files: ['src/auth/middleware.ts', 'src/auth/token.ts'],
      subject: 'fix(auth): reject expired refresh tokens in auth middleware',
      date: '2026-10-02T10:00:00Z',
    },
    {
      files: ['src/auth/middleware.ts', 'src/auth/token.ts'],
      subject: 'refactor(auth): rotate signing key id across token verifier and middleware',
      date: '2026-10-03T10:00:00Z',
    },
    {
      files: ['src/auth/middleware.ts', 'src/auth/token.ts'],
      subject: 'feat(auth): support audience scoping in token parser and middleware',
      date: '2026-10-04T10:00:00Z',
    },
    {
      files: ['src/auth/middleware.ts', 'src/auth/token.ts'],
      subject: 'chore(auth): tighten clock skew tolerance on token validation',
      date: '2026-10-05T10:00:00Z',
    },
    // 4 shared commits + 1 solo commit on schema.ts (100% overlap, 80% Jaccard)
    {
      files: ['src/db/migrations.ts', 'src/db/schema.ts'],
      subject: 'feat(db): add audit_log table to schema and migration runner',
      date: '2026-10-06T10:00:00Z',
    },
    {
      files: ['src/db/migrations.ts', 'src/db/schema.ts'],
      subject: 'fix(db): align foreign key cascade rule in schema and migration 002',
      date: '2026-10-07T10:00:00Z',
    },
    {
      files: ['src/db/migrations.ts', 'src/db/schema.ts'],
      subject: 'feat(db): add composite index on tenant_id in schema and migrations',
      date: '2026-10-08T10:00:00Z',
    },
    {
      files: ['src/db/migrations.ts', 'src/db/schema.ts'],
      subject: 'chore(db): freeze v1 schema checksum in migration manifest',
      date: '2026-10-09T10:00:00Z',
    },
    {
      files: ['src/db/schema.ts'],
      subject: 'docs(db): document column comments on schema types',
      date: '2026-10-10T10:00:00Z',
    },
    // 3 shared commits + 1 solo commit each on openapi.ts and router.ts (75% overlap, 60% Jaccard)
    {
      files: ['src/api/openapi.ts', 'src/api/router.ts'],
      subject: 'feat(api): register /v1/orders endpoint in router and OpenAPI spec',
      date: '2026-10-11T10:00:00Z',
    },
    {
      files: ['src/api/openapi.ts', 'src/api/router.ts'],
      subject: 'fix(api): match pagination query parameters between router and OpenAPI',
      date: '2026-10-12T10:00:00Z',
    },
    {
      files: ['src/api/openapi.ts', 'src/api/router.ts'],
      subject: 'feat(api): add 429 rate-limit response header to router and OpenAPI',
      date: '2026-10-13T10:00:00Z',
    },
    {
      files: ['src/api/openapi.ts'],
      subject: 'docs(api): refine OpenAPI description examples',
      date: '2026-10-14T10:00:00Z',
    },
    {
      files: ['src/api/router.ts'],
      subject: 'perf(api): cache compiled route regexes in router',
      date: '2026-10-15T10:00:00Z',
    },
  ];

  const commitPlan = variant === 'B' ? [...commitPlanB] : [...commitPlanA];

  if (options.includeBulkAndHub) {
    // Hub-and-spoke: src/core/hub.ts touched 8 times; src/feature/spoke.ts touched 2 times (both with hub.ts -> 100% overlap, 25% Jaccard)
    for (let h = 1; h <= 6; h++) {
      commitPlan.push({
        files: ['src/core/hub.ts', 'package-lock.json'],
        subject: `chore(core): update central hub configuration step ${h}`,
        date: `2026-10-16T0${h}:00:00Z`,
      });
    }
    commitPlan.push(
      {
        files: ['src/core/hub.ts', 'src/feature/spoke.ts'],
        subject: 'feat(spoke): wire spoke feature flag into central hub',
        date: '2026-10-16T07:00:00Z',
      },
      {
        files: ['src/core/hub.ts', 'src/feature/spoke.ts'],
        subject: 'fix(spoke): update spoke fallback default in central hub',
        date: '2026-10-16T08:00:00Z',
      },
    );
  }

  if (options.includeAdversarial) {
    const advFileA = 'src/security/normal-file.ts';
    const advFileB = 'src/security/tag-<img src=x onerror=alert(1)>-\u202Ebidi.ts';
    commitPlan.push(
      {
        files: [advFileA, advFileB],
        subject: 'test(sec): adversarial filename & escape sequence commit 1',
        date: '2026-10-17T10:00:00Z',
      },
      {
        files: [advFileA, advFileB],
        subject: 'test(sec): \x1b]8;;https://evil.example/phish\x07safe-label\x1b]8;;\x07 commit 2',
        date: '2026-10-18T10:00:00Z',
      },
    );
  }

  for (let i = 0; i < commitPlan.length; i++) {
    const step = commitPlan[i]!;
    for (const f of step.files) {
      writeRepoFile(repoDir, f, `// Commit ${i + 1}: ${step.date}\nexport const rev = ${i + 1};\n`);
    }
    runGitSync(repoDir, ['add', '.']);
    runGitSync(repoDir, ['commit', '-m', step.subject], {
      GIT_AUTHOR_DATE: step.date,
      GIT_COMMITTER_DATE: step.date,
    });
  }

  return {
    variant,
    repoDir,
    cleanup: () => {
      rmSync(repoDir, { recursive: true, force: true });
    },
    expectedTopPairs:
      variant === 'B'
        ? [
            ['src/auth/middleware.ts', 'src/auth/token.ts', 5],
            ['src/db/migrations.ts', 'src/db/schema.ts', 4],
            ['src/api/openapi.ts', 'src/api/router.ts', 3],
          ]
        : [
            ['src/checkout/session.ts', 'src/checkout/webhook.ts', 6],
            ['src/billing/invoice.ts', 'src/billing/ledger.ts', 4],
            ['src/styles/tokens.css', 'src/ui/panel.tsx', 3],
          ],
  };
}
