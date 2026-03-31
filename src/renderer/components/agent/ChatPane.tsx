import { useState, useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { ToolCallCard } from './ToolCallCard';
import { useAgent } from '../../hooks/useAgent';
import { useSessionStore } from '../../store/sessionStore';

export function ChatPane() {
  const { activeSessionId } = useSessionStore();
  const { messages, isStreaming, sendMessage } = useAgent(activeSessionId);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

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

    try {
      await sendMessage(content);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="bg-surface-container-low px-4 py-2 flex items-center justify-between border-b border-outline-variant/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-secondary" />
          <span className="text-xs font-headline font-bold text-primary">Termimate AI</span>
        </div>
        <span className="text-[10px] text-outline">
          {isStreaming ? 'Thinking...' : 'Ready'}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-outline/50 text-sm">
              Ask me anything about your project...
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            <MessageBubble role={msg.role} content={msg.content} />
            {msg.toolCalls?.map((tc, j) => (
              <ToolCallCard
                key={`${i}-tool-${j}`}
                toolName={tc.toolName}
                input={tc.input}
                result={tc.result}
                isLoading={tc.isLoading}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Input */}
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        disabled={isStreaming || !activeSessionId}
      />
    </div>
  );
}
