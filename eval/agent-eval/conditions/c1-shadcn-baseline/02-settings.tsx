import * as React from 'react';

export function EvalScreen({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [windowDays, setWindowDays] = React.useState<'7d' | '30d' | '90d'>('30d');
  const [orgName, setOrgName] = React.useState('Atelier Koma Production');
  const [cadence, setCadence] = React.useState<'realtime' | 'daily' | 'weekly'>('daily');
  const [query, setQuery] = React.useState('');
  const [channel, setChannel] = React.useState<'all' | 'us' | 'eu'>('all');
  const [enforced, setEnforced] = React.useState(true);

  const rows = [
    { id: 'AUD-201', name: 'WebAuthn Passkey Policy', region: 'us-east-1', metric: '100.0%', status: 'Enforced' },
    { id: 'AUD-202', name: 'EU VAT Invoice Routing', region: 'eu-central-1', metric: '99.99%', status: 'Active' },
    { id: 'AUD-203', name: 'APAC Spend Cap Alerting', region: 'ap-northeast-1', metric: '99.95%', status: '85% Cap' },
  ].filter(
    (r) =>
      (!query || r.name.toLowerCase().includes(query.toLowerCase())) &&
      (channel === 'all' || r.region.startsWith(channel)),
  );

  return (
    <main className={`b-shell f12-theme-${theme}`} aria-label="Organization Security & Billing Preferences">
      <header className="b-header">
        <div>
          <span className="b-badge">Settings</span>
          <h1 className="b-title">Organization Security &amp; Billing Preferences</h1>
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
          <p className="b-kpi-label">Enforced Security Controls (02-settings)</p>
          <p className="b-kpi-val">{windowDays === '7d' ? '26,110 ops' : windowDays === '30d' ? '92,770 ops' : '278,410 ops'}</p>
          <p className="b-sub">Compared against prior window baseline</p>
          <div className="b-table-wrap" style={{ marginTop: 16 }}>
            <table className="b-table">
              <caption>Verified signing events trend points</caption>
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

        <section className="b-card" aria-label="Workspace security and billing form">
          <h2 style={{ fontSize: 18, marginTop: 0, color: 'var(--b-text)' }}>Security &amp; Billing Configuration</h2>
          <div className="b-field">
            <label className="b-label" htmlFor="c1-org-name-02">Organization display name</label>
            <input
              id="c1-org-name-02"
              className="b-input"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>
          <div className="b-field">
            <label className="b-label" htmlFor="c1-cadence-02">Invoice &amp; audit digest cadence</label>
            <select
              id="c1-cadence-02"
              className="b-select"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as 'realtime' | 'daily' | 'weekly')}
            >
              <option value="realtime">Real-time webhook</option>
              <option value="daily">Daily exposure digest</option>
              <option value="weekly">Weekly rollup</option>
            </select>
          </div>
          <div className="b-btn-row">
            <button type="button" className="b-btn b-btn-primary">Save Preferences</button>
          </div>
        </section>
      </div>

      <section className="b-card" aria-label="Operational configuration and ledger">
        <h2 style={{ fontSize: 18, marginTop: 0, color: 'var(--b-text)' }}>Security &amp; billing audit trail (Organization Security &amp; Billing Preferences)</h2>
        <div className="b-grid-equal">
          <div className="b-field">
            <label className="b-label" htmlFor="c1-search-02-settings">Filter records</label>
            <input
              id="c1-search-02-settings"
              className="b-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by service or SKU..."
            />
          </div>
          <div className="b-field">
            <label className="b-label" htmlFor="c1-channel-02-settings">Execution scope</label>
            <select
              id="c1-channel-02-settings"
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
          <label className="b-label" htmlFor="c1-switch-02-settings">
            <input
              id="c1-switch-02-settings"
              type="checkbox"
              checked={enforced}
              onChange={(e) => setEnforced(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Enforce strict schema &amp; signature verification
          </label>
        </div>
        <div className="b-table-wrap">
          <table className="b-table" id="c1-ledger-table-02-settings">
            <caption>Security &amp; billing audit trail (Organization Security &amp; Billing Preferences)</caption>
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
