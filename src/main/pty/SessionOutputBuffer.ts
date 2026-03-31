/**
 * Circular buffer that keeps the last N lines of terminal output.
 * Used by the AI agent to access recent terminal context.
 */
export class SessionOutputBuffer {
  private buffer: string[] = [];
  private maxLines: number;

  constructor(maxLines: number) {
    this.maxLines = maxLines;
  }

  push(data: string): void {
    const lines = data.split('\n');
    this.buffer.push(...lines);

    if (this.buffer.length > this.maxLines) {
      this.buffer = this.buffer.slice(-this.maxLines);
    }
  }

  getContent(): string {
    return this.buffer.join('\n');
  }

  getLines(count?: number): string[] {
    if (count === undefined) {
      return [...this.buffer];
    }
    return this.buffer.slice(-count);
  }

  clear(): void {
    this.buffer = [];
  }
}
