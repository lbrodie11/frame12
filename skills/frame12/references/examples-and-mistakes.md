# FRAME/12 Worked Examples, Common Mistakes & ESLint Config

---

## 1. Worked Example A: SaaS Workspace & Notification Settings

Uses `Sheet`, `Scene`, `Panel`, `PanelPair`, `SegmentedControl`, `Input`, `Select`, `Button`, `Badge`, `Tag`, and a confirmation `Dialog` for destructive actions.

```tsx
import * as React from 'react';
import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Button,
  Badge,
  Tag,
  Metric,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/frame12';
import { type MotionMode, useChanged } from '@/hooks/use-on-twos';

const ENV_OPTIONS = [
  { value: 'prod', label: 'PROD', unit: 'live' },
  { value: 'stage', label: 'STAGE', unit: 'test' },
];

export function WorkspaceSettingsScreen() {
  const [env, setEnv] = React.useState<string>('prod');
  const [motion] = React.useState<MotionMode>('stepped');
  const [workspaceName, setWorkspaceName] = React.useState('Kurokawa Press');
  const [threshold, setThreshold] = React.useState('15');
  const [channel, setChannel] = React.useState('webhook');
  const changed = useChanged(env);

  return (
    <Sheet motion={motion}>
      <header className="hd">
        <div>
          <p className="eyebrow">
            Workspace configuration
            <Tag>{env.toUpperCase()}</Tag>
            <Badge pop={changed} burst>Active sheet</Badge>
          </p>
          <h1 className="title">Dispatch &amp; Alert Settings</h1>
        </div>
        <SegmentedControl
          options={ENV_OPTIONS}
          value={env}
          onChange={setEnv}
          ariaLabel="Environment"
          idPrefix="env"
        />
      </header>

      <Scene gutter="scene" layout="split">
        <Panel cut="C-01" label="General profile and routing">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--f-gutter-scene)' }}>
            <Input
              id="ws-name"
              label="Workspace name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              hint="Displayed on outbound dispatch headers"
            />
            <Input
              id="ws-threshold"
              label="Alert threshold (%)"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              error={Number(threshold) < 10 ? 'Threshold must be at least 10%' : undefined}
              hint="Minimum drop before paging on-call"
            />
            <Select
              id="ws-channel"
              label="Primary delivery channel"
              value={channel}
              onValueChange={setChannel}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="webhook">Signed HTTPS webhook</SelectItem>
                <SelectItem value="email">Operations digest email</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Panel>

        <PanelPair
          top={{
            cut: 'C-02',
            label: 'Webhook delivery rate',
            children: (
              <Metric
                label="Delivery success"
                value={99.4}
                format={(v) => `${v.toFixed(1)}%`}
                delta={0.008}
                deltaKind="pct"
                comparisonLabel="vs prior 7d"
                motion={motion}
              />
            ),
          }}
          bottom={{
            cut: 'C-03',
            label: 'Danger zone',
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--f-gutter-pair)' }}>
                <h3 className="m-label">Danger Zone</h3>
                <p className="m-note">Revoking the signing key immediately halts all webhooks.</p>
                <Dialog>
                  <DialogTrigger id="revoke-open" variant="marker">
                    Rotate signing key
                  </DialogTrigger>
                  <DialogContent cut="C-04">
                    <DialogHeader>
                      <DialogTitle>Rotate Webhook Signing Key</DialogTitle>
                      <DialogDescription>
                        Existing endpoints using the current secret will reject payloads until updated.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose id="revoke-cancel" variant="secondary">Cancel</DialogClose>
                      <DialogClose id="revoke-confirm" variant="primary">Confirm rotation</DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            ),
          }}
        />
      </Scene>
    </Sheet>
  );
}
```

---

## 2. Worked Example B: Product Landing Hero + Feature Breakdown

