import OpenAI from 'openai';
import type { ILLMProvider, StreamMessageParams } from './ILLMProvider';
import type { StreamEvent, ModelDefinition } from '../../../shared/types/agent.types';
import { getApiKey } from '../../security/KeychainService';

export class OpenAIProvider implements ILLMProvider {
  readonly name = 'openai';
  readonly supportedModels: ModelDefinition[] = [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', maxTokens: 4096 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', maxTokens: 4096 },
  ];

  private client: OpenAI | null = null;

  private async getClient(): Promise<OpenAI> {
    if (!this.client) {
      const apiKey = await getApiKey('openai');
      if (!apiKey) throw new Error('OpenAI API key not configured');
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async *streamMessage(params: StreamMessageParams): AsyncIterable<StreamEvent> {
    const client = await this.getClient();

    const stream = await client.chat.completions.create({
      model: params.model,
      stream: true,
      messages: [
        { role: 'system', content: params.systemPrompt },
        ...params.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield { type: 'text_delta', content: delta.content };
      }
      if (chunk.choices[0]?.finish_reason === 'stop') {
        yield {
          type: 'message_stop',
          usage: {
            inputTokens: chunk.usage?.prompt_tokens ?? 0,
            outputTokens: chunk.usage?.completion_tokens ?? 0,
          },
        };
      }
    }
  }
}
