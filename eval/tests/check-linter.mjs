// Unit and CLI tests for scripts/check-frame12.mjs
// Verifies that every violation rule (color-literal, illegal-gutter, marker-misuse,
// cut-order, raw-shadcn-import) is caught and that compliant code passes cleanly.

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintSource } from '../../scripts/check-frame12.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const CHECKER_PATH = resolve(REPO_ROOT, 'scripts/check-frame12.mjs');

let failures = 0;
function check(ok, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
}

// 1. Compliant FRAME/12 screen passes with 0 violations
{
  const cleanCode = `
    import * as React from 'react';
    import { Sheet, Scene, Panel, PanelPair, Button, Badge, Tag } from '@/components/frame12';

    export function CleanScreen() {
      return (
        <Sheet>
          <Scene gutter="scene" layout="split">
            <Panel cut="C-01" label="Primary panel">
              <div style={{ display: 'flex', gap: 'var(--f-gutter-pair)', color: 'var(--f-ink)' }}>
                <span style={{ background: 'var(--f-marker)', color: 'var(--f-marker-ink)' }}>
                  Highlighted
                </span>
                <Button variant="primary">Save</Button>
              </div>
            </Panel>
            <PanelPair
              top={{ cut: 'C-02', label: 'Top KPI', children: <Tag>OK</Tag> }}
              bottom={{ cut: 'C-03', label: 'Bottom KPI', children: <Badge>99%</Badge> }}
            />
          </Scene>
        </Sheet>
      );
    }
  `;
  const res = lintSource(cleanCode, 'eval/screens/clean.tsx');
  check(res.length === 0, 'linter: clean FRAME/12 component passes with 0 violations', JSON.stringify(res));
}

// 2. Rule 1: color-literal
{
  const hexCode = `export const Box = () => <div style={{ color: '#ef4444', background: 'rgb(10, 20, 30)' }} />;`;
  const res = lintSource(hexCode, 'eval/screens/bad-color.tsx');
  const rules = res.map((v) => v.rule);
  check(
    res.length === 2 && rules.every((r) => r === 'color-literal'),
    'linter [color-literal]: flags hex (#ef4444) and rgb(...) literals in TSX',
  );

  const fontCode = `.bad { font-family: "Dela Gothic One", sans-serif; color: hsl(120, 50%, 50%); }`;
  const resCss = lintSource(fontCode, 'eval/screens/bad.css');
  check(
    resCss.length === 2 && resCss.every((v) => v.rule === 'color-literal'),
    'linter [color-literal]: flags hard-coded font family and hsl(...) in CSS outside token files',
  );

  const tokenRes = lintSource(`:root { --f-ink: #121212; }`, 'registry/styles/frame12.css');
  const tokenStandaloneRes = lintSource(
    `:root { --f-ink: #121212; }`,
    'registry/styles/frame12-tokens.css',
  );
  check(
    tokenRes.length === 0 && tokenStandaloneRes.length === 0,
    'linter [color-literal]: exempts token files frame12.css and frame12-tokens.css',
  );

  const urlThenHexCode = `const url = "https://example.com"; const bad = "#ff0000";`;
  const resUrlHex = lintSource(urlThenHexCode, 'eval/screens/url-hex.tsx');
  check(
    resUrlHex.length === 1 && resUrlHex[0].rule === 'color-literal' && resUrlHex[0].snippet === '#ff0000',
    'linter [color-literal]: preserves string literals containing "https://" and flags #ff0000 on the same line',
  );

  const namedGradientCode = `.grad { background: linear-gradient(to right, red, blue); }`;
  const resGrad = lintSource(namedGradientCode, 'eval/screens/bad-grad.css');
  check(
    resGrad.length === 1 && resGrad[0].rule === 'color-literal',
    'linter [color-literal]: flags named-color CSS linear-gradient(to right, red, blue)',
  );
}

