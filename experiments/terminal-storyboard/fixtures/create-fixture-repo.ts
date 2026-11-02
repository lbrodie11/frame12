import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export interface FixtureRepoOptions {
  includeAdversarial?: boolean;
}

export interface FixtureRepoHandle {
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
 * Creates a deterministic temporary git repository with scripted co-change commits:
 * - F-01: src/checkout/session.ts + src/checkout/webhook.ts (6 shared commits)
 * - F-02: src/billing/invoice.ts + src/billing/ledger.ts (4 shared commits)
 * - F-03: src/ui/panel.tsx + src/styles/tokens.css (3 shared commits)
 */
export function createFixtureRepo(options: FixtureRepoOptions = {}): FixtureRepoHandle {
  const repoDir = mkdtempSync(join(tmpdir(), 'f12-storyboard-fixture-'));

  runGitSync(repoDir, ['init']);
  runGitSync(repoDir, ['config', 'user.name', 'FRAME12 Fixture Bot']);
  runGitSync(repoDir, ['config', 'user.email', 'fixture@frame12.local']);
  runGitSync(repoDir, ['config', 'commit.gpgsign', 'false']);

  const commitPlan: Array<{
    files: string[];
    subject: string;
    date: string;
  }> = [
    // 6 commits touching src/checkout/session.ts + src/checkout/webhook.ts
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

    // 4 commits touching src/billing/invoice.ts + src/billing/ledger.ts
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

    // 3 commits touching src/ui/panel.tsx + src/styles/tokens.css
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

  if (options.includeAdversarial) {
    const advFileA = 'src/security/normal-file.ts';
    const advFileB = 'src/security/tag-<img src=x onerror=alert(1)>-\u202Ebidi.ts';
    commitPlan.push(
      {
        files: [advFileA, advFileB],
        subject: 'test(sec): adversarial filename & escape sequence commit 1',
        date: '2026-10-14T10:00:00Z',
      },
      {
        files: [advFileA, advFileB],
        subject: 'test(sec): \x1b]8;;https://evil.example/phish\x07safe-label\x1b]8;;\x07 commit 2',
        date: '2026-10-15T10:00:00Z',
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
    repoDir,
    cleanup: () => {
      rmSync(repoDir, { recursive: true, force: true });
    },
    expectedTopPairs: [
      ['src/checkout/session.ts', 'src/checkout/webhook.ts', 6],
      ['src/billing/invoice.ts', 'src/billing/ledger.ts', 4],
      ['src/styles/tokens.css', 'src/ui/panel.tsx', 3],
    ],
  };
}
