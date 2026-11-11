import * as React from 'react';

/**
 * Renders one line of the package README's inline markdown (a table cell): `code`, **bold** and
 * [links](https://…). Only https links and in-page anchors become links; everything else stays
 * text. No HTML is parsed.
 */
export function InlineMd({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let at = 0;
  let k = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > at) out.push(text.slice(at, m.index));
    if (m[1] !== undefined) out.push(<code key={k++}>{m[1]}</code>);
    else if (m[2] !== undefined) out.push(<strong key={k++}>{m[2]}</strong>);
    else {
      const href = m[4]!;
      out.push(
        /^https:\/\//.test(href) || /^#[\w-]+$/.test(href) ? (
          <a key={k++} href={href}>
            {m[3]}
          </a>
        ) : (
          m[3]
        ),
      );
    }
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}
