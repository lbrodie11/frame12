'use client';

import * as React from 'react';
import { Button } from '@/components/frame12';

export interface CopyCommandProps {
  command: string;
  label?: string;
  id?: string;
}

export function CopyCommand({ command, label = 'Install command', id }: CopyCommandProps) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(command).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="f12-cmd-box">
      <div className="f12-cmd-head">
        <span className="f12-cmd-label">{label}</span>
        <Button
          type="button"
          id={id}
          variant={copied ? 'marker' : 'secondary'}
          size="sm"
          onClick={onCopy}
          aria-label={`Copy ${label}: ${command}`}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="f12-cmd-pre" tabIndex={0} role="region" aria-label={`${label} code`}>
        <code>{command}</code>
      </pre>
    </div>
  );
}
