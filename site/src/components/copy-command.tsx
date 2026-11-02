'use client';

import * as React from 'react';
import { Button } from '@/components/frame12';

export interface CopyCommandProps {
  command: string;
  label?: string;
  id?: string;
}

export function CopyCommand({ command, label = 'Install command', id }: CopyCommandProps) {
  const [status, setStatus] = React.useState<'idle' | 'copied' | 'failed'>('idle');
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const onCopy = async () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(command);
        setStatus('copied');
      } catch {
        setStatus('failed');
      }
    } else {
      setStatus('failed');
    }
    timerRef.current = setTimeout(() => setStatus('idle'), 1800);
  };

  return (
    <div className="f12-cmd-box">
      <div className="f12-cmd-head">
        <span className="f12-cmd-label">{label}</span>
        <Button
          type="button"
          id={id}
          variant={status === 'copied' ? 'marker' : 'secondary'}
          size="sm"
          onClick={onCopy}
          aria-label={`Copy ${label}: ${command}`}
        >
          {status === 'copied' ? 'Copied' : status === 'failed' ? 'Select below' : 'Copy'}
        </Button>
      </div>
      <pre className="f12-cmd-pre" tabIndex={0} role="region" aria-label={`${label} code`}>
        <code>{command}</code>
      </pre>
    </div>
  );
}
