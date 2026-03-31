import type { PTYConfig } from '../../shared/types/session.types';
import { PTYSession } from './PTYSession';
import { SessionOutputBuffer } from './SessionOutputBuffer';
import { DEFAULT_OUTPUT_BUFFER_LINES } from '../../shared/constants';

export class PTYManager {
  private static instance: PTYManager;
  private sessions = new Map<string, PTYSession>();
  private outputBuffers = new Map<string, SessionOutputBuffer>();

  static getInstance(): PTYManager {
    if (!PTYManager.instance) {
      PTYManager.instance = new PTYManager();
    }
    return PTYManager.instance;
  }

  createSession(config: PTYConfig): PTYSession {
    const session = new PTYSession(config);
    const buffer = new SessionOutputBuffer(DEFAULT_OUTPUT_BUFFER_LINES);

    session.onData((data) => {
      buffer.push(data);
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
    }
  }

  getOutputBuffer(sessionId: string): SessionOutputBuffer | null {
    return this.outputBuffers.get(sessionId) ?? null;
  }

  getSession(sessionId: string): PTYSession | null {
    return this.sessions.get(sessionId) ?? null;
  }
}
