/**
 * A `.f12rec` file sink for Node hosts (`startLive({ record })`, `frame12-term --record`). Writes
 * synchronously, line by line, so a recording is complete even when the process exits right after
 * the snapshot. Not exported: core stays free of the file system.
 */
import { closeSync, openSync, writeSync } from 'node:fs';
import type { RecordSink } from '../core/recording.js';

export function fileRecordSink(path: string): RecordSink {
  const fd = openSync(path, 'w');
  let open = true;
  return {
    write(line) {
      if (open) writeSync(fd, line);
    },
    end() {
      if (!open) return;
      open = false;
      closeSync(fd);
    },
  };
}
