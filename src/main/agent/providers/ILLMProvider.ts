import type { StreamEvent, ModelDefinition } from '../../../shared/types/agent.types';

export interface StreamMessageParams {
  model: string;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools?: ToolDefinition[];
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
