# Changelog

## v2.0.3 — Debug console inspection

- Add `debug --lines N` to inspect the latest Playwright stdout/stderr capture.

## v2.0.2 — Loaded-version and setup diagnostics

- Add `/pw-fast version` (in-process, no model/tool subprocess) and `playwright_fast({action:'version'})` with extension path and Node command.
- Include v2.0.2 version marker in all successful tool outputs and JSON CLI plans/doctor.
- Add read-only `scripts/diagnose-install.mjs` to detect project/global stale plugin links and duplicate native extensions.
- Explicitly document full OMP process restart for extension updates and project-scoped plugin shadowing.
- Add regression test for `setup --browser all` through both runner and extension, and tests for diagnostics.
- Allow `doctor` and `version` without project `package.json` (setup/run still require a project).

## v2.0.1 — runtime hotfix

- **Fix:** extension launches Playwright CLI via `node`, not OMP/Bun `process.execPath`.
- **Fix:** non-zero child exits reject the tool call rather than appearing successful.
- **Fix:** spawned-process errors are reported without crashing the runner.
- **Test:** add offline CLI and extension integration regression coverage.
- **Docs:** reliable upgrade instructions and Task Plan semantic-validation guidance.
- **Compatibility:** plugin directory name, commands, flags, and runner format unchanged.

## v2.0.0

- Plugin-first Playwright skill, automatic routing instructions, conservative affected selection, and CI-friendly runner.
