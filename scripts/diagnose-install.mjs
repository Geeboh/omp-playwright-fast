#!/usr/bin/env node
/**
 * Read-only OMP Playwright Fast plugin inventory.
 * Detects common stale/duplicate installation paths without modifying plugin state.
 */
import { existsSync, lstatSync, statSync, realpathSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join, dirname } from 'node:path';

const EXPECTED = '2.0.3';
const PLUGIN = 'omp-playwright-fast';
const args = process.argv.slice(2);
let project = process.cwd();
let asJson = false;
for (let i=0;i<args.length;i++) {
  if (args[i] === '--project') { const value = args[i+1]; if (!value || value.startsWith('-')) { console.error('--project needs value'); process.exit(2); } project = resolve(value); i++; }
  else if (args[i] === '--json') asJson = true;
  else if (args[i] === '--help') {
    console.log('node scripts/diagnose-install.mjs [--project /code/project] [--json]');
    process.exit(0);
  } else { console.error(`Unknown option ${args[i]}`); process.exit(2); }
}

function text(file) { try { return readFileSync(file,'utf8'); } catch { return ''; } }
function obj(file) { try { return JSON.parse(text(file)); } catch { return null; } }
function pathExists(file) { try { lstatSync(file); return true; } catch { return false; } }
function safeReal(file) { try { return realpathSync(file); } catch { return null; } }

const roots = [];
function addRoot(root, kind) { if (!roots.some(x=>x.root===root)) roots.push({root,kind}); }
addRoot(join(homedir(),'.omp','plugins'), 'user-default');
if (process.env.XDG_DATA_HOME) addRoot(join(process.env.XDG_DATA_HOME, 'omp', 'plugins'),'user-xdg');
const cfg = process.env.PI_CODING_AGENT_DIR || process.env.PI_CONFIG_DIR;
if (cfg) addRoot(join(cfg,'plugins'),'user-config-override');
let cur=resolve(project);
while (true) {
  addRoot(join(cur,'.omp','plugins'), cur===resolve(project)?'project':'project-ancestor');
  if (dirname(cur)===cur) break;
  cur=dirname(cur);
}

const discovered = [];
for (const {root,kind} of roots) {
  const slot=join(root,'node_modules',PLUGIN);
  if (!pathExists(slot)) continue;
  const target=safeReal(slot);
  const data=target ? obj(join(target,'package.json')) : null;
  const source=target ? text(join(target,'src','main.ts')) : '';
  const version=data?.version || 'unknown';
  const staleMarker = source.includes('spawn(process.execPath');
  const safeNodeMarker = source.includes('spawn(nodeRuntime');
  discovered.push({kind,slot,target,version,validManifest:data?.name===PLUGIN,
    staleProcessExecPath:staleMarker, explicitNodeRunner:safeNodeMarker,
    current:version===EXPECTED && safeNodeMarker && !staleMarker});
}

const native = [];
const candidateDirs=[join(homedir(),'.omp','agent','extensions')];
cur=resolve(project);
while(true) {
  candidateDirs.push(join(cur,'.omp','extensions'));
  if(dirname(cur)===cur) break;
  cur=dirname(cur);
}
for(const dir of [...new Set(candidateDirs)]) {
  if(!existsSync(dir)) continue;
  let entries=[];
  try { entries=readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)); } catch { continue; }
  const paths=[];
  const regular = (file) => { try { return statSync(file).isFile(); } catch { return false; } };
  const directory = (file) => { try { return statSync(file).isDirectory(); } catch { return false; } };
  for (const e of entries) {
    const entry = join(dir, e.name);
    if ((e.isFile() || e.isSymbolicLink()) && regular(entry) && /\.(?:ts|js|mjs|cjs)$/.test(e.name)) paths.push(entry);
    if ((e.isDirectory() || e.isSymbolicLink()) && directory(entry)) for (const name of ['index.ts','index.js','index.mjs','index.cjs']) {
      const file=join(entry,name); if (regular(file)) paths.push(file);
    }
  }
  for (const file of paths.sort()) {
    const source=text(file);
    if(source.includes('playwright_fast') || source.includes('Playwright Fast QA'))
      native.push({file, processExecPath:source.includes('spawn(process.execPath')});
  }
}

native.sort((a,b)=>a.file.localeCompare(b.file));
const issues=[];
if(discovered.length===0) issues.push('No conventional OMP plugin installation found; inspect omp plugin list and configured extension paths.');
for(const x of discovered) if(!x.current) issues.push(`Outdated/broken plugin copy: ${x.slot} -> ${x.target || '(broken link)'} (v${x.version}).`);
if(discovered.length>1) issues.push(`Multiple plugin copies (${discovered.length}) exist across roots. A project-scoped copy can shadow the user plugin.`);
if(native.length) issues.push(`${native.length} native extension(s) also register playwright_fast; these can conflict with the plugin tool.`);
const report={expectedVersion:EXPECTED,project:resolve(project),pluginCopies:discovered,nativeExtensionCopies:native,issues,
  guidance:issues.length ? 'Check active OMP plugin location, relink the updated package, remove/disable only identified duplicates, and START A NEW OMP PROCESS. /reload-plugins does not necessarily replace loaded extensions.' : 'No obvious on-disk conflicts. Start a new OMP process, then run /pw-fast version.'};
if(asJson) console.log(JSON.stringify(report,null,2));
else {
  console.log(`Playwright Fast install check (expected v${EXPECTED})`);
  console.log(`Project: ${report.project}`);
  for (const x of discovered) console.log(`  ${x.kind}: v${x.version} ${x.current?'OK':'STALE'}  ${x.slot} -> ${x.target||'(missing)'}`);
  for (const x of native) console.log(`  native: ${x.file} ${x.processExecPath?'[OLD process.execPath launcher]':''}`);
  for (const issue of issues) console.log(`WARNING: ${issue}`);
  console.log(report.guidance);
}
// Diagnostic reports issues, but does not make installation scripts fail automatically.