// 3. Rule 2: illegal-gutter
{
  const badSceneGutter = `
    import { Scene } from '@frame12/registry';
    export const S = () => <Scene gutter="wide" layout="split"><div style={{ gap: '16px' }} /></Scene>;
  `;
  const res = lintSource(badSceneGutter, 'eval/screens/bad-gutter.tsx');
  check(
    res.length === 2 && res.every((v) => v.rule === 'illegal-gutter'),
    'linter [illegal-gutter]: flags invalid <Scene gutter="wide"> and inline gap: "16px"',
  );

  const badTailwindGap = `export const G = () => <div className="grid gap-4 gap-x-6" />;`;
  const resTw = lintSource(badTailwindGap, 'eval/screens/bad-tw-gap.tsx');
  check(
    resTw.length === 2 && resTw.every((v) => v.rule === 'illegal-gutter'),
    'linter [illegal-gutter]: flags Tailwind gap-4 and gap-x-6 classes',
  );

  const badCnGap = `export const G2 = () => <div className={cn('grid gap-4', active && \`flex gap-2\`)} />;`;
  const resCnTw = lintSource(badCnGap, 'eval/screens/bad-cn-gap.tsx');
  check(
    resCnTw.length === 2 && resCnTw.every((v) => v.rule === 'illegal-gutter'),
    'linter [illegal-gutter]: flags Tailwind gap-4 inside className={cn(...)} and template literals',
  );

  const goodGutters = `
    export const Ok = () => (
      <div className="gap-gutter-pair gap-[20px]" style={{ gap: '12px 20px', rowGap: 'var(--f-gutter-change)' }} />
    );
  `;
  const resGood = lintSource(goodGutters, 'eval/screens/good-gutter.tsx');
  check(resGood.length === 0, 'linter [illegal-gutter]: allows 12px, 20px, 32px, and --f-gutter-* tokens');
}

// 4. Rule 3: marker-misuse
{
  const badMarkerProp = `
    export const M = () => (
      <div style={{ color: 'var(--f-marker)', borderColor: 'var(--f-marker)' }}>
        <svg><path stroke="var(--f-marker)" /></svg>
      </div>
    );
  `;
  const res = lintSource(badMarkerProp, 'eval/screens/bad-marker.tsx');
  check(
    res.length === 3 && res.every((v) => v.rule === 'marker-misuse'),
    'linter [marker-misuse]: flags --f-marker on color, borderColor, and SVG stroke',
  );

  const badMarkerUnpairedBg = `
    export const M2 = () => <span style={{ background: 'var(--f-marker)', color: 'var(--f-ink)' }}>Warn</span>;
  `;
  const resUnpaired = lintSource(badMarkerUnpairedBg, 'eval/screens/bad-marker-bg.tsx');
  check(
    resUnpaired.length === 1 && resUnpaired[0].rule === 'marker-misuse',
    'linter [marker-misuse]: flags --f-marker background when not paired with --f-marker-ink text',
  );
}

