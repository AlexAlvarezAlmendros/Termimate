import { z } from 'zod';
import * as path from 'path';
import * as fsp from 'fs/promises';
import type { ITool } from './ITool';
import type { ToolResult, ToolContext } from '../../../shared/types/agent.types';

const inputSchema = z.object({
  pattern: z.string().describe('Glob pattern to match files or directories (e.g. "**/*.ts", "src/**/*.test.*", "*.json").'),
  path: z.string().optional().describe('Root directory to search from (defaults to project root or cwd).'),
  maxResults: z.number().optional().describe('Maximum number of paths to return (default: 100).'),
});

const DEFAULT_MAX_RESULTS = 100;

export class GlobTool implements ITool {
  readonly name = 'glob';
  readonly description =
    'Find files and directories matching a glob pattern. ' +
    'Returns a sorted list of relative paths. ' +
    'Useful for discovering project structure before reading files. ' +
    'Supports ** for recursive matching (e.g. "**/*.ts" finds all TypeScript files).';
  readonly inputSchema = inputSchema;
  readonly requiresConfirmation = false;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    const root = context.projectRoot ?? process.cwd();
    const searchDir = parsed.path ? path.resolve(root, parsed.path) : root;
    const maxResults = parsed.maxResults ?? DEFAULT_MAX_RESULTS;

    try {
      const matches: string[] = [];

      for await (const entry of fsp.glob(parsed.pattern, { cwd: searchDir })) {
        matches.push(entry.replace(/\\/g, '/'));
        if (matches.length >= maxResults) break;
      }

      if (matches.length === 0) {
        return { success: true, output: 'No files matched the pattern.' };
      }

      matches.sort();
      const truncated = matches.length >= maxResults
        ? `\n(showing first ${maxResults} results — use maxResults to increase)`
        : '';

      return { success: true, output: matches.join('\n') + truncated };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}
