import type { StreamEvent, ModelDefinition } from '../../../shared/types/agent.types';

/** A structured tool call block emitted by the assistant. */
export interface ToolCallBlock {
  id: string;
  name: string;
  input: unknown;
}

/** A structured tool result block provided by the user after execution. */
export interface ToolResultBlock {
  toolCallId: string;
  toolName: string;
  content: string;
  isError?: boolean;
}

/** Rich message type supporting native tool_use/tool_result blocks for all providers. */
export type RichMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCallBlock[] }
  | { role: 'tool_result'; toolCallId: string; toolName: string; content: string; isError?: boolean };

export interface StreamMessageParams {
  model: string;
  systemPrompt: string;
  messages: RichMessage[];
  tools?: ToolDefinition[];
  enableThinking?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ILLMProvider {
  readonly name: string;
  readonly supportedModels: ModelDefinition[];

  streamMessage(params: StreamMessageParams): AsyncIterable<StreamEvent>;
}
