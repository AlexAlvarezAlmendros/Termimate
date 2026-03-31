export interface Project {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  rootPath: string | null;
  instructions: string | null;
  agentId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateProjectDTO {
  name: string;
  icon?: string;
  color?: string;
  rootPath?: string;
  instructions?: string;
  agentId?: string;
}

export interface UpdateProjectDTO {
  name?: string;
  icon?: string;
  color?: string;
  rootPath?: string;
  instructions?: string;
  agentId?: string;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  filePath: string;
  fileName: string;
  mimeType: string | null;
  createdAt: number;
}
