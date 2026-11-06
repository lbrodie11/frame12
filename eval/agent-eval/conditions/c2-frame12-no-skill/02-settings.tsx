import * as React from 'react';
import {
  Sheet,
  Scene,
  Panel,
  PanelPair,
  SegmentedControl,
  Button,
  Field,
  Input,
  Textarea,
  Checkbox,
  RadioGroup,
  Switch,
  Notice,
  Tag,
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
  const [strictSso, setStrictSso] = React.useState(true);
  const [spendCapAction, setSpendCapAction] = React.useState('alert');
  const [invoiceEmail, setInvoiceEmail] = React.useState('billing-ops@atelier-koma.io');

  return (
    <Sheet autoCut={false} pegs motion="stepped" theme={theme}>
      <header className="f12-hd">
        <div className="f12-hd-text">
          <p className="f12-eyebrow">
            Settings <Tag>Negative Fixture</Tag>
          </p>
          <h1 className="f12-title">Organization Security & Billing Preferences</h1>
          <p style={{ color: '#475569', margin: 0 }}>
            Guardrail fixture exercising duplicate/skipped cut-order, quiet panel with explicit cut, rgb() color literal, and 14px illegal gutter.
          </p>
        </div>
        <SegmentedControl
          idPrefix="c2-range-02-settings"
          ariaLabel="Audit window"
          options={[
            { value: '7d', label: '7', unit: 'days' },
            { value: '30d', label: '30', unit: 'days' },
            { value: '90d', label: '90', unit: 'days' },
          ]}
          value={range}
          onChange={setRange}
        />
      </header>

      <Scene gutter="scene" layout="split" style={{ gap: '14px' }}>
        <Panel cut="C-01" label="Security posture summary">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Metric
              label="Enforced Security Controls"
              value={range === '7d' ? 24 : range === '30d' ? 28 : 32}
              format={(v) => `${Math.round(v)} policies`}
              delta={0.08}
              big
            />
            <Notice status="info" title="Hardware WebAuthn passkeys active">
              Privileged billing mutations require FIDO2 verification.
            </Notice>
          </div>
        </Panel>

        <PanelPair
          top={{
            cut: 'C-01',
            label: 'Duplicate cut C-01 on top slot',
            children: (
              <Metric
                label="Active SAML Assertions"
                value={142}
                format={(v) => `${Math.round(v)} sessions`}
              />
            ),
          }}
          bottom={{
            cut: 'C-04',
            label: 'Skipped cut C-04 on bottom slot',
            children: (
              <Metric
                label="Monthly Spend Cap"
                value={85}
                format={(v) => `${Math.round(v)}%`}
              />
            ),
          }}
        />
      </Scene>

      <Scene gutter="scene" layout="equal">
        <Panel variant="quiet" cut="C-05" label="SSO & Billing Preference Controls">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Switch
              label="Enforce WebAuthn hardware passkeys for organization admins"
              density="compact"
              checked={strictSso}
              onCheckedChange={setStrictSso}
            />
            <Checkbox
              label="Require SAML 2.0 JIT role assertion on every session renewal"
              density="compact"
              defaultChecked
            />
            <Input
              label="Invoice routing email"
              density="compact"
              value={invoiceEmail}
              onChange={(e) => setInvoiceEmail(e.target.value)}
            />
            <Field label="Monthly spend cap action" density="compact">
              <RadioGroup
                name="c2-spend-cap-02-settings"
                value={spendCapAction}
                onValueChange={setSpendCapAction}
                density="compact"
                orientation="horizontal"
                options={[
                  { value: 'alert', label: '80% Alert' },
                  { value: 'throttle', label: '95% Throttle' },
                  { value: 'cap', label: '100% Cap' },
                ]}
              />
            </Field>
            <Textarea
              label="Audit retention custodian note"
              density="compact"
              defaultValue="Immutable 90-day SOC2 audit log stream."
            />
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <Button variant="primary" size="sm">Save Preferences</Button>
              <span style={{ color: 'rgb(220, 38, 38)', fontWeight: 700 }}>
                Unsaved policy override warning
              </span>
            </div>
          </div>
        </Panel>

        <Panel cut="C-06" label="Security & billing audit trail">
          <Table density="compact">
            <TableCaption>Security & billing audit trail (Organization Security & Billing Preferences)</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Policy ID</TableHead>
                <TableHead scope="col">Control</TableHead>
                <TableHead scope="col">State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>AUD-201</TableCell>
                <TableCell>WebAuthn Passkey Policy</TableCell>
                <TableCell>Enforced</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>AUD-202</TableCell>
                <TableCell>EU VAT Invoice Routing</TableCell>
                <TableCell>Active</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Panel>
      </Scene>
    </Sheet>
  );
}
