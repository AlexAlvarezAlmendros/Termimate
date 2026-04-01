import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type { ITool } from './ITool';
import type { ToolResult, ToolContext } from '../../../shared/types/agent.types';
import { PTYManager } from '../../pty/PTYManager';
import { getConfig } from '../../config/ConfigService';

const inputSchema = z.object({
  command: z.string().describe('The shell command to execute in the active terminal session'),
});

const TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 100;

export class BashExecutorTool implements ITool {
  readonly name = 'bash_execute';
  readonly description =
    'Execute a command in the active terminal session using the configured shell. The output is captured and returned. Requires user confirmation.';
  readonly inputSchema = inputSchema;
  readonly requiresConfirmation = true;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);

    const ptyManager = PTYManager.getInstance();
    const session = ptyManager.getSession(context.sessionId);
    const buffer = ptyManager.getOutputBuffer(context.sessionId);

    if (!session || !buffer) {
      return { success: false, error: 'No active terminal session found.' };
    }

    const shell = getConfig().terminal.defaultShell;
    const sentinelId = uuid().replace(/-/g, '').slice(0, 12);
    const sentinel = `TERMIMATE_DONE_${sentinelId}`;

    // Build the command + sentinel appropriate for the shell
    const wrappedCommand = this.wrapCommand(parsed.command, sentinel, shell);

    // Record how many lines are already in the buffer so we only read new output
    const startLineCount = buffer.getLines().length;

    // Send the command to the PTY
    session.write(wrappedCommand + '\r');

    // Poll the buffer until the sentinel appears or we time out
    return new Promise((resolve) => {
      const deadline = Date.now() + TIMEOUT_MS;

      const poll = setInterval(() => {
        const allLines = buffer.getLines();
        const newLines = allLines.slice(startLineCount);
        const combined = newLines.join('\n');

        const sentinelIndex = combined.indexOf(sentinel);

        if (sentinelIndex !== -1) {
          clearInterval(poll);
          // Strip the sentinel line and ANSI escape codes from the output
          const output = combined
            .slice(0, sentinelIndex)
            .replace(/\x1b\[[0-9;]*[mGKHF]/g, '') // ANSI escapes
            .replace(/\r/g, '')
            .trim();
          resolve({ success: true, output: output || '(no output)' });
          return;
        }

        if (Date.now() > deadline) {
          clearInterval(poll);
          resolve({
            success: false,
            error: `Command timed out after ${TIMEOUT_MS / 1000}s. Partial output:\n${combined}`,
          });
        }
      }, POLL_INTERVAL_MS);
    });
  }

  private wrapCommand(command: string, sentinel: string, shell: string): string {
    const isCmd = shell === 'cmd.exe';
    const isPowerShell = shell === 'powershell.exe' || shell === 'pwsh.exe' || shell === 'pwsh';

    if (isCmd) {
      return `${command} & echo ${sentinel}`;
    } else if (isPowerShell) {
      return `${command}; Write-Host "${sentinel}"`;
    } else {
      // bash, zsh, fish, git bash
      return `${command}; echo "${sentinel}"`;
    }
  }
}
