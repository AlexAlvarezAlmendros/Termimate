import { z } from 'zod';
import { readFile } from 'fs/promises';
import type { ITool } from './ITool';
import type { ToolResult, ToolContext } from '../../../shared/types/agent.types';
import { sanitizePath } from '../../security/PathSanitizer';

const inputSchema = z.object({
  path: z.string().describe('Relative path to the file within the project'),
});

export class FileReadTool implements ITool {
  readonly name = 'file_read';
  readonly description = 'Read the contents of a file within the project directory';
  readonly inputSchema = inputSchema;
  readonly requiresConfirmation = false;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);

    if (!context.projectRoot) {
      return { success: false, error: 'No project root configured' };
    }

    try {
      const fullPath = sanitizePath(parsed.path, context.projectRoot);
      const content = await readFile(fullPath, 'utf-8');
      return { success: true, output: content };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}