Uses `Sheet`, `Scene`, `Panel`, `PanelPair`, `Metric`, `ToneAreaChart`, `ToneSpark`, `ToneBarList`, `Balloon`, and `SegmentedControl`.

```tsx
import * as React from 'react';
import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Button,
  Badge,
  Tag,
  Metric,
  ToneAreaChart,
  ToneBarList,
  ToneSpark,
} from '@/components/frame12';
import { useChanged } from '@/hooks/use-on-twos';

export function ProductLandingHero({ series, features }: {
  series: Array<{ label: string; value: number }>;
  features: Array<{ id: string; name: string; value: number; share: number; badge?: string }>;
}) {
  const [windowDays, setWindowDays] = React.useState<number>(30);
  const changed = useChanged(windowDays);

  return (
    <Sheet>
      <header className="hd">
        <div>
          <p className="eyebrow">
            FRAME/12 Production Engine
            <Tag>12 FPS</Tag>
            <Badge pop={changed} burst>On Twos</Badge>
          </p>
          <h1 className="title">Revenue Recovery Drawn in Ink</h1>
          <p className="sub">Deterministic checkout interventions with zero layout shift.</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--f-gutter-pair)', alignItems: 'center' }}>
          <SegmentedControl
            options={[
              { value: 7, label: '7', unit: 'days' },
              { value: 30, label: '30', unit: 'days' },
            ]}
            value={windowDays}
            onChange={setWindowDays}
            ariaLabel="Preview window"
            idPrefix="hero-win"
          />
          <Button variant="primary" size="lg">Start trial sheet</Button>
        </div>
      </header>

      <Scene gutter="scene" layout="split">
        <Panel cut="C-01" label="Live recovery trajectory">
          <Metric
            label="Recovered checkout volume"
            value={148200}
            delta={0.184}
            range={windowDays}
            big
          />
          <ToneAreaChart data={series} seriesLabel="Recovered volume" height={260} />
        </Panel>

        <PanelPair
          top={{
            cut: 'C-02',
            label: 'Net margin retained',
            children: (
              <Metric
                label="Net margin retained"
                value={64100}
                delta={0.142}
                range={windowDays}
                spark={<ToneSpark values={series.map((d) => d.value)} label="Daily margin" />}
              />
            ),
          }}
          bottom={{
            cut: 'C-03',
            label: 'Feature contribution',
            children: (
              <ToneBarList
                title="By capability"
                items={features}
                changed={changed}
                idPrefix="feat"
              />
            ),
          }}
        />
      </Scene>
    </Sheet>
  );
}
```

---

## 3. Worked Example C: Data Table & Filter Ledger

Uses `SegmentedControl` + `Select` + `Input` in an establishing filter/summary scene, paired with a semantic `Table` and row-inspection `Dialog`.

