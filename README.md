# OMP Playwright Fast v2.0.3 — plugin-first browser QA

> **v2.0.3 release:** Adds debug console capture and bounded inspection alongside the existing version fingerprinting and diagnostics.

A reusable OMP plugin bundling a discoverable skill, slash command, model-callable browser QA tool, and smart CLI. v2 upgrades the earlier standalone v1 skill. No Python dependency.

## Upgrade and verify loaded plugin (important)

v2.0.0 accidentally called `spawn(process.execPath, ...)` from the OMP extension.
In a Bun-compiled OMP host, `process.execPath` points to `omp`, **not** Node.
The observed `unknown flag: --browser`, `No default model selected`, and misleading
`Exit: 0 / doctor failed` messages stem from launching nested OMP instead of the
Playwright runner. Removing `--browser` or configuring another model will not fix it.

**Preferred repair:** Keep the plugin in a stable directory, extract v2.0.3 there, relink to that exact directory, then fully restart the OMP PROCESS (not merely the model session). For example, from the parent containing `omp-playwright-fast-v2/`:

```bash
# Back up local edits first if you modified the plugin.
unzip -o /path/to/omp-playwright-fast-v2.0.3.zip
# Explicitly set the global plugin link to this corrected location.
cd omp-playwright-fast-v2
node scripts/diagnose-install.mjs --project /code/tadaproject/The-Adaptive-Disaster-Appliance
omp plugin link "$PWD"
# QUIT all OMP processes that can hold this old extension, then start a fresh OMP process.
# In fresh OMP: /pw-fast version
```

Relinking the same package name with `omp plugin link "$PWD"` updates its global link. Project plugin copies and native `.omp/extensions` may still shadow or duplicate it: the diagnostic identifies common locations but does not delete them. Inspect them before removing anything. If you are using named OMP profiles or unusual config roots, also inspect `omp plugin list` for the exact active profile.

v2.0.3 explicitly starts `node` (never `process.execPath`) for the CLI runner,
reports failed subprocesses as failed tools, and safely formats subprocess errors.
Node.js 20+ must be on PATH inside the OMP environment. If it is installed somewhere
else, set `OMP_PLAYWRIGHT_NODE=/absolute/path/to/node` **before starting OMP**.

Verification in the target web project, in a **new OMP process**:

```text
/pw-fast version   # MUST report v2.0.3 and the loaded extension path
/pw-fast version
/pw-fast doctor
/pw-fast plan --profile affected --browser chromium
```

Direct runtime sanity check (bypasses the OMP extension):

```bash
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs version
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs doctor --browser chromium
```

If `/pw-fast version` is unrecognized or reports the wrong version, the new extension has not loaded; do not retry `setup` with fewer arguments. Verify OMP profile, plugin paths, native extensions, and fully restart the host.

The `Task Plan` semantic assessment error is independent. Write each OMP plan step
as one specific action with one measurable result; split combined multi-action
steps before retrying the plan.

## Regression tests

From the plugin root, run `npm test`. The test suite uses a fake Playwright CLI
and validates doctor, affected planning, run summaries, zero-test rejection, all-browser setup,
version identity, plugin inventory diagnostics and extension tool registration/Node launching/error propagation. The TypeScript
extension integration test runs on Node 22+; on Node 20 it is skipped, while the
CLI tests still run. These tests do **not** download browsers or launch a real OMP
session; a live OMP integration and all three browser engines still need
verification in the actual project.

## Install (recommended)

```bash
unzip omp-playwright-fast-v2.0.3.zip
cd omp-playwright-fast-v2
./install.sh --plugin
# equivalent: omp plugin link "$PWD"
```

Plugin links target a local directory; **do not delete or move the extracted folder after linking**. For distribution, publish to a git repository with package.json and then install by a pinned git ref (e.g. `omp plugin install 'git+https://github.com/ORG/REPO.git#v2.0.3'` once it exists). No remote repo is assumed to exist yet. Restart OMP or reload plugins after installation. Check `omp plugin list`.

