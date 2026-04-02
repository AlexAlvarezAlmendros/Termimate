import OpenAI from 'openai';
import type { ILLMProvider, StreamMessageParams } from './ILLMProvider';
import type { StreamEvent, ModelDefinition } from '../../../shared/types/agent.types';
import { getApiKey } from '../../security/KeychainService';
import { ThinkingStreamParser, THINKING_SYSTEM_INSTRUCTION } from './ThinkingStreamParser';

// Models that don't support function calling
const NO_TOOLS_MODELS = new Set(['o1', 'o1-mini', 'o3-mini']);

export class OpenAIProvider implements ILLMProvider {
  readonly name = 'openai';
  readonly supportedModels: ModelDefinition[] = [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', maxTokens: 16384 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', maxTokens: 16384 },
    { id: 'o1', name: 'o1', provider: 'openai', maxTokens: 32768 },
    { id: 'o1-mini', name: 'o1 Mini', provider: 'openai', maxTokens: 65536 },
    { id: 'o3-mini', name: 'o3 Mini', provider: 'openai', maxTokens: 65536 },
  ];

  private client: OpenAI | null = null;

  resetClient(): void {
    this.client = null;
  }

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

    const supportsTools = !NO_TOOLS_MODELS.has(params.model) && params.tools && params.tools.length > 0;
    const systemPrompt = params.enableThinking
      ? `${THINKING_SYSTEM_INSTRUCTION}\n\n${params.systemPrompt}`
      : params.systemPrompt;
    const parser = params.enableThinking ? new ThinkingStreamParser() : null;

    const stream = await client.chat.completions.create({
      model: params.model,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: 'system', content: systemPrompt },
        ...params.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      ...(supportsTools
        ? {
            tools: params.tools!.map((t) => ({
              type: 'function' as const,
              function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema,
              },
            })),
            tool_choice: 'auto' as const,
          }
        : {}),
    });

    // Map of tool call index → accumulated data
    const toolCallMap = new Map<number, { id: string; name: string; args: string }>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const finishReason = chunk.choices[0]?.finish_reason;

      // Accumulate tool call chunks
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallMap.has(idx)) {
            toolCallMap.set(idx, { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' });
          }
          const entry = toolCallMap.get(idx)!;
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name = tc.function.name;
          if (tc.function?.arguments) entry.args += tc.function.arguments;
        }
      }

      // Text delta — pipe through parser when thinking is enabled
      if (delta?.content) {
        if (parser) {
          for (const event of parser.process(delta.content)) yield event;
        } else {
          yield { type: 'text_delta', content: delta.content };
        }
      }

      // On finish, flush parser + tool calls then emit message_stop
      if (finishReason === 'tool_calls' || finishReason === 'stop') {
        if (parser) {
          for (const event of parser.flush()) yield event;
        }

        // Flush accumulated tool calls
        for (const [, entry] of toolCallMap) {
          let parsedInput: unknown = {};
          try {
            parsedInput = entry.args ? JSON.parse(entry.args) : {};
          } catch {
            parsedInput = { raw: entry.args };
          }
          yield { type: 'tool_use_start', toolName: entry.name, toolInput: parsedInput };
        }
        toolCallMap.clear();

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
