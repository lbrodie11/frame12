'use client';

import * as React from 'react';
import { type MotionMode, useChanged } from '@/hooks/use-on-twos';
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
  ToneSpark,
  Balloon,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/frame12';

type EnvKey = 'prod' | 'stage' | 'dev';

interface EnvPreset {
  label: string;
  endpoint: string;
  deliveryRate: number;
  deliveryDelta: number;
  latencyMs: number;
  latencyDelta: number;
  deliverySpark: number[];
  latencySpark: number[];
  keys: Array<{ id: string; prefix: string; scope: string; created: string; status: string }>;
}

const ENV_PRESETS: Record<EnvKey, EnvPreset> = {
  prod: {
    label: 'Production',
    endpoint: 'https://hooks.atelier-checkout.io/v2/dispatch',
    deliveryRate: 99.6,
    deliveryDelta: 0.012,
    latencyMs: 142,
    latencyDelta: -0.084,
    deliverySpark: [99.1, 99.3, 99.4, 99.2, 99.5, 99.6, 99.7, 99.5, 99.6, 99.8, 99.6, 99.7, 99.6, 99.6],
    latencySpark: [168, 162, 159, 155, 151, 149, 148, 146, 145, 144, 143, 141, 142, 142],
    keys: [
      { id: 'k1', prefix: 'f12_live_98a4…31c0', scope: 'dispatch:write', created: 'Oct 02', status: 'ACTIVE' },
      { id: 'k2', prefix: 'f12_live_41b9…88e2', scope: 'ledger:read', created: 'Sep 14', status: 'ACTIVE' },
      { id: 'k3', prefix: 'f12_live_10f2…77d1', scope: 'webhook:sign', created: 'Aug 19', status: 'STANDBY' },
    ],
  },
  stage: {
    label: 'Staging',
    endpoint: 'https://stage-hooks.atelier-checkout.io/v2/dispatch',
    deliveryRate: 98.2,
    deliveryDelta: 0.004,
    latencyMs: 186,
    latencyDelta: -0.032,
    deliverySpark: [97.4, 97.8, 98.0, 97.9, 98.1, 98.3, 98.0, 98.2, 98.4, 98.1, 98.2, 98.3, 98.2, 98.2],
    latencySpark: [204, 198, 195, 192, 190, 189, 191, 188, 187, 185, 186, 187, 186, 186],
    keys: [
      { id: 'k1', prefix: 'f12_stg_72c1…09a4', scope: 'dispatch:write', created: 'Oct 18', status: 'ACTIVE' },
      { id: 'k2', prefix: 'f12_stg_33d8…54b7', scope: 'ledger:read', created: 'Oct 01', status: 'ACTIVE' },
    ],
  },
  dev: {
    label: 'Sandbox',
    endpoint: 'https://sandbox.atelier-checkout.io/v2/dispatch',
    deliveryRate: 94.8,
    deliveryDelta: -0.015,
    latencyMs: 224,
    latencyDelta: 0.041,
    deliverySpark: [95.2, 94.9, 95.1, 94.0, 94.5, 94.8, 95.0, 94.7, 94.6, 94.9, 94.8, 94.7, 94.8, 94.8],
    latencySpark: [210, 214, 218, 220, 225, 222, 228, 226, 224, 223, 225, 224, 224, 224],
    keys: [
      { id: 'k1', prefix: 'f12_dev_55e0…12f9', scope: 'dispatch:all', created: 'Oct 29', status: 'ACTIVE' },
    ],
  },
};

const ENV_OPTIONS: Array<{ value: EnvKey; label: string; unit: string }> = [
  { value: 'prod', label: 'PROD', unit: 'live' },
  { value: 'stage', label: 'STAGE', unit: 'qa' },
  { value: 'dev', label: 'DEV', unit: 'test' },
];

const MOTION_OPTIONS: Array<{ value: MotionMode; label: string; unit: string }> = [
  { value: 'stepped', label: '12', unit: 'fps' },
  { value: 'smooth', label: '60', unit: 'fps' },
  { value: 'cut', label: 'Cut', unit: '0ms' },
];

