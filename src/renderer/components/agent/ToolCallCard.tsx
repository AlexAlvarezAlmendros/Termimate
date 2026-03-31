interface ToolCallCardProps {
  toolName: string;
  input: unknown;
  result?: { output?: string; error?: string };
  isLoading: boolean;
}

export function ToolCallCard({ toolName, input, result, isLoading }: ToolCallCardProps) {
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
        <pre className="mt-2 pt-2 border-t border-outline-variant/10 text-on-surface/70 overflow-x-auto whitespace-pre-wrap">
          {result.output.slice(0, 500)}
        </pre>
      )}
      {result?.error && (
        <pre className="mt-2 pt-2 border-t border-outline-variant/10 text-error overflow-x-auto whitespace-pre-wrap">
          {result.error}
        </pre>
      )}
    </div>
  );
}
