export interface Session {
  id: string;
  projectId: string | null;
  name: string;
  shell: string;
  cwd: string | null;
  envVars: Record<string, string> | null;
  isActive: boolean;
  createdAt: number;
  lastUsedAt: number;
}

export interface CreateSessionDTO {
  projectId?: string;
  name?: string;
  shell?: string;
  cwd?: string;
  envVars?: Record<string, string>;
}

export interface PTYConfig {
  sessionId: string;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
  env?: Record<string, string>;
}
