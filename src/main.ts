import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';

const PLUGIN_VERSION = '2.0.3';
const script = fileURLToPath(new URL('../bin/pw-smart.mjs', import.meta.url));
const actions = ['version', 'doctor', 'setup', 'plan', 'run', 'debug'] as const;
const profiles = ['quick', 'smoke', 'affected', 'failed', 'matrix', 'full'] as const;
const browsers = ['chromium', 'firefox', 'webkit', 'all'] as const;

// OMP itself may be a Bun-compiled executable. process.execPath then points to
// `omp`, NOT Node: using it would recursively launch OMP with our CLI flags.
// Playwright requires Node, so launch Node explicitly. A custom absolute path
// can be supplied when OMP's PATH does not contain the desired Node runtime.
const nodeRuntime = process.env.OMP_PLAYWRIGHT_NODE?.trim() || 'node';

function execute(cwd: string, args: string[], signal?: AbortSignal): Promise<{ code: number, output: string }> {
  return new Promise((resolve) => {
    let finished = false;
    let output = '';
    const stdoutDecoder = new StringDecoder();
    const stderrDecoder = new StringDecoder();
    const append = (decoder: StringDecoder, chunk: Buffer | Uint8Array) => {
      output += decoder.write(chunk);
      if (output.length > 16000) output = output.slice(-16000);
    };
    const finish = (code: number, message = '') => {
      if (finished) return;
      finished = true;
      output += stdoutDecoder.end();
      output += stderrDecoder.end();
      if (output.length > 16000) output = output.slice(-16000);
      resolve({ code, output: message + output });
    };
    try {
      const child = spawn(nodeRuntime, [script, ...args], {
        cwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        signal,
        shell: false,
      });
      child.stdout.on('data', (chunk: Buffer) => append(stdoutDecoder, chunk));
      child.stderr.on('data', (chunk: Buffer) => append(stderrDecoder, chunk));
      child.on('error', (err) => finish(1, signal?.aborted ? 'QA runner cancelled\n' : `Could not launch Node runtime '${nodeRuntime}': ${err.message}\nEnsure Node.js 20+ is on PATH or set OMP_PLAYWRIGHT_NODE to its absolute path.\n`));
      child.on('close', (code, exitSignal) => finish(code ?? 1, exitSignal ? `QA runner terminated by ${exitSignal}\n` : ''));
    } catch (err) {
      finish(1, `Could not launch QA runner: ${String(err)}\n`);
    }
  });
}

export default function (pi: ExtensionAPI) {
  const z = pi.zod;
  pi.registerTool({
    name: 'playwright_fast',
    label: 'Playwright Fast QA',
    description: 'Run or plan targeted Playwright QA in the current Node web project, or inspect captured debug console output. Use for UI changes, interactions, visual layout, responsive behavior, browser regressions. Plan first when cost uncertain. Runs Chromium by default; matrix runs all configured projects, so verify configured engine names for release.',
    approval: 'exec',
    parameters: z.object({
      action: z.enum(actions).describe('plan is non-executing; run invokes actual tests; debug inspects the latest captured console output; setup installs project dependencies and browsers'),
      profile: z.enum(profiles).optional(),
      browser: z.enum(browsers).optional(),
      workers: z.number().int().min(1).max(32).optional(),
      base: z.string().optional().describe('Git comparison revision for impact analysis'),
      lines: z.number().int().min(1).max(10000).optional().describe('Number of captured console lines to print for debug'),
      dryRun: z.boolean().optional(),
      withDeps: z.boolean().optional().describe('Explicit approval needed before OS package changes')
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      // In-process identity check detects stale extension modules and never launches OMP, Node or an LLM.
      if (params.action === 'version') {
        return { content: [{ type: 'text', text: `Playwright Fast plugin v${PLUGIN_VERSION}; extension=${fileURLToPath(import.meta.url)}; runner=${script}; node=${nodeRuntime}` }], details: { pluginVersion: PLUGIN_VERSION } };
      }
      const args = [params.action];
      if (params.profile) args.push('--profile', params.profile);
      if (params.browser) args.push('--browser', params.browser);
      if (params.workers) args.push('--workers', String(params.workers));
      if (params.base) args.push('--base', params.base);
      if (params.lines) args.push('--lines', String(params.lines));
      if (params.dryRun) args.push('--dry-run');
      if (params.withDeps) args.push('--with-deps');
      const result = await execute(ctx.cwd, args, signal);
      if (result.code !== 0) {
        // OMP treats a thrown error as a failed tool. Merely returning an
        // `Exit: 1` string can still display a green success checkmark.
        throw new Error(`Playwright Fast QA '${params.action}' exited ${result.code}.\n${result.output}`);
      }
      return { content: [{ type: 'text', text: `Playwright Fast plugin v${PLUGIN_VERSION}\nExit: 0\n${result.output}` }], details: { exitCode: 0 } };
    }
  });
  pi.registerCommand('pw-fast', {
    description: 'Playwright fast QA: /pw-fast [version|doctor|setup|plan|run|debug] [--profile quick|affected|matrix] ...',
    handler: async (input, ctx) => {
      // Command dispatches a reproducible QA workflow through the agent; it does not silently execute shell code.
      const safe = input.trim() || 'plan --profile affected';
      if (safe === 'version') {
        ctx.ui.notify(`Playwright Fast plugin v${PLUGIN_VERSION} loaded from ${fileURLToPath(import.meta.url)}`, 'info');
        return;
      }
      pi.sendMessage({ customType: 'playwright-fast-request', content: `Use playwright_fast to perform: ${safe}. Work in ${ctx.cwd}. Report measured results; do not claim success on skipped runs.`, display: true, attribution: 'user' });
    }
  });
}
