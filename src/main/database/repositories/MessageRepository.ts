import { v4 as uuid } from 'uuid';
import { DatabaseManager } from '../DatabaseManager';
import type { Message } from '../../../shared/types/agent.types';

export class MessageRepository {
  private get db() {
    return DatabaseManager.getInstance().getDatabase();
  }

  findBySession(sessionId: string): Message[] {
    const rows = this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
      .all(sessionId);
    return rows.map(this.mapRow);
  }

  create(data: {
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    toolCalls?: string;
    tokensUsed?: number;
  }): Message {
    const id = uuid();
    const now = Date.now();

    this.db
      .prepare(
        `INSERT INTO messages (id, session_id, role, content, tool_calls, tokens_used, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, data.sessionId, data.role, data.content, data.toolCalls ?? null, data.tokensUsed ?? null, now);

    return this.findById(id)!;
  }

  findById(id: string): Message | null {
    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    return row ? this.mapRow(row) : null;
  }

  deleteBySession(sessionId: string): void {
    this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
  }

  private mapRow(row: unknown): Message {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      sessionId: r.session_id as string,
      role: r.role as 'user' | 'assistant',
      content: r.content as string,
      toolCalls: r.tool_calls as string | null,
      tokensUsed: r.tokens_used as number | null,
      createdAt: r.created_at as number,
    };
  }
}
