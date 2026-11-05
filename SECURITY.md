# Security Policy

## Supported versions

FRAME/12 is pre-1.0. Security fixes land on the `main` branch and in the registry it publishes at `https://frame12.dev/r/*.json`. Re-run `npx shadcn@latest add …` to pull in fixed component source.

| Version | Supported |
| --- | --- |
| `main` and the current `frame12.dev` registry | ✅ |
| Older copies already installed in your project | Update to the current registry |

## Reporting a vulnerability

**Please do not report security issues in public issues, pull requests, or discussions.**

Report them privately through GitHub instead: open the repository's **Security** tab, choose **Report a vulnerability**, and fill in the advisory form.

Please include:

- the affected component, block, script, or page;
- steps to reproduce or a proof of concept;
- the impact you expect, such as XSS through a component prop or a supply-chain risk in a registry payload.

## What to expect

FRAME/12 is maintained by one person, so responses are best-effort:

- an acknowledgement within **7 days**;
- an assessment and fix plan once the issue is confirmed;
- credit in the advisory and the CHANGELOG, unless you'd rather stay anonymous.

## Scope

**In scope:**

- the component and block source in `registry/`;
- the published registry JSON at `frame12.dev/r/*.json`;
- the documentation site in `site/`;
- the build, lint, and install scripts in `scripts/`;
- the agent skill and linter in `skills/frame12/`.

**Not vulnerabilities:**

- **Demo credentials.** Keys and IDs in the demo blocks are fictional fixtures. For example, `f12_sim_*` API keys, `whsec_f12_*` webhook secrets, and `@atelier-koma.io` addresses are deliberately fake and grant no access.
- **Issues in third-party dependencies** such as React, Next.js, Radix, or shadcn. Please report those upstream, though a heads-up here is welcome if FRAME/12 is affected.
