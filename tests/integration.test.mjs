import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, chmodSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import * as nodeModule from 'node:module';

const pluginRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runner = resolve(pluginRoot, 'bin/pw-smart.mjs');
const diagnostic = resolve(pluginRoot, 'scripts/diagnose-install.mjs');

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'omp-pwfast-test-'));
  mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), '{"name":"test-app","private":true}');
  writeFileSync(join(dir, 'playwright.config.js'), '// test fixture\n');
  writeFileSync(join(dir, 'node_modules/.bin/playwright'), `#!/usr/bin/env node
if (process.argv.includes('install')) {
  if (process.env.RECORD_INSTALL_ARGS) require('node:fs').writeFileSync(process.env.RECORD_INSTALL_ARGS, JSON.stringify(process.argv.slice(2)));
  process.exit(0);
}
if (process.argv.includes('test')) {
  if (process.env.FAKE_MALFORMED_JSON === '1') { console.log('not json'); process.exit(0); }
  const passed = process.env.FAKE_ZERO_TESTS !== '1';
  const skipped = process.env.FAKE_SKIPPED_TESTS === '1';
  console.log(JSON.stringify({
    stats: { expected: skipped ? 0 : (passed ? 1 : 0), unexpected: 0, flaky: 0, skipped: skipped ? 1 : 0 },
    suites: skipped ? [] : (passed ? [{ specs: [{ file: 'tests/smoke.spec.ts', title: 'ok', tests: [{ projectName: 'chromium', results: [{ status: 'passed', duration: 9 }] }] }] }] : []),
  }));
  console.error('fixture debug stderr');
  process.exit(0);
}
console.error('unexpected mock command');
process.exit(2);
`);
  chmodSync(join(dir, 'node_modules/.bin/playwright'), 0o755);
  return dir;
}
function call(root, args, env={}) {
  return spawnSync(process.execPath, [runner, ...args], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8' });
}

test('doctor: returns structured status without invoking a model or LLM', () => {
  const root = fixture();
  try {
    const result = call(root, ['doctor', '--browser', 'chromium']);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.playwrightInstalled, true);
    assert.equal(report.configPresent, true);
  } finally { rmSync(root, {recursive:true, force:true}); }
});

test('plan: retains Chromium argument and conservatively broadens uncertain selection', () => {
  const root = fixture();
  try {
    const result = call(root, ['plan', '--profile', 'affected', '--browser', 'chromium']);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.impact.mode, 'fallback-all');
    assert.ok(report.commandLine.includes('--project=chromium'));
    assert.ok(!report.commandLine.includes('--last-failed'));
  } finally { rmSync(root, {recursive:true, force:true}); }
});

test('run: writes concise history on successful JSON output', () => {
  const root = fixture();
  try {
    const result = call(root, ['run', '--profile', 'affected', '--browser', 'chromium']);
    assert.equal(result.status, 0, result.stderr);
    const info = JSON.parse(readFileSync(join(root, '.playwright-fast/last-run.json'), 'utf8'));
    assert.equal(info.exitCode, 0);
    assert.equal(info.stats.expected, 1);
    assert.equal(info.samples[0].status, 'passed');
  } finally { rmSync(root, {recursive:true, force:true}); }
});

test('run: malformed JSON is a failure', () => {
  const root = fixture();
  try {
    const result = call(root, ['run', '--profile', 'affected'], {FAKE_MALFORMED_JSON: '1'});
    assert.equal(result.status, 1, result.stdout + result.stderr);
  } finally { rmSync(root, {recursive:true, force:true}); }
});

test('run: all skipped tests are not a passing validation', () => {
  const root = fixture();
  try {
    const result = call(root, ['run', '--profile', 'affected'], {FAKE_SKIPPED_TESTS: '1'});
    assert.equal(result.status, 3, result.stdout + result.stderr);
  } finally { rmSync(root, {recursive:true, force:true}); }
});

