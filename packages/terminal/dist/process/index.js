/**
 * @frame12/terminal/process: the only module that starts child processes.
 *
 * A child process that writes straight to the terminal corrupts a live view (Ink redraws over it).
 * `spawnLogged` pipes the child's stdout and stderr into the Director's log instead, line by line,
 * sanitized and redacted like every other string, and reports the exit code.
 */
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { safeLink } from '../core/safety.js';
/** Splits a stream into complete lines, keeping a partial last line until more arrives. */
function lineSplitter(onLine) {
    let rest = '';
    // A streaming decoder keeps a multi-byte character split across two chunks intact.
    const decoder = new StringDecoder('utf8');
    return {
        push(chunk) {
            const text = rest + decoder.write(chunk);
            const parts = text.split(/\r?\n/);
            rest = parts.pop() ?? '';
            for (const p of parts)
                onLine(p);
        },
        end() {
            rest += decoder.end();
            if (rest !== '')
                onLine(rest);
            rest = '';
        },
    };
}
/**
 * Runs `cmd args` without a shell (arguments are never interpreted), logging every line of its
 * stdout (`info`) and stderr (`warn`) to the Director. Resolves when the process exits; never rejects.
 */
export function spawnLogged(director, cmd, args = [], options = {}) {
    const signal = options.signal ?? director.signal;
    const meta = (stream) => ({ stream, ...(options.cut !== undefined ? { cut: options.cut } : {}) });
    return new Promise((resolve) => {
        if (signal.aborted)
            return resolve({ code: null, signal: null, error: 'canceled before start' });
        let child;
        try {
            child = spawn(cmd, [...args], { cwd: options.cwd, env: options.env, shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            director.log('error', `${cmd} could not start: ${message}`, meta('stderr'));
            return resolve({ code: null, signal: null, error: message });
        }
        const out = lineSplitter((line) => director.log('info', line, meta('stdout')));
        const err = lineSplitter((line) => director.log(options.stderrLevel ?? 'warn', line, meta('stderr')));
        child.stdout?.on('data', (c) => out.push(c));
        child.stderr?.on('data', (c) => err.push(c));
        const onAbort = () => child.kill('SIGTERM');
        signal.addEventListener('abort', onAbort, { once: true });
        let settled = false;
        const finish = (result) => {
            if (settled)
                return;
            settled = true;
            signal.removeEventListener('abort', onAbort);
            out.end();
            err.end();
            resolve(result);
        };
        child.on('error', (e) => {
            director.log('error', `${cmd} could not start: ${e.message}`, meta('stderr'));
            finish({ code: null, signal: null, error: e.message });
        });
        child.on('close', (code, sig) => {
            // Flush any partial last lines first, so the exit line is the last thing logged.
            out.end();
            err.end();
            const how = sig ? `was stopped by ${sig}` : `exited with code ${code}`;
            director.log(code === 0 ? 'info' : 'error', `${cmd} ${how}`, meta(code === 0 ? 'stdout' : 'stderr'));
            finish({ code, signal: sig });
        });
    });
}
/**
 * Opens a URL in the default browser, without a shell. Only links that pass `safeLink` (https, or
 * http to localhost when allowed) are opened; returns false otherwise.
 */
export function openUrl(url, platform = process.platform) {
    const safe = safeLink(url);
    if (!safe)
        return false;
    const [cmd, args] = platform === 'darwin'
        ? ['open', [safe]]
        : platform === 'win32'
            ? // rundll32 hands the URL to the protocol handler with no shell, so `&` and `^` stay literal.
                ['rundll32', ['url.dll,FileProtocolHandler', safe]]
            : ['xdg-open', [safe]];
    try {
        const child = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true });
        child.on('error', () => undefined);
        child.unref();
        return true;
    }
    catch {
        return false;
    }
}
