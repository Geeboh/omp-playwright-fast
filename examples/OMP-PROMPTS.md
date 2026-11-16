# Ready-to-paste Oh My Pi prompts

## Fast everyday test

/skill:playwright-fast Audit the current app's web tests, bootstrap missing tooling safely, create/update a few meaningful @smoke tests, then run Chromium smoke and fix discovered defects. Use minimal context and concise failure summaries. Do not introduce manual user acceptance gates.

## Goal / YOLO release-quality cross-browser gate

/goal Under autonomous execution, use the playwright-fast skill to inspect the existing app and tests, bootstrap Playwright as needed, harden independent DRY tests, run targeted Chromium gates while remediating, then verify Chromium, Firefox, WebKit. Stop only for genuine external permissions/credentials/unsafe actions. Do not pretend untested gates have passed. Preserve existing config and evidence, minimize tokens, avoid redundant runs. Produce a final evidence summary.

## Focused test fix

/skill:playwright-fast Reproduce only the failing Playwright tests, diagnose from trace and concise logs, fix root cause, rerun --last-failed then the smallest relevant regression scope. Avoid full matrices until the targeted fix is proven.

## Runtime advice

Prefer direct `/skill:playwright-fast` for ordinary testing; `/goal` for autonomous multi-stage remediation. `/vibe` optional for exploratory UI QA but not necessary for reproducible testing. `/prewalk` once for unfamiliar large repositories; avoid repeated prewalk scans.
