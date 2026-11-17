#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, freemem } from 'node:os';
import { resolve, dirname, relative, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const RUNNER_VERSION = '2.0.3';
const ROOT = process.cwd();
const DIR = resolve(ROOT, '.playwright-fast');
const args = process.argv.slice(2);
const command = args.shift() || 'plan';
const opts = { profile: 'affected', browser: 'chromium', base: 'HEAD', dryRun: false, withDeps: false, workers: null, lines: 80 };
const validProfiles = ['quick', 'smoke', 'affected', 'failed', 'matrix', 'full'];
const browsers = ['chromium', 'firefox', 'webkit', 'all'];
function die(s) { console.error(`ERROR: ${s}`); process.exit(2); }
function shell(cmd, a, options = {}) { return spawnSync(cmd, a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32*1024*1024, ...options }); }
for (let i=0;i<args.length;i++) {
  const x = args[i];
  if (['--profile','--browser','--workers','--base','--lines'].includes(x)) {
    if (i+1>=args.length) die(`${x} needs value`);
    const key = x.slice(2).replace(/-([a-z])/g, (_,s)=>s.toUpperCase()); opts[key] = args[++i];
  } else if (x==='--dry-run') opts.dryRun=true;
  else if (x==='--with-deps') opts.withDeps=true;
  else if (x==='--help' || x==='-h') { console.log('pw-smart.mjs doctor|setup|plan|run --profile quick|smoke|affected|failed|matrix|full --browser chromium|firefox|webkit|all --workers N --base REF --dry-run --with-deps'); process.exit(0); }
  else if (x==='--help' || x==='-h') { console.log('pw-smart.mjs version|doctor|setup|plan|run|debug --profile quick|smoke|affected|failed|matrix|full --browser chromium|firefox|webkit|all --workers N --base REF --lines N --dry-run --with-deps'); process.exit(0); }
  else die(`unknown option ${x}`);
}
if (!['doctor','setup','plan','run'].includes(command)) die('invalid command');
if (!['version','doctor','setup','plan','run','debug'].includes(command)) die('invalid command');
if (!validProfiles.includes(opts.profile)) die('invalid profile');
if (!browsers.includes(opts.browser)) die('invalid browser');
if (opts.workers != null && (!/^\d+$/.test(String(opts.workers)) || +opts.workers<1 || +opts.workers>32)) die('workers must be 1..32');
if (!existsSync('package.json')) die('run from the web project root (package.json missing)');
if (!/^\d+$/.test(String(opts.lines)) || +opts.lines<1 || +opts.lines>10000) die('lines must be 1..10000');
if (command === 'debug') {
  const consolePath = resolve(DIR, 'last-run.console.log');
  if (!existsSync(consolePath)) die('no captured console output; run Playwright first');
  const output = readFileSync(consolePath, 'utf8').trimEnd();
  console.log(output ? output.split('\n').slice(-+opts.lines).join('\n') : '(no console output captured)');
  process.exit(0);
}
const pm = existsSync('bun.lock') || existsSync('bun.lockb') ? 'bun' : existsSync('pnpm-lock.yaml') ? 'pnpm' : existsSync('yarn.lock') ? 'yarn' : 'npm';
const pw = resolve(ROOT, 'node_modules/.bin/playwright');
const hasPW = existsSync(pw);
const hasConfig = ['ts','js','mts','mjs','cts','cjs'].some(s => existsSync(`playwright.config.${s}`));
const cpu = cpus().length || 2;
const mem = Math.max(1, Math.floor(freemem() / (1.5 * 1024**3)));
const workers = opts.workers ? +opts.workers : Math.max(1, Math.min(4, Math.max(1, cpu-1), mem));
const git = (a) => shell('git', a);
const clean = (s) => s.replaceAll('\\','/').replace(/^\.\//,'');
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
const knownExt = /\.(tsx?|jsx?|mjs|cjs|vue|svelte)$/;
const testsPattern = /(^|\/)(tests?|e2e|specs?)(\/|$)|\.spec\.[cm]?[jt]sx?$/;
const filesFromDiff = (a) => { const r=git(a); return r.status===0?r.stdout.split('\n').map(clean).filter(Boolean):null; };
function changed() {
  const base = filesFromDiff(['diff','--name-only','--diff-filter=ACMRTUXB',`${opts.base}...HEAD`]);
  if (base===null) return { files: [], uncertain: true, reason: `cannot compare ${opts.base}...HEAD` };
  const unstaged = filesFromDiff(['diff','--name-only']);
  const staged = filesFromDiff(['diff','--cached','--name-only']);
  const unknown = filesFromDiff(['ls-files','--others','--exclude-standard']);
  if ([unstaged,staged,unknown].some(x=>x===null)) return { files: base, uncertain:true,reason:'git working tree incomplete' };
  return { files: [...new Set([...base,...unstaged,...staged,...unknown])], uncertain:false,reason:'' };
}
function trackedTests() {
  const out = git(['ls-files','--cached','--others','--exclude-standard']);
  if (out.status!==0) return [];
  return out.stdout.split('\n').filter(x=>/\.spec\.[cm]?[jt]sx?$/.test(x) && existsSync(x));
}
function impacts() {
  const delta = changed();
  delta.files = delta.files.filter(f => !/(^|\/)(node_modules|\.playwright-fast|test-results|playwright-report|dist|build)\//.test(f));
  const tests = trackedTests();
  const direct = delta.files.filter(f => tests.includes(f));
  if (delta.uncertain) return { selection: [], mode:'fallback-all', reason:delta.reason, files:delta.files, tests };
  if (!delta.files.length) return { selection:[],mode:'fallback-all',reason:'no changed files; validation must not be silently skipped',files:[],tests };
  if (delta.files.some(f => /(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|playwright\.config\.[^/]+|vite\.config\.[^/]+|next\.config\.[^/]+|webpack\.config\.[^/]+|tsconfig[^/]*|\.github\/workflows\/)/.test(f))) return { selection:[],mode:'fallback-all',reason:'global or build configuration changed',files:delta.files,tests };
  // Conservative direct imports: select a test only when changed file is a direct relative module dependency.
  // Unknown transitive dependencies or changed application routes cause fallback-all, never false assurance.
  const impacted = new Set(direct);
  let uncertain = false;
  for (const file of delta.files.filter(x=> !tests.includes(x))) {
    if (!knownExt.test(file) || !existsSync(file)) { uncertain=true; continue; }
    let mapped=false;
    for (const test of tests) {
      const source=read(test);
      const rel=relative(dirname(resolve(test)), resolve(file)).replaceAll('\\','/');
      const patterns=[rel,rel.replace(/\.[^.]+$/,''),rel.replace(/\/index\.[^.]+$/,'')];
      if (patterns.some(p=>p && (source.includes(`'${p}'`) || source.includes(`"${p}"`) || source.includes(`'./${p}'`) || source.includes(`"./${p}"`)))) { impacted.add(test); mapped=true; }
    }
    if (!mapped) uncertain=true;
  }
  if (uncertain || !impacted.size) return { selection: [], mode:'fallback-all', reason:'application change cannot be proven covered by selected tests', files:delta.files,tests };
  return { selection:[...impacted],mode:'selected',reason:'direct test modifications/imports',files:delta.files,tests };
}
function runGitInfo() { const status=git(['rev-parse','--is-inside-work-tree']); return status.status===0; }
if (command==='doctor') {
  console.log(JSON.stringify({ root: ROOT, packageManager:pm, playwrightInstalled:hasPW, configPresent:hasConfig, git:runGitInfo(), cpu, availableMemoryGiB:+(freemem()/1024**3).toFixed(1), suggestedWorkers:workers },null,2)); process.exit(0);
}
if (command==='setup') {
  const add = pm==='pnpm'?['pnpm',['add','-D','@playwright/test']]:pm==='yarn'?['yarn',['add','-D','@playwright/test']]:pm==='bun'?['bun',['add','-d','@playwright/test']]:['npm',['install','--save-dev','@playwright/test']];
  const engines=opts.browser==='all'?['chromium','firefox','webkit']:[opts.browser];
  const setup = [...(!hasPW?[[add[0],...add[1]]]:[]),[pw,'install',...(opts.withDeps?['--with-deps']:[]),...engines]];
  console.log(`Setup plan: packageManager=${pm} browsers=${engines.join(',')} withDeps=${opts.withDeps}\n${JSON.stringify(setup)}`);
  if(opts.dryRun) process.exit(0);
  if (!hasPW) { const r=shell(add[0],add[1],{stdio:'inherit'}); if(r.status!==0) process.exit(r.status||1); }
  const r=shell(pw,['install',...(opts.withDeps?['--with-deps']:[]),...engines],{stdio:'inherit'});
  process.exit(r.status||0);
}
if (!hasPW || !hasConfig) die('Playwright or config missing; run setup and configure playwright.config.* (v1 template available)');
const impact=impacts();
const profile=opts.profile;
const selection=profile==='affected'?impact.selection:[];
const matrix=profile==='matrix'||profile==='full';
const chosen=matrix?'configured projects':(opts.browser==='all'?'configured projects':opts.browser);
const cli=['test',...selection];
if (!matrix && opts.browser!=='all') cli.push(`--project=${opts.browser}`);
if (profile==='smoke') cli.push('--grep','@smoke');
if (profile==='failed') cli.push('--last-failed');
cli.push('--workers',String(workers));
const plan={ action:command, profile, browser:chosen, workers, impact, selection, commandLine:[pw,...cli], dryRun:opts.dryRun, warning:profile==='affected' && impact.mode==='fallback-all'?`Full selected-browser fallback: ${impact.reason}`:null };
console.log(JSON.stringify(plan,null,2));
if (command==='plan'||opts.dryRun) process.exit(0);
mkdirSync(DIR,{recursive:true});
const started=Date.now();
const result=shell(pw,[...cli,'--reporter=json'],{ maxBuffer:64*1024*1024 });
const consolePath=resolve(DIR,'last-run.console.log');
const consoleOutput=[result.stdout ? `[stdout]\n${result.stdout}` : '', result.stderr ? `[stderr]\n${result.stderr}` : ''].filter(Boolean).join('\n');
writeFileSync(consolePath, consoleOutput ? `${consoleOutput}\n` : '');
let parsed=null;
try { parsed=JSON.parse(result.stdout); } catch {}
const emptySuite = parsed && (parsed.stats?.expected ?? 0) + (parsed.stats?.unexpected ?? 0) + (parsed.stats?.flaky ?? 0) + (parsed.stats?.skipped ?? 0) === 0;
const entry={ timestamp:new Date().toISOString(), elapsedMs:Date.now()-started, exitCode:emptySuite ? 3 : (result.status??1), profile, browser:chosen, workers, changedFiles:impact.files, selectionMode:profile==='affected'?impact.mode:'profile', stats:parsed?.stats??null, console:relative(ROOT,consolePath) };
if(parsed){
  const samples=[];
  function visit(suite) {
    for(const spec of suite.specs??[]) for(const test of spec.tests??[]) for(const r of test.results??[]) samples.push({id:`${spec.file??suite.file??''}:${spec.title}:${test.projectName}`, durationMs:r.duration??0,status:r.status??'unknown'});
    for(const nested of suite.suites??[]) visit(nested);
  }
  for(const suite of parsed.suites??[]) visit(suite);
  entry.samples=samples;
}
writeFileSync(resolve(DIR,'last-run.json'),JSON.stringify(entry,null,2));
if(parsed) {
  const historyPath=resolve(DIR,'history.json');
  let history=[]; try { history=JSON.parse(read(historyPath)); if(!Array.isArray(history)) history=[]; } catch {}
  history.push(entry); writeFileSync(historyPath, JSON.stringify(history.slice(-100),null,2));
  console.log(JSON.stringify({ exitCode:entry.exitCode,elapsedMs:entry.elapsedMs, stats:entry.stats, failing:entry.samples?.filter(x=>x.status!=='passed').slice(0,15), evidence:'.playwright-fast/last-run.json', console:entry.console },null,2));
} else {
  console.error('Non-JSON Playwright result or infrastructure error:',(result.stderr||result.stdout).slice(-6000));
  console.error(`Console output: ${entry.console}`);
}
if (emptySuite) console.error('ERROR: Playwright reported zero tests; not a passing validation');
process.exit(entry.exitCode);
