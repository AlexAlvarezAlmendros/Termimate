import { z } from 'zod';
import { mkdir } from 'fs/promises';
import * as path from 'path';
import type { ITool } from './ITool';
import type { ToolResult, ToolContext } from '../../../shared/types/agent.types';
import { sanitizePath } from '../../security/PathSanitizer';

const inputSchema = z.object({
  path: z.string().describe('Path to the directory to create. Use a relative path (resolved from project root or cwd) or an absolute path.'),
  recursive: z.boolean().optional().describe('Create parent directories as needed (default: true)'),
});

export class DirectoryCreateTool implements ITool {
  readonly name = 'directory_create';
  readonly description = 'Create a directory. Accepts relative paths (resolved from project root or cwd) and absolute paths. Creates parent directories as needed.';
  readonly inputSchema = inputSchema;
  readonly requiresConfirmation = true;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    const root = context.projectRoot ?? process.cwd();

    try {
      let fullPath: string;
      if (path.isAbsolute(parsed.path)) {
        fullPath = parsed.path;
      } else {
        fullPath = sanitizePath(parsed.path, root);
      }

      const recursive = parsed.recursive !== false;
      await mkdir(fullPath, { recursive });
      return { success: true, output: `Created directory: ${fullPath}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}
