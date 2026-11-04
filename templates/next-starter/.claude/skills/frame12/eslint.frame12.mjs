// Reusable ESLint flat-config snippet enforcing FRAME/12 component & adapter imports.
// Usage in eslint.config.mjs:
//   import frame12Rules from './skills/frame12/eslint.frame12.mjs';
//   export default [...frame12Rules];

export const frame12RestrictedImports = {
  paths: [
    {
      name: '@/components/ui/button',
      message: 'Use FRAME/12 <Button> from @/components/frame12 instead of raw shadcn button.',
    },
    {
      name: '@/components/ui/input',
      message: 'Use FRAME/12 <Input> from @/components/frame12 instead of raw shadcn input.',
    },
    {
      name: '@/components/ui/textarea',
      message: 'Use FRAME/12 <Textarea> from @/components/frame12 instead of raw shadcn textarea.',
    },
    {
      name: '@/components/ui/checkbox',
      message: 'Use FRAME/12 <Checkbox> from @/components/frame12 instead of raw shadcn checkbox.',
    },
    {
      name: '@/components/ui/radio-group',
      message: 'Use FRAME/12 <RadioGroup> from @/components/frame12 instead of raw shadcn radio-group.',
    },
    {
      name: '@/components/ui/switch',
      message: 'Use FRAME/12 <Switch> from @/components/frame12 instead of raw shadcn switch.',
    },
    {
      name: '@/components/ui/field',
      message: 'Use FRAME/12 <Field> from @/components/frame12 instead of raw shadcn field.',
    },
    {
      name: '@/components/ui/label',
      message: 'Use FRAME/12 <Field> or the built-in label prop on form controls from @/components/frame12.',
    },
    {
      name: '@/components/ui/badge',
      message: 'Use FRAME/12 <Badge> or <Tag> from @/components/frame12 instead of raw shadcn badge.',
    },
    {
      name: '@/components/ui/card',
      message: 'Use FRAME/12 <Panel> or <PanelPair> from @/components/frame12 instead of Card.',
    },
    {
      name: '@/components/ui/tabs',
      message: 'Use FRAME/12 <Tabs> (for switching content panels) or <SegmentedControl> (for changing the view of the same content) from @/components/frame12.',
    },
    {
      name: '@/components/ui/dialog',
      message: 'Use the FRAME/12 <Dialog> adapter from @/components/frame12.',
    },
    {
      name: '@/components/ui/select',
      message: 'Use the FRAME/12 <Select> adapter from @/components/frame12.',
    },
    {
      name: '@/components/ui/tooltip',
      message: 'Use the FRAME/12 <Tooltip> adapter from @/components/frame12.',
    },
    {
      name: '@/components/ui/dropdown-menu',
      message: 'Use the FRAME/12 <DropdownMenu> adapter from @/components/frame12.',
    },
    {
      name: '@/components/ui/table',
      message: 'Use the FRAME/12 <Table> adapter from @/components/frame12.',
    },
  ],
  patterns: [
    {
      group: ['@radix-ui/*'],
      message:
        'Import the FRAME/12 adapter (Dialog, Select, Tooltip, DropdownMenu, SegmentedControl) from @/components/frame12 instead of raw @radix-ui/* primitives.',
    },
    {
      group: ['recharts', 'chart.js', 'react-chartjs-2', 'd3', 'framer-motion', 'gsap'],
      message:
        'FRAME/12 forbids external charting and animation libraries. Use ToneAreaChart, ToneBarList, ToneSpark from @/components/frame12 and useOnTwos from @/hooks/use-on-twos.',
    },
  ],
};

const frame12RecommendedRule = {
  name: 'frame12/design-grammar',
  files: ['**/*.{ts,tsx,js,jsx}'],
  ignores: [
    '**/registry/ui/**',
    '**/registry/hooks/**',
    '**/components/frame12/**',
    '**/hooks/use-on-twos.*',
  ],
  rules: {
    'no-restricted-imports': ['error', frame12RestrictedImports],
  },
};

const frame12Config = [frame12RecommendedRule];
frame12Config.configs = {
  recommended: frame12RecommendedRule,
};

export default frame12Config;
