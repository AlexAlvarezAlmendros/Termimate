import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import * as path from 'path';
import type { ITool } from './ITool';
import type { ToolResult, ToolContext } from '../../../shared/types/agent.types';
import { sanitizePath, assertPathWithinProject } from '../../security/PathSanitizer';

const inputSchema = z.object({
  path: z.string().describe('Path to the file. Use a relative path (resolved from the project root or current working directory) or an absolute path.'),
  content: z.string().describe('The content to write to the file'),
  createDirectories: z.boolean().optional().describe('Create parent directories if they do not exist (default: true)'),
});

export class FileWriteTool implements ITool {
  readonly name = 'file_write';
  readonly description = 'Write content to a file. Accepts relative paths (resolved from project root or cwd) and absolute paths. Creates the file if it does not exist, overwrites if it does.';
  readonly inputSchema = inputSchema;
  readonly requiresConfirmation = true;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    const root = context.projectRoot ?? process.cwd();

    try {
      // Accept absolute paths directly; use sanitizePath only for relative ones
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

      const shouldCreateDirs = parsed.createDirectories !== false;
      if (shouldCreateDirs) {
        await mkdir(path.dirname(fullPath), { recursive: true });
      }

      await writeFile(fullPath, parsed.content, 'utf-8');
      const byteSize = Buffer.byteLength(parsed.content, 'utf-8');
      return { success: true, output: `Written ${byteSize} bytes to ${fullPath}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}
