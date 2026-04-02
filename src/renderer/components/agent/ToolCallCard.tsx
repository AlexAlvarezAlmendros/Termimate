import { useState } from 'react';

interface ToolCallCardProps {
  toolName: string;
  input: unknown;
  result?: { output?: string; error?: string };
  isLoading: boolean;
}

const TOOL_META: Record<string, { label: string; icon: () => JSX.Element; color: string }> = {
  bash_execute:     { label: 'Run command',    icon: TerminalIcon,   color: 'text-amber-400'  },
  file_read:        { label: 'Read file',      icon: FileReadIcon,   color: 'text-blue-400'   },
  file_write:       { label: 'Write file',     icon: FileWriteIcon,  color: 'text-purple-400' },
  file_list:        { label: 'List files',     icon: FolderIcon,     color: 'text-sky-400'    },
  directory_create: { label: 'Create folder',  icon: FolderPlusIcon, color: 'text-teal-400'   },
  terminal_read:    { label: 'Read terminal',  icon: TerminalIcon,   color: 'text-green-400'  },
  web_fetch:        { label: 'Fetch webpage',  icon: GlobeIcon,      color: 'text-orange-400' },
};

const OUTPUT_TRUNCATE = 600;

export function ToolCallCard({ toolName, input, result, isLoading }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);

  const meta = TOOL_META[toolName];
  const label  = meta?.label ?? toolName;
  const Icon   = meta?.icon  ?? DefaultToolIcon;
  const color  = meta?.color ?? 'text-outline';

  // Build a short human-readable summary of the input
  const inputSummary = summarizeInput(toolName, input);

  return (
    <div className="my-1 rounded-lg border border-outline-variant/15 bg-surface-container overflow-hidden text-xs">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/4 transition-colors text-left"
      >
        {/* Status dot / spinner */}
        <span className="shrink-0">
          {isLoading ? (
            <span className="block w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          ) : result?.error ? (
            <span className={`block w-2 h-2 rounded-full bg-error`} />
          ) : (
            <span className={`block w-2 h-2 rounded-full bg-secondary`} />
          )}
        </span>

        {/* Icon + label */}
        <span className={`${color} shrink-0`}><Icon /></span>
        <span className="font-medium text-on-surface/80">{label}</span>

        {/* Input summary */}
        {inputSummary && (
          <span className="text-outline/50 font-mono truncate flex-1">{inputSummary}</span>
        )}

        {/* Status badge */}
        {isLoading && <span className="text-[10px] text-outline/50 animate-pulse shrink-0">running…</span>}
        {result && !isLoading && (
          <span className={`text-[10px] shrink-0 ${result.error ? 'text-error/70' : 'text-secondary/70'}`}>
            {result.error ? 'failed' : 'done'}
          </span>
        )}

        {/* Chevron */}
        <span className={`shrink-0 text-outline/30 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <ChevronDownIcon />
        </span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-outline-variant/10">
          {/* Input */}
          <div className="px-3 py-2">
            <p className="text-[10px] text-outline/50 uppercase tracking-wider mb-1">Input</p>
            <pre className="text-on-surface/60 font-mono whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto text-[11px] leading-relaxed">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>

          {/* Output */}
          {result?.output && (
            <div className="px-3 pb-2 border-t border-outline-variant/10 pt-2">
              <p className="text-[10px] text-outline/50 uppercase tracking-wider mb-1">Output</p>
              <pre className="text-on-surface/70 font-mono whitespace-pre-wrap overflow-x-auto text-[11px] leading-relaxed">
                {outputExpanded ? result.output : result.output.slice(0, OUTPUT_TRUNCATE)}
              </pre>
              {result.output.length > OUTPUT_TRUNCATE && (
                <button
                  onClick={(e) => { e.stopPropagation(); setOutputExpanded((v) => !v); }}
                  className="mt-1 text-[10px] text-primary hover:underline"
                >
                  {outputExpanded ? 'Show less' : `+${result.output.length - OUTPUT_TRUNCATE} more chars`}
                </button>
              )}
            </div>
          )}

          {/* Error */}
          {result?.error && (
            <div className="px-3 pb-2 border-t border-outline-variant/10 pt-2">
              <p className="text-[10px] text-error/70 uppercase tracking-wider mb-1">Error</p>
              <pre className="text-error/80 font-mono whitespace-pre-wrap overflow-x-auto text-[11px]">
                {result.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Input summariser ────────────────────────────────────────────────────────

function summarizeInput(toolName: string, input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const obj = input as Record<string, unknown>;
  if (toolName === 'bash_execute' && typeof obj.command === 'string') {
    return obj.command.split('\n')[0].slice(0, 80);
  }
  if ((toolName === 'file_read' || toolName === 'file_list' || toolName === 'file_write' || toolName === 'directory_create') && typeof obj.path === 'string') {
    return obj.path;
  }
  if (toolName === 'web_fetch' && typeof obj.url === 'string') {
    try { return new URL(obj.url).hostname; } catch { return obj.url.slice(0, 80); }
  }
  const first = Object.values(obj)[0];
  return typeof first === 'string' ? first.slice(0, 80) : '';
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function TerminalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function FileReadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function FileWriteIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FolderPlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function DefaultToolIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