test('run: captures and inspects debug console output', () => {
  const root = fixture();
  try {
    const result = call(root, ['run', '--profile', 'affected', '--browser', 'chromium']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /last-run\.console\.log/);
    const debug = call(root, ['debug', '--lines', '1']);
    assert.equal(debug.status, 0, debug.stderr);
    assert.equal(debug.stdout.trim(), 'fixture debug stderr');
  } finally { rmSync(root, {recursive:true, force:true}); }
});

test('run: zero tests is a failure, not a green check', () => {
  const root = fixture();
  try {
    const result = call(root, ['run', '--profile', 'affected'], {FAKE_ZERO_TESTS: '1'});
    assert.equal(result.status, 3, result.stdout + result.stderr);
  } finally { rmSync(root, {recursive:true, force:true}); }
});


test('setup: browser=all installs three browser engines via the Playwright binary, not omp', () => {
  const root = fixture();
  try {
    const argsPath = join(root, 'install-args.json');
    const result = call(root, ['setup', '--browser', 'all'], {RECORD_INSTALL_ARGS: argsPath});
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /chromium,firefox,webkit/);
    assert.match(result.stdout, /node_modules\/\.bin\/playwright/);
    assert.deepEqual(JSON.parse(readFileSync(argsPath, 'utf8')), ['install','chromium','firefox','webkit']);
    assert.doesNotMatch(result.stderr, /unknown flag: --browser/);
  } finally { rmSync(root, { recursive:true, force:true }); }
});

test('version: no project or model required', () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-pwfast-empty-'));
  try {
    const version = call(root, ['version']);
    assert.equal(version.status, 0, version.stderr);
    assert.match(version.stdout, /2\.0\.3/);
    const doctor = call(root, ['doctor']);
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.equal(JSON.parse(doctor.stdout).packageJsonPresent, false);
  } finally { rmSync(root, { recursive:true, force:true }); }
});

