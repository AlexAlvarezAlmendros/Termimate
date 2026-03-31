import Anthropic from '@anthropic-ai/sdk';
import type { ILLMProvider, StreamMessageParams } from './ILLMProvider';
import type { StreamEvent, ModelDefinition } from '../../../shared/types/agent.types';
import { getApiKey } from '../../security/KeychainService';

export class AnthropicProvider implements ILLMProvider {
  readonly name = 'anthropic';
  readonly supportedModels: ModelDefinition[] = [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', maxTokens: 8192 },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic', maxTokens: 8192 },
  ];

  private client: Anthropic | null = null;

  private async getClient(): Promise<Anthropic> {
    if (!this.client) {
      const apiKey = await getApiKey('anthropic');
      if (!apiKey) throw new Error('Anthropic API key not configured');
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async *streamMessage(params: StreamMessageParams): AsyncIterable<StreamEvent> {
    const client = await this.getClient();

    const stream = client.messages.stream({
      model: params.model,
      max_tokens: 4096,
      system: params.systemPrompt,
      messages: params.messages,
      tools: params.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if ('text' in delta) {
          yield { type: 'text_delta', content: delta.text };
        }
      } else if (event.type === 'message_stop') {
        const finalMessage = await stream.finalMessage();
        yield {
          type: 'message_stop',
          usage: {
            inputTokens: finalMessage.usage.input_tokens,
            outputTokens: finalMessage.usage.output_tokens,
          },
        };
      }
    }
  }
}
