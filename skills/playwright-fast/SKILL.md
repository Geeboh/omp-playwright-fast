---
name: playwright-fast
description: Fast browser QA for OMP web projects: use Playwright Chromium, Firefox, WebKit for changed UI testing, DOM/interaction regression, responsive design, screenshot evidence, cross-browser releases, and autonomous bug fixes. Includes conservative impact selection, parallel workers and token-efficient reporting. Invoke when browser verification is needed, not for design-only discussion.
---
# Playwright Fast v2.0.3
Use built-in `playwright_fast` extension tool when installed; `/pw-fast` is the conversational command, and `node <plugin>/bin/pw-smart.mjs` is CLI alternative.

## Default workflow
1. On suspected plugin/tool mismatch, run `/pw-fast version` (no LLM) or `playwright_fast({action:'version'})` and require v2.0.3. Restart OMP after extension upgrades; `/reload-plugins` alone may not replace a loaded extension module.
2. Discover existing project test conventions, server startup, base URL and existing Playwright config. Never overwrite.
3. `playwright_fast({action:'doctor'})`; if missing tooling, `action:'setup', browser:'chromium'` after ordinary dependency-change approval. Linux packages require explicit `withDeps`.
4. Use `action:'plan', profile:'affected'` before execution. Inspect fallback mode. If no safe dependency map, full selected-browser suite is intentional.
5. `action:'run', profile:'affected'` for application work; `quick` for all Chromium tests; `smoke` for tagged smoke; `failed` to rerun. Provide server URL/config as project implementation requires.
6. For release/feature freeze, install all three browsers and run `matrix` or `full`, verifying the project's config actually names chromium/firefox/webkit projects.
7. Fix root causes, not tests to fit a broken UI. Keep test data deterministic and isolated. Report pass/fail counts, skipped tests, elapsed time, unsupported browsers, and evidence paths accurately.

## Design QA
For completed UI implementations, verify at representative mobile, tablet, desktop viewports; keyboard navigation; focus handling; overflow, layout regressions, page errors and interactive states. Screenshots are evidence, not a substitute for assertions. Use a design skill for design decisions and Playwright for checking real rendered UI.

## Token and performance discipline
Use selectors by role/label/testid; test fixtures and typed helpers; shared auth/storage state only when security-appropriate; API setup instead of UI login when possible; avoid hard sleeps; reserve traces/screenshots for failures; cap workers by CPU and free memory; do not run three browsers for every small edit; never blindly retry flaky tests. Avoid nonessential console dumps, print concise structured failures. Distinguish plan/dry-run from actual execution.

## Cautions
The `affected` algorithm handles directly changed tests/direct imports conservatively; it is NOT a complete dependency graph. Ambiguous source changes cause fallback to the whole selected-browser suite. No zero-test PASS. Matrix scope respects the existing Playwright projects. Plugin auto-discovery does not guarantee invocation by every model, so use AGENTS.md routing text and explicit tools/commands.

## Runtime and Task Plan troubleshooting
The extension must invoke the standalone runner using Node.js, not OMP/Bun `process.execPath`. If OMP returns `unknown flag: --browser` or `No default model selected` from `playwright_fast`, upgrade to v2.0.3, check `scripts/diagnose-install.mjs` for shadowing plugin copies, and fully restart OMP. A zero-exit `doctor` that still says `doctor failed` is not proof of correct execution; inspect its JSON. Break `task_plan` steps into single, concrete, verifiable actions when semantic assessment rejects a multi-action step.
