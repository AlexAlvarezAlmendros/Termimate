import type { ToolCall } from '../../store/agentStore';
import { ThinkingStep } from './steps/ThinkingStep';
import { ToolStep } from './steps/ToolStep';

interface ActivityTimelineProps {
  thinking?: string;
  toolCalls?: ToolCall[];
  isStreaming: boolean;
}

export function ActivityTimeline({ thinking, toolCalls, isStreaming }: ActivityTimelineProps) {
  const hasThinking = !!thinking;
  const hasTools = !!(toolCalls && toolCalls.length > 0);

  if (!hasThinking && !hasTools) return null;

  return (
    <div className="relative pl-0 space-y-2 mb-2">
      {/* Vertical timeline connector line */}
      {(hasThinking || hasTools) && (hasThinking && hasTools || (toolCalls?.length ?? 0) > 1) && (
        <div
          className="absolute left-3 top-3 bottom-3 w-px bg-outline-variant/15"
          aria-hidden="true"
        />
      )}

      {/* Thinking / Planning step */}
      {hasThinking && (
        <ThinkingStep thinking={thinking!} isStreaming={isStreaming && !hasTools} />
      )}

      {/* Tool call steps */}
      {toolCalls?.map((tc, i) => {
        return <ToolStep key={i} toolCall={tc} />;
      })}

      {/* "Working…" placeholder if streaming but no tools yet and no thinking */}
      {isStreaming && !hasThinking && !hasTools && (
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-surface-container-high border border-outline-variant/20 flex items-center justify-center">
            <span className="block w-2 h-2 rounded-full border-[1.5px] border-primary/30 border-t-primary animate-spin" />
          </div>
          <span className="text-xs text-outline/50 animate-pulse">Working…</span>
        </div>
      )}
    </div>
  );
}
