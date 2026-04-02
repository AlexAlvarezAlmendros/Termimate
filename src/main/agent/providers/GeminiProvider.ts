import { GoogleGenerativeAI, type Content, type Part, type FunctionDeclaration } from '@google/generative-ai';
import type { ILLMProvider, StreamMessageParams, RichMessage } from './ILLMProvider';
import type { StreamEvent, ModelDefinition } from '../../../shared/types/agent.types';
import { getApiKey } from '../../security/KeychainService';
import { ThinkingStreamParser, THINKING_SYSTEM_INSTRUCTION } from './ThinkingStreamParser';

export class GeminiProvider implements ILLMProvider {
  readonly name = 'gemini';
  readonly supportedModels: ModelDefinition[] = [
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'gemini', maxTokens: 65536 },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'gemini', maxTokens: 65536 },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini', maxTokens: 8192 },
  ];

  private client: GoogleGenerativeAI | null = null;

  resetClient(): void {
    this.client = null;
  }

  private async getClient(): Promise<GoogleGenerativeAI> {
    if (!this.client) {
      const apiKey = await getApiKey('gemini');
      if (!apiKey) throw new Error('Gemini API key not configured. Open Settings to add your key.');
      this.client = new GoogleGenerativeAI(apiKey);
    }
    return this.client;
  }

  // Gemini rejects JSON Schema fields it doesn't know (e.g. additionalProperties, $schema)
  // It also can't handle anyOf/oneOf/allOf — unwrap first type in anyOf if present
  private sanitizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const UNSUPPORTED = new Set(['additionalProperties', '$schema', 'default', 'examples', 'oneOf', 'allOf']);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema)) {
      if (UNSUPPORTED.has(key)) continue;
      // Unwrap anyOf: take the first non-empty variant that has a type field
      if (key === 'anyOf' && Array.isArray(value)) {
        const typed = (value as Record<string, unknown>[]).find((v) => v['type']);
        if (typed) {
          Object.assign(result, this.sanitizeSchema(typed));
        }
        continue;
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.sanitizeSchema(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        result[key] = value.map((v) =>
          v && typeof v === 'object' && !Array.isArray(v) ? this.sanitizeSchema(v as Record<string, unknown>) : v,
        );
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Converts RichMessage[] → Gemini Content[] format.
   * Consecutive tool_result messages are batched into a single user turn with functionResponse parts.
   */
  private buildContents(messages: RichMessage[]): Content[] {
    const contents: Content[] = [];
    let i = 0;
    while (i < messages.length) {
      const m = messages[i];
      if (m.role === 'assistant') {
        const parts: Part[] = [];
        if (m.content) parts.push({ text: m.content });
        if (m.toolCalls && m.toolCalls.length > 0) {
          for (const tc of m.toolCalls) {
            parts.push({ functionCall: { name: tc.name, args: tc.input as Record<string, unknown> } });
          }
        }
        if (parts.length > 0) contents.push({ role: 'model', parts });
        i++;
      } else if (m.role === 'tool_result') {
        // Batch consecutive tool_results into one user turn
        const parts: Part[] = [];
        while (i < messages.length && messages[i].role === 'tool_result') {
          const tr = messages[i] as { role: 'tool_result'; toolCallId: string; toolName: string; content: string };
          parts.push({
            functionResponse: {
              name: tr.toolName,
              response: { name: tr.toolName, content: tr.content },
            },
          });
          i++;
        }
        contents.push({ role: 'user', parts });
      } else {
        contents.push({ role: 'user', parts: [{ text: m.content }] });
        i++;
      }
    }
    return contents;
  }

  async *streamMessage(params: StreamMessageParams): AsyncIterable<StreamEvent> {
    const client = await this.getClient();

    const systemPrompt = params.enableThinking
      ? `${THINKING_SYSTEM_INSTRUCTION}\n\n${params.systemPrompt}`
      : params.systemPrompt;
    const parser = params.enableThinking ? new ThinkingStreamParser() : null;

    const model = client.getGenerativeModel({
      model: params.model,
      systemInstruction: systemPrompt,
      ...(params.tools && params.tools.length > 0
        ? {
            tools: [
              {
                functionDeclarations: params.tools.map(
                  (t): FunctionDeclaration => ({
                    name: t.name,
                    description: t.description,
                    parameters: this.sanitizeSchema(t.inputSchema) as unknown as FunctionDeclaration['parameters'],
                  }),
                ),
              },
            ],
          }
        : {}),
    });

    // Convert messages to Gemini Content[] (handles tool_use/tool_result natively)
    const contents = this.buildContents(params.messages);

    const result = await model.generateContentStream({ contents });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of result.stream) {
      const candidate = chunk.candidates?.[0];
      if (!candidate) continue;

      for (const part of candidate.content?.parts ?? []) {
        if ('text' in part && part.text) {
          if (parser) {
            for (const event of parser.process(part.text)) yield event;
          } else {
            yield { type: 'text_delta', content: part.text };
          }
        } else if ('functionCall' in part && part.functionCall) {
          yield {
            type: 'tool_use_start',
            toolName: part.functionCall.name,
            toolInput: part.functionCall.args ?? {},
          };
        }
      }

      if (chunk.usageMetadata) {
        inputTokens = chunk.usageMetadata.promptTokenCount ?? 0;
        outputTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
      }
    }

    if (parser) {
      for (const event of parser.flush()) yield event;
    }

    yield {
      type: 'message_stop',
      usage: { inputTokens, outputTokens },
    };
  }
}
