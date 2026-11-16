# OMP Playwright Fast v2.0 — plugin-first browser QA

A reusable OMP plugin bundling a discoverable skill, slash command, model-callable browser QA tool, and smart CLI. v2 upgrades the earlier standalone v1 skill. No Python dependency.

## Install (recommended)

```bash
unzip omp-playwright-fast-v2.0.zip
cd omp-playwright-fast-v2
./install.sh --plugin
# equivalent: omp plugin link "$PWD"
```

Plugin links target a local directory; **do not delete or move the extracted folder after linking**. For distribution, publish to a git repository with package.json and then install by a pinned git ref (e.g. `omp plugin install 'git+https://github.com/ORG/REPO.git#v2.0.0'` once it exists). No remote repo is assumed to exist yet. Restart OMP or reload plugins after installation. Check `omp plugin list`.

Standalone fallback (does not register extension tools): `./install.sh --global-skill` or `./install.sh --project-skill /code/project`. Avoid installing both copies under the same skill name; native skill locations have higher discovery priority than plugin-bundled skills.

## Automatic adoption

Copy **AGENTS.snippet.md** into your global OMP AGENTS.md (where your OMP version looks for global agent instructions), or append it to each project's `AGENTS.md`. Global instruction placement varies by OMP profile; verify your effective agent config. Plugin exposes `playwright_fast` tool; the instruction makes the behavior explicit. Autonomous recognition is guidance, not hardwired interception of every code-edit tool. The plugin intentionally does not run browser tests on every file write.

## Usage within OMP

```
/pw-fast doctor
/pw-fast plan --profile affected
/pw-fast run --profile affected
/pw-fast run --profile quick
/pw-fast setup --browser all
/pw-fast run --profile matrix
```

You can also ask OMP to test changed browser behavior and it can choose the `playwright_fast` tool. For UI design: design with your design skill, implement, then validate in Chromium, plus the other engines for release. `/skill:playwright-fast` remains available.

## Direct CLI from project root

```bash
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs doctor
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs setup --browser chromium
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs plan --profile affected
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs run --profile affected
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs setup --browser all
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs run --profile matrix
```

`--dry-run` works with setup and run. `plan` is inherently non-executing. `--with-deps` permits Playwright to install Linux system packages (may require root); it is never the default. `--workers N` caps concurrency at 32; default clamps to 4, free memory, and available CPU. `--base REF` specifies git comparison ref (default HEAD; working-tree edits and untracked files are included). Existing Playwright config is respected. Set up your test configuration yourself if none exists, using `skills/playwright-fast/templates/playwright.config.ts` as a starting point.

## Impact safety

`affected` detects Git changes and changed `.spec.*` files. It selects known directly importing tests. For opaque changes, changed config, uncovered files, missing Git comparison, or uncertain imports it deliberately falls back to **all tests for the selected browser**. This is a safe initial impact-selection design, not a complete dependency graph. Quick is all tests in one engine; smoke selects `@smoke`. Matrix/full runs all projects configured in Playwright config, **not necessarily three engines** if you have changed the config. No tests means no proof of quality.

## Execution history and evidence

`.playwright-fast/last-run.json` contains timings, exit code, samples and Playwright's JSON summary (when produced). `.playwright-fast/history.json` retains the most recent 100 parseable runs. These histories are the foundation for later predictive scheduling; **v2 records measurements but does not yet reorder or shard based on historical duration**. Run output is reduced to summary and failures; inspect Playwright HTML/traces separately as configured.

## Important operational constraints

- Playwright browser binaries require an internet connection for first-time download; Linux shared libraries may need `--with-deps`.
- No automatic dev-server discovery or startup beyond your existing `playwright.config.*` `webServer` setting.
- Tests must avoid sharing mutable accounts/data across parallel workers; prefer deterministic fixtures, per-worker resources and API setup.
- A malicious or untrusted plugin executes in the OMP host process. Audit before enabling. Tool permission is `exec`; commands are explicit.
- Browser engine equality is not guaranteed on every OS; Chromium, Firefox and WebKit checks depend on host support.
- Native plugin packaging and manifest syntax were based on OMP documentation; local OMP-host integration still requires verification.

## Compatibility

The `skills/playwright-fast/scripts/pw-fast.sh` v1 runner is retained for familiar commands and flags. v2 smart mode is invoked through plugin tooling or `bin/pw-smart.mjs`.
