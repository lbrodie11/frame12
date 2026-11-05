import * as React from 'react';

export function EvalScreen({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [windowDays, setWindowDays] = React.useState<'7d' | '30d' | '90d'>('30d');
  const [query, setQuery] = React.useState('');
  const [channel, setChannel] = React.useState<'all' | 'us' | 'eu'>('all');
  const [enforced, setEnforced] = React.useState(true);

  const rows = [
    { id: 'SKU-8801', name: 'EWR-01 · Heavy Press Frame', region: 'us-east-1', metric: '99.4%', status: 'In Stock (420)' },
    { id: 'SKU-8802', name: 'FRA-02 · Registration Peg Bar', region: 'eu-central-1', metric: '98.9%', status: 'Allocated (185)' },
    { id: 'SKU-8803', name: 'NRT-01 · Screentone Sheet B4', region: 'ap-northeast-1', metric: '94.2%', status: 'Low Stock (19)' },
  ].filter(
    (r) =>
      (!query || r.name.toLowerCase().includes(query.toLowerCase())) &&
      (channel === 'all' || r.region.startsWith(channel)),
  );

  return (
    <main className={`b-shell f12-theme-${theme}`} aria-label="Multi-Region Inventory & Fulfillment Ledger">
      <header className="b-header">
        <div>
          <span className="b-badge">Data-Heavy View</span>
          <h1 className="b-title">Multi-Region Inventory & Fulfillment Ledger</h1>
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
          <p className="b-kpi-label">Regional Units Fulfilled (04-data-heavy)</p>
          <p className="b-kpi-val">{windowDays === '7d' ? '14.2m' : windowDays === '30d' ? '11.8m' : '9.4m'}</p>
          <p className="b-sub">Compared against prior window baseline</p>
          <div className="b-table-wrap" style={{ marginTop: 16 }}>
            <table className="b-table">
              <caption>Fulfilled SKU units trend points</caption>
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
        <h2 style={{ fontSize: 18, marginTop: 0, color: 'var(--b-text)' }}>High-density SKU allocation table (Multi-Region Inventory & Fulfillment Ledger)</h2>
        <div className="b-grid-equal">
          <div className="b-field">
            <label className="b-label" htmlFor="c1-search-04-data-heavy">Filter records</label>
            <input
              id="c1-search-04-data-heavy"
              className="b-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by service or SKU..."
            />
          </div>
          <div className="b-field">
            <label className="b-label" htmlFor="c1-channel-04-data-heavy">Execution scope</label>
            <select
              id="c1-channel-04-data-heavy"
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
          <label className="b-label" htmlFor="c1-switch-04-data-heavy">
            <input
              id="c1-switch-04-data-heavy"
              type="checkbox"
              checked={enforced}
              onChange={(e) => setEnforced(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Enforce strict schema &amp; signature verification
          </label>
        </div>
        <div className="b-table-wrap">
          <table className="b-table" id="c1-ledger-table-04-data-heavy">
            <caption>High-density SKU allocation table (Multi-Region Inventory & Fulfillment Ledger)</caption>
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
