import type { PTYConfig } from '../../shared/types/session.types';
import { PTYSession } from './PTYSession';
import { SessionOutputBuffer } from './SessionOutputBuffer';
import { DEFAULT_OUTPUT_BUFFER_LINES, MAX_SCROLLBACK_BYTES } from '../../shared/constants';

export class PTYManager {
  private static instance: PTYManager;
  private sessions = new Map<string, PTYSession>();
  private outputBuffers = new Map<string, SessionOutputBuffer>();
  private rawScrollbackBuffers = new Map<string, string>();

  static getInstance(): PTYManager {
    if (!PTYManager.instance) {
      PTYManager.instance = new PTYManager();
    }
    return PTYManager.instance;
  }

  createSession(config: PTYConfig, initialScrollback?: string): PTYSession {
    const session = new PTYSession(config);
    const buffer = new SessionOutputBuffer(DEFAULT_OUTPUT_BUFFER_LINES);

    // Seed buffer with the previously saved scrollback so accumulated data is
    // always the FULL history (old + new), not just data from this launch.
    this.rawScrollbackBuffers.set(config.sessionId, initialScrollback ?? '');

    session.onData((data) => {
      buffer.push(data);

      // Accumulate raw output for scrollback persistence (capped at MAX_SCROLLBACK_BYTES)
      const existing = this.rawScrollbackBuffers.get(config.sessionId) ?? '';
      const combined = existing + data;
      this.rawScrollbackBuffers.set(
        config.sessionId,
        combined.length > MAX_SCROLLBACK_BYTES
          ? combined.slice(combined.length - MAX_SCROLLBACK_BYTES)
          : combined,
      );
    });

    this.sessions.set(config.sessionId, session);
    this.outputBuffers.set(config.sessionId, buffer);

    return session;
  }

  writeToSession(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.write(data);
    }
  }

  resizeSession(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.resize(cols, rows);
    }
  }

  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.destroy();
      this.sessions.delete(sessionId);
      this.outputBuffers.delete(sessionId);
      this.rawScrollbackBuffers.delete(sessionId);
    }
  }

  getOutputBuffer(sessionId: string): SessionOutputBuffer | null {
    return this.outputBuffers.get(sessionId) ?? null;
  }

  getSession(sessionId: string): PTYSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  getRawScrollback(sessionId: string): string {
    return this.rawScrollbackBuffers.get(sessionId) ?? '';
  }

  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }
}
