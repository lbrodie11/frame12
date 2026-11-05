import * as React from 'react';

export function EvalScreen({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [windowDays, setWindowDays] = React.useState<'7d' | '30d' | '90d'>('30d');
  const [query, setQuery] = React.useState('');
  const [channel, setChannel] = React.useState<'all' | 'us' | 'eu'>('all');
  const [enforced, setEnforced] = React.useState(true);

  const rows = [
    { id: 'INC-401', name: 'US-East Primary Gateway', region: 'us-east-1', metric: '99.98%', status: 'Resolved' },
    { id: 'INC-402', name: 'EU-Central Webhook Relay', region: 'eu-central-1', metric: '99.95%', status: 'Monitoring' },
    { id: 'INC-403', name: 'AP-Northeast Fulfillment Sync', region: 'ap-northeast-1', metric: '99.82%', status: 'Mitigating' },
  ].filter(
    (r) =>
      (!query || r.name.toLowerCase().includes(query.toLowerCase())) &&
      (channel === 'all' || r.region.startsWith(channel)),
  );

  return (
    <main className={`b-shell f12-theme-${theme}`} aria-label="Operational Incident & SLO Dashboard">
      <header className="b-header">
        <div>
          <span className="b-badge">Dashboard</span>
          <h1 className="b-title">Operational Incident & SLO Dashboard</h1>
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
          <p className="b-kpi-label">Mean Time to Recovery (MTTR) (01-dashboard)</p>
          <p className="b-kpi-val">{windowDays === '7d' ? '14.2m' : windowDays === '30d' ? '11.8m' : '9.4m'}</p>
          <p className="b-sub">Compared against prior window baseline</p>
          <div className="b-table-wrap" style={{ marginTop: 16 }}>
            <table className="b-table">
              <caption>Error-budget burn rate (ops) trend points</caption>
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
            <p className="b-kpi-val">42ms</p>
            <span className="b-badge">-8.4% vs prior</span>
          </section>
          <section className="b-card" aria-label="Secondary metric bottom">
            <p className="b-kpi-label">SLO Availability</p>
            <p className="b-kpi-val">99.96%</p>
            <span className="b-badge">Within budget</span>
          </section>
        </div>
      </div>

      <section className="b-card" aria-label="Operational configuration and ledger">
        <h2 style={{ fontSize: 18, marginTop: 0, color: 'var(--b-text)' }}>Active incident responder ledger (Operational Incident & SLO Dashboard)</h2>
        <div className="b-grid-equal">
          <div className="b-field">
            <label className="b-label" htmlFor="c1-search-01-dashboard">Filter records</label>
            <input
              id="c1-search-01-dashboard"
              className="b-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by service or SKU..."
            />
          </div>
          <div className="b-field">
            <label className="b-label" htmlFor="c1-channel-01-dashboard">Execution scope</label>
            <select
              id="c1-channel-01-dashboard"
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
          <label className="b-label" htmlFor="c1-switch-01-dashboard">
            <input
              id="c1-switch-01-dashboard"
              type="checkbox"
              checked={enforced}
              onChange={(e) => setEnforced(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Enforce strict schema &amp; signature verification
          </label>
        </div>
        <div className="b-table-wrap">
          <table className="b-table" id="c1-ledger-table-01-dashboard">
            <caption>Active incident responder ledger (Operational Incident & SLO Dashboard)</caption>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Resource</th>
                <th scope="col">Region</th>
                <th scope="col">Attainment</th>
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
