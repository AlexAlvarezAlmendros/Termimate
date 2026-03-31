import { v4 as uuid } from 'uuid';
import { DatabaseManager } from '../DatabaseManager';
import type { Session, CreateSessionDTO } from '../../../shared/types/session.types';
import { DEFAULT_SHELL } from '../../../shared/constants';

export class SessionRepository {
  private get db() {
    return DatabaseManager.getInstance().getDatabase();
  }

  findAll(projectId?: string): Session[] {
    if (projectId) {
      const rows = this.db
        .prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY last_used_at DESC')
        .all(projectId);
      return rows.map(this.mapRow);
    }
    const rows = this.db.prepare('SELECT * FROM sessions ORDER BY last_used_at DESC').all();
    return rows.map(this.mapRow);
  }

  findById(id: string): Session | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    return row ? this.mapRow(row) : null;
  }

  create(dto: CreateSessionDTO): Session {
    const id = uuid();
    const now = Date.now();
    const name = dto.name ?? `Session ${now}`;

    this.db
      .prepare(
        `INSERT INTO sessions (id, project_id, name, shell, cwd, env_vars, is_active, created_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        id,
        dto.projectId ?? null,
        name,
        dto.shell ?? DEFAULT_SHELL,
        dto.cwd ?? null,
        dto.envVars ? JSON.stringify(dto.envVars) : null,
        now,
        now,
      );

    return this.findById(id)!;
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  private mapRow(row: unknown): Session {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      projectId: r.project_id as string | null,
      name: r.name as string,
      shell: r.shell as string,
      cwd: r.cwd as string | null,
      envVars: r.env_vars ? JSON.parse(r.env_vars as string) : null,
      isActive: (r.is_active as number) === 1,
      createdAt: r.created_at as number,
      lastUsedAt: r.last_used_at as number,
    };
  }
}