Standalone fallback (does not register extension tools): `./install.sh --global-skill` or `./install.sh --project-skill /code/project`. Avoid installing both copies under the same skill name; native skill locations have higher discovery priority than plugin-bundled skills.

## Automatic adoption

Copy **AGENTS.snippet.md** into your global OMP AGENTS.md (where your OMP version looks for global agent instructions), or append it to each project's `AGENTS.md`. Global instruction placement varies by OMP profile; verify your effective agent config. Plugin exposes `playwright_fast` tool; the instruction makes the behavior explicit. Autonomous recognition is guidance, not hardwired interception of every code-edit tool. The plugin intentionally does not run browser tests on every file write.

## Usage within OMP

```
/pw-fast version
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
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs version
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs doctor
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs setup --browser chromium
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs plan --profile affected
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs run --profile affected
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs setup --browser all
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs run --profile matrix
node /path/to/omp-playwright-fast-v2/bin/pw-smart.mjs debug --lines 80
```

**Read-only install diagnostics:** `node scripts/diagnose-install.mjs --project /code/tadaproject/The-Adaptive-Disaster-Appliance` reports global/project plugin copies and likely duplicate native extensions; it never deletes or updates anything. `./install.sh --diagnose --project /code/tadaproject/The-Adaptive-Disaster-Appliance` is equivalent. Note that non-default OMP profiles/custom config paths may require extra checks.

**Immediate setup bypass:** from your web project root, run `node /absolute/path/to/omp-playwright-fast-v2/bin/pw-smart.mjs setup --browser all` to install browsers without going through a potentially stale OMP extension.

`--dry-run` works with setup and run. `plan` is inherently non-executing. `--with-deps` permits Playwright to install Linux system packages (may require root); it is never the default. `--workers N` caps concurrency at 32; default clamps to 4, free memory, and available CPU. `--base REF` specifies git comparison ref (default HEAD; working-tree edits and untracked files are included). Existing Playwright config is respected. Set up your test configuration yourself if none exists, using `skills/playwright-fast/templates/playwright.config.ts` as a starting point.

## Impact safety

`affected` detects Git changes and changed `.spec.*` files. It selects known directly importing tests. For opaque changes, changed config, uncovered files, missing Git comparison, or uncertain imports it deliberately falls back to **all tests for the selected browser**. This is a safe initial impact-selection design, not a complete dependency graph. Quick is all tests in one engine; smoke selects `@smoke`. Matrix/full runs all projects configured in Playwright config, **not necessarily three engines** if you have changed the config. No tests means no proof of quality.

## Execution history and evidence

`.playwright-fast/last-run.json` contains timings, exit code, samples, the console artifact path and Playwright's JSON summary (when produced). `.playwright-fast/last-run.console.log` retains labeled stdout/stderr from the latest run; inspect its bounded tail with `debug --lines N`. `.playwright-fast/history.json` retains the most recent 100 parseable runs. These histories are the foundation for later predictive scheduling; **v2 records measurements but does not yet reorder or shard based on historical duration**. Run output is reduced to summary and failures; inspect Playwright HTML/traces separately as configured.

## Important operational constraints

- Playwright browser binaries require an internet connection for first-time download; Linux shared libraries may need `--with-deps`.
- No automatic dev-server discovery or startup beyond your existing `playwright.config.*` `webServer` setting.
- Tests must avoid sharing mutable accounts/data across parallel workers; prefer deterministic fixtures, per-worker resources and API setup.
- A malicious or untrusted plugin executes in the OMP host process. Audit before enabling. Tool permission is `exec`; commands are explicit.
- Browser engine equality is not guaranteed on every OS; Chromium, Firefox and WebKit checks depend on host support.
- Native plugin packaging and manifest syntax were based on OMP documentation; local OMP-host integration still requires verification.

## Compatibility

The `skills/playwright-fast/scripts/pw-fast.sh` v1 runner is retained for familiar commands and flags. v2 smart mode is invoked through plugin tooling or `bin/pw-smart.mjs`.
