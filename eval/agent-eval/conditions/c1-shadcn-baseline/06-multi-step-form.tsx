import * as React from 'react';

export function EvalScreen({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [windowDays, setWindowDays] = React.useState<'7d' | '30d' | '90d'>('30d');
  const [wizardStep, setWizardStep] = React.useState<'step-1' | 'step-2' | 'step-3'>('step-1');
  const [artifactDigest, setArtifactDigest] = React.useState('sha256:9f84c2a1b07d44e1');
  const [canaryPolicy, setCanaryPolicy] = React.useState<'realtime' | 'staged' | 'manual'>('staged');
  const [runbookNote, setRunbookNote] = React.useState(
    'Verified artifact sha256:9f84c2 across us-east-1 and eu-central-1.',
  );
  const [query, setQuery] = React.useState('');
  const [channel, setChannel] = React.useState<'all' | 'us' | 'eu'>('all');
  const [enforced, setEnforced] = React.useState(true);
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);

  const rows = [
    { id: 'REL-601', name: 'us-east-1 · Canary Ring 0', region: 'us-east-1', metric: '100.0%', status: 'Ready' },
    { id: 'REL-602', name: 'eu-central-1 · Canary Ring 1', region: 'eu-central-1', metric: '99.98%', status: 'Staged' },
    { id: 'REL-603', name: 'ap-northeast-1 · Canary Ring 2', region: 'ap-northeast-1', metric: '99.91%', status: 'Awaiting Signoff' },
  ].filter(
    (r) =>
      (!query ||
        r.name.toLowerCase().includes(query.toLowerCase()) ||
        r.id.toLowerCase().includes(query.toLowerCase())) &&
      (channel === 'all' || r.region.startsWith(channel)),
  );

  return (
    <main className={`b-shell f12-theme-${theme}`} aria-label="Production Deployment & Rollout Wizard">
      <header className="b-header">
        <div>
          <span className="b-badge">Multi-Step Form</span>
          <h1 className="b-title">Production Deployment &amp; Rollout Wizard</h1>
          <p className="b-sub">Conventional shadcn/Tailwind card &amp; table baseline</p>
        </div>
        <div className="b-btn-row" role="group" aria-label="Time window">
          {(['7d', '30d', '90d'] as const).map((w) => (
            <button
              key={w}
              type="button"
              id={`c1-win-${w}`}
              className={`b-btn ${windowDays === w ? 'b-btn-primary' : ''}`}
              aria-pressed={windowDays === w}
              onClick={() => setWindowDays(w)}
            >
              {w.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <div className="b-grid-2">
        <section className="b-card" aria-label="Primary performance summary">
          <p className="b-kpi-label">Pre-Flight Verification Checks (06-multi-step-form)</p>
          <p className="b-kpi-val">{windowDays === '7d' ? '26,110 ops' : windowDays === '30d' ? '92,770 ops' : '278,410 ops'}</p>
          <p className="b-sub">Compared against prior window baseline</p>
          <div className="b-table-wrap" style={{ marginTop: 16 }}>
            <table className="b-table">
              <caption>Canary validation probes trend points</caption>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">Primary Value</th>
                  <th scope="col">Baseline</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Week 1</td><td>4,120</td><td>3,890</td></tr>
                <tr><td>Week 2</td><td>4,680</td><td>4,110</td></tr>
                <tr><td>Week 3</td><td>5,290</td><td>4,450</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <div className="b-card-stack">
          <section className="b-card" aria-label="Secondary metric top">
            <p className="b-kpi-label">P95 Dispatch Latency</p>
            <p className="b-kpi-val">38ms</p>
            <span className="b-badge">-9.4% vs prior</span>
          </section>
          <section className="b-card" aria-label="Secondary metric bottom">
            <p className="b-kpi-label">SLO Availability</p>
            <p className="b-kpi-val">99.96%</p>
            <span className="b-badge">Within budget</span>
          </section>
        </div>
      </div>

      <section className="b-card" aria-label="Three-step production deployment rollout wizard">
        <div className="b-header" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, margin: 0, color: 'var(--b-text)' }}>Three-Step Production Deployment Wizard</h2>
            <p id="eval-wizard-step-indicator" className="b-sub">
              Active wizard stage: {wizardStep.toUpperCase()}
            </p>
          </div>
          <div className="b-btn-row" role="group" aria-label="Wizard step selector">
            {(['step-1', 'step-2', 'step-3'] as const).map((s, idx) => (
              <button
                key={s}
                type="button"
                className={`b-btn ${wizardStep === s ? 'b-btn-primary' : ''}`}
                aria-pressed={wizardStep === s}
                onClick={() => setWizardStep(s)}
              >
                {`Step ${idx + 1}`}
              </button>
            ))}
          </div>
        </div>

        {wizardStep === 'step-1' && (
          <div className="b-field">
            <label className="b-label" htmlFor="c1-artifact-digest">Step 1 · Signed artifact digest</label>
            <input
              id="c1-artifact-digest"
              className="b-input"
              value={artifactDigest}
              onChange={(e) => setArtifactDigest(e.target.value)}
            />
          </div>
        )}
        {wizardStep === 'step-2' && (
          <div className="b-field">
            <label className="b-label" htmlFor="c1-canary-policy">Step 2 · Canary traffic progression policy</label>
            <select
              id="c1-canary-policy"
              className="b-select"
              value={canaryPolicy}
              onChange={(e) => setCanaryPolicy(e.target.value as 'realtime' | 'staged' | 'manual')}
            >
              <option value="realtime">10% Canary · 15m</option>
              <option value="staged">25% Progressive</option>
              <option value="manual">Blue/Green Hold</option>
            </select>
          </div>
        )}
        {wizardStep === 'step-3' && (
          <div className="b-field">
            <label className="b-label" htmlFor="c1-runbook-note">Step 3 · Pre-flight release &amp; rollback runbook note</label>
            <input
              id="c1-runbook-note"
              className="b-input"
              value={runbookNote}
              onChange={(e) => setRunbookNote(e.target.value)}
            />
          </div>
        )}

        <div className="b-header" style={{ marginTop: 12 }}>
          <div className="b-btn-row">
            <button
              id="eval-wizard-prev"
              type="button"
              className="b-btn"
              disabled={wizardStep === 'step-1'}
              onClick={() => setWizardStep((prev) => (prev === 'step-3' ? 'step-2' : 'step-1'))}
            >
              Previous Step
            </button>
            <button
              id="eval-wizard-next"
              type="button"
              className="b-btn b-btn-primary"
              disabled={wizardStep === 'step-3'}
              onClick={() => setWizardStep((prev) => (prev === 'step-1' ? 'step-2' : 'step-3'))}
            >
              Next Step
            </button>
          </div>
          <button
            id="c1-open-confirm-dialog"
            type="button"
            className="b-btn"
            onClick={() => dialogRef.current?.showModal()}
          >
            Confirm Rollout
          </button>
        </div>

        <dialog ref={dialogRef} aria-labelledby="c1-rollout-dialog-title">
          <h3 id="c1-rollout-dialog-title">Confirm production rollout</h3>
          <p>Promote {artifactDigest} across staged canary rings.</p>
          <button type="button" className="b-btn" onClick={() => dialogRef.current?.close()}>
            Close
          </button>
        </dialog>
      </section>

      <section className="b-card" aria-label="Operational configuration and ledger">
        <h2 style={{ fontSize: 18, marginTop: 0, color: 'var(--b-text)' }}>Canary rollout gate verification ledger</h2>
        <div className="b-grid-equal">
          <div className="b-field">
            <label className="b-label" htmlFor="c1-search-06-multi-step-form">Filter records</label>
            <input
              id="c1-search-06-multi-step-form"
              className="b-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by service or SKU..."
            />
          </div>
          <div className="b-field">
            <label className="b-label" htmlFor="c1-channel-06-multi-step-form">Execution scope</label>
            <select
              id="c1-channel-06-multi-step-form"
              className="b-select"
              value={channel}
              onChange={(e) => setChannel(e.target.value as 'all' | 'us' | 'eu')}
            >
              <option value="all">All regions</option>
              <option value="us">US East</option>
              <option value="eu">EU Central</option>
            </select>
          </div>
        </div>
        <div className="b-field">
          <label className="b-label" htmlFor="c1-switch-06-multi-step-form">
            <input
              id="c1-switch-06-multi-step-form"
              type="checkbox"
              checked={enforced}
              onChange={(e) => setEnforced(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Enforce strict schema &amp; signature verification
          </label>
        </div>
        <div className="b-table-wrap">
          <table className="b-table" id="c1-ledger-table-06-multi-step-form">
            <caption>Active operational records</caption>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Service / Cohort</th>
                <th scope="col">Region</th>
                <th scope="col">Throughput</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.name}</td>
                  <td>{r.region}</td>
                  <td>{r.metric}</td>
                  <td><span className="b-badge">{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
