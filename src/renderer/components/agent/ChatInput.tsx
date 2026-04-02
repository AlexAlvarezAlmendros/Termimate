import { useCallback, useRef, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Agent } from '../../../../shared/types/agent.types';
import type { ModelDefinitionUI } from '../../constants/models';

export type ApprovalLevel = 'default' | 'confirm_all' | 'auto' | 'plan';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  disabled: boolean;
  isStreaming?: boolean;
  // selectors
  agents: Agent[];
  selectedAgentId: string | null;
  onAgentChange: (id: string | null) => void;
  models: ModelDefinitionUI[];
  selectedModel: number;
  onModelChange: (idx: number) => void;
  approvalLevel: ApprovalLevel;
  onApprovalChange: (level: ApprovalLevel) => void;
  enableThinking?: boolean;
  onThinkingToggle?: () => void;
  sessionName?: string;
  tokensUsed?: number;
  maxTokens?: number;
}

export function ChatInput({
  value, onChange, onSend, onCancel, disabled, isStreaming,
  agents, selectedAgentId, onAgentChange,
  models, selectedModel, onModelChange,
  approvalLevel, onApprovalChange,
  enableThinking, onThinkingToggle,
  sessionName,
  tokensUsed = 0, maxTokens = 200000,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    },
    [onSend],
  );

  const contextPct = Math.min(100, (tokensUsed / maxTokens) * 100);

  return (
    <div className="p-3 shrink-0">
      <div
        className="rounded-xl border border-outline-variant/20 bg-surface-container overflow-hidden shadow-sm"
        style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04)' }}
      >
        {/* Context bar (only when tokens used) */}
        {tokensUsed > 0 && (
          <div className="w-full h-0.5 bg-surface-container-lowest">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${contextPct}%`,
                background: contextPct > 80 ? '#B3261E' : contextPct > 50 ? '#E8680C' : '#6750A4',
              }}
            />
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled && !isStreaming}
          placeholder="Describe what to build"
          rows={2}
          className="w-full bg-transparent border-none px-4 pt-3 pb-1 text-sm text-on-surface focus:outline-none placeholder:text-outline/40 disabled:opacity-50 resize-none overflow-y-auto"
          style={{ maxHeight: '150px' }}
        />

        {/* Toolbar row 1 */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-t border-outline-variant/10">
          {/* + attachment placeholder */}
          <button
            disabled={isStreaming}
            className="p-1 rounded-md text-outline/50 hover:text-on-surface hover:bg-white/5 disabled:opacity-30 transition-colors"
            title="Attach"
          >
            <PlusIcon />
          </button>

          <div className="w-px h-4 bg-outline-variant/20 mx-0.5" />

          {/* Thinking toggle */}
          <button
            type="button"
            disabled={isStreaming}
            onClick={onThinkingToggle}
            title={enableThinking ? 'Disable extended thinking' : 'Enable extended thinking'}
            className={`p-1 rounded-md transition-colors disabled:opacity-30 ${
              enableThinking
                ? 'text-secondary bg-secondary/15 hover:bg-secondary/20'
                : 'text-outline/50 hover:text-on-surface hover:bg-white/5'
            }`}
          >
            <BrainIcon />
          </button>

          <div className="w-px h-4 bg-outline-variant/20 mx-0.5" />
          <CustomSelect
            options={[{ value: '', label: 'No Agent' }, ...agents.map((a) => ({ value: a.id, label: a.name }))]}
            value={selectedAgentId ?? ''}
            onChange={(v) => onAgentChange(v || null)}
            disabled={isStreaming}
            icon={<AgentIcon />}
          />

          {/* Model selector */}
          <CustomSelect
            options={models.map((m, i) => ({ value: String(i), label: m.label }))}
            value={String(selectedModel)}
            onChange={(v) => onModelChange(Number(v))}
            disabled={isStreaming}
            suffix={<ChevronIcon />}
          />

          <div className="flex-1" />

          {/* Send / Stop */}
          {isStreaming ? (
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg text-error hover:bg-error/10 transition-colors"
              title="Stop generation"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={disabled || !value.trim()}
              className="p-1.5 rounded-lg bg-primary/90 text-on-primary hover:bg-primary disabled:opacity-30 disabled:bg-transparent disabled:text-outline transition-all"
              title="Send (Enter)"
            >
              <SendIcon />
            </button>
          )}
        </div>

        {/* Toolbar row 2 */}
        <div className="flex items-center gap-2 px-3 pb-2 pt-0.5">
          {/* Local session */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-outline/60 hover:text-outline hover:bg-white/5 cursor-default transition-colors">
            <TerminalSmallIcon />
            <span>{sessionName ?? 'Local'}</span>
          </div>

          {/* Approval level */}
          <CustomSelect
            options={[
              { value: 'default', label: 'Default Approvals' },
              { value: 'confirm_all', label: 'Confirm All' },
              { value: 'auto', label: 'Auto-approve' },
              { value: 'plan', label: '📋 Plan Mode' },
            ]}
            value={approvalLevel}
            onChange={(v) => onApprovalChange(v as ApprovalLevel)}
            disabled={isStreaming}
            icon={<ShieldIcon />}
            small
          />

          <div className="flex-1" />

          {/* Status spinner */}
          {isStreaming && (
            <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          )}
          {tokensUsed > 0 && !isStreaming && (
            <span className="text-[10px] font-mono text-outline/40" title="Tokens used">
              {tokensUsed.toLocaleString()} tk
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Custom Select ───────────────────────────────────────────────────────────

interface CustomSelectOption { value: string; label: string; }
interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  icon?: ReactNode;
  suffix?: ReactNode;
  small?: boolean;
}

function CustomSelect({ options, value, onChange, disabled, icon, suffix, small }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = () => {
    if (disabled) return;
    if (!open && triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect());
    }
    setOpen((o) => !o);
  };

  const textSize = small ? 'text-[11px]' : 'text-xs';
  const padding = small ? 'px-2 py-0.5' : 'px-2 py-1';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`flex items-center gap-1.5 ${padding} rounded-md bg-surface-container-highest border border-outline-variant/20 hover:border-outline-variant/40 transition-colors disabled:opacity-40`}
      >
        {icon}
        <span className={`${textSize} text-on-surface`}>{selected?.label ?? ''}</span>
        {suffix}
      </button>

      {open && rect && createPortal(
        <div
          className="fixed min-w-max bg-surface-container-high rounded-lg shadow-xl border border-outline-variant/20 py-1"
          style={{
            zIndex: 9999,
            ...(window.innerHeight - rect.bottom < 200
              ? { left: rect.left, bottom: window.innerHeight - rect.top + 4 }
              : { left: rect.left, top: rect.bottom + 4 }),
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                opt.value === value ? 'text-primary bg-primary/10' : 'text-on-surface hover:bg-primary/10'
              }`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function AgentIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" /><path d="M12 7v4" />
    </svg>
  );
}

function ChevronIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function TerminalSmallIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.88A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.88A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}
