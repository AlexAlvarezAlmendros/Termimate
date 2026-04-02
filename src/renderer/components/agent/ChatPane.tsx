import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import type { ApprovalLevel } from './ChatInput';
import { ActivityTimeline } from './ActivityTimeline';
import { useAgent } from '../../hooks/useAgent';
import { useAgentCrud } from '../../hooks/useAgentCrud';
import { useSessionStore } from '../../store/sessionStore';
import { useAgentStore } from '../../store/agentStore';
import { MODELS } from '../../constants/models';

const EMPTY_TOKEN_USAGE = { input: 0, output: 0 };

export function ChatPane() {
  const { activeSessionId, sessions } = useSessionStore();
  const { messages, isStreaming, sendMessage } = useAgent(activeSessionId);
  const { agents } = useAgentCrud();
  const tokenUsage = useAgentStore((s) =>
    activeSessionId ? (s.tokenUsage[activeSessionId] ?? EMPTY_TOKEN_USAGE) : EMPTY_TOKEN_USAGE,
  );
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState(0);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [approvalLevel, setApprovalLevel] = useState<ApprovalLevel>('default');
  const [enableThinking, setEnableThinking] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const hasProject = !!activeSession?.projectId;

  // Check if any API key is configured
  useEffect(() => {
    if (!window.electronAPI) return;
    Promise.all([
      window.electronAPI.config.getApiKey('anthropic'),
      window.electronAPI.config.getApiKey('openai'),
      window.electronAPI.config.getApiKey('gemini'),
    ]).then(([a, o, g]) => setHasApiKey(!!(a || o || g)));
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !activeSessionId) return;

    const content = inputValue.trim();
    setInputValue('');

    const { provider, model } = MODELS[selectedModel];
    try {
      await sendMessage(content, provider, model, selectedAgentId ?? undefined, enableThinking, approvalLevel);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleClearContext = async () => {
    if (!activeSessionId) return;
    if (!confirm('Clear all messages for this session?')) return;
    useAgentStore.getState().clearMessages(activeSessionId);
    if (window.electronAPI) {
      await window.electronAPI.message.deleteBySession(activeSessionId);
    }
  };

  const handleCancel = () => {
    if (!window.electronAPI || !activeSessionId) return;
    // The streamId isn't tracked client-side; cancel all active streams for this session
    window.electronAPI.agent.cancel(activeSessionId);
    useAgentStore.getState().setStreaming(activeSessionId, false);
  };

  const totalTokens = tokenUsage.input + tokenUsage.output;

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="bg-surface-container-low px-4 py-2 border-b border-outline-variant/5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-secondary" />
            <span className="text-xs font-headline font-bold text-primary">Termimate AI</span>
            {messages.length > 0 && (
              <span className="text-[10px] text-outline/50">{messages.length} msgs</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClearContext}
                disabled={isStreaming}
                className="text-[10px] text-outline/50 hover:text-error disabled:opacity-30 transition-colors"
                title="Clear context"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {hasApiKey === false && (
          <div className="bg-error/10 border border-error/20 rounded-lg px-3 py-2 text-xs text-error">
            No API key configured. Open <strong>Settings</strong> to add your Anthropic, OpenAI or Gemini key.
          </div>
        )}
        {!hasProject && activeSessionId && (
          <div className="bg-tertiary/10 border border-tertiary/20 rounded-lg px-3 py-2 text-xs text-tertiary">
            This session has no project assigned. The agent has limited context.
          </div>
        )}
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-outline/50 text-sm">
              Ask me anything about your project...
            </p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isLastStreaming = isStreaming && i === messages.length - 1;
          const hasActivity = msg.role === 'assistant' && !!(msg.thinking || msg.toolCalls?.length);

          return (
            <div key={i}>
              {hasActivity && (
                <ActivityTimeline
                  thinking={msg.thinking}
                  toolCalls={msg.toolCalls}
                  isStreaming={isLastStreaming}
                />
              )}
              {(msg.content || (isLastStreaming && !hasActivity)) && (
                <MessageBubble
                  role={msg.role}
                  content={msg.content}
                  isStreaming={isLastStreaming && (!hasActivity || !!msg.content)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Input */}
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        onCancel={handleCancel}
        disabled={isStreaming || !activeSessionId}
        isStreaming={isStreaming}
        agents={agents}
        selectedAgentId={selectedAgentId}
        onAgentChange={setSelectedAgentId}
        models={MODELS}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        approvalLevel={approvalLevel}
        onApprovalChange={setApprovalLevel}
        enableThinking={enableThinking}
        onThinkingToggle={() => setEnableThinking((v) => !v)}
        sessionName={activeSession?.name}
        tokensUsed={totalTokens}
        maxTokens={MODELS[selectedModel]?.maxTokens ?? 200000}
      />
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
