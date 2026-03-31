import { useCallback } from 'react';
import { useProjectStore } from '../store/projectStore';
import type { CreateProjectDTO, UpdateProjectDTO } from '../../shared/types/project.types';

export function useProject() {
  const { projects, setProjects, addProject, updateProject, removeProject } = useProjectStore();

  const loadProjects = useCallback(async () => {
    const loaded = await window.electronAPI.project.list();
    setProjects(loaded);
  }, [setProjects]);

  const createProject = useCallback(
    async (dto: CreateProjectDTO) => {
      const project = await window.electronAPI.project.create(dto);
      addProject(project);
      return project;
    },
    [addProject],
  );

  const editProject = useCallback(
    async (id: string, dto: UpdateProjectDTO) => {
      const updated = await window.electronAPI.project.update(id, dto);
      updateProject(id, updated);
      return updated;
    },
    [updateProject],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await window.electronAPI.project.delete(id);
      removeProject(id);
    },
    [removeProject],
  );

  return {
    projects,
    loadProjects,
    createProject,
    editProject,
    deleteProject,
  };
}