// 5. Rule 4: cut-order
{
  const dupAndOutOfOrder = `
    import { Panel } from '@frame12/registry';
    export const C = () => (
      <>
        <Panel cut="C-01">First</Panel>
        <Panel cut="C-03">Skipped C-02</Panel>
        <Panel cut="C-03">Duplicate C-03</Panel>
      </>
    );
  `;
  const res = lintSource(dupAndOutOfOrder, 'eval/screens/bad-cuts.tsx');
  check(
    res.length === 2 && res.every((v) => v.rule === 'cut-order'),
    'linter [cut-order]: flags skipped cut (C-01 -> C-03) and duplicate cut (C-03)',
  );

  const wrongStartAndFormat = `
    import { Panel } from '@frame12/registry';
    export const C2 = () => (
      <>
        <Panel cut="C-02">Starts at 2</Panel>
        <Panel cut="C-3">Malformed single digit</Panel>
      </>
    );
  `;
  const res2 = lintSource(wrongStartAndFormat, 'eval/screens/bad-cuts-2.tsx');
  check(
    res2.length === 2 && res2.every((v) => v.rule === 'cut-order'),
    'linter [cut-order]: flags non-C-01 start and malformed C-3 label',
  );

  const explicitInAutoCut = `
    import { Sheet, Panel, PanelPair, Dialog, DialogContent } from '@/components/frame12';
    export const AutoBad = () => (
      <Sheet autoCut>
        <Panel cut="C-01" label="First">One</Panel>
        <Panel cut={'C-02'} label="Second">Two</Panel>
        <PanelPair
          topCut="C-03"
          bottom={{ cut: 'C-04', label: 'Bottom', children: 'Four' }}
        />
        <Dialog>
          <DialogContent cut="C-05">Allowed on DialogContent</DialogContent>
        </Dialog>
      </Sheet>
    );
  `;
  const resAutoBad = lintSource(explicitInAutoCut, 'eval/screens/bad-autocut.tsx');
  check(
    resAutoBad.length === 4 &&
      resAutoBad.every(
        (v) =>
          v.rule === 'explicit-cut-in-autocut' &&
          v.message === 'Cut numbers are automatic inside <Sheet autoCut>; remove the cut prop.',
      ),
    'linter [explicit-cut-in-autocut]: flags cut="...", cut={\'...\'}, topCut="...", and cut: \'...\' inside <Sheet autoCut> while allowing DialogContent cut',
    JSON.stringify(resAutoBad),
  );

  const cleanAutoCut = `
    import { Sheet, Panel, PanelPair, Dialog, DialogContent } from '@/components/frame12';
    export const AutoGood = () => (
      <Sheet autoCut>
        <Panel label="First">One</Panel>
        <Panel cut={false} label="Unnumbered">Skip</Panel>
        <PanelPair topLabel="Top" bottomLabel="Bottom">
          <div>Two</div>
          <div>Three</div>
        </PanelPair>
        <Dialog>
          <DialogContent cut="C-04">Dialog cut stays explicit</DialogContent>
        </Dialog>
      </Sheet>
    );
  `;
  const resAutoGood = lintSource(cleanAutoCut, 'eval/screens/good-autocut.tsx');
  check(
    resAutoGood.length === 0,
    'linter [explicit-cut-in-autocut]: clean <Sheet autoCut> with cut={false} and DialogContent cut passes with 0 violations',
    JSON.stringify(resAutoGood),
  );

  const nestedSheetScope = `
    import { Sheet, Panel } from '@/components/frame12';
    export const NestedSheets = () => (
      <Sheet autoCut>
        <Panel label="Auto outer">One</Panel>
        <Sheet>
          <Panel cut="C-01" label="Explicit inside nested non-auto Sheet">Inner 1</Panel>
          <Panel cut="C-02" label="Explicit inside nested non-auto Sheet">Inner 2</Panel>
        </Sheet>
      </Sheet>
    );
  `;
  const resNestedScope = lintSource(nestedSheetScope, 'eval/screens/nested-sheets.tsx');
  check(
    resNestedScope.length === 0,
    'linter [explicit-cut-in-autocut]: nested non-auto <Sheet> inside <Sheet autoCut> permits sequential explicit cuts',
    JSON.stringify(resNestedScope),
  );

  const callbackArrowInTags = `
    import { Sheet, Panel, Dialog, DialogContent } from '@/components/frame12';
    export const CallbackTags = () => (
      <Sheet onClick={() => {}} autoCut>
        <Panel onClick={() => {}} cut="C-01" label="Should fail">One</Panel>
        <Dialog>
          <DialogContent onClick={() => {}} cut="C-08">Allowed after arrow callback</DialogContent>
        </Dialog>
      </Sheet>
    );
  `;
  const resCallbackTags = lintSource(callbackArrowInTags, 'eval/screens/callback-tags.tsx');
  check(
    resCallbackTags.length === 1 &&
      resCallbackTags[0].rule === 'explicit-cut-in-autocut' &&
      resCallbackTags[0].snippet === 'cut="C-01"',
    'linter [explicit-cut-in-autocut]: brace-aware JSX scanning detects autoCut after onClick={() => {}} on <Sheet> and allows cut after onClick={() => {}} on <DialogContent>',
    JSON.stringify(resCallbackTags),
  );

  const quotedSheetInsideAutoCut = `
    import { Sheet, Panel } from '@/components/frame12';
    export const QuotedSheetInAuto = () => (
      <Sheet autoCut>
        <code>{"<Sheet>"}</code>
        <Panel cut="C-01" label="Must still fail inside autoCut">One</Panel>
      </Sheet>
    );
  `;
  const resQuotedInAuto = lintSource(quotedSheetInsideAutoCut, 'eval/screens/quoted-in-auto.tsx');
  check(
    resQuotedInAuto.length === 1 &&
      resQuotedInAuto[0].rule === 'explicit-cut-in-autocut' &&
      resQuotedInAuto[0].snippet === 'cut="C-01"',
    'linter [explicit-cut-in-autocut]: quoted {"<Sheet>"} string inside <Sheet autoCut> does not clobber autoCut scope',
    JSON.stringify(resQuotedInAuto),
  );

  const quotedAutoCutOutside = `
    import { Sheet, Panel } from '@/components/frame12';
    const help = "<Sheet autoCut>";
    export const QuotedAutoOutside = () => (
      <Sheet title={help}>
        <Panel cut="C-01" label="Allowed outside autoCut">One</Panel>
      </Sheet>
    );
  `;
  const resQuotedOutside = lintSource(quotedAutoCutOutside, 'eval/screens/quoted-outside.tsx');
  check(
    resQuotedOutside.length === 0,
    'linter [explicit-cut-in-autocut]: quoted "<Sheet autoCut>" string does not falsely activate autoCut scope',
    JSON.stringify(resQuotedOutside),
  );

  const spreadDialogAndPanelInAutoCut = `
    import { Sheet, Panel, Dialog, DialogContent } from '@/components/frame12';
    export const SpreadInAuto = () => (
      <Sheet autoCut>
        <Dialog>
          <DialogContent {...{ cut: 'C-08' }}>Allowed spread cut on DialogContent</DialogContent>
        </Dialog>
        <Panel {...{ cut: 'C-01' }} label="Forbidden spread cut on Panel">One</Panel>
      </Sheet>
    );
  `;
  const resSpreadInAuto = lintSource(spreadDialogAndPanelInAutoCut, 'eval/screens/spread-in-auto.tsx');
  check(
    resSpreadInAuto.length === 1 &&
      resSpreadInAuto[0].rule === 'explicit-cut-in-autocut' &&
      resSpreadInAuto[0].snippet === "cut: 'C-01'",
    'linter [explicit-cut-in-autocut]: resolves innermost enclosing tag for spread properties ({...{ cut: "C-08" }} exempt on DialogContent, flagged on Panel)',
    JSON.stringify(resSpreadInAuto),
  );

  const jsxProseAndRegexQuotes = `
    import { Sheet, Panel } from '@/components/frame12';
    const hasDoubleQuote = /"/.test('x');
    const fakeSheetRegex = /<Sheet autoCut>/;
    export const ProseAndRegexInAuto = () => (
      <Sheet autoCut>
        <p>'Tis ready for inspection</p>
        {/"/.test('x') && <Panel cut="C-01" label="Must fail after prose quote and regex literal">One</Panel>}
      </Sheet>
    );
    export const ProseAndRegexLegacy = () => (
      <Sheet title={String(hasDoubleQuote && fakeSheetRegex)}>
        <p>'Tis legacy sheet</p>
        <Panel cut="C-02" label="Must fail cut-order starting at C-02">Two</Panel>
      </Sheet>
    );
  `;
  const resProseAndRegex = lintSource(jsxProseAndRegexQuotes, 'eval/screens/prose-regex.tsx');
  check(
    resProseAndRegex.length === 2 &&
      resProseAndRegex[0].rule === 'explicit-cut-in-autocut' &&
      resProseAndRegex[0].snippet === 'cut="C-01"' &&
      resProseAndRegex[1].rule === 'cut-order' &&
      resProseAndRegex[1].snippet === 'cut="C-02"',
    'linter [cut-order & explicit-cut-in-autocut]: distinguishes JSX text quotes (<p>\'Tis ready</p>) and regex literals (/"/.test(\'x\')) from JS strings',
    JSON.stringify(resProseAndRegex),
  );

  const selfClosingSheetChildren = `
    import { Sheet, Panel } from '@/components/frame12';
    export const SelfClosingAuto = () => (
      <Sheet autoCut children={<Panel cut="C-01" label="Forbidden in self-closing autoCut Sheet" />} />
    );
    export const SelfClosingNestedNonAuto = () => (
      <Sheet autoCut>
        <Sheet children={<Panel cut="C-01" label="Allowed in nested self-closing non-auto Sheet" />} />
      </Sheet>
    );
  `;
  const resSelfClosingSheet = lintSource(
    selfClosingSheetChildren,
    'eval/screens/self-closing-sheet.tsx',
  );
  check(
    resSelfClosingSheet.length === 1 &&
      resSelfClosingSheet[0].rule === 'explicit-cut-in-autocut' &&
      resSelfClosingSheet[0].line === 4,
    'linter [explicit-cut-in-autocut]: tracks self-closing <Sheet> boundaries for JSX-valued children props in both directions',
    JSON.stringify(resSelfClosingSheet),
  );

  const noWhitespaceReturnAndUnrelatedMarkup = `
    import { Sheet, Panel } from '@/components/frame12';
    const Clip = (_props: { cut?: string }) => null;
    export function NoSpaceReturn() {
      return<Sheet autoCut>
        <Clip cut="C-01" />
        <div data-cut="C-01" />
        <Panel cut="C-01" label="Forbidden on Panel">One</Panel>
      </Sheet>;
    }
  `;
  const resNoSpaceAndUnrelated = lintSource(
    noWhitespaceReturnAndUnrelatedMarkup,
    'eval/screens/no-space-unrelated.tsx',
  );
  check(
    resNoSpaceAndUnrelated.length === 1 &&
      resNoSpaceAndUnrelated[0].rule === 'explicit-cut-in-autocut' &&
      resNoSpaceAndUnrelated[0].line === 8,
    'linter [explicit-cut-in-autocut]: TypeScript AST handles return<Sheet autoCut> without whitespace and ignores unrelated <Clip cut="C-01" /> and <div data-cut="C-01" />',
    JSON.stringify(resNoSpaceAndUnrelated),
  );

  const localPropConstantsInAutoAndLegacy = `
    import { Sheet, Panel, PanelPair } from '@/components/frame12';
    const topAuto = { cut: 'C-02', label: 'Top', children: 'Top' };
    export const LocalConstInAuto = () => (
      <Sheet autoCut>
        <PanelPair top={topAuto} bottom={{ label: 'Bottom', children: 'Bottom' }} />
      </Sheet>
    );
    const topValid = { cut: 'C-02', label: 'Top', children: 'Top' };
    export const LocalConstMixedValid = () => (
      <Sheet>
        <Panel cut="C-01">First</Panel>
        <PanelPair top={topValid} bottom={{ cut: 'C-03', label: 'Bottom', children: 'Bottom' }} />
      </Sheet>
    );
  `;
  const resLocalConst = lintSource(
    localPropConstantsInAutoAndLegacy,
    'eval/screens/local-const-cuts.tsx',
  );
  check(
    resLocalConst.length === 1 &&
      resLocalConst[0].rule === 'explicit-cut-in-autocut' &&
      resLocalConst[0].snippet === "cut: 'C-02'",
    'linter [cut-order & explicit-cut-in-autocut]: resolves local prop object constants (PanelPair top={top}) at JSX use sites in DOM order',
    JSON.stringify(resLocalConst),
  );

  const quietPanelsInNarrativeSheet = `
    export const QuietAndNarrative = () => (
      <Sheet>
        <Panel cut="C-01" label="Hero">Hero</Panel>
        <Panel variant="quiet" label="Subordinate filter ledger">Quiet subgroup</Panel>
        <Panel cut="C-02" label="Secondary">Secondary</Panel>
        <Panel variant="quiet" cut="C-03" label="Invalid numbered quiet panel">Bad</Panel>
      </Sheet>
    );
  `;
  const resQuiet = lintSource(
    quietPanelsInNarrativeSheet,
    'eval/screens/quiet-and-narrative.tsx',
  );
  check(
    resQuiet.length === 1 &&
      resQuiet[0].rule === 'cut-order' &&
      resQuiet[0].message.includes('Quiet panels (<Panel variant="quiet">)') &&
      resQuiet[0].snippet === 'cut="C-03"',
    'linter [cut-order]: allows unnumbered <Panel variant="quiet"> subgroups between C-01 and C-02 and flags explicit cut on variant="quiet"',
    JSON.stringify(resQuiet),
  );

  // 5b. Effective variant resolution across spreads, nested spreads, and PanelPair slot/child inheritance
  const spreadOverriddenByJsxExpressive = lintSource(
    `
    export const SpreadToExpressive = () => (
      <Sheet>
        <Panel {...{ variant: 'quiet', cut: 'C-01' }} variant="expressive">A</Panel>
        <Panel cut="C-02">B</Panel>
      </Sheet>
    );
  `,
    'eval/screens/spread-to-expressive.tsx',
  );
  const jsxExpressiveOverriddenBySpreadQuiet = lintSource(
    `
    export const ExpressiveToQuiet = () => (
      <Sheet>
        <Panel {...{ variant: 'expressive', cut: 'C-01' }} variant="quiet">A</Panel>
      </Sheet>
    );
  `,
    'eval/screens/expressive-to-quiet.tsx',
  );
  const nestedSpreadsPrecedence = lintSource(
    `
    const quietCut = { variant: 'quiet', cut: 'C-01' };
    const expressiveOverride = { ...quietCut, variant: 'expressive' };
    const quietOverride = { ...expressiveOverride, cut: 'C-02', variant: 'quiet' };
    export const NestedSpreads = () => (
      <Sheet>
        <Panel {...expressiveOverride}>Valid C-01</Panel>
        <Panel {...quietOverride}>Invalid quiet C-02</Panel>
      </Sheet>
    );
  `,
    'eval/screens/nested-spreads.tsx',
  );
  const panelPairSlotOverrides = lintSource(
    `
    export const PairSlots = () => (
      <Sheet>
        <PanelPair
          variant="quiet"
          top={{ ...{ variant: 'quiet', cut: 'C-01' }, variant: 'expressive' }}
          bottom={{ cut: 'C-02' }}
        />
      </Sheet>
    );
  `,
    'eval/screens/pair-slots.tsx',
  );
  const panelPairInheritedQuietChildren = lintSource(
    `
    export const PairChildren = () => (
      <Sheet>
        <PanelPair variant="quiet">
          <Panel cut="C-01">Inherited quiet 1</Panel>
          <Panel variant="expressive" cut="C-01">Explicit expressive override</Panel>
        </PanelPair>
      </Sheet>
    );
  `,
    'eval/screens/pair-children.tsx',
  );

  check(
    spreadOverriddenByJsxExpressive.length === 0 &&
      jsxExpressiveOverriddenBySpreadQuiet.length === 1 &&
      jsxExpressiveOverriddenBySpreadQuiet[0].rule === 'cut-order' &&
      jsxExpressiveOverriddenBySpreadQuiet[0].message.includes('Quiet panels') &&
      nestedSpreadsPrecedence.length === 1 &&
      nestedSpreadsPrecedence[0].snippet === "cut: 'C-02'" &&
      panelPairSlotOverrides.length === 1 &&
      panelPairSlotOverrides[0].snippet === "cut: 'C-02'" &&
      panelPairInheritedQuietChildren.length === 1 &&
      panelPairInheritedQuietChildren[0].line === 5,
    'linter [cut-order]: resolves effective variant in JSX/spread precedence order and propagates PanelPair variant to slots and direct Panel children',
    JSON.stringify({
      spreadOverriddenByJsxExpressive,
      jsxExpressiveOverriddenBySpreadQuiet,
      nestedSpreadsPrecedence,
      panelPairSlotOverrides,
      panelPairInheritedQuietChildren,
    }),
  );

  // 5c. Non-Panel child slots, JSX fragments, slot-children traversal order, explicit undefined vs false, shorthand props, and local scalar constants
  const nonPanelFirstSlotThenPanel = lintSource(
    `
    export const MixedPairSlots = () => (
      <Sheet>
        <PanelPair topCut="C-01" bottomCut="C-02">
          <div>A</div>
          <Panel>B</Panel>
        </PanelPair>
      </Sheet>
    );
  `,
    'eval/screens/mixed-pair-slots.tsx',
  );
  const nonPanelFirstSlotThenExplicitPanel = lintSource(
    `
    export const MixedPairExplicit = () => (
      <Sheet>
        <PanelPair topCut="C-01">
          <div>A</div>
          <Panel cut="C-02">B</Panel>
        </PanelPair>
      </Sheet>
    );
  `,
    'eval/screens/mixed-pair-explicit.tsx',
  );
  const nonPanelFirstSlotDuplicatePanel = lintSource(
    `
    export const MixedPairDuplicate = () => (
      <Sheet>
        <PanelPair topCut="C-01">
          <div>A</div>
          <Panel cut="C-01">B</Panel>
        </PanelPair>
      </Sheet>
    );
  `,
    'eval/screens/mixed-pair-dup.tsx',
  );
  const fragmentInsideQuietPair = lintSource(
    `
    export const FragmentInQuietPair = () => (
      <Sheet>
        <PanelPair variant="quiet">
          <>
            <Panel cut="C-01">A</Panel>
            <Panel cut="C-02">B</Panel>
          </>
        </PanelPair>
      </Sheet>
    );
  `,
    'eval/screens/fragment-in-quiet-pair.tsx',
  );
  const slotChildrenBeforeNextSlot = lintSource(
    `
    const topConst = { cut: 'C-01', children: <Panel cut="C-02">Nested in top</Panel> };
    export const SlotOrder = () => (
      <Sheet>
        <PanelPair
          top={topConst}
          bottom={{ cut: 'C-03', children: <Panel cut="C-04">Nested in bottom</Panel> }}
        />
        <PanelPair topCut="C-05" bottomCut="C-07">
          <div><Panel cut="C-06">Nested in child slot 0</Panel></div>
          <div>Bottom slot</div>
        </PanelPair>
      </Sheet>
    );
  `,
    'eval/screens/slot-order.tsx',
  );
  const explicitUndefinedVariantOverride = lintSource(
    `
    export const UndefinedVariantOverride = () => (
      <Sheet>
        <Panel {...{ variant: 'quiet', cut: 'C-01' }} variant={undefined}>A</Panel>
        <Panel {...{ variant: 'quiet', cut: 'C-02' }} {...{ variant: undefined }}>B</Panel>
      </Sheet>
    );
  `,
    'eval/screens/undefined-variant-override.tsx',
  );
  const undefinedCutFallsBackToTopCut = lintSource(
    `
    export const UndefinedCutFallback = () => (
      <Sheet>
        <PanelPair variant="quiet" topCut="C-01" bottomCut="C-02">
          <Panel cut={undefined}>Falls back to topCut C-01 on quiet slot</Panel>
          <Panel cut={false}>Suppresses bottomCut C-02</Panel>
        </PanelPair>
      </Sheet>
    );
  `,
    'eval/screens/undefined-cut-fallback.tsx',
  );
  const shorthandAndLocalScalar = lintSource(
    `
    const variant = 'quiet';
    const cut = 'C-01';
    const v = 'quiet';
    export const ShorthandAndScalar = () => (
      <Sheet>
        <Panel {...{ variant, cut }}>Shorthand quiet C-01</Panel>
        <Panel variant={v} cut="C-02">Scalar quiet C-02</Panel>
      </Sheet>
    );
  `,
    'eval/screens/shorthand-and-scalar.tsx',
  );

  check(
    nonPanelFirstSlotThenPanel.length === 0 &&
      nonPanelFirstSlotThenExplicitPanel.length === 0 &&
      nonPanelFirstSlotDuplicatePanel.length === 1 &&
      nonPanelFirstSlotDuplicatePanel[0].message.includes('Duplicate cut number "C-01"') &&
      fragmentInsideQuietPair.length === 0 &&
      slotChildrenBeforeNextSlot.length === 0 &&
      explicitUndefinedVariantOverride.length === 0 &&
      undefinedCutFallsBackToTopCut.length === 1 &&
      undefinedCutFallsBackToTopCut[0].snippet === 'topCut="C-01"' &&
      shorthandAndLocalScalar.length === 2 &&
      shorthandAndLocalScalar.every((v) => v.message.includes('Quiet panels')),
    'linter [cut-order]: handles non-Panel child slots, fragments, slot-children-before-next-slot order, explicit undefined vs false, shorthand props, and local scalar constants',
    JSON.stringify({
      nonPanelFirstSlotThenPanel,
      nonPanelFirstSlotThenExplicitPanel,
      nonPanelFirstSlotDuplicatePanel,
      fragmentInsideQuietPair,
      slotChildrenBeforeNextSlot,
      explicitUndefinedVariantOverride,
      undefinedCutFallsBackToTopCut,
      shorthandAndLocalScalar,
    }),
  );

  // 5d. Hoisted child references at render sites, empty-string cut, PanelPair dropped slots, conditional slot children, and local component aliases
  const hoistedQuietChildInPanel = lintSource(
    `
    const inner = <Panel variant="quiet" cut="C-01" />;
    export const HoistedQuiet = () => (
      <Sheet>
        <Panel children={inner} />
      </Sheet>
    );
  `,
    'eval/screens/hoisted-quiet-child.tsx',
  );
  const hoistedChildInAutoCutSheet = lintSource(
    `
    const bodyProp = <Panel cut="C-01" />;
    const bodyJsx = <Panel cut="C-02" />;
    export const HoistedAutoCut = () => (
      <>
        <Sheet autoCut children={bodyProp} />
        <Sheet autoCut>{bodyJsx}</Sheet>
      </>
    );
  `,
    'eval/screens/hoisted-autocut-child.tsx',
  );
  const emptyCutAndDroppedPairSlots = lintSource(
    `
    export const EmptyAndDropped = () => (
      <Sheet>
        <Panel cut="">Empty string cut is suppressed</Panel>
        <PanelPair top={{ cut: 'C-99' }} />
        <PanelPair>
          <Panel cut="C-01">First</Panel>
          <Panel cut="C-02">Second</Panel>
          <Panel cut="C-99">Third child dropped by PanelPair</Panel>
        </PanelPair>
      </Sheet>
    );
  `,
    'eval/screens/empty-and-dropped.tsx',
  );
  const conditionalSlotInQuietPairAndAlias = lintSource(
    `
    const P2 = Panel;
    export const CondAndAlias = ({ flag }: { flag: boolean }) => (
      <Sheet>
        <PanelPair variant="quiet">
          {flag && <Panel cut="C-01">Inherited quiet via &&</Panel>}
          <Panel>Second</Panel>
        </PanelPair>
        <P2 variant="quiet" cut="C-02">Aliased Panel quiet cut</P2>
      </Sheet>
    );
  `,
    'eval/screens/cond-and-alias.tsx',
  );
  const ternaryAndNullishInPairSlot = lintSource(
    `
    export const TernaryAndNullishPair = ({ flag, maybe }: { flag: boolean; maybe?: React.ReactNode }) => (
      <Sheet>
        <PanelPair topCut="C-01" bottomCut="C-02">
          {flag ? <Panel>A</Panel> : <Panel>B</Panel>}
          <Panel>C</Panel>
        </PanelPair>
        <PanelPair topCut="C-03" bottomCut="C-04">
          {maybe ?? <Panel>D</Panel>}
          <Panel>E</Panel>
        </PanelPair>
      </Sheet>
    );
  `,
    'eval/screens/ternary-and-nullish-pair.tsx',
  );

  check(
    hoistedQuietChildInPanel.length === 1 &&
      hoistedQuietChildInPanel[0].rule === 'cut-order' &&
      hoistedQuietChildInPanel[0].snippet === 'cut="C-01"' &&
      hoistedChildInAutoCutSheet.length === 2 &&
      hoistedChildInAutoCutSheet.every((v) => v.rule === 'explicit-cut-in-autocut') &&
      emptyCutAndDroppedPairSlots.length === 0 &&
      conditionalSlotInQuietPairAndAlias.length === 2 &&
      conditionalSlotInQuietPairAndAlias.every((v) => v.message.includes('Quiet panels')) &&
      ternaryAndNullishInPairSlot.length === 0,
    'linter [cut-order & explicit-cut-in-autocut]: resolves hoisted child references at render sites, ignores cut="" and dropped PanelPair slots, and handles conditional/ternary/nullish pair slots and local Panel aliases',
    JSON.stringify({
      hoistedQuietChildInPanel,
      hoistedChildInAutoCutSheet,
      emptyCutAndDroppedPairSlots,
      conditionalSlotInQuietPairAndAlias,
      ternaryAndNullishInPairSlot,
    }),
  );

  // 5e. TabsContent provides default variant="quiet" to Panel and PanelPair
  const tabsContentDefaultQuietNumbered = lintSource(
    `
    export const TabsCutCheck = () => (
      <Sheet>
        <Panel cut="C-01">Hero</Panel>
        <Tabs defaultValue="a">
          <TabsContent value="a">
            <Panel label="Quiet by default">No cut needed</Panel>
            <Panel cut="C-02">Invalid numbered default-quiet panel</Panel>
          </TabsContent>
        </Tabs>
      </Sheet>
    );
  `,
    'eval/screens/tabs-cut-check.tsx',
  );
  const tabsContentExplicitExpressive = lintSource(
    `
    export const TabsExpressiveCheck = () => (
      <Sheet>
        <Panel cut="C-01">Hero</Panel>
        <Tabs defaultValue="a">
          <TabsContent value="a">
            <Panel variant="expressive" cut="C-02">Explicit expressive panel</Panel>
          </TabsContent>
        </Tabs>
      </Sheet>
    );
  `,
    'eval/screens/tabs-expressive-check.tsx',
  );
  check(
    tabsContentDefaultQuietNumbered.length === 1 &&
      tabsContentDefaultQuietNumbered[0].rule === 'cut-order' &&
      tabsContentDefaultQuietNumbered[0].message.includes('Quiet panels') &&
      tabsContentExplicitExpressive.length === 0,
    'linter [cut-order]: treats <Panel> and <PanelPair> inside <TabsContent> as default variant="quiet" unless variant="expressive" is explicitly set',
    JSON.stringify({ tabsContentDefaultQuietNumbered, tabsContentExplicitExpressive }),
  );
}

