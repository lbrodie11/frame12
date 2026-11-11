// Hydrates the server-rendered SsrApp (registry/tests/cut-morph.mjs, hydration case).
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { SsrApp } from './cut-morph-ssr';

hydrateRoot(document.getElementById('root')!, <SsrApp />);
