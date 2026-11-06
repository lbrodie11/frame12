import * as React from 'react';

export function EvalScreen({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [windowDays, setWindowDays] = React.useState<'7d' | '30d' | '90d'>('30d');
  const [planTier, setPlanTier] = React.useState<'starter' | 'growth' | 'enterprise'>('growth');
  const [query, setQuery] = React.useState('');
  const [channel, setChannel] = React.useState<'all' | 'us' | 'eu'>('all');
  const [enforced, setEnforced] = React.useState(true);

  const rows = [
    { id: 'POP-501', name: 'IAD-01 · Virginia Edge PoP', region: 'us-east-1', metric: '99.99%', status: 'GA Tier-1' },
    { id: 'POP-502', name: 'FRA-01 · Frankfurt Edge PoP', region: 'eu-central-1', metric: '99.99%', status: 'GA Tier-1' },
    { id: 'POP-503', name: 'HND-01 · Tokyo Edge PoP', region: 'ap-northeast-1', metric: '99.98%', status: 'GA Tier-1' },
  ].filter(
    (r) =>
      (!query || r.name.toLowerCase().includes(query.toLowerCase())) &&
      (channel === 'all' || r.region.startsWith(channel)),
  );

  return (
    <main className={`b-shell f12-theme-${theme}`} aria-label="Developer Platform Product Launch & Pricing Page">
      <header className="b-header">
        <div>
          <span className="b-badge">Landing Page</span>
          <h1 className="b-title">Developer Platform Product Launch &amp; Pricing Page</h1>
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
          <p className="b-kpi-label">Verified Edge Benchmark Throughput (05-landing-page)</p>
          <p className="b-kpi-val">{windowDays === '7d' ? '26,110 ops' : windowDays === '30d' ? '92,770 ops' : '278,410 ops'}</p>
          <p className="b-sub">Compared against prior window baseline</p>
          <div className="b-table-wrap" style={{ marginTop: 16 }}>
            <table className="b-table">
              <caption>Benchmark req/s trend points</caption>
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

      <section className="b-card" aria-label="Plan comparison matrix and tier pricing">
        <div className="b-header" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, margin: 0, color: 'var(--b-text)' }}>Seat &amp; Volume Pricing Tiers</h2>
            <p id="eval-active-tier-summary" className="b-sub">
              {planTier === 'starter'
                ? 'Starter Tier · $49/mo · Up to 5 seats & 1M events/mo'
                : planTier === 'growth'
                  ? 'Growth Tier · $249/mo · Up to 25 seats & 25M events/mo'
                  : 'Enterprise Tier · $990/mo · Unlimited seats & 250M+ events/mo'}
            </p>
          </div>
          <div className="b-btn-row" role="group" aria-label="Seat and volume pricing tier">
            {([
              { value: 'starter', label: 'START (5)' },
              { value: 'growth', label: 'GROW (25)' },
              { value: 'enterprise', label: 'ENT (max)' },
            ] as const).map((tier) => (
              <button
                key={tier.value}
                type="button"
                id={`eval-tier-05-landing-page-${tier.value}`}
                className={`b-btn ${planTier === tier.value ? 'b-btn-primary' : ''}`}
                aria-pressed={planTier === tier.value}
                onClick={() => setPlanTier(tier.value)}
              >
                {tier.label}
              </button>
            ))}
          </div>
        </div>
        <div className="b-table-wrap">
          <table className="b-table" id="eval-plan-comparison-table">
            <caption>Plan comparison matrix across Starter, Growth, and Enterprise tiers</caption>
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">Starter ($49/mo)</th>
                <th scope="col">Growth ($249/mo)</th>
                <th scope="col">Enterprise ($990/mo)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Included Operator Seats</td>
                <td>5 seats</td>
                <td>25 seats</td>
                <td>Unlimited</td>
              </tr>
              <tr>
                <td>Monthly Committed Volume</td>
                <td>1,000,000 reqs</td>
                <td>25,000,000 reqs</td>
                <td>250,000,000+ reqs</td>
              </tr>
              <tr>
                <td>Global Edge P95 SLA</td>
                <td>&lt; 45ms</td>
                <td>&lt; 25ms</td>
                <td>&lt; 15ms Dedicated</td>
              </tr>
              <tr>
                <td>Audit Log Retention</td>
                <td>30 days</td>
                <td>90 days</td>
                <td>365 days (Immutable)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="b-card" aria-label="Operational configuration and ledger">
        <h2 style={{ fontSize: 18, marginTop: 0, color: 'var(--b-text)' }}>Regional PoP benchmark verification ledger</h2>
        <div className="b-grid-equal">
          <div className="b-field">
            <label className="b-label" htmlFor="c1-search-05-landing-page">Filter records</label>
            <input
              id="c1-search-05-landing-page"
              className="b-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by service or SKU..."
            />
          </div>
          <div className="b-field">
            <label className="b-label" htmlFor="c1-channel-05-landing-page">Execution scope</label>
            <select
              id="c1-channel-05-landing-page"
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
          <label className="b-label" htmlFor="c1-switch-05-landing-page">
            <input
              id="c1-switch-05-landing-page"
              type="checkbox"
              checked={enforced}
              onChange={(e) => setEnforced(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Enforce strict schema &amp; signature verification
          </label>
        </div>
        <div className="b-table-wrap">
          <table className="b-table" id="c1-ledger-table-05-landing-page">
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