// 6. Rule 5: raw-shadcn-import
{
  const badImports = `
    import { Button } from '@/components/ui/button';
    import { Tabs } from '@/components/ui/tabs';
    import { Checkbox } from '@/components/ui/checkbox';
    import { RadioGroup } from '@/components/ui/radio-group';
    import { Switch } from '@/components/ui/switch';
    import { Textarea } from '@/components/ui/textarea';
    import { Field } from '@/components/ui/field';
    import { Label } from '@/components/ui/label';
    import { Alert } from '@/components/ui/alert';
    import { Toast } from '@/components/ui/toast';
    import { Toaster } from '@/components/ui/toaster';
    import { Toaster as Sonner } from '@/components/ui/sonner';
    import { Skeleton } from '@/components/ui/skeleton';
    import { EmptyState } from '@/components/ui/empty-state';
    import { Breadcrumb } from '@/components/ui/breadcrumb';
    import { Pagination } from '@/components/ui/pagination';
    import * as DialogPrimitive from '@radix-ui/react-dialog';
    import { AreaChart } from 'recharts';
    export const X = () => null;
  `;
  const res = lintSource(badImports, 'eval/screens/bad-imports.tsx');
  check(
    res.length === 18 && res.every((v) => v.rule === 'raw-shadcn-import'),
    'linter [raw-shadcn-import]: flags @/components/ui/{button,tabs,checkbox,radio-group,switch,textarea,field,label,alert,toast,toaster,sonner,skeleton,empty-state,breadcrumb,pagination}, @radix-ui/react-dialog, and recharts',
  );
}

