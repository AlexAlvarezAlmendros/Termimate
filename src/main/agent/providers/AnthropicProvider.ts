import Anthropic from '@anthropic-ai/sdk';
import type { ILLMProvider, StreamMessageParams } from './ILLMProvider';
import type { StreamEvent, ModelDefinition } from '../../../shared/types/agent.types';
import { getApiKey } from '../../security/KeychainService';

export class AnthropicProvider implements ILLMProvider {
  readonly name = 'anthropic';
  readonly supportedModels: ModelDefinition[] = [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic', maxTokens: 32000 },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic', maxTokens: 16000 },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic', maxTokens: 8192 },
  ];

  private client: Anthropic | null = null;

  resetClient(): void {
    this.client = null;
  }

  private async getClient(): Promise<Anthropic> {
    if (!this.client) {
      const apiKey = await getApiKey('anthropic');
      if (!apiKey) throw new Error('Anthropic API key not configured. Open Settings to add your key.');
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
      ...(params.tools && params.tools.length > 0
        ? {
            tools: params.tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
            })),
          }
        : {}),
    });

    // Track active tool blocks: index → { name, accumulatedInput }
    const toolBlocks = new Map<number, { name: string; accumulatedInput: string }>();

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          toolBlocks.set(event.index, {
            name: event.content_block.name,
            accumulatedInput: '',
          });
          // Don't emit yet — wait for full input at content_block_stop
        }
      } else if (event.type === 'content_block_delta') {
        const delta = event.delta;

        if ('text' in delta) {
          yield { type: 'text_delta', content: delta.text };
        } else if (delta.type === 'input_json_delta') {
          const block = toolBlocks.get(event.index);
          if (block) {
            block.accumulatedInput += delta.partial_json;
          }
        }
      } else if (event.type === 'content_block_stop') {
        // Tool block complete — emit tool_use_start with full parsed input
        const block = toolBlocks.get(event.index);
        if (block) {
          let parsedInput: unknown = {};
          try {
            parsedInput = JSON.parse(block.accumulatedInput || '{}');
          } catch {
            parsedInput = {};
          }

          yield {
            type: 'tool_use_start',
            toolName: block.name,
            toolInput: parsedInput,
          };

          toolBlocks.delete(event.index);
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
