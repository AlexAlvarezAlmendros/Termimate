import { z } from 'zod';
import { readFile, writeFile } from 'fs/promises';
import * as path from 'path';
import type { ITool } from './ITool';
import type { ToolResult, ToolContext } from '../../../shared/types/agent.types';
import { sanitizePath, assertPathWithinProject } from '../../security/PathSanitizer';

const inputSchema = z.object({
  path: z.string().describe('Path to the file to edit (relative or absolute).'),
  old_string: z.string().describe('The exact string to find and replace. Must appear exactly once in the file.'),
  new_string: z.string().describe('The replacement string. Use an empty string to delete the old_string.'),
});

export class FileEditTool implements ITool {
  readonly name = 'file_edit';
  readonly description =
    'Surgically edit a file by replacing an exact string with a new one. Safer than file_write for small changes because the rest of the file is untouched. ' +
    'The old_string must match exactly (including whitespace and indentation) and must appear exactly once. ' +
    'Use file_read first to obtain the exact content to replace.';
  readonly inputSchema = inputSchema;
  readonly requiresConfirmation = true;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    const root = context.projectRoot ?? process.cwd();

    try {
      let fullPath: string;
      if (path.isAbsolute(parsed.path)) {
        if (context.projectRoot) {
          assertPathWithinProject(parsed.path, context.projectRoot);
        }
        fullPath = parsed.path;
      } else {
        fullPath = sanitizePath(parsed.path, root);
      }

      const original = await readFile(fullPath, 'utf-8');
      const occurrences = original.split(parsed.old_string).length - 1;

      if (occurrences === 0) {
        return { success: false, error: `old_string not found in ${fullPath}` };
      }
      if (occurrences > 1) {
        return {
          success: false,
          error: `old_string appears ${occurrences} times — make it more unique so the edit is unambiguous`,
        };
      }

      const updated = original.replace(parsed.old_string, parsed.new_string);
      await writeFile(fullPath, updated, 'utf-8');

      const linesChanged =
        Math.abs(
          (parsed.new_string.match(/\n/g) ?? []).length -
          (parsed.old_string.match(/\n/g) ?? []).length,
        );
      return {
        success: true,
        output: `Edited ${fullPath} — ${linesChanged === 0 ? 'inline change' : `${linesChanged} line(s) delta`}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}
