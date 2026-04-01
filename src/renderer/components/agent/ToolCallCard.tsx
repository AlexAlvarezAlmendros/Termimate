import { useState } from 'react';

interface ToolCallCardProps {
  toolName: string;
  input: unknown;
  result?: { output?: string; error?: string };
  isLoading: boolean;
}

const TRUNCATE_AT = 500;

export function ToolCallCard({ toolName, input, result, isLoading }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-surface-container rounded-lg border border-outline-variant/10 p-3 text-xs font-mono">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-tertiary font-bold">{toolName}</span>
        {isLoading && <span className="text-outline animate-pulse">running...</span>}
        {result && (
          <span className={result.error ? 'text-error' : 'text-secondary'}>
            {result.error ? 'failed' : 'success'}
          </span>
        )}
      </div>
      <pre className="text-on-surface-variant overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(input, null, 2)}
      </pre>
      {result?.output && (
        <div className="mt-2 pt-2 border-t border-outline-variant/10">
          <pre className="text-on-surface/70 overflow-x-auto whitespace-pre-wrap">
            {expanded ? result.output : result.output.slice(0, TRUNCATE_AT)}
          </pre>
          {result.output.length > TRUNCATE_AT && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-[10px] text-primary hover:underline"
            >
              {expanded ? 'Show less' : `Show ${result.output.length - TRUNCATE_AT} more characters`}
            </button>
          )}
        </div>
      )}
      {result?.error && (
        <pre className="mt-2 pt-2 border-t border-outline-variant/10 text-error overflow-x-auto whitespace-pre-wrap">
          {result.error}
        </pre>
      )}
    </div>
  );
}