test('install diagnostic identifies current and stale project plugin copies', () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-pwfast-install-'));
  const install = join(root, '.omp/plugins/node_modules');
  try {
    mkdirSync(install, {recursive:true});
    symlinkSync(pluginRoot, join(install, 'omp-playwright-fast'));
    const good = spawnSync(process.execPath, [diagnostic, '--project', root, '--json'], {
      cwd:root, encoding:'utf8', env:{...process.env,HOME:root,XDG_DATA_HOME:join(root,'xdg')},
    });
    assert.equal(good.status, 0, good.stderr);
    const report=JSON.parse(good.stdout);
    assert.equal(report.pluginCopies.length,1);
    assert.equal(report.pluginCopies[0].version,'2.0.3');
    assert.equal(report.issues.length,0,JSON.stringify(report.issues));
    rmSync(join(install, 'omp-playwright-fast'));
    const stale=join(root,'old-plugin');
    mkdirSync(join(stale,'src'),{recursive:true});
    writeFileSync(join(stale,'package.json'),JSON.stringify({name:'omp-playwright-fast',version:'2.0.0'}));
    writeFileSync(join(stale,'src/main.ts'),'spawn(process.execPath, [script, ...args])');
    symlinkSync(stale, join(install, 'omp-playwright-fast'));
    const bad = spawnSync(process.execPath, [diagnostic, '--project', root, '--json'], {
      cwd:root, encoding:'utf8', env:{...process.env,HOME:root,XDG_DATA_HOME:join(root,'xdg')},
    });
    const broken=JSON.parse(bad.stdout);
    assert.equal(broken.pluginCopies[0].current,false);
    assert.ok(broken.pluginCopies[0].staleProcessExecPath);
    assert.ok(broken.issues.length>0);
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('install diagnostic rejects a missing project value', () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-pwfast-invalid-project-'));
  try {
    const result = spawnSync(process.execPath, [diagnostic, '--project', '--json'], {cwd:root, encoding:'utf8'});
    assert.equal(result.status, 2);
    assert.match(result.stderr, /--project needs value/);
  } finally { rmSync(root, {recursive:true, force:true}); }
});

test('install diagnostic reports symlinked native extensions deterministically', () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-pwfast-native-'));
  const dir = join(root, '.omp/extensions');
  try {
    mkdirSync(dir, {recursive:true});
    writeFileSync(join(dir, 'z.mjs'), 'register playwright_fast');
    writeFileSync(join(dir, 'b.mjs'), 'register playwright_fast');
    symlinkSync(join(dir, 'z.mjs'), join(dir, 'a.mjs'));
    const result = spawnSync(process.execPath, [diagnostic, '--project', root, '--json'], {cwd:root, encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    const files = report.nativeExtensionCopies.map((entry) => entry.file);
    assert.ok(files.includes(join(dir, 'a.mjs')));
    assert.deepEqual(files, [...files].sort());
  } finally { rmSync(root, {recursive:true, force:true}); }
});

test('extension: uses Node runner and surfaces failed subprocesses as tool errors', async (t) => {
  // Test the real TypeScript extension without adding dependencies to the plugin.
  // Node 22+ can strip erasable TS syntax; on Node 20 the CLI tests still run.
  if (typeof nodeModule.stripTypeScriptTypes !== 'function') {
    t.skip('Node 22+ is required for dependency-free TS extension integration tests');
    return;
  }
  const root = fixture();
  const dynamicPlugin = mkdtempSync(join(tmpdir(), 'omp-pwfast-extension-'));
  try {
    mkdirSync(join(dynamicPlugin, 'src'), {recursive:true});
    mkdirSync(join(dynamicPlugin, 'bin'), {recursive:true});
    copyFileSync(runner, join(dynamicPlugin, 'bin/pw-smart.mjs'));
    const typescript = readFileSync(resolve(pluginRoot, 'src/main.ts'), 'utf8');
    // Deliberately do not invoke process.execPath from the extension itself.
    assert.ok(!typescript.includes('spawn(process.execPath'));
    const transpiled = nodeModule.stripTypeScriptTypes(typescript, {mode:'strip'});
    const extensionPath = join(dynamicPlugin, 'src/main.mjs');
    writeFileSync(extensionPath, transpiled);
    const { default: extension } = await import(pathToFileURL(extensionPath));
    const chain = { optional() { return this; }, describe() { return this; }, min() { return this; }, max() { return this; }, int() {return this;} };
    let tool = null;
    let command = null;
    let messages = 0;
    extension({
      zod: { object: () => chain, enum: () => chain, number: () => chain, string: () => chain, boolean: () => chain },
      registerTool: (x) => { tool = x; },
      registerCommand: (name, x) => { assert.equal(name, 'pw-fast'); command = x; },
      sendMessage: () => { messages++; },
    });
    assert.ok(tool?.execute, 'extension tool must register');
    const ctx = { cwd: root, ui: { notify: (message) => { assert.match(message, /v2\.0\.3/); } } };
    const version = await tool.execute('call-0', { action: 'version' }, undefined, undefined, ctx);
    assert.match(version.content[0].text, /plugin v2\.0\.3/);
    assert.match(version.content[0].text, /src\/main\.mjs/);
    await command.handler('version', ctx);
    assert.equal(messages, 0, 'version command must not consume an LLM turn');
    const setup = await tool.execute('call-setup', { action: 'setup', browser: 'all' }, undefined, undefined, ctx);
    assert.match(setup.content[0].text, /chromium,firefox,webkit/);
    const doctor = await tool.execute('call-1', { action: 'doctor', browser: 'chromium' }, undefined, undefined, ctx);
    assert.match(doctor.content[0].text, /"playwrightInstalled": true/);
    const plan = await tool.execute('call-2', { action: 'plan', profile: 'affected', browser: 'chromium' }, undefined, undefined, ctx);
    assert.match(plan.content[0].text, /--project=chromium/);
    await assert.rejects(
      () => tool.execute('call-3', { action: 'run', profile: 'affected' }, undefined, undefined, {
        cwd: join(root, 'missing-project'),
      }),
      /Playwright Fast QA 'run' exited/,
    );
  } finally {
    rmSync(root, {recursive:true, force:true});
    rmSync(dynamicPlugin, {recursive:true, force:true});
  }
});
