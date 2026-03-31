import { useEffect } from 'react';
import { useAgentStore } from '../store/agentStore';

export function useAgent(sessionId: string | null) {
  const messages = useAgentStore((s) => (sessionId ? (s.messages[sessionId] ?? []) : []));
  const isStreaming = useAgentStore((s) => (sessionId ? (s.streamingSessions[sessionId] ?? false) : false));

  useEffect(() => {
    if (!sessionId || !window.electronAPI) return;

    const removeStreamListener = window.electronAPI.agent.onStreamEvent((streamId, event) => {
      const store = useAgentStore.getState();

      if (event.type === 'text_delta') {
        const sessionMessages = store.messages[sessionId] ?? [];
        const lastMessage = sessionMessages[sessionMessages.length - 1];

        if (lastMessage?.role === 'assistant') {
          store.appendToLastMessage(sessionId, event.content);
        } else {
          store.addMessage(sessionId, { role: 'assistant', content: event.content });
        }
        store.setStreaming(sessionId, true);
      } else if (event.type === 'tool_use_start') {
        store.addToolCall(sessionId, event.toolName, event.toolInput);
      } else if (event.type === 'tool_use_end') {
        store.resolveToolCall(sessionId, event.toolName, {
          output: event.result?.output,
          error: event.result?.error,
        });
      } else if (event.type === 'message_stop') {
        store.setStreaming(sessionId, false);
        if (event.usage) {
          store.updateTokenUsage(sessionId, event.usage.input_tokens ?? 0, event.usage.output_tokens ?? 0);
        }
      } else if (event.type === 'error') {
        store.addMessage(sessionId, {
          role: 'assistant',
          content: `Error: ${event.message ?? 'Unknown error occurred'}`,
        });
        store.setStreaming(sessionId, false);
      }
    });

    return () => {
      removeStreamListener();
    };
  }, [sessionId]);

  const sendMessage = async (content: string) => {
    if (!sessionId || !content.trim() || !window.electronAPI) return;

    useAgentStore.getState().addMessage(sessionId, { role: 'user', content });

    try {
      await window.electronAPI.agent.sendMessage({
        sessionId,
        content,
      });
    } catch (error) {
      useAgentStore.getState().addMessage(sessionId, {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
      });
      useAgentStore.getState().setStreaming(sessionId, false);
    }
  };

  return {
    messages,
    isStreaming,
    sendMessage,
  };
}
