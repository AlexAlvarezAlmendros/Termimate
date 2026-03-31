import { z } from 'zod';
import { exec } from 'child_process';
import type { ITool } from './ITool';
import type { ToolResult, ToolContext } from '../../../shared/types/agent.types';

const inputSchema = z.object({
  command: z.string().describe('The bash command to execute'),
});

const TIMEOUT_MS = 30_000;

export class BashExecutorTool implements ITool {
  readonly name = 'bash_execute';
  readonly description = 'Execute a bash command in the project directory. Requires user confirmation.';
  readonly inputSchema = inputSchema;
  readonly requiresConfirmation = true;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);

    return new Promise((resolve) => {
      exec(
        parsed.command,
        {
          cwd: context.projectRoot ?? undefined,
          timeout: TIMEOUT_MS,
          env: { ...process.env },
        },
        (error, stdout, stderr) => {
          if (error) {
            resolve({
              success: false,
              error: `Exit code ${error.code}: ${stderr || error.message}`,
              output: stdout || undefined,
            });
          } else {
            resolve({
              success: true,
              output: stdout + (stderr ? `\nSTDERR: ${stderr}` : ''),
            });
          }
        },
      );
    });
  }
}
