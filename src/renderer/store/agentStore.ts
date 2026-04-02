import { create } from 'zustand';

export interface ToolCall {
  toolName: string;
  input: unknown;
  result?: { output?: string; error?: string };
  isLoading: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
}

interface AgentStore {
  messages: Record<string, ChatMessage[]>; // sessionId → messages
  streamingSessions: Record<string, boolean>;
  tokenUsage: Record<string, { input: number; output: number }>;

  addMessage: (sessionId: string, message: ChatMessage) => void;
  appendToLastMessage: (sessionId: string, content: string) => void;
  appendThinking: (sessionId: string, content: string) => void;
  setStreaming: (sessionId: string, streaming: boolean) => void;
  isSessionStreaming: (sessionId: string) => boolean;
  clearMessages: (sessionId: string) => void;
  /** Remove the last assistant message if it is an incomplete streaming artifact. */
  removeLastStreamingMessage: (sessionId: string) => void;

  addToolCall: (sessionId: string, toolName: string, input: unknown) => void;
  resolveToolCall: (sessionId: string, toolName: string, result: { output?: string; error?: string }) => void;
  updateTokenUsage: (sessionId: string, input: number, output: number) => void;
  setMessages: (sessionId: string, messages: ChatMessage[]) => void;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  messages: {},
  streamingSessions: {},
  tokenUsage: {},

  addMessage: (sessionId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] ?? []), message],
      },
    })),

  appendToLastMessage: (sessionId, content) =>
    set((state) => {
      const msgs = state.messages[sessionId] ?? [];
      if (msgs.length === 0) return state;

      const last = msgs[msgs.length - 1];
      const updated = [...msgs.slice(0, -1), { ...last, content: last.content + content }];
      return {
        messages: { ...state.messages, [sessionId]: updated },
      };
    }),

  appendThinking: (sessionId, content) =>
    set((state) => {
      const msgs = state.messages[sessionId] ?? [];
      if (msgs.length === 0) return state;
      const last = msgs[msgs.length - 1];
      if (last.role !== 'assistant') return state;
      const updated = [...msgs.slice(0, -1), { ...last, thinking: (last.thinking ?? '') + content }];
      return { messages: { ...state.messages, [sessionId]: updated } };
    }),

  setStreaming: (sessionId, streaming) =>
    set((state) => ({
      streamingSessions: { ...state.streamingSessions, [sessionId]: streaming },
    })),

  isSessionStreaming: (sessionId) => get().streamingSessions[sessionId] ?? false,

  clearMessages: (sessionId) =>
    set((state) => ({
      messages: { ...state.messages, [sessionId]: [] },
    })),

  removeLastStreamingMessage: (sessionId) =>
    set((state) => {
      const msgs = state.messages[sessionId] ?? [];
      if (msgs.length === 0) return state;
      const last = msgs[msgs.length - 1];
      // Only remove the last assistant message (partial streaming artifact)
      if (last.role !== 'assistant') return state;
      return { messages: { ...state.messages, [sessionId]: msgs.slice(0, -1) } };
    }),

  addToolCall: (sessionId, toolName, input) =>
    set((state) => {
      const msgs = state.messages[sessionId] ?? [];
      if (msgs.length === 0) return state;

      const last = msgs[msgs.length - 1];
      if (last.role !== 'assistant') return state;

      const toolCalls = [...(last.toolCalls ?? []), { toolName, input, isLoading: true }];
      const updated = [...msgs.slice(0, -1), { ...last, toolCalls }];
      return { messages: { ...state.messages, [sessionId]: updated } };
    }),

  resolveToolCall: (sessionId, toolName, result) =>
    set((state) => {
      const msgs = state.messages[sessionId] ?? [];
      if (msgs.length === 0) return state;

      const last = msgs[msgs.length - 1];
      if (last.role !== 'assistant' || !last.toolCalls) return state;

      const toolCalls = last.toolCalls.map((tc) =>
        tc.toolName === toolName && tc.isLoading ? { ...tc, result, isLoading: false } : tc,
      );
      const updated = [...msgs.slice(0, -1), { ...last, toolCalls }];
      return { messages: { ...state.messages, [sessionId]: updated } };
    }),

  updateTokenUsage: (sessionId, input, output) =>
    set((state) => {
      const prev = state.tokenUsage[sessionId] ?? { input: 0, output: 0 };
      return {
        tokenUsage: {
          ...state.tokenUsage,
          [sessionId]: { input: prev.input + input, output: prev.output + output },
        },
      };
    }),

  setMessages: (sessionId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [sessionId]: messages },
    })),
}));
