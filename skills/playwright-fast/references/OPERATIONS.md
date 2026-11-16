# Playwright Fast operations

## Execution tiers

| Tier | Scope | When |
|---|---|---|
| smoke | `@smoke` on Chromium | edit loop; requires smoke tags |
| quick | all tests on Chromium | pre-commit, untagged suites |
| changed | changed *test files* only, Chromium | when test files changed; not code-impact selection |
| failed | native `--last-failed` on Chromium | debugging, scoped previous result |
| matrix | all configured browser projects | cross-browser release validation |
| full | same as matrix, expandable by project | feature freeze |

`--browser` at run time is currently reserved for setup selection and does not override profiles. To run just Firefox, call the project-local Playwright CLI directly with `test --project=firefox`.

## Bootstrap/install

- `setup` uses existing project's lockfile manager (pnpm > yarn > bun > npm when multiple lockfiles, but multiple locks should be manually resolved).
- Installs dev dependency only when missing; never overwrites config. A generated config is a starter, not a universal app definition.
- Browser binaries share Playwright's OS cache. To avoid installing unneeded browsers, bootstrap Chromium only. Install all three before matrix.
- Linux system libraries: `setup --browser all --with-deps` may invoke privileged OS package installation; use only on a trusted build host. On non-Debian hosts inspect upstream compatibility first.
- WebKit is a Playwright build of WebKit, not branded Safari; Firefox also uses Playwright's patched build.
- New app requires live server. Configure `webServer` in config once, or start existing app server yourself. PW_BASE_URL targets a running instance and must be wired to config.
- Existing configs may use arbitrary project names, testDirs, reporters and auth. Match actual project names before running the wrapper or adapt wrapper.

## Speed optimization

- First measure `time` to establish baseline, then compare by tier; avoid assuming more workers always means faster.
- Run no more workers than CPU and realistic app capacity; start with 2-4. Reduce workers if DB writes, memory, or dev server saturates.
- Server should be started/reused once per test run, not per test; prefer `webServer` with `reuseExistingServer: !CI` on trusted dev hosts.
- Reuse auth via setup project + protected storageState files when worth it; exclude auth state from VCS. Do not share mutable accounts across workers.
- Retry on CI once to classify flaky failures, not to hide reliability issues.
- Avoid screenshot/video on successful tests; use failure artifacts only. Collect trace on failure or first retry according to needs.
- Mocks are appropriate for deterministic unit-like browser tests, but keep real integration journeys.
- Prefer locator and `expect` auto-waiting; never `waitForTimeout` as normal synchronization.
- Run WebKit/Firefox at least on release gates, important UI changes and critical flows.

## Sharding and reporting

- Shard on independent CI agents: `--shard 1/3`, `2/3`, `3/3`. Sharding serially on the same machine does not speed up work.
- `--list` discovers tests without browser test execution; wrapper `--dry-run` only prints planned commands.
- Shell runner records `.playwright-fast/last-run.log` and `.playwright-fast/last-run.summary`; `playwright-report/` is from Playwright HTML reporter.
- Use per-job unique output directories for parallel CI jobs; otherwise reporters may clobber artifacts. For distributed CI use blob reporters and `merge-reports` outside this basic runner.
- On failures report short stack, browser/project, test path, trace, how reproducible, severity. Don't dump whole logs into LLM context.

## Known limitations (intentional)

- Runner does not discover actual impacted tests from app source changes; `--only-changed` is Git changed-test selection only.
- No self-managed remote browser farm, credential provisioning, screenshot baseline auto-approval, or flaky quarantine.
- Installer handles Node test projects. For Python Playwright repositories, design a separate venv adapter; never `pip install` into global Python.
- Does not auto-change a site's implementation, commit changes, or install non-Playwright npm project dependencies.
