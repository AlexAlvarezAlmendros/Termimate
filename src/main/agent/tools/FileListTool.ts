import { z } from 'zod';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import type { ITool } from './ITool';
import type { ToolResult, ToolContext } from '../../../shared/types/agent.types';
import { sanitizePath } from '../../security/PathSanitizer';

const inputSchema = z.object({
  path: z.string().default('.').describe('Relative path within the project to list (default: root)'),
  recursive: z.boolean().default(false).describe('Whether to list files recursively'),
  maxDepth: z.number().int().min(1).max(5).default(2).describe('Max depth for recursive listing (1-5)'),
});

interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  children?: FileEntry[];
}

async function listDir(dirPath: string, depth: number, maxDepth: number): Promise<FileEntry[]> {
  const entries = await readdir(dirPath);
  const result: FileEntry[] = [];

  for (const entry of entries) {
    // Skip hidden files and common noise directories
    if (entry.startsWith('.') || entry === 'node_modules' || entry === '__pycache__' || entry === '.git') {
      continue;
    }

    const fullPath = join(dirPath, entry);
    try {
      const info = await stat(fullPath);
      if (info.isDirectory()) {
        const children = depth < maxDepth ? await listDir(fullPath, depth + 1, maxDepth) : undefined;
        result.push({ name: entry, type: 'directory', children });
      } else {
        result.push({ name: entry, type: 'file' });
      }
    } catch {
      // Skip entries we can't stat
    }
  }

  return result.sort((a, b) => {
    // Directories first, then alphabetical
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function formatTree(entries: FileEntry[], prefix = ''): string {
  const lines: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const icon = entry.type === 'directory' ? '📁 ' : '';
    lines.push(`${prefix}${connector}${icon}${entry.name}`);

    if (entry.children && entry.children.length > 0) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      lines.push(formatTree(entry.children, childPrefix));
    }
  }
  return lines.join('\n');
}

export class FileListTool implements ITool {
  readonly name = 'file_list';
  readonly description = 'List files and directories within the project. Use this to explore the project structure before reading specific files.';
  readonly inputSchema = inputSchema;
  readonly requiresConfirmation = false;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);

    if (!context.projectRoot) {
      return { success: false, error: 'No project root configured. Please set a root path in the project settings.' };
    }

    try {
      const targetPath = parsed.path === '.' || !parsed.path
        ? context.projectRoot
        : sanitizePath(parsed.path, context.projectRoot);

      const maxDepth = parsed.recursive ? parsed.maxDepth : 1;
      const entries = await listDir(targetPath, 1, maxDepth);

      if (entries.length === 0) {
        return { success: true, output: '(empty directory)' };
      }

      const header = `${parsed.path || '.'} (${entries.length} entries):\n`;
      const tree = formatTree(entries);
      return { success: true, output: header + tree };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}
