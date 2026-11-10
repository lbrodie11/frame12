// Shared by the site's TempoProvider (site-shell.tsx, a client module) and the first-paint script
// in app/layout.tsx (a server component, which cannot read values out of a 'use client' module).
export const TEMPO_STORAGE_KEY = 'frame12-tempo';

/** The tempos the first-paint script accepts; anything else reads as `auto` (matches isTempo). */
export const STORED_TEMPOS = ['auto', 'twos', 'ones', 'still'] as const;
