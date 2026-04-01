import type { ProviderName } from '../../../shared/types/agent.types';

export interface ModelDefinitionUI {
  provider: ProviderName;
  model: string;
  label: string;
  maxTokens: number;
}

export const MODELS: ModelDefinitionUI[] = [
  { provider: 'anthropic', model: 'claude-opus-4-6',            label: 'Claude Opus 4.6',   maxTokens: 200000  },
  { provider: 'anthropic', model: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6', maxTokens: 200000  },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',  maxTokens: 200000  },
  { provider: 'openai',    model: 'gpt-4o',                     label: 'GPT-4o',            maxTokens: 16384   },
  { provider: 'openai',    model: 'gpt-4o-mini',                label: 'GPT-4o Mini',       maxTokens: 16384   },
  { provider: 'openai',    model: 'o1',                         label: 'o1',                maxTokens: 32768   },
  { provider: 'openai',    model: 'o3-mini',                    label: 'o3 Mini',           maxTokens: 65536   },
  { provider: 'gemini',    model: 'gemini-3.1-pro-preview',     label: 'Gemini 3.1 Pro',    maxTokens: 1048576 },
  { provider: 'gemini',    model: 'gemini-3-flash-preview',     label: 'Gemini 3 Flash',    maxTokens: 1048576 },
  { provider: 'gemini',    model: 'gemini-2.0-flash',           label: 'Gemini 2.0 Flash',  maxTokens: 1048576 },
];
