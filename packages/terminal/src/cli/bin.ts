#!/usr/bin/env node
/** The `frame12-term` executable. See `./main.ts`. */
import { main } from './main.js';

const code = await main(process.argv.slice(2), { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr, env: process.env });
process.exitCode = code;
