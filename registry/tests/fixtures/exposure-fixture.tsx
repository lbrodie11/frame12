// Browser entry for registry/tests/exposure.mjs and the flipbook case in flash-safety.mjs.
// `window.__xs(props)` mounts one configuration; every value/playing callback is logged to
// `window.__xsLog`. With `window.__xsSsr` set (by the test, before this script runs) it hydrates
// server-rendered markup instead.
import * as React from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { Harness, gen, type FixtureProps } from './exposure-app';

window.__xsLog = [];
window.__xsAccept = true;
window.__xsAcceptPlaying = true;
window.__gen = gen;
window.__xsCtx = [];

let root: Root | null = null;
window.__xs = (p) => {
  root?.unmount();
  window.__xsLog = [];
  window.__xsCtx = [];
  root = createRoot(document.getElementById('root')!);
  root.render(<Harness {...p} />);
};
window.__xsUnmount = () => {
  root?.unmount();
  root = null;
};
const ssr = (window as unknown as { __xsSsr?: FixtureProps }).__xsSsr;
if (ssr) {
  root = hydrateRoot(document.getElementById('root')!, <Harness {...ssr} />);
}
