// Registers tests/loader/hooks.mjs. Used as `node --import ./tests/loader/register.mjs`.
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);
