import { v4 as uuid } from 'uuid';
import { DatabaseManager } from '../DatabaseManager';
import type { Project, CreateProjectDTO, UpdateProjectDTO } from '../../../shared/types/project.types';

export class ProjectRepository {
  private get db() {
    return DatabaseManager.getInstance().getDatabase();
  }

  findAll(): Project[] {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
    return rows.map(this.mapRow);
  }

  findById(id: string): Project | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    return row ? this.mapRow(row) : null;
  }

  create(dto: CreateProjectDTO): Project {
    const id = uuid();
    const now = Date.now();

    this.db
      .prepare(
        `INSERT INTO projects (id, name, icon, color, root_path, instructions, agent_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, dto.name, dto.icon ?? null, dto.color ?? null, dto.rootPath ?? null, dto.instructions ?? null, dto.agentId ?? null, now, now);

    return this.findById(id)!;
  }

  update(id: string, dto: UpdateProjectDTO): Project {
    const existing = this.findById(id);
    if (!existing) throw new Error(`Project ${id} not found`);

    const now = Date.now();
    this.db
      .prepare(
        `UPDATE projects SET name = ?, icon = ?, color = ?, root_path = ?, instructions = ?, agent_id = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        dto.name ?? existing.name,
        dto.icon ?? existing.icon,
        dto.color ?? existing.color,
        dto.rootPath ?? existing.rootPath,
        dto.instructions ?? existing.instructions,
        dto.agentId ?? existing.agentId,
        now,
        id,
      );

    return this.findById(id)!;
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  private mapRow(row: unknown): Project {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      name: r.name as string,
      icon: r.icon as string | null,
      color: r.color as string | null,
      rootPath: r.root_path as string | null,
      instructions: r.instructions as string | null,
      agentId: r.agent_id as string | null,
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
    };
  }
}
