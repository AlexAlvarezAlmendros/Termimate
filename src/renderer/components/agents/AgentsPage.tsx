import { useState, useEffect } from 'react';
import { useAgentCrud } from '../../hooks/useAgentCrud';
import { MODELS } from '../../constants/models';
import type { Agent, ProviderName } from '../../../../shared/types/agent.types';

const TOOLS = [
  { id: 'file_list',     label: 'List files' },
  { id: 'file_read',     label: 'Read files' },
  { id: 'bash_execute',  label: 'Execute commands' },
  { id: 'terminal_read', label: 'Read terminal output' },
];

const PROVIDERS: { value: ProviderName; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai',    label: 'OpenAI' },
  { value: 'gemini',    label: 'Google Gemini' },
];

interface FormState {
  name: string;
  provider: ProviderName;
  model: string;
  systemPrompt: string;
  enabledTools: string[];
}

const DEFAULT_FORM: FormState = {
  name: '',
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  systemPrompt: '',
  enabledTools: ['file_list', 'file_read'],
};

export function AgentsPage() {
  const { agents, loadAgents, createAgent, editAgent, deleteAgent } = useAgentCrud();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const modelsForProvider = MODELS.filter((m) => m.provider === form.provider);

  const openNew = () => {
    setForm(DEFAULT_FORM);
    setSelectedId(null);
    setIsNew(true);
    setError(null);
  };

  const openEdit = (agent: Agent) => {
    setForm({
      name: agent.name,
      provider: agent.provider,
      model: agent.model,
      systemPrompt: agent.systemPrompt ?? '',
      enabledTools: agent.toolsConfig?.enabledTools ?? [],
    });
    setSelectedId(agent.id);
    setIsNew(false);
    setError(null);
  };

  const closePanel = () => {
    setSelectedId(null);
    setIsNew(false);
    setError(null);
  };

  const handleProviderChange = (provider: ProviderName) => {
    const firstModel = MODELS.find((m) => m.provider === provider)?.model ?? '';
    setForm((f) => ({ ...f, provider, model: firstModel }));
  };

  const toggleTool = (toolId: string) => {
    setForm((f) => ({
      ...f,
      enabledTools: f.enabledTools.includes(toolId)
        ? f.enabledTools.filter((t) => t !== toolId)
        : [...f.enabledTools, toolId],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const dto = {
        name: form.name.trim(),
        provider: form.provider,
        model: form.model,
        systemPrompt: form.systemPrompt.trim() || undefined,
        toolsConfig: { enabledTools: form.enabledTools },
      };
      if (isNew) {
        await createAgent(dto);
      } else if (selectedId) {
        await editAgent(selectedId, dto);
      }
      closePanel();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save agent.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete agent "${name}"? This cannot be undone.`)) return;
    await deleteAgent(id);
    if (selectedId === id) closePanel();
  };

  const panelOpen = isNew || selectedId !== null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Agent list */}
      <div className="flex flex-col w-72 shrink-0 border-r border-outline-variant/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10">
          <h2 className="text-sm font-headline font-bold text-primary">Agents</h2>
          <button
            onClick={openNew}
            className="px-3 py-1 text-xs bg-primary text-on-primary rounded-lg font-semibold hover:brightness-110 transition-all"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {agents.length === 0 && (
            <p className="text-xs text-outline/50 px-3 py-2">No agents yet. Create one to get started.</p>
          )}
          {agents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => openEdit(agent)}
              className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                selectedId === agent.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-outline hover:bg-surface-container-high/50'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{agent.name}</p>
                <p className="text-[10px] text-outline/60 uppercase tracking-wide">
                  {agent.provider} · {MODELS.find((m) => m.model === agent.model)?.label ?? agent.model}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(agent.id, agent.name); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-error transition-all shrink-0 ml-2"
                title="Delete agent"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Form panel */}
      {panelOpen ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-headline font-bold text-on-surface">
                {isNew ? 'New Agent' : 'Edit Agent'}
              </h3>
              <button onClick={closePanel} className="text-outline hover:text-on-surface text-xl leading-none">×</button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs text-outline mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="My Agent"
                  className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline/40 focus:ring-1 focus:ring-primary/50 focus:outline-none"
                />
              </div>

              {/* Provider */}
              <div>
                <label className="block text-xs text-outline mb-1">Provider</label>
                <select
                  value={form.provider}
                  onChange={(e) => handleProviderChange(e.target.value as ProviderName)}
                  className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 focus:outline-none"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Model */}
              <div>
                <label className="block text-xs text-outline mb-1">Model</label>
                <select
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 focus:outline-none"
                >
                  {modelsForProvider.map((m) => (
                    <option key={m.model} value={m.model}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-xs text-outline mb-1">System Prompt</label>
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                  placeholder="You are a helpful assistant specialized in..."
                  rows={5}
                  className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline/40 focus:ring-1 focus:ring-primary/50 focus:outline-none resize-y font-mono"
                />
              </div>

              {/* Tools */}
              <div>
                <label className="block text-xs text-outline mb-2">Enabled Tools</label>
                <div className="space-y-2">
                  {TOOLS.map((tool) => (
                    <label key={tool.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.enabledTools.includes(tool.id)}
                        onChange={() => toggleTool(tool.id)}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-sm text-on-surface">{tool.label}</span>
                      <span className="text-[10px] text-outline/50 font-mono">{tool.id}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-xs text-error">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={closePanel}
                  className="px-5 py-2 border border-outline-variant/30 text-outline rounded-lg text-sm font-semibold hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-outline/40 text-sm">Select an agent to edit or create a new one</p>
        </div>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
