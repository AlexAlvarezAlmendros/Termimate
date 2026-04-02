import Anthropic from '@anthropic-ai/sdk';
import type { ILLMProvider, StreamMessageParams, RichMessage } from './ILLMProvider';
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

  /**
   * Converts RichMessage[] → Anthropic message format.
   * Consecutive tool_result messages are batched into a single user turn.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildMessages(messages: RichMessage[]): any[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = [];
    let i = 0;
    while (i < messages.length) {
      const m = messages[i];
      if (m.role === 'assistant') {
        if (m.toolCalls && m.toolCalls.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const content: any[] = [];
          if (m.content) content.push({ type: 'text', text: m.content });
          for (const tc of m.toolCalls) {
            content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
          }
          result.push({ role: 'assistant', content });
        } else {
          result.push({ role: 'assistant', content: m.content });
        }
        i++;
      } else if (m.role === 'tool_result') {
        // Batch consecutive tool_results into one user message with tool_result content blocks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolResultContent: any[] = [];
        while (i < messages.length && messages[i].role === 'tool_result') {
          const tr = messages[i] as { role: 'tool_result'; toolCallId: string; toolName: string; content: string; isError?: boolean };
          toolResultContent.push({
            type: 'tool_result',
            tool_use_id: tr.toolCallId,
            content: tr.content,
            is_error: tr.isError ?? false,
          });
          i++;
        }
        result.push({ role: 'user', content: toolResultContent });
      } else {
        result.push({ role: 'user', content: m.content });
        i++;
      }
    }
    return result;
  }

  async *streamMessage(params: StreamMessageParams): AsyncIterable<StreamEvent> {
    const client = await this.getClient();

    const hasTools = !!(params.tools && params.tools.length > 0);
    const maxTokens = params.enableThinking ? 16000 : 4096;
    const thinkingBudget = params.enableThinking ? Math.floor(maxTokens * 0.8) : 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestBody: any = {
      model: params.model,
      max_tokens: maxTokens,
      system: params.systemPrompt,
      messages: this.buildMessages(params.messages),
      ...(hasTools
        ? {
            tools: params.tools!.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
            })),
          }
        : {}),
      ...(params.enableThinking
        ? { thinking: { type: 'enabled', budget_tokens: thinkingBudget } }
        : {}),
    };

    // Interleaved thinking with tools requires a beta header (passed as request option, not body)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestOptions: any =
      params.enableThinking && hasTools
        ? { headers: { 'anthropic-beta': 'interleaved-thinking-2025-05-14' } }
        : {};

    const stream = client.messages.stream(requestBody, requestOptions);

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
        // thinking blocks are tracked via index via deltas below
      } else if (event.type === 'content_block_delta') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const delta = event.delta as any;

        if (delta.type === 'text_delta') {
          yield { type: 'text_delta', content: delta.text };
        } else if (delta.type === 'input_json_delta') {
          const block = toolBlocks.get(event.index);
          if (block) {
            block.accumulatedInput += delta.partial_json;
          }
        } else if (delta.type === 'thinking_delta') {
          yield { type: 'thinking_delta', content: delta.thinking as string };
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
