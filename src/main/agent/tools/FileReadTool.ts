import { z } from 'zod';
import { readFile } from 'fs/promises';
import * as path from 'path';
import type { ITool } from './ITool';
import type { ToolResult, ToolContext } from '../../../shared/types/agent.types';
import { sanitizePath, assertPathWithinProject } from '../../security/PathSanitizer';

const inputSchema = z.object({
  path: z.string().describe('Path to the file. Use a relative path (resolved from project root or cwd) or an absolute path.'),
});

export class FileReadTool implements ITool {
  readonly name = 'file_read';
  readonly description = 'Read the contents of a file. Accepts relative paths (resolved from project root or cwd) and absolute paths.';
  readonly inputSchema = inputSchema;
  readonly requiresConfirmation = false;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    const root = context.projectRoot ?? process.cwd();

    try {
      let fullPath: string;
      if (path.isAbsolute(parsed.path)) {
        // When a project root is set, absolute paths must still be within it
        if (context.projectRoot) {
          assertPathWithinProject(parsed.path, context.projectRoot);
        }
        fullPath = parsed.path;
      } else {
        fullPath = sanitizePath(parsed.path, root);
      }
      const content = await readFile(fullPath, 'utf-8');
      return { success: true, output: content };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}
