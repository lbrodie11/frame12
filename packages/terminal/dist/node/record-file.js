/**
 * A `.f12rec` file sink for Node hosts (`startLive({ record })`, `frame12-term --record`).
 *
 * It writes to a temporary file next to the target, synchronously, line by line, and renames it
 * into place on `end()`: an existing file at the path is only replaced by a finished (or visibly
 * stopped) recording, never truncated by a run that fails before it starts, and a reader of the
 * same path keeps the file it opened. `discard()` drops the temporary file. Not exported: core
 * stays free of the file system.
 */
import { closeSync, openSync, renameSync, rmSync, writeSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
let counter = 0;
export function fileRecordSink(path) {
    const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.${++counter}.tmp`);
    const fd = openSync(tmp, 'wx');
    let open = true;
    const close = () => {
        if (!open)
            return false;
        open = false;
        closeSync(fd);
        return true;
    };
    // A forced exit (a second Ctrl-C) still keeps what was recorded, as a direct write would have.
    const onExit = () => {
        if (close())
            renameSync(tmp, path);
    };
    process.once('exit', onExit);
    return {
        name: path,
        write(line) {
            if (open)
                writeSync(fd, line);
        },
        end() {
            process.off('exit', onExit);
            if (close())
                renameSync(tmp, path);
        },
        discard() {
            process.off('exit', onExit);
            close();
            rmSync(tmp, { force: true });
        },
    };
}
