'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { BLOCK_RETURN_TABLE, parseBlockSection, type BlockSlug } from '@/lib/return-context';
import { replaceSectionParam } from '@/lib/history-focus';

/**
 * Keeps a tabbed block's active section in `?section=`.
 *
 * - `section` is read from the URL (validated; unknown → the block default) and is meant to be
 *   passed as the block's `defaultSection`. The page is rendered dynamically, so the server HTML
 *   already shows the right tab and the page height matches before first paint.
 * - `onSectionChange` mirrors internal tab changes into the URL with `replaceState`.
 * - `key` changes only when the URL's section changes from *outside* the block (e.g. a nav or
 *   return link to the same route), remounting the block on the new tab.
 * - `current` is the section on screen, for building origin tokens.
 */
export function useBlockSection<S extends string>(block: BlockSlug) {
  const sections = BLOCK_RETURN_TABLE[block].sections;
  const defaultSection = (sections?.[0] ?? '') as S;
  const searchParams = useSearchParams();
  const rawSection = searchParams?.get('section') ?? null;
  const urlSection = (parseBlockSection(block, rawSection) ?? defaultSection) as S;
  const invalidParam = rawSection !== null && rawSection !== urlSection;

  // `?section=bogus` (or `?section=overview`, the default) renders the default tab; drop the
  // meaningless parameter from the address bar so it is never shared or bookmarked.
  React.useEffect(() => {
    if (invalidParam) replaceSectionParam(null, defaultSection);
  }, [invalidParam, defaultSection]);

  const knownRef = React.useRef<S>(urlSection);
  const [epoch, setEpoch] = React.useState(0);
  const [current, setCurrent] = React.useState<S>(urlSection);

  React.useEffect(() => {
    if (urlSection === knownRef.current) return;
    knownRef.current = urlSection;
    setCurrent(urlSection);
    setEpoch((e) => e + 1);
  }, [urlSection]);

  const onSectionChange = React.useCallback(
    (next: S) => {
      knownRef.current = next;
      setCurrent(next);
      replaceSectionParam(next, defaultSection);
    },
    [defaultSection],
  );

  return { section: urlSection, key: epoch, current, onSectionChange };
}
