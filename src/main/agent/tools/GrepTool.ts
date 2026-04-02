import { z } from 'zod';
import { readFile } from 'fs/promises';
import { glob } from 'fs/promises';
import * as path from 'path';
import * as fsp from 'fs/promises';
import type { ITool } from './ITool';
import type { ToolResult, ToolContext } from '../../../shared/types/agent.types';

const inputSchema = z.object({
  pattern: z.string().describe('Search string or regular expression to find.'),
  path: z.string().optional().describe('Directory to search in (defaults to project root or cwd). Use "." for current directory.'),
  filePattern: z.string().optional().describe('Glob pattern to filter files (e.g. "**/*.ts"). Defaults to all files.'),
  isRegex: z.boolean().optional().describe('Treat pattern as a regular expression (default: false).'),
  maxResults: z.number().optional().describe('Maximum number of matching lines to return (default: 50).'),
});

const MAX_FILE_SIZE = 500_000; // 500 KB — skip binary/giant files
const DEFAULT_MAX_RESULTS = 50;

export class GrepTool implements ITool {
  readonly name = 'grep';
  readonly description =
    'Search for a string or regex pattern in files under a directory. ' +
    'Returns matching lines with file paths and line numbers. ' +
    'Use filePattern to limit the search to specific file types (e.g. "**/*.ts").';
  readonly inputSchema = inputSchema;
  readonly requiresConfirmation = false;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    const root = context.projectRoot ?? process.cwd();
    const searchDir = parsed.path ? path.resolve(root, parsed.path) : root;
    const fileGlob = parsed.filePattern ?? '**/*';
    const maxResults = parsed.maxResults ?? DEFAULT_MAX_RESULTS;

    let regex: RegExp;
    try {
      regex = parsed.isRegex
        ? new RegExp(parsed.pattern, 'g')
        : new RegExp(parsed.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    } catch {
      return { success: false, error: `Invalid regex: ${parsed.pattern}` };
    }

    try {
      const matches: string[] = [];

      // Collect matching files using glob
      const files: string[] = [];
      for await (const entry of fsp.glob(fileGlob, { cwd: searchDir })) {
        files.push(path.join(searchDir, entry));
        if (files.length > 2000) break; // safety cap
      }

      for (const filePath of files) {
        if (matches.length >= maxResults) break;

        let stat: import('fs').Stats;
        try { stat = await fsp.stat(filePath); } catch { continue; }
        if (!stat.isFile() || stat.size > MAX_FILE_SIZE) continue;

        let content: string;
        try { content = await readFile(filePath, 'utf-8'); } catch { continue; }

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          // Reset lastIndex between lines for global regex
          regex.lastIndex = 0;
          if (regex.test(lines[i])) {
            const rel = path.relative(root, filePath).replace(/\\/g, '/');
            matches.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
            if (matches.length >= maxResults) break;
          }
        }
      }

      if (matches.length === 0) {
        return { success: true, output: 'No matches found.' };
      }

      const output = matches.join('\n');
      const truncated = matches.length >= maxResults ? `\n(showing first ${maxResults} results — use maxResults to increase)` : '';
      return { success: true, output: output + truncated };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}