export function SettingsScreen({ initialTheme }: { initialTheme?: 'light' | 'dark' }) {
  const [env, setEnv] = React.useState<EnvKey>('prod');
  const [motion, setMotion] = React.useState<MotionMode>('stepped');
  const [theme] = React.useState<'light' | 'dark' | undefined>(initialTheme);
  const [workspaceName, setWorkspaceName] = React.useState<string>('Atelier Koma Checkout');
  const [threshold, setThreshold] = React.useState<string>('15');
  const [channel, setChannel] = React.useState<string>('webhook');
  const [endpoint, setEndpoint] = React.useState<string>(ENV_PRESETS.prod.endpoint);
  const [statusMessage, setStatusMessage] = React.useState<string>('All dispatch rules synchronized');

  const preset = ENV_PRESETS[env];
  const changed = useChanged(env);

  const handleEnvChange = (next: EnvKey) => {
    setEnv(next);
    setEndpoint(ENV_PRESETS[next].endpoint);
    setStatusMessage(`Switched environment to ${ENV_PRESETS[next].label}`);
  };

  const thresholdNum = Number(threshold);
  const thresholdError =
    Number.isNaN(thresholdNum) || thresholdNum < 10
      ? 'Threshold must be at least 10% to prevent alert fatigue'
      : undefined;

  return (
    <main className="eval-screen-root">
      <Sheet motion={motion} theme={theme} id="settings-sheet">
        <header className="f12-hd">
          <div className="f12-hd-text">
            <p className="f12-eyebrow">
              {workspaceName}
              <Tag>{preset.label}</Tag>
              <Badge pop={changed} burst>
                Cut Sheet 01
              </Badge>
            </p>
            <h1 className="f12-title">Workspace &amp; Dispatch Settings</h1>
            <p className="f12-sub" id="settings-status">
              Environment: {preset.label} · {statusMessage}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--f-gutter-pair)',
              alignItems: 'center',
            }}
          >
            <SegmentedControl
              options={ENV_OPTIONS}
              value={env}
              onChange={handleEnvChange}
              ariaLabel="Deployment environment"
              idPrefix="set-env"
            />
            <SegmentedControl
              options={MOTION_OPTIONS}
              value={motion}
              onChange={setMotion}
              ariaLabel="Motion mode"
              idPrefix="set-mo"
            />
          </div>
        </header>

        <Scene gutter="scene" layout="split" id="settings-scene-primary">
          <Panel cut="C-01" label="General profile and alert thresholds">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!thresholdError) {
                  setStatusMessage(`Saved ${preset.label} configuration (${channel})`);
                }
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--f-gutter-scene)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--f-gutter-pair)',
                }}
              >
                <h2 className="f12-m-label">General Profile &amp; Alert Routing</h2>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger id="settings-retry-tooltip">Retry policy</TooltipTrigger>
                    <TooltipContent>
                      Exponential backoff across 5 attempts over 12 minutes
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 'var(--f-gutter-scene)',
                }}
              >
                <Input
                  id="settings-workspace-name"
                  label="Workspace display name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  hint="Printed in outbound dispatch headers and audit logs"
                />
                <Input
                  id="settings-threshold"
                  label="Alert lift threshold (%)"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  error={thresholdError}
                  hint="Minimum conversion drop before paging on-call"
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 'var(--f-gutter-scene)',
                  alignItems: 'start',
                }}
              >
                <Input
                  id="settings-endpoint"
                  label="Webhook endpoint URL"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  hint="Must accept TLS 1.3 POST payloads with HMAC-SHA256 signature"
                />
                <Select
                  id="settings-channel"
                  label="Primary delivery channel"
                  value={channel}
                  onValueChange={(val) => {
                    setChannel(val);
                    setStatusMessage(`Delivery channel updated to ${val}`);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webhook">Signed HTTPS webhook</SelectItem>
                    <SelectItem value="email">Operations digest email</SelectItem>
                    <SelectItem value="incident">Incident room dispatch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--f-gutter-pair)',
                  alignItems: 'center',
                }}
              >
                <Button id="settings-save" type="submit" variant="primary">
                  Save configuration
                </Button>
                <Button
                  id="settings-reset"
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setWorkspaceName('Atelier Koma Checkout');
                    setThreshold('15');
                    setEndpoint(preset.endpoint);
                    setChannel('webhook');
                    setStatusMessage('Restored default workspace parameters');
                  }}
                >
                  Reset defaults
                </Button>
              </div>
            </form>
          </Panel>

          <PanelPair
            id="settings-kpis"
            top={{
              cut: 'C-02',
              label: 'Webhook delivery rate',
              children: (
                <Metric
                  label="Webhook delivery rate"
                  value={preset.deliveryRate}
                  format={(v) => `${v.toFixed(1)}%`}
                  delta={preset.deliveryDelta}
                  deltaKind="pct"
                  comparisonLabel="vs prior 14d"
                  note="Verified 2xx responses within 2,000ms timeout window"
                  motion={motion}
                  spark={
                    <ToneSpark
                      values={preset.deliverySpark}
                      label="14-day delivery success"
                      rangeKey={env}
                      motion={motion}
                    />
                  }
                />
              ),
            }}
            bottom={{
              cut: 'C-03',
              label: 'Mean dispatch latency',
              children: (
                <Metric
                  label="Mean dispatch latency"
                  value={preset.latencyMs}
                  format={(v) => `${Math.round(v)} ms`}
                  delta={preset.latencyDelta}
                  deltaKind="pct"
                  comparisonLabel="vs prior 14d"
                  note="End-to-end roundtrip from trigger event to ACK"
                  motion={motion}
                  spark={
                    <ToneSpark
                      values={preset.latencySpark}
                      label="14-day latency (ms)"
                      rangeKey={env}
                      motion={motion}
                    />
                  }
                />
              ),
            }}
          />
        </Scene>

        <Scene gutter="change" layout="equal" id="settings-scene-secondary">
          <Panel cut="C-04" label="API signing keys">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--f-gutter-pair)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--f-gutter-pair)',
                }}
              >
                <h2 className="f12-m-label">API Signing Keys ({preset.label})</h2>
                <DropdownMenu>
                  <DropdownMenuTrigger id="settings-key-menu" size="sm" variant="secondary">
                    Key actions
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Key ledger</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      id="settings-key-audit"
                      onSelect={() => setStatusMessage('Exported key audit log CSV')}
                    >
                      Export key audit CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      id="settings-key-verify"
                      onSelect={() => setStatusMessage('Verified active HMAC signatures')}
                    >
                      Verify signature chain
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Table>
                <TableCaption>Active HMAC signing keys for {preset.label}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key Prefix</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preset.keys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell>{k.prefix}</TableCell>
                      <TableCell>{k.scope}</TableCell>
                      <TableCell>{k.created}</TableCell>
                      <TableCell>
                        <Tag>{k.status}</Tag>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>Active keys in {preset.label}</TableCell>
                    <TableCell>{preset.keys.length} total</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </Panel>

          <Panel cut="C-05" label="Danger zone and secret rotation">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--f-gutter-scene)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--f-gutter-pair)',
                }}
              >
                <h2 className="f12-m-label">Danger Zone · Secret Rotation</h2>
                <Balloon tailOffset={-10}>Immediate cutoff · 0s grace</Balloon>
              </div>

              <p className="f12-m-note" style={{ maxWidth: '54ch' }}>
                Revoking the active signing secret immediately invalidates in-flight webhook
                headers for {preset.label}. Consumers must load the standby secret before rotation.
              </p>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--f-gutter-pair)',
                  alignItems: 'center',
                }}
              >
                <Dialog>
                  <DialogTrigger id="settings-revoke-open" variant="marker">
                    Revoke active signing secret
                  </DialogTrigger>
                  <DialogContent cut="C-06">
                    <DialogHeader>
                      <DialogTitle>Revoke Active Signing Secret</DialogTitle>
                      <DialogDescription>
                        This action immediately halts unverified webhook deliveries in{' '}
                        {preset.label} ({endpoint}).
                      </DialogDescription>
                    </DialogHeader>
                    <p style={{ margin: 0, fontSize: '14px' }}>
                      Target key: <strong>{preset.keys[0]?.prefix}</strong>
                    </p>
                    <DialogFooter>
                      <DialogClose id="settings-revoke-cancel" variant="secondary">
                        Cancel
                      </DialogClose>
                      <DialogClose
                        id="settings-revoke-confirm"
                        variant="primary"
                        onClick={() =>
                          setStatusMessage(`Revoked signing secret ${preset.keys[0]?.prefix}`)
                        }
                      >
                        Confirm revocation
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </Panel>
        </Scene>
      </Sheet>
    </main>
  );
}
