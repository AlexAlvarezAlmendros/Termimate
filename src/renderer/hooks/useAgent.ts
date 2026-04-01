import { useEffect } from 'react';
import { useAgentStore } from '../store/agentStore';
import type { ChatMessage } from '../store/agentStore';
import type { ProviderName } from '../../../shared/types/agent.types';
import type { ToolCall } from '../store/agentStore';

const EMPTY_MESSAGES: ChatMessage[] = [];

export function useAgent(sessionId: string | null) {
  const messages = useAgentStore((s) => (sessionId ? (s.messages[sessionId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES));
  const isStreaming = useAgentStore((s) => (sessionId ? (s.streamingSessions[sessionId] ?? false) : false));

  // Load persisted messages from DB when switching to a session with no in-memory messages
  useEffect(() => {
    if (!sessionId || !window.electronAPI) return;
    const existing = useAgentStore.getState().messages[sessionId];
    if (existing && existing.length > 0) return;

    window.electronAPI.message.list(sessionId).then((dbMessages) => {
      if (dbMessages.length === 0) return;
      const store = useAgentStore.getState();
      store.setMessages(sessionId, dbMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        toolCalls: m.toolCalls ? (JSON.parse(m.toolCalls) as ToolCall[]) : undefined,
      })));
    }).catch(() => { /* silent — history load failure is non-critical */ });
  }, [sessionId]);

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
          store.updateTokenUsage(sessionId, event.usage.inputTokens ?? 0, event.usage.outputTokens ?? 0);
        }
      } else if (event.type === 'error') {
        const msg = event.message ?? 'Unknown error occurred';
        let friendlyMsg = `Error: ${msg}`;

        if (msg.includes('API key not configured') || msg.includes('api_key')) {
          friendlyMsg = 'No API key configured. Open **Settings** (gear icon) and add your Anthropic or OpenAI API key to start chatting.';
        } else if (msg.includes('rate_limit') || msg.includes('429')) {
          friendlyMsg = 'Rate limit reached. Please wait a moment before sending another message.';
        } else if (msg.includes('ENOTFOUND') || msg.includes('network')) {
          friendlyMsg = 'Network error. Check your internet connection and try again.';
        }

        store.addMessage(sessionId, { role: 'assistant', content: friendlyMsg });
        store.setStreaming(sessionId, false);
      }
    });

    return () => {
      removeStreamListener();
    };
  }, [sessionId]);

  const sendMessage = async (content: string, provider?: ProviderName, model?: string, agentId?: string) => {
    if (!sessionId || !content.trim() || !window.electronAPI) return;

    useAgentStore.getState().addMessage(sessionId, { role: 'user', content });

    try {
      await window.electronAPI.agent.sendMessage({
        sessionId,
        content,
        provider,
        model,
        agentId,
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
