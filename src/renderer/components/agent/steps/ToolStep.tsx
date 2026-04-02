import { useState } from 'react';
import type { ReactElement } from 'react';
import type { ToolCall } from '../../../store/agentStore';

interface ToolStepProps {
  toolCall: ToolCall;
}

const OUTPUT_TRUNCATE = 600;

const TOOL_CONFIG: Record<string, {
  label: string;
  activeLabel: string;
  color: string;
  icon: () => ReactElement;
}> = {
  bash_execute:     { label: 'Ran command',     activeLabel: 'Running command',    color: 'text-amber-400',  icon: TerminalIcon   },
  file_read:        { label: 'Read file',        activeLabel: 'Reading file',       color: 'text-blue-400',   icon: FileReadIcon   },
  file_write:       { label: 'Wrote file',       activeLabel: 'Writing file',       color: 'text-purple-400', icon: FileWriteIcon  },
  file_list:        { label: 'Listed files',     activeLabel: 'Listing files',      color: 'text-sky-400',    icon: FolderIcon     },
  directory_create: { label: 'Created folder',   activeLabel: 'Creating folder',    color: 'text-teal-400',   icon: FolderPlusIcon },
  terminal_read:    { label: 'Read terminal',    activeLabel: 'Reading terminal',   color: 'text-green-400',  icon: TerminalIcon   },
  web_fetch:        { label: 'Fetched webpage',  activeLabel: 'Fetching webpage',   color: 'text-orange-400', icon: GlobeIcon      },
};

function getDetail(toolName: string, input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const obj = input as Record<string, unknown>;
  if (toolName === 'bash_execute' && typeof obj.command === 'string') {
    return obj.command.split('\n')[0].slice(0, 70);
  }
  if ((toolName === 'file_read' || toolName === 'file_write' || toolName === 'file_list' || toolName === 'directory_create') && typeof obj.path === 'string') {
    // Show last 3 path segments
    const parts = String(obj.path).replace(/\\/g, '/').split('/');
    return parts.slice(-3).join('/');
  }
  if (toolName === 'web_fetch' && typeof obj.url === 'string') {
    try { return new URL(obj.url).hostname; } catch { return obj.url.slice(0, 60); }
  }
  const first = Object.values(obj)[0];
  return typeof first === 'string' ? first.slice(0, 70) : '';
}

export function ToolStep({ toolCall }: ToolStepProps) {
  const [expanded, setExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);

  const cfg = TOOL_CONFIG[toolCall.toolName];
  const label = toolCall.isLoading
    ? (cfg?.activeLabel ?? toolCall.toolName)
    : (cfg?.label ?? toolCall.toolName);
  const color = cfg?.color ?? 'text-outline';
  const Icon = cfg?.icon ?? DefaultIcon;
  const detail = getDetail(toolCall.toolName, toolCall.input);

  return (
    <div className="flex items-start gap-2.5 max-w-[85%]">
      {/* Timeline dot */}
      <div className="shrink-0 mt-0.5">
        <div className={`w-6 h-6 rounded-full bg-surface-container-high border border-outline-variant/20 flex items-center justify-center ${color}`}>
          <Icon />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 min-w-0">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-xs text-on-surface/70 hover:text-on-surface/90 transition-colors w-full text-left py-0.5"
        >
          {/* Status */}
          <span className="shrink-0">
            {toolCall.isLoading ? (
              <span className="block w-2 h-2 rounded-full border-[1.5px] border-primary/30 border-t-primary animate-spin" />
            ) : toolCall.result?.error ? (
              <span className="text-error text-[10px]">✗</span>
            ) : (
              <span className="text-secondary text-[10px]">✓</span>
            )}
          </span>

          {/* Label */}
          <span className="font-medium">{label}</span>

          {/* Detail */}
          {detail && (
            <span className="text-outline/50 font-mono truncate flex-1">{detail}</span>
          )}

          {/* Loading pulse */}
          {toolCall.isLoading && (
            <span className="text-[10px] text-outline/40 animate-pulse shrink-0">running…</span>
          )}

          {/* Chevron */}
          <span className="text-outline/30 text-[10px] ml-auto shrink-0">{expanded ? '▲' : '▼'}</span>
        </button>

        {expanded && (
          <div className="mt-1.5 rounded-lg border border-outline-variant/15 bg-surface-container overflow-hidden text-[11px]">
            {/* Input */}
            <div className="px-3 py-2">
              <p className="text-[10px] text-outline/50 uppercase tracking-wider mb-1">Input</p>
              <pre className="text-on-surface/55 font-mono whitespace-pre-wrap overflow-x-auto max-h-28 overflow-y-auto leading-relaxed">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>

            {/* Output */}
            {toolCall.result?.output && (
              <div className="px-3 pb-2 border-t border-outline-variant/10 pt-2">
                <p className="text-[10px] text-outline/50 uppercase tracking-wider mb-1">Output</p>
                <pre className="text-on-surface/70 font-mono whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto leading-relaxed">
                  {outputExpanded ? toolCall.result.output : toolCall.result.output.slice(0, OUTPUT_TRUNCATE)}
                </pre>
                {toolCall.result.output.length > OUTPUT_TRUNCATE && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setOutputExpanded((v) => !v); }}
                    className="mt-1 text-[10px] text-primary hover:underline"
                  >
                    {outputExpanded ? 'Show less' : `+${toolCall.result.output.length - OUTPUT_TRUNCATE} more chars`}
                  </button>
                )}
              </div>
            )}

            {/* Error */}
            {toolCall.result?.error && (
              <div className="px-3 pb-2 border-t border-outline-variant/10 pt-2">
                <p className="text-[10px] text-error/60 uppercase tracking-wider mb-1">Error</p>
                <pre className="text-error/75 font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
                  {toolCall.result.error}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function TerminalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function FileReadIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function FileWriteIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FolderPlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function DefaultIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
