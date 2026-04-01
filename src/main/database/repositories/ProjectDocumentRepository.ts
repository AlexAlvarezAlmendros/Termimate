import { v4 as uuid } from 'uuid';
import { DatabaseManager } from '../DatabaseManager';
import type { ProjectDocument } from '../../../shared/types/project.types';

const MAX_DOCUMENTS_PER_PROJECT = 20;

export class ProjectDocumentRepository {
  private get db() {
    return DatabaseManager.getInstance().getDatabase();
  }

  findByProject(projectId: string): ProjectDocument[] {
    const rows = this.db
      .prepare('SELECT * FROM project_documents WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId);
    return rows.map(this.mapRow);
  }

  create(projectId: string, filePath: string, fileName: string, mimeType?: string): ProjectDocument {
    const count = (
      this.db.prepare('SELECT COUNT(*) as n FROM project_documents WHERE project_id = ?').get(projectId) as { n: number }
    ).n;
    if (count >= MAX_DOCUMENTS_PER_PROJECT) {
      throw new Error(`Maximum of ${MAX_DOCUMENTS_PER_PROJECT} documents per project reached.`);
    }

    const id = uuid();
    const now = Date.now();

    this.db
      .prepare(
        `INSERT INTO project_documents (id, project_id, file_path, file_name, mime_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, projectId, filePath, fileName, mimeType ?? null, now);

    return this.findById(id)!;
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM project_documents WHERE id = ?').run(id);
  }

  private findById(id: string): ProjectDocument | null {
    const row = this.db.prepare('SELECT * FROM project_documents WHERE id = ?').get(id);
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: unknown): ProjectDocument {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      projectId: r.project_id as string,
      filePath: r.file_path as string,
      fileName: r.file_name as string,
      mimeType: r.mime_type as string | null,
      createdAt: r.created_at as number,
    };
  }
}
