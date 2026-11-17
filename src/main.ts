import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../bin/pw-smart.mjs', import.meta.url));
const actions = ['doctor', 'setup', 'plan', 'run'] as const;
const profiles = ['quick', 'smoke', 'affected', 'failed', 'matrix', 'full'] as const;
const browsers = ['chromium', 'firefox', 'webkit', 'all'] as const;

function execute(cwd: string, args: string[], signal?: AbortSignal): Promise<{ code: number, output: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], signal });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => {
      output += chunk.toString();
      if (output.length > 12000) output = output.slice(-12000);
    });
    child.on('error', (err) => resolve({ code: 1, output: `Execution error: ${err.message}\n${output}` }));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

export default function (pi: ExtensionAPI) {
  const z = pi.zod;
  pi.registerTool({
    name: 'playwright_fast',
    label: 'Playwright Fast QA',
    description: 'Run or plan targeted Playwright QA in the current Node web project, or inspect captured debug console output. Use for UI changes, interactions, visual layout, responsive behavior, browser regressions. Plan first when cost uncertain. Runs Chromium by default; matrix across Chromium, Firefox and WebKit for release.',
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
      const args = [params.action];
      if (params.profile) args.push('--profile', params.profile);
      if (params.browser) args.push('--browser', params.browser);
      if (params.workers) args.push('--workers', String(params.workers));
      if (params.base) args.push('--base', params.base);
      if (params.lines) args.push('--lines', String(params.lines));
      if (params.dryRun) args.push('--dry-run');
      if (params.withDeps) args.push('--with-deps');
      const result = await execute(ctx.cwd, args, signal);
      return { content: [{ type: 'text', text: `Exit: ${result.code}\n${result.output}` }], details: { exitCode: result.code } };
    }
  });
  pi.registerCommand('pw-fast', {
    description: 'Playwright fast QA: /pw-fast [doctor|setup|plan|run] [--profile quick|affected|matrix] ...',
    handler: async (input, ctx) => {
      // Command dispatches a reproducible QA workflow through the agent; it does not silently execute shell code.
      const safe = input.trim() || 'plan --profile affected';
      pi.sendMessage({ customType: 'playwright-fast-request', content: `Use playwright_fast to perform: ${safe}. Work in ${ctx.cwd}. Report measured results; do not claim success on skipped runs.`, display: true, attribution: 'user' });
    }
  });
}
