import { GoogleGenerativeAI, type Content, type FunctionDeclaration } from '@google/generative-ai';
import type { ILLMProvider, StreamMessageParams } from './ILLMProvider';
import type { StreamEvent, ModelDefinition } from '../../../shared/types/agent.types';
import { getApiKey } from '../../security/KeychainService';

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
  private sanitizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const UNSUPPORTED = new Set(['additionalProperties', '$schema', 'default', 'examples']);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema)) {
      if (UNSUPPORTED.has(key)) continue;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.sanitizeSchema(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  async *streamMessage(params: StreamMessageParams): AsyncIterable<StreamEvent> {
    const client = await this.getClient();

    const model = client.getGenerativeModel({
      model: params.model,
      systemInstruction: params.systemPrompt,
      ...(params.tools && params.tools.length > 0
        ? {
            tools: [
              {
                functionDeclarations: params.tools.map(
                  (t): FunctionDeclaration => ({
                    name: t.name,
                    description: t.description,
                    parameters: this.sanitizeSchema(t.inputSchema) as FunctionDeclaration['parameters'],
                  }),
                ),
              },
            ],
          }
        : {}),
    });

    // Convert messages to Gemini format (role 'assistant' → 'model')
    const contents: Content[] = params.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const result = await model.generateContentStream({ contents });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of result.stream) {
      const candidate = chunk.candidates?.[0];
      if (!candidate) continue;

      for (const part of candidate.content?.parts ?? []) {
        if ('text' in part && part.text) {
          yield { type: 'text_delta', content: part.text };
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

    yield {
      type: 'message_stop',
      usage: { inputTokens, outputTokens },
    };
  }
}
