import * as path from 'path';

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export function assertPathWithinProject(filePath: string, projectRoot: string): void {
  const resolved = path.resolve(filePath);
  const root = path.resolve(projectRoot);

  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new SecurityError(`Path traversal attempt: ${filePath}`);
  }
}

export function sanitizePath(filePath: string, projectRoot: string): string {
  const resolved = path.resolve(projectRoot, filePath);
  assertPathWithinProject(resolved, projectRoot);
  return resolved;
}
