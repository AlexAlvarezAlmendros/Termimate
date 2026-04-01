export type ProviderName = 'anthropic' | 'openai' | 'gemini';

export interface Agent {
  id: string;
  name: string;
  systemPrompt: string | null;
  provider: ProviderName;
  model: string;
  toolsConfig: ToolsConfig | null;
  createdAt: number;
}

export interface CreateAgentDTO {
  name: string;
  systemPrompt?: string;
  provider: ProviderName;
  model: string;
  toolsConfig?: ToolsConfig;
}

export interface UpdateAgentDTO {
  name?: string;
  systemPrompt?: string;
  provider?: ProviderName;
  model?: string;
  toolsConfig?: ToolsConfig;
}

export interface ToolsConfig {
  enabledTools: string[];
  bashAllowlist?: string[];
}

export interface ModelDefinition {
  id: string;
  name: string;
  provider: ProviderName;
  maxTokens: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export type StreamEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'tool_use_start'; toolName: string; toolInput: unknown }
  | { type: 'tool_use_end'; toolName: string; result: ToolResult }
  | { type: 'message_stop'; usage: TokenUsage }
  | { type: 'error'; message: string };

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface ToolContext {
  sessionId: string;
  projectRoot: string | null;
  outputBuffer: string | null;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: string | null;
  tokensUsed: number | null;
  createdAt: number;
}

export interface SendMessageParams {
  sessionId: string;
  content: string;
  provider?: ProviderName;
  model?: string;
  agentId?: string;
  attachments?: string[];
}

export interface ConfirmRequest {
  requestId: string;
  type: 'bash_execute';
  command: string;
  sessionId: string;
}
