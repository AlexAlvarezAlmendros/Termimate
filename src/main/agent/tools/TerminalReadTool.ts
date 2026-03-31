import { z } from 'zod';
import type { ITool } from './ITool';
import type { ToolResult, ToolContext } from '../../../shared/types/agent.types';
import { PTYManager } from '../../pty/PTYManager';

const inputSchema = z.object({
  lines: z.number().optional().describe('Number of recent lines to read (default: all buffered)'),
});

export class TerminalReadTool implements ITool {
  readonly name = 'terminal_read';
  readonly description = 'Read the recent output from the active terminal session';
  readonly inputSchema = inputSchema;
  readonly requiresConfirmation = false;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);

    const buffer = PTYManager.getInstance().getOutputBuffer(context.sessionId);
    if (!buffer) {
      return { success: false, error: 'No terminal output buffer found for this session' };
    }

    const lines = buffer.getLines(parsed.lines);
    return { success: true, output: lines.join('\n') };
  }
}
