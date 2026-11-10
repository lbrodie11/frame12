// The class manifest matches what the renderers really emit, in both directions.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PKG_ROOT, S, check, finish, scanMarkup } from './lib.mjs';

const manifest = await import(pathToFileURL(path.join(PKG_ROOT, 'dist/manifest.js')).href);

const statuses = ['neutral', 'info', 'success', 'warning', 'danger'];
const fixtures = {
  sheet: [S.sheet({ children: '' }), S.sheet({ theme: 'light', autoCut: true, children: '' }), S.sheet({ theme: 'dark', children: '' })],
  scene: [
    ...['split', 'stack', 'equal', 'three'].flatMap((layout) => ['pair', 'scene', 'change'].map((gutter) => S.scene({ layout, gutter, children: '' }))),
    S.scene({ areas: ['a b'], breakpoint: 960, children: S.sceneArea({ area: 'a', children: '' }) }),
  ],
  panel: ['rect', 'slant-bottom', 'slant-top'].flatMap((shape) => ['expressive', 'quiet'].map((variant) => S.panel({ shape, variant, area: 'a', label: 'l', children: '' }))),
  panelPair: [S.panelPair({ top: {}, bottom: {}, area: 'a' })],
  balloon: [S.balloon({ children: '' })],
  tag: [S.tag({ children: 'x' }), ...statuses.map((status) => S.tag({ variant: 'stamp', status, children: 'x' }))],
  badge: [S.badge({ children: 'x' }), ...statuses.map((status) => S.badge({ status, children: 'x' }))],
  metric: [
    S.metric({ label: 'l', value: 1, delta: 0.1, note: 'n', big: true, comparisonLabel: 'c' }),
    S.metric({ label: 'l', value: 1, delta: -0.1, variant: 'quiet' }),
    S.metric({ label: 'l', value: 1, delta: 0 }),
  ],
  toneBarList: [
    S.toneBarList({
      title: 't',
      subtitle: 's',
      density: 'compact',
      selectedId: 'a',
      items: [
        { id: 'a', name: 'a', value: 1, share: 0.5, badge: 'b' },
        { id: 'b', name: 'b', value: 2, pattern: 'hatch' },
        { id: 'c', name: 'c', value: 3, pattern: 'dense' },
      ],
    }),
  ],
  ghostWire: ['auto', 'horizontal', 'vertical'].map((orientation) => S.ghostWire({ from: 'a', to: 'b', label: 'l', orientation })),
  receipt: [
    S.receiptList({
      items: [
        { kind: 'commit', value: 'abcdef0123', href: 'https://e.com', origin: 'human', title: 't', date: 'd' },
        { kind: 'file', value: 'f', origin: 'agent' },
        { kind: 'link', value: 'l', origin: 'bot' },
      ],
    }),
  ],
};

const manifestClasses = new Set(Object.values(manifest.MANIFEST_CLASSES).flat());
const manifestAttrs = new Set(manifest.MANIFEST_ATTRIBUTES);
const emitted = new Set();
for (const [name, outs] of Object.entries(fixtures)) {
  const { classes, attributes } = scanMarkup(outs.join(''));
  for (const c of classes) emitted.add(c);
  const extraClasses = [...classes].filter((c) => !manifestClasses.has(c));
  const svgAttrs = new Set(['viewbox', 'preserveaspectratio', 'points', 'vector-effect', 'width', 'height', 'd', 'cx', 'cy', 'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'maskunits', 'mask', 'stroke-dasharray', 'stroke-dashoffset']);
  const extraAttrs = [...attributes].filter((a) => !manifestAttrs.has(a) && !svgAttrs.has(a));
  check(extraClasses.length === 0 && extraAttrs.length === 0, `manifest: ${name}() emits only manifest classes and attributes`, [...extraClasses, ...extraAttrs].join(', '));
  const own = manifest.MANIFEST_CLASSES[name] ?? [];
  const unseen = own.filter((c) => !classes.has(c));
  check(unseen.length === 0, `manifest: every class listed for ${name} is really emitted by ${name}()`, unseen.join(', '));
}
check([...manifestClasses].every((c) => emitted.has(c)), 'manifest: no manifest class is unreachable');

finish('manifest');
