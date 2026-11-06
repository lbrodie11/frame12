import * as React from 'react';
import {
  Sheet,
  Scene,
  Panel,
  SegmentedControl,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  Field,
  Input,
  Textarea,
  Checkbox,
  RadioGroup,
  Switch,
  Notice,
  Tag,
  Breadcrumb,
  Metric,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/frame12';

export function EvalScreen({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [range, setRange] = React.useState<'7d' | '30d' | '90d'>('30d');
  const [step, setStep] = React.useState('step-1');
  const [digest, setDigest] = React.useState('sha256:9f84c2a1b0e4');
  const [trafficPolicy, setTrafficPolicy] = React.useState('canary-10');
  const [autoRollback, setAutoRollback] = React.useState(true);

  return (
    <Sheet autoCut pegs motion="stepped" theme={theme}>
      <header className="f12-hd">
        <div className="f12-hd-text">
          <Breadcrumb
            items={[
              { label: 'FRAME/12 Control Plane', href: '#control-plane' },
              { label: 'Multi-Step Form', href: '#category' },
              { label: 'Production Deployment & Rollout Wizard', current: true },
            ]}
          />
          <p className="f12-eyebrow">
            Multi-Step Form <Tag>Negative Fixture</Tag>
          </p>
          <h1 className="f12-title">Production Deployment & Rollout Wizard</h1>
          <p style={{ color: '#334155', margin: 0 }}>
            Guardrail fixture exercising 10px/28px illegal gutters, marker outline misuse, hex error color literal, and explicit cuts inside autoCut.
          </p>
        </div>
        <SegmentedControl
          idPrefix="c2-range-06-multi-step-form"
          ariaLabel="Rollout window"
          options={[
            { value: '7d', label: '7', unit: 'days' },
            { value: '30d', label: '30', unit: 'days' },
            { value: '90d', label: '90', unit: 'days' },
          ]}
          value={range}
          onChange={setRange}
        />
      </header>

      <Scene gutter="scene" layout="split" style={{ gap: '28px' }}>
        <Panel cut="C-01" label="Pre-flight readiness summary">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Metric
              label="Pre-Flight Verification Checks"
              value={range === '7d' ? 18 : range === '30d' ? 42 : 128}
              format={(v) => `${Math.round(v)} checks`}
              delta={0.05}
              big
            />
            <div style={{ outline: '2px solid var(--f-marker)', padding: '8px' }}>
              <span style={{ color: '#ef4444' }}>
                Canary gate warning styled with prohibited hex literal and marker outline
              </span>
            </div>
          </div>
        </Panel>

        <Panel cut="C-02" label="Three-step rollout wizard">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Tabs value={step} onValueChange={setStep} density="compact" idPrefix="c2-wizard-06">
              <TabsList ariaLabel="Rollout wizard steps">
                <TabsTrigger value="step-1">Step 1 · Artifact</TabsTrigger>
                <TabsTrigger value="step-2">Step 2 · Traffic</TabsTrigger>
                <TabsTrigger value="step-3">Step 3 · Signoff</TabsTrigger>
              </TabsList>
              <TabsContent value="step-1">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Notice status="info" title="Step 1: Target OCI Artifact">
                    Verify artifact digest before promoting canary traffic.
                  </Notice>
                  <Input
                    label="Signed artifact digest"
                    density="compact"
                    value={digest}
                    onChange={(e) => setDigest(e.target.value)}
                  />
                </div>
              </TabsContent>
              <TabsContent value="step-2">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Field label="Canary traffic progression policy" density="compact">
                    <RadioGroup
                      name="c2-traffic-06"
                      value={trafficPolicy}
                      onValueChange={setTrafficPolicy}
                      density="compact"
                      orientation="horizontal"
                      options={[
                        { value: 'canary-10', label: '10% Canary' },
                        { value: 'canary-25', label: '25% Progressive' },
                        { value: 'blue-green', label: 'Blue/Green Hold' },
                      ]}
                    />
                  </Field>
                  <Switch
                    label="Auto-rollback if P95 latency exceeds 60ms"
                    density="compact"
                    checked={autoRollback}
                    onCheckedChange={setAutoRollback}
                  />
                </div>
              </TabsContent>
              <TabsContent value="step-3">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Checkbox
                    label="Require dual-operator signoff on production promotion"
                    density="compact"
                    defaultChecked
                  />
                  <Textarea
                    label="Release rollback runbook note"
                    density="compact"
                    defaultValue="Verified artifact sha256:9f84c2 across us-east-1 and eu-central-1."
                  />
                </div>
              </TabsContent>
            </Tabs>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStep((s) => (s === 'step-3' ? 'step-2' : 'step-1'))}
              >
                Previous Step
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setStep((s) => (s === 'step-1' ? 'step-2' : 'step-3'))}
              >
                Next Step
              </Button>
            </div>
          </div>
        </Panel>
      </Scene>

      <Scene gutter="scene" layout="stack">
        <Panel cut="C-03" label="Canary rollout gate verification ledger">
          <Table density="compact">
            <TableCaption>Canary rollout gate verification ledger</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Gate ID</TableHead>
                <TableHead scope="col">Cluster</TableHead>
                <TableHead scope="col">Readiness</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>REL-601</TableCell>
                <TableCell>us-east-1 · Canary Ring 0</TableCell>
                <TableCell>Ready</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Panel>
      </Scene>
    </Sheet>
  );
}