// 7. End-to-end CLI exit code check
{
  const tmpDir = resolve(__dirname, '../.f12-run-linter');
  mkdirSync(tmpDir, { recursive: true });
  const badFile = resolve(tmpDir, 'drift-fixture.tsx');
  writeFileSync(
    badFile,
    `import { Button } from '@/components/ui/button';\nexport const F = () => <div style={{ color: '#ff0000', gap: '18px' }} />;`,
  );

  const failRun = spawnSync(process.execPath, [CHECKER_PATH, badFile], { encoding: 'utf8' });
  check(
    failRun.status === 1 &&
      failRun.stderr.includes('[color-literal]') &&
      failRun.stderr.includes('[illegal-gutter]') &&
      failRun.stderr.includes('[raw-shadcn-import]'),
    'linter CLI: exits with code 1 and reports rule IDs on drifting fixture',
  );

  const passRun = spawnSync(process.execPath, [CHECKER_PATH, resolve(REPO_ROOT, 'registry/ui')], {
    encoding: 'utf8',
  });
  check(
    passRun.status === 0 && passRun.stdout.includes('PASS  check-frame12'),
    'linter CLI: exits with code 0 on registry/ui',
  );

  rmSync(tmpDir, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} linter check(s) failed` : '\nAll linter checks passed');
process.exitCode = failures ? 1 : 0;
