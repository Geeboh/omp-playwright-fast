---
name: playwright-fast
description: Fast browser QA for OMP web projects: use Playwright Chromium, Firefox, WebKit for changed UI testing, DOM/interaction regression, responsive design, screenshot evidence, cross-browser releases, and autonomous bug fixes. Includes conservative impact selection, parallel workers and token-efficient reporting. Invoke when browser verification is needed, not for design-only discussion.
---
# Playwright Fast v2
Use built-in `playwright_fast` extension tool when installed; `/pw-fast` is the conversational command, and `node <plugin>/bin/pw-smart.mjs` is CLI alternative.

## Default workflow
1. Discover existing project test conventions, server startup, base URL and existing Playwright config. Never overwrite.
2. `playwright_fast({action:'doctor'})`; if missing tooling, `action:'setup', browser:'chromium'` after ordinary dependency-change approval. Linux packages require explicit `withDeps`.
3. Use `action:'plan', profile:'affected'` before execution. Inspect fallback mode. If no safe dependency map, full selected-browser suite is intentional.
4. `action:'run', profile:'affected'` for application work; `quick` for all Chromium tests; `smoke` for tagged smoke; `failed` to rerun. Provide server URL/config as project implementation requires.
5. For release/feature freeze, install all three browsers and run `matrix` or `full`, verifying the project's config actually names chromium/firefox/webkit projects.
6. Fix root causes, not tests to fit a broken UI. Keep test data deterministic and isolated. Report pass/fail counts, skipped tests, elapsed time, unsupported browsers, and evidence paths accurately.

## Design QA
For completed UI implementations, verify at representative mobile, tablet, desktop viewports; keyboard navigation; focus handling; overflow, layout regressions, page errors and interactive states. Screenshots are evidence, not a substitute for assertions. Use a design skill for design decisions and Playwright for checking real rendered UI.

## Token and performance discipline
Use selectors by role/label/testid; test fixtures and typed helpers; shared auth/storage state only when security-appropriate; API setup instead of UI login when possible; avoid hard sleeps; reserve traces/screenshots for failures; cap workers by CPU and free memory; do not run three browsers for every small edit; never blindly retry flaky tests. Avoid nonessential console dumps, print concise structured failures. Distinguish plan/dry-run from actual execution.

## Cautions
The `affected` algorithm handles directly changed tests/direct imports conservatively; it is NOT a complete dependency graph. Ambiguous source changes cause fallback to the whole selected-browser suite. No zero-test PASS. Matrix scope respects the existing Playwright projects. Plugin auto-discovery does not guarantee invocation by every model, so use AGENTS.md routing text and explicit tools/commands.
