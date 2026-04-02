import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import type { HookConfig, HookDefinition, PreHookResult } from './HookTypes';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Loads and executes project-level hooks defined in `.termimate/hooks.json`.
 *
 * PreToolUse hooks are blocking:
 *   - Exit code 0 → allow
 *   - Exit code 2 → block (stdout becomes the error message surfaced to the LLM)
 *   - Any other exit code → allow (avoid accidental blocks from unrelated failures)
 *
 * PostToolUse hooks are fire-and-forget (non-blocking).
 *
 * Hook processes receive the following environment variables:
 *   TERMIMATE_EVENT       = 'PreToolUse' | 'PostToolUse'
 *   TERMIMATE_TOOL        = tool name
 *   TERMIMATE_INPUT       = JSON-encoded tool input
 *   TERMIMATE_SUCCESS     = '1' | '0'          (PostToolUse only)
 *   TERMIMATE_OUTPUT      = tool output string  (PostToolUse only)
 */
export class HookExecutor {
  private readonly hooks: HookDefinition[];
  private readonly shell: string;

  private constructor(hooks: HookDefinition[], shell: string) {
    this.hooks = hooks;
    this.shell = shell;
  }

  /** Load hooks from `{projectRoot}/.termimate/hooks.json`. Returns an empty executor on any error. */
  static async load(projectRoot: string, shell: string): Promise<HookExecutor> {
    try {
      const configPath = nodePath.join(projectRoot, '.termimate', 'hooks.json');
      const raw = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(raw) as HookConfig;
      return new HookExecutor(Array.isArray(config.hooks) ? config.hooks : [], shell);
    } catch {
      return new HookExecutor([], shell);
    }
  }

  /** True if no hooks are defined (avoids unnecessary overhead). */
  get isEmpty(): boolean {
    return this.hooks.length === 0;
  }

  /**
   * Run all matching PreToolUse hooks sequentially.
   * Returns 'block' on the first hook that exits with code 2.
   */
  async runPreHooks(toolName: string, input: unknown): Promise<PreHookResult> {
    const matching = this.matching('PreToolUse', toolName);
    for (const hook of matching) {
      const env: Record<string, string> = {
        TERMIMATE_EVENT: 'PreToolUse',
        TERMIMATE_TOOL: toolName,
        TERMIMATE_INPUT: JSON.stringify(input),
      };
      const { exitCode, stdout } = await this.exec(hook.command, env, hook.timeout ?? DEFAULT_TIMEOUT_MS);
      if (exitCode === 2) {
        return {
          decision: 'block',
          message: stdout || `Blocked by PreToolUse hook for: ${toolName}`,
        };
      }
    }
    return { decision: 'allow' };
  }

  /** Spawn all matching PostToolUse hooks in the background (non-blocking). */
  runPostHooks(toolName: string, input: unknown, success: boolean, output: string): void {
    const matching = this.matching('PostToolUse', toolName);
    for (const hook of matching) {
      const env: Record<string, string> = {
        TERMIMATE_EVENT: 'PostToolUse',
        TERMIMATE_TOOL: toolName,
        TERMIMATE_INPUT: JSON.stringify(input),
        TERMIMATE_SUCCESS: success ? '1' : '0',
        TERMIMATE_OUTPUT: output,
      };
      this.spawnBackground(hook.command, env);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private matching(event: 'PreToolUse' | 'PostToolUse', toolName: string): HookDefinition[] {
    return this.hooks.filter(
      (h) => h.event === event && (!h.tool || h.tool === '*' || h.tool === toolName),
    );
  }

  private exec(
    command: string,
    extraEnv: Record<string, string>,
    timeout: number,
  ): Promise<{ exitCode: number; stdout: string }> {
    return new Promise((resolve) => {
      const env = { ...process.env, ...extraEnv } as NodeJS.ProcessEnv;
      const [cmd, args] = this.shellArgs(command);
      const child = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });

      let stdout = '';
      child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });

      const timer = setTimeout(() => {
        child.kill();
        resolve({ exitCode: 0, stdout: '' });
      }, timeout);

      child.on('close', (code: number | null) => {
        clearTimeout(timer);
        resolve({ exitCode: code ?? 0, stdout: stdout.trim() });
      });

      child.on('error', () => {
        clearTimeout(timer);
        resolve({ exitCode: 0, stdout: '' });
      });
    });
  }

  private spawnBackground(command: string, extraEnv: Record<string, string>): void {
    const env = { ...process.env, ...extraEnv } as NodeJS.ProcessEnv;
    const [cmd, args] = this.shellArgs(command);
    try {
      const child = spawn(cmd, args, { env, stdio: 'ignore', detached: false });
      child.unref();
    } catch { /* ignore spawn errors for background hooks */ }
  }

  /** Returns [executable, args] for running `command` in the configured shell. */
  private shellArgs(command: string): [string, string[]] {
    const isWin = process.platform === 'win32';
    if (isWin) {
      // Use cmd.exe for simple commands; pwsh/powershell if that's the configured shell
      const shellLower = (this.shell ?? '').toLowerCase();
      if (shellLower.includes('pwsh') || shellLower.includes('powershell')) {
        return ['powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]];
      }
      return ['cmd.exe', ['/c', command]];
    }
    // Unix: use the configured shell (bash, zsh, sh…) or fallback to /bin/sh
    const sh = this.shell || '/bin/sh';
    return [sh, ['-c', command]];
  }
}
