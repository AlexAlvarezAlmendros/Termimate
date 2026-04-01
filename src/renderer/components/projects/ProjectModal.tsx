import { useState, useEffect, useCallback } from 'react';
import type { Project, CreateProjectDTO, ProjectDocument } from '../../../../shared/types/project.types';
import { useProject } from '../../hooks/useProject';
import { useAgentCrud } from '../../hooks/useAgentCrud';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null; // if provided → edit mode
}

const EMOJI_OPTIONS = ['📁', '🚀', '⚡', '🔥', '💡', '🛠️', '🎯', '🧩', '🌐', '🔒'];
const COLOR_OPTIONS = [
  '#6750A4', // primary
  '#625B71', // secondary
  '#7D5260', // tertiary
  '#B3261E', // error
  '#386A20', // green
  '#006874', // teal
  '#1B6EF3', // blue
  '#E8680C', // orange
];

export function ProjectModal({ isOpen, onClose, project }: ProjectModalProps) {
  const { createProject, editProject } = useProject();
  const { agents, loadAgents } = useAgentCrud();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [rootPath, setRootPath] = useState('');
  const [instructions, setInstructions] = useState('');
  const [agentId, setAgentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  // Load documents when editing an existing project
  const loadDocuments = useCallback(async (projectId: string) => {
    try {
      const docs = await window.electronAPI.project.listDocuments(projectId);
      setDocuments(docs);
    } catch {
      setDocuments([]);
    }
  }, []);

  useEffect(() => {
    if (project) {
      loadDocuments(project.id);
    } else {
      setDocuments([]);
    }
  }, [project, isOpen, loadDocuments]);

  // Populate fields when editing
  useEffect(() => {
    if (project) {
      setName(project.name);
      setIcon(project.icon ?? '📁');
      setColor(project.color ?? COLOR_OPTIONS[0]);
      setRootPath(project.rootPath ?? '');
      setInstructions(project.instructions ?? '');
      setAgentId(project.agentId ?? null);
    } else {
      setName('');
      setIcon('📁');
      setColor(COLOR_OPTIONS[0]);
      setRootPath('');
      setInstructions('');
      setAgentId(null);
    }
    setError('');
  }, [project, isOpen]);

  if (!isOpen) return null;

  const handleAddDocument = async () => {
    if (!project) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.txt,.md,.json,.yaml,.yml,.toml,.xml,.csv,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.c,.h,.cpp,.hpp,.rb,.sh,.bat,.ps1,.sql,.html,.css,.env,.cfg,.ini,.log';
    input.onchange = async () => {
      if (!input.files) return;
      for (const file of Array.from(input.files)) {
        try {
          // In Electron, File objects have a `path` property with the full filesystem path
          const filePath = (file as File & { path: string }).path;
          const doc = await window.electronAPI.project.addDocument(
            project.id,
            filePath,
            file.name,
            file.type || undefined,
          );
          setDocuments((prev) => [doc, ...prev]);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to add document');
        }
      }
    };
    input.click();
  };

  const handleRemoveDocument = async (docId: string) => {
    try {
      await window.electronAPI.project.removeDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove document');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    setSaving(true);
    setError('');

    const dto: CreateProjectDTO = {
      name: name.trim(),
      icon,
      color,
      rootPath: rootPath.trim() || undefined,
      instructions: instructions.trim() || undefined,
      agentId: agentId ?? undefined,
    };

    try {
      if (project) {
        await editProject(project.id, dto);
      } else {
        await createProject(dto);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-container w-full max-w-md rounded-2xl shadow-2xl border border-outline-variant/20 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10">
          <h2 className="text-base font-headline font-bold text-on-surface">
            {project ? 'Edit Project' : 'New Project'}
          </h2>
          <button
            onClick={onClose}
            className="text-outline hover:text-on-surface transition-colors p-1 rounded-md hover:bg-surface-container-high"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <p className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Icon picker */}
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-widest mb-2">
              Icon
            </label>
            <div className="flex gap-2 flex-wrap">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                    icon === emoji
                      ? 'bg-primary/20 ring-2 ring-primary'
                      : 'bg-surface-container-high hover:bg-surface-container-highest'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-widest mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-outline ring-offset-surface-container' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-widest mb-1">
              Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              className="w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder-outline/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
          </div>

          {/* Root Path */}
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-widest mb-1">
              Root Path
            </label>
            <input
              type="text"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="/home/user/my-project"
              className="w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder-outline/50 focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
            />
            <p className="mt-1 text-[10px] text-outline/60">
              Absolute path to the project folder the AI will have access to
            </p>
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-widest mb-1">
              AI Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="You are helping with a Node.js API. Always prefer TypeScript..."
              rows={4}
              className="w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder-outline/50 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <p className="mt-1 text-[10px] text-outline/60">
              Custom instructions added to the AI system prompt for this project
            </p>
          </div>

          {/* Agent */}
          <div>
            <label className="block text-xs font-bold text-outline uppercase tracking-widest mb-1">
              Agent
            </label>
            <select
              value={agentId ?? ''}
              onChange={(e) => setAgentId(e.target.value || null)}
              className="w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">None</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.provider})</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-outline/60">
              Default agent used when chatting in this project's sessions
            </p>
          </div>

          {/* Documents (only in edit mode) */}
          {project && (
            <div>
              <label className="block text-xs font-bold text-outline uppercase tracking-widest mb-2">
                Context Documents
              </label>
              <div className="space-y-1.5 mb-2">
                {documents.length === 0 && (
                  <p className="text-xs text-outline/60 italic">No documents attached yet.</p>
                )}
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-2 bg-surface-container-high rounded-lg px-3 py-1.5"
                  >
                    <span className="text-xs text-on-surface truncate flex-1" title={doc.filePath}>
                      📄 {doc.fileName}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDocument(doc.id)}
                      className="text-outline hover:text-error transition-colors p-0.5 rounded shrink-0"
                      title="Remove document"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddDocument}
                className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
              >
                + Attach document
              </button>
              <p className="mt-1 text-[10px] text-outline/60">
                Files attached here will be included in the AI context for this project (max 20)
              </p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-outline hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold bg-primary text-on-primary rounded-lg hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {saving ? 'Saving...' : project ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
