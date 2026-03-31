import { v4 as uuid } from 'uuid';
import { DatabaseManager } from '../DatabaseManager';
import type { Agent, CreateAgentDTO, UpdateAgentDTO } from '../../../shared/types/agent.types';

export class AgentRepository {
  private get db() {
    return DatabaseManager.getInstance().getDatabase();
  }

  findAll(): Agent[] {
    const rows = this.db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
    return rows.map(this.mapRow);
  }

  findById(id: string): Agent | null {
    const row = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
    return row ? this.mapRow(row) : null;
  }

  create(dto: CreateAgentDTO): Agent {
    const id = uuid();
    const now = Date.now();

    this.db
      .prepare(
        `INSERT INTO agents (id, name, system_prompt, provider, model, tools_config, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        dto.name,
        dto.systemPrompt ?? null,
        dto.provider,
        dto.model,
        dto.toolsConfig ? JSON.stringify(dto.toolsConfig) : null,
        now,
      );

    return this.findById(id)!;
  }

  update(id: string, dto: UpdateAgentDTO): Agent {
    const existing = this.findById(id);
    if (!existing) throw new Error(`Agent ${id} not found`);

    this.db
      .prepare(
        `UPDATE agents SET name = ?, system_prompt = ?, provider = ?, model = ?, tools_config = ?
         WHERE id = ?`,
      )
      .run(
        dto.name ?? existing.name,
        dto.systemPrompt ?? existing.systemPrompt,
        dto.provider ?? existing.provider,
        dto.model ?? existing.model,
        dto.toolsConfig ? JSON.stringify(dto.toolsConfig) : existing.toolsConfig ? JSON.stringify(existing.toolsConfig) : null,
        id,
      );

    return this.findById(id)!;
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM agents WHERE id = ?').run(id);
  }

  private mapRow(row: unknown): Agent {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      name: r.name as string,
      systemPrompt: r.system_prompt as string | null,
      provider: r.provider as 'anthropic' | 'openai',
      model: r.model as string,
      toolsConfig: r.tools_config ? JSON.parse(r.tools_config as string) : null,
      createdAt: r.created_at as number,
    };
  }
}