```tsx
import * as React from 'react';
import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Input,
  Metric,
  Tag,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/frame12';

export function LedgerTableScreen({ rows }: {
  rows: Array<{ id: string; orderId: string; channel: string; status: string; amount: number }>;
}) {
  const [status, setStatus] = React.useState<string>('all');
  const [channel, setChannel] = React.useState<string>('all');
  const [query, setQuery] = React.useState<string>('');

  const filtered = rows.filter(
    (r) =>
      (status === 'all' || r.status === status) &&
      (channel === 'all' || r.channel === channel) &&
      (query === '' || r.orderId.toLowerCase().includes(query.toLowerCase())),
  );
  const total = filtered.reduce((acc, r) => acc + r.amount, 0);

  return (
    <Sheet>
      <header className="hd">
        <div>
          <p className="eyebrow">Recovery Ledger <Tag>{filtered.length} rows</Tag></p>
          <h1 className="title">Intervention Dispatch Log</h1>
        </div>
        <SegmentedControl
          options={[
            { value: 'all', label: 'ALL', unit: 'rows' },
            { value: 'recovered', label: 'WON', unit: 'orders' },
            { value: 'pending', label: 'OPEN', unit: 'retry' },
          ]}
          value={status}
          onChange={setStatus}
          ariaLabel="Filter by status"
          idPrefix="status"
        />
      </header>

      <Scene gutter="scene" layout="split">
        <Panel cut="C-01" label="Filter controls and ledger table">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--f-gutter-pair)', marginBottom: 'var(--f-gutter-scene)' }}>
            <Input
              id="ledger-search"
              label="Search order ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ORD-..."
            />
            <Select id="ledger-channel" label="Channel" value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="email">Abandoned-cart email</SelectItem>
                <SelectItem value="exit">Exit-intent offer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableCaption>Filtered intervention dispatches</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.orderId}</TableCell>
                  <TableCell>{r.channel}</TableCell>
                  <TableCell><Tag>{r.status}</Tag></TableCell>
                  <TableCell>${r.amount.toLocaleString('en-US')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Filtered Total</TableCell>
                <TableCell>${total.toLocaleString('en-US')}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Panel>

        <PanelPair
          top={{
            cut: 'C-02',
            label: 'Filtered recovery sum',
            children: <Metric label="Filtered recovery" value={total} />,
          }}
          bottom={{
            cut: 'C-03',
            label: 'Matching dispatches',
            children: (
              <Metric
                label="Matching dispatches"
                value={filtered.length}
                format={(v) => `${Math.round(v)} orders`}
              />
            ),
          }}
        />
      </Scene>
    </Sheet>
  );
}
```

---

## 4. Common Agent Drift Mistakes & Fixes

| Mistake (Drift) | Why It Fails | Correct FRAME/12 Fix |
| --- | --- | --- |
| Writing `style={{ color: '#ef4444', gap: '16px' }}` | Violates Rule 1 (`color-literal`) and Rule 2 (`illegal-gutter`). FRAME/12 is strictly monochrome ink + marker yellow with `12px`/`20px`/`32px` gutters. | Use `var(--f-ink)` / `var(--f-ink-2)` and `gap: 'var(--f-gutter-pair)'` (`12px`) or `'var(--f-gutter-scene)'` (`20px`). Flag errors with `<Input error="..." />` or `<Badge>`. |
| Using `color: 'var(--f-marker)'` or `borderColor: 'var(--f-marker)'` | Violates Rule 4 (`marker-misuse`). Marker yellow (`#ffd60a`) has `1.4:1` contrast against white paper and is illegible as text or line art. | Only use `background: 'var(--f-marker)'` paired with `color: 'var(--f-marker-ink)'`, or use `<Tag>`, `<Badge>`, or `<Button variant="marker">`. |
| Numbering panels `C-01`, `C-03`, `C-02` or starting a second section at `C-01` | Violates Rule 3 (`cut-order`). Storyboard cuts must increment sequentially across the entire screen in DOM order. | Number panels `C-01`, `C-02`, `C-03`, `C-04`… top-to-bottom, left-to-right. |
| Importing `Tabs` or `Card` from `@/components/ui/...` | Violates Rule 5 (`raw-shadcn-import`). Raw shadcn primitives lack `2.5px` mitered polygon frames and 12fps stepped motion. | Replace `Card` with `<Panel cut="C-0X">` and `Tabs` with `<SegmentedControl>`. |
| Animating hover states with `steps(3)` or running `.enter` on initial mount | Violates Rule 5 (Motion on twos). Hover/focus must be instant; initial mount must render at rest. | Keep hover instant (`0ms`) and gate entrance animations with `const changed = useChanged(key)`. |

---

## 5. ESLint Flat-Config Snippet (`skills/frame12/eslint.frame12.mjs`)

Drop `skills/frame12/eslint.frame12.mjs` into your `eslint.config.mjs` to block raw shadcn or Radix imports whenever a FRAME/12 component or adapter exists:

```js
import frame12Config from './skills/frame12/eslint.frame12.mjs';

export default [
  ...frame12Config,
];
```
