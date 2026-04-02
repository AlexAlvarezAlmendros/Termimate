import { useState } from 'react';
import type { ToolCall } from '../../store/agentStore';

interface AgentActivityLogProps {
  thinking?: string;
  toolCalls?: ToolCall[];
  isStreaming: boolean;
}

const TOOL_LABELS: Record<string, { label: string; activeLabel: string }> = {
  bash_execute:  { label: 'Ran command',    activeLabel: 'Running command' },
  file_read:     { label: 'Read file',      activeLabel: 'Reading file' },
  file_list:     { label: 'Listed files',   activeLabel: 'Listing files' },
  terminal_read: { label: 'Read terminal',  activeLabel: 'Reading terminal' },
};

function summarizeToolInput(toolName: string, input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const obj = input as Record<string, unknown>;
  if (toolName === 'bash_execute' && typeof obj.command === 'string') {
    return obj.command.split('\n')[0].slice(0, 60);
  }
  if ((toolName === 'file_read' || toolName === 'file_list') && typeof obj.path === 'string') {
    // Show only the last segments of the path
    const parts = String(obj.path).replace(/\\/g, '/').split('/');
    return parts.slice(-3).join('/');
  }
  const first = Object.values(obj)[0];
  return typeof first === 'string' ? first.slice(0, 60) : '';
}

export function AgentActivityLog({ thinking, toolCalls, isStreaming }: AgentActivityLogProps) {
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);

  const hasContent = !!(thinking || (toolCalls && toolCalls.length > 0));
  if (!hasContent && !isStreaming) return null;

  const isExpanded = manualExpanded !== null ? manualExpanded : false;
  const toggle = () => setManualExpanded((v) => !(v !== null ? v : false));

  const getHeaderText = (): string => {
    if (isStreaming) {
      const activeTool = toolCalls ? [...toolCalls].reverse().find((tc) => tc.isLoading) : undefined;
      if (activeTool) {
        const meta = TOOL_LABELS[activeTool.toolName];
        const label = meta?.activeLabel ?? activeTool.toolName;
        const detail = summarizeToolInput(activeTool.toolName, activeTool.input);
        return detail ? `${label}: ${detail}` : label;
      }
      if (thinking && (!toolCalls || toolCalls.length === 0)) return 'Thinking…';
      if (thinking) return 'Reasoning…';
      return 'Working…';
    }
    // Finished
    const toolCount = toolCalls?.length ?? 0;
    if (toolCount > 0 && thinking) {
      return `Reasoned and used ${toolCount} tool${toolCount > 1 ? 's' : ''}`;
    }
    if (toolCount > 0) {
      return `Used ${toolCount} tool${toolCount > 1 ? 's' : ''}`;
    }
    if (thinking) return 'Reasoned through the problem';
    return 'Done';
  };

  return (
    <div className="flex flex-col items-start">
      <button
        onClick={toggle}
        className="flex items-center gap-2 text-xs text-on-surface/60 hover:text-on-surface/80 transition-colors py-1 group max-w-[85%]"
      >
        {isStreaming ? (
          <span className="block w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
        ) : (
          <CheckCircleIcon />
        )}
        <span className={`truncate ${isStreaming ? 'animate-pulse' : ''}`}>
          {getHeaderText()}
        </span>
        <span className="text-on-surface/30 text-[10px] group-hover:text-on-surface/50 shrink-0">
          {isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {isExpanded && (
        <div className="ml-5 mt-1 space-y-1.5 border-l-2 border-outline-variant/15 pl-3 pb-2 text-[11px] max-w-[85%] w-full">
          {/* Thinking / reasoning */}
          {thinking && (
            <div className="text-on-surface/50 font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto py-1">
              {thinking}
              {isStreaming && (!toolCalls || !toolCalls.some((tc) => tc.isLoading)) && (
                <span className="inline-block w-1.5 h-3 bg-secondary/50 animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          )}

          {/* Tool calls as steps */}
          {toolCalls?.map((tc, i) => (
            <ToolStep key={i} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Individual tool step (expandable) ── */

function ToolStep({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TOOL_LABELS[toolCall.toolName];
  const label = toolCall.isLoading
    ? (meta?.activeLabel ?? toolCall.toolName)
    : (meta?.label ?? toolCall.toolName);
  const detail = summarizeToolInput(toolCall.toolName, toolCall.input);

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-on-surface/50 hover:text-on-surface/70 transition-colors w-full text-left"
      >
        {toolCall.isLoading ? (
          <span className="block w-2.5 h-2.5 rounded-full border-[1.5px] border-primary/30 border-t-primary animate-spin shrink-0" />
        ) : toolCall.result?.error ? (
          <span className="text-error shrink-0 text-[10px]">✗</span>
        ) : (
          <span className="text-secondary shrink-0 text-[10px]">✓</span>
        )}
        <span className="font-medium text-on-surface/60">{label}</span>
        {detail && (
          <span className="text-on-surface/35 font-mono truncate">{detail}</span>
        )}
        <span className="text-on-surface/20 text-[9px] ml-auto shrink-0">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="ml-4 mt-1 mb-1 space-y-1">
          <div>
            <p className="text-[10px] text-outline/50 uppercase tracking-wider mb-0.5">Input</p>
            <pre className="text-on-surface/50 font-mono whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto text-[10px] leading-relaxed">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {toolCall.result?.output && (
            <div>
              <p className="text-[10px] text-outline/50 uppercase tracking-wider mb-0.5">Output</p>
              <pre className="text-on-surface/60 font-mono whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto text-[10px] leading-relaxed">
                {toolCall.result.output.slice(0, 500)}
                {toolCall.result.output.length > 500 && '…'}
              </pre>
            </div>
          )}
          {toolCall.result?.error && (
            <div>
              <p className="text-[10px] text-error/60 uppercase tracking-wider mb-0.5">Error</p>
              <pre className="text-error/70 font-mono whitespace-pre-wrap overflow-x-auto text-[10px]">
                {toolCall.result.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Icons ── */

function CheckCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-secondary shrink-0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
