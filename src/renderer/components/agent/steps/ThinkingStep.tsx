import { useState } from 'react';

interface ThinkingStepProps {
  thinking: string;
  isStreaming: boolean;
}

/**
 * Detects whether the thinking text appears to contain a numbered plan
 * (e.g. "1. Do X\n2. Do Y"). Used to render a checklist instead of plain text.
 */
function detectPlanItems(text: string): string[] | null {
  const lines = text.split('\n');
  const planLines: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\s*(\d+[\.\)]\s+|[-*]\s+\[[ x]\]\s+|[-*]\s+)(.+)/);
    if (match) planLines.push(match[2].trim());
  }
  // Only treat as a plan if at least 2 items found
  return planLines.length >= 2 ? planLines : null;
}

export function ThinkingStep({ thinking, isStreaming }: ThinkingStepProps) {
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  // Always start collapsed — user clicks to expand (same behaviour as tool steps)
  const isExpanded = manualExpanded !== null ? manualExpanded : false;
  const toggle = () => setManualExpanded((v) => !(v !== null ? v : false));

  const planItems = !isStreaming ? detectPlanItems(thinking) : null;
  const isPlan = planItems !== null;

  return (
    <div className="flex items-start gap-2.5 max-w-[85%]">
      {/* Timeline dot */}
      <div className="flex flex-col items-center mt-0.5 shrink-0">
        <div className="w-6 h-6 rounded-full bg-secondary/10 border border-secondary/25 flex items-center justify-center text-secondary/70">
          <BrainIcon />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 min-w-0">
        <button
          onClick={toggle}
          className="flex items-center gap-2 text-xs text-secondary/70 hover:text-secondary/90 transition-colors w-full text-left py-0.5"
        >
          {isStreaming ? (
            <span className="text-[10px] text-secondary/50 animate-pulse font-medium">
              {isPlan ? 'Planning…' : 'Thinking…'}
            </span>
          ) : (
            <span className="font-medium">
              {isPlan ? `Plan (${planItems!.length} steps)` : `Reasoning (${thinking.split(/\s+/).length} words)`}
            </span>
          )}
          <span className="text-secondary/30 ml-auto text-[10px]">{isExpanded ? '▲' : '▼'}</span>
        </button>

        {isExpanded && (
          <div className="mt-1.5 rounded-lg bg-secondary/5 border border-secondary/15 overflow-hidden">
            {isPlan && planItems ? (
              /* Checklist rendering */
              <ul className="px-3 py-2.5 space-y-1.5">
                {planItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-on-surface/60">
                    <span className="mt-0.5 w-4 h-4 rounded border border-secondary/30 bg-secondary/5 flex items-center justify-center shrink-0 text-[9px] text-secondary/50 font-mono">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              /* Plain reasoning text */
              <div className="px-3 py-2.5 text-[11px] text-on-surface/55 font-mono leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                {thinking}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-3 bg-secondary/50 animate-pulse ml-0.5 align-text-bottom" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BrainIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.88A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.88A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}
