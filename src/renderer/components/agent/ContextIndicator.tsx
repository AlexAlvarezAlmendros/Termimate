interface ContextIndicatorProps {
  tokensUsed: number;
  maxTokens: number;
}

export function ContextIndicator({ tokensUsed, maxTokens }: ContextIndicatorProps) {
  const percent = Math.min(100, (tokensUsed / maxTokens) * 100);

  return (
    <div className="p-3 bg-surface-container-high/50 rounded-lg border border-outline-variant/5 space-y-2">
      <div className="flex justify-between text-[10px] font-mono text-outline">
        <span>CONTEXT WINDOW</span>
        <span className="text-primary">{Math.round(percent)}%</span>
      </div>
      <div className="w-full bg-surface-container-lowest h-1 rounded-full overflow-hidden">
        <div
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-outline">
        <span>TOKENS</span>
        <span>{tokensUsed.toLocaleString()}</span>
      </div>
    </div>
  );
}
