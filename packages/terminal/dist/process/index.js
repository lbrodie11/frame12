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
/** The default for `maxLineLength`: well above the sanitizer's own per-line cap. */
const DEFAULT_SPAWN_MAX_LINE = 16_384;
/** A carriage return rewrites the line, as on a terminal: keep what follows the last one. */
function afterLastCR(s) {
    const i = s.lastIndexOf('\r');
    return i === -1 ? s : s.slice(i + 1);
}
/**
 * Splits a stream into complete lines, keeping a partial last line until more arrives. Memory is
 * bounded: a pending line keeps only what follows its last carriage return (progress output), and
 * past `maxLine` characters its head is logged, the rest is dropped and one note says how much.
 */
function lineSplitter(onLine, maxLine = DEFAULT_SPAWN_MAX_LINE) {
    let rest = '';
    let held = ''; // a trailing \r that may be the first half of \r\n
    let dropped = -1; // characters dropped from the current line, once its head was logged (-1: none)
    // A streaming decoder keeps a multi-byte character split across two chunks intact.
    const decoder = new StringDecoder('utf8');
    const closeLine = () => {
        if (dropped >= 0) {
            if (dropped > 0)
                onLine(`[line truncated: ${dropped} more characters were not logged]`);
        }
        else
            onLine(afterLastCR(rest));
        rest = '';
        dropped = -1;
    };
    const extend = (text) => {
        if (dropped >= 0) {
            dropped += text.length;
            return;
        }
        rest = afterLastCR(rest + text);
        if (rest.length > maxLine) {
            // Do not split a surrogate pair at the cut.
            let at = maxLine;
            const c = rest.charCodeAt(at - 1);
            if (c >= 0xd800 && c <= 0xdbff)
                at--;
            onLine(rest.slice(0, at));
            dropped = rest.length - at;
            rest = '';
        }
    };
    const feed = (text) => {
        text = held + text;
        held = '';
        if (text.endsWith('\r')) {
            held = '\r';
            text = text.slice(0, -1);
        }
        const parts = text.split(/\r?\n/);
        const last = parts.pop() ?? '';
        for (const p of parts) {
            extend(p);
            closeLine();
        }
        extend(last);
    };
    return {
        push(chunk) {
            feed(typeof chunk === 'string' ? chunk : decoder.write(chunk));
        },
        end() {
            feed(decoder.end());
            held = '';
            if (rest !== '' || dropped >= 0)
                closeLine();
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
        const max = Math.max(1, options.maxLineLength ?? DEFAULT_SPAWN_MAX_LINE);
        const out = lineSplitter((line) => director.log('info', line, meta('stdout')), max);
        const err = lineSplitter((line) => director.log(options.stderrLevel ?? 'warn', line, meta('stderr')), max);
        child.stdout?.on('data', (c) => out.push(c));
        child.stderr?.on('data', (c) => err.push(c));
        // SIGTERM first; a child that ignores it (or is stuck) gets SIGKILL, so a cancel always ends it.
        let killTimer;
        const onAbort = () => {
            child.kill('SIGTERM');
            killTimer = setTimeout(() => child.kill('SIGKILL'), Math.max(0, options.killAfterMs ?? 5000));
            killTimer.unref?.();
        };
        signal.addEventListener('abort', onAbort, { once: true });
        let settled = false;
        const finish = (result) => {
            if (settled)
                return;
            settled = true;
            if (killTimer !== undefined)
                clearTimeout(killTimer);
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
            // A child that never started emits 'close' after 'error'; it already logged why.
            if (settled)
                return;
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
