# Security Policy

## Supported versions

FRAME/12 is pre-1.0. Security fixes land on the `main` branch and in the registry it publishes at `https://frame12.dev/r/*.json`.

| Version | Supported |
| --- | --- |
| `main` and the current `frame12.dev` registry | ✅ |
| Older copies already installed in your project | Apply the fix as described below |

## Applying a security fix

shadcn copies FRAME/12 source into your project, so a fix only reaches you when you reinstall the affected items:

1. **Commit or back up your work first.** `--overwrite` replaces the installed files, including any edits you made to them.
2. **Reinstall each affected item with `--overwrite`.** The advisory names the items; you can also reinstall the whole kit.

   ```bash
   npx shadcn@latest add https://frame12.dev/r/<name>.json --overwrite
   # or the whole kit:
   npx shadcn@latest add https://frame12.dev/r/frame12.json --overwrite
   ```

   Without `--overwrite`, shadcn won't replace files that already exist, **even with `-y`**. It asks "Would you like to overwrite? (y/N)", and the default is **No**. In CI or coding-agent shells nobody answers, so the old, vulnerable file stays in place and the command still exits `0`.
3. **Review the changes with `git diff`.** Re-apply any customizations you still need. Keep token overrides in your own stylesheet, not in `styles/frame12.css`; see the [README](README.md#1-add-the-registry-kit).
4. **Confirm the fix landed.** Check that every file the advisory names appears in the diff.

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
- a published advisory naming the affected registry items and files, so you know what to reinstall;
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
