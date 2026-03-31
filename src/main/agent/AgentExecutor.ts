import { v4 as uuid } from 'uuid';
import { BrowserWindow } from 'electron';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ILLMProvider, ToolDefinition } from './providers/ILLMProvider';
import type { ITool } from './tools/ITool';
import type { SendMessageParams, StreamEvent, ToolContext } from '../../shared/types/agent.types';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { FileReadTool } from './tools/FileReadTool';
import { BashExecutorTool } from './tools/BashExecutorTool';
import { TerminalReadTool } from './tools/TerminalReadTool';
import { MessageRepository } from '../database/repositories/MessageRepository';
import { ProjectRepository } from '../database/repositories/ProjectRepository';
import { SessionRepository } from '../database/repositories/SessionRepository';
import { IPC_CHANNELS } from '../../shared/constants';

const MAX_TOOL_ROUNDS = 10;

export class AgentExecutor {
  private static instance: AgentExecutor;
  private providers = new Map<string, ILLMProvider>();
  private tools = new Map<string, ITool>();
  private toolDefinitions: ToolDefinition[] = [];
  private messageRepo = new MessageRepository();
  private projectRepo = new ProjectRepository();
  private sessionRepo = new SessionRepository();
  private activeStreams = new Map<string, boolean>(); // streamId → cancelled

  static getInstance(): AgentExecutor {
    if (!AgentExecutor.instance) {
      AgentExecutor.instance = new AgentExecutor();
    }
    return AgentExecutor.instance;
  }

  private constructor() {
    // Register providers
    const anthropic = new AnthropicProvider();
    const openai = new OpenAIProvider();
    this.providers.set(anthropic.name, anthropic);
    this.providers.set(openai.name, openai);

    // Register tools
    const tools: ITool[] = [new FileReadTool(), new BashExecutorTool(), new TerminalReadTool()];
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }

    // Build tool definitions for LLM
    this.toolDefinitions = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.inputSchema, { target: 'openApi3' }) as Record<string, unknown>,
    }));
  }

  async handleMessage(params: SendMessageParams): Promise<string> {
    const streamId = uuid();
    this.activeStreams.set(streamId, false);

    // Store user message
    this.messageRepo.create({
      sessionId: params.sessionId,
      role: 'user',
      content: params.content,
    });

    // Get session and project context
    const session = this.sessionRepo.findById(params.sessionId);
    const project = session?.projectId ? this.projectRepo.findById(session.projectId) : null;

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(project);

    // Build tool context
    const toolContext: ToolContext = {
      sessionId: params.sessionId,
      projectRoot: project?.rootPath ?? null,
      outputBuffer: null,
    };

    // Default to anthropic provider
    const provider = this.providers.get('anthropic');
    if (!provider) {
      this.emitStreamEvent(streamId, { type: 'error', message: 'No LLM provider available' });
      this.activeStreams.delete(streamId);
      return streamId;
    }

    const model = provider.supportedModels[0].id;

    try {
      await this.runConversationLoop(streamId, params.sessionId, provider, model, systemPrompt, toolContext);
    } catch (error) {
      console.error('Agent error:', error);
      this.emitStreamEvent(streamId, {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    this.activeStreams.delete(streamId);
    return streamId;
  }

  private async runConversationLoop(
    streamId: string,
    sessionId: string,
    provider: ILLMProvider,
    model: string,
    systemPrompt: string,
    toolContext: ToolContext,
  ): Promise<void> {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      if (this.activeStreams.get(streamId)) break; // cancelled

      // Get conversation history
      const history = this.messageRepo.findBySession(sessionId);
      const messages = history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      let fullResponse = '';
      const toolCalls: Array<{ name: string; input: unknown }> = [];
      let currentToolName = '';
      let currentToolInput = '';
      let usage = { inputTokens: 0, outputTokens: 0 };

      for await (const event of provider.streamMessage({
        model,
        systemPrompt,
        messages,
        tools: this.toolDefinitions,
      })) {
        if (this.activeStreams.get(streamId)) break;

        if (event.type === 'text_delta') {
          fullResponse += event.content;
          this.emitStreamEvent(streamId, event);
        } else if (event.type === 'tool_use_start') {
          currentToolName = event.toolName;
          currentToolInput = typeof event.toolInput === 'string' ? event.toolInput : JSON.stringify(event.toolInput);
          this.emitStreamEvent(streamId, event);
        } else if (event.type === 'tool_use_end') {
          // We'll handle this after executing
          try {
            const input = JSON.parse(currentToolInput || '{}');
            toolCalls.push({ name: currentToolName, input });
          } catch {
            toolCalls.push({ name: currentToolName, input: {} });
          }
        } else if (event.type === 'message_stop') {
          usage = { inputTokens: event.usage.inputTokens, outputTokens: event.usage.outputTokens };
        }
      }

      // If no tool calls, we're done
      if (toolCalls.length === 0) {
        if (fullResponse) {
          this.messageRepo.create({
            sessionId,
            role: 'assistant',
            content: fullResponse,
          });
        }
        this.emitStreamEvent(streamId, { type: 'message_stop', usage });
        return;
      }

      // Execute tool calls
      const toolResults: string[] = [];
      for (const tc of toolCalls) {
        const tool = this.tools.get(tc.name);
        if (!tool) {
          const result = { success: false, error: `Unknown tool: ${tc.name}` };
          this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
          toolResults.push(`Tool ${tc.name}: Error - Unknown tool`);
          continue;
        }

        try {
          const result = await tool.execute(tc.input, toolContext);
          this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
          toolResults.push(`Tool ${tc.name}: ${result.success ? result.output ?? 'Success' : `Error: ${result.error}`}`);
        } catch (error) {
          const result = { success: false, error: error instanceof Error ? error.message : 'Execution failed' };
          this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
          toolResults.push(`Tool ${tc.name}: Error - ${result.error}`);
        }
      }

      // Store assistant message with tool results and re-loop
      const assistantContent = [fullResponse, ...toolResults].filter(Boolean).join('\n\n');
      if (assistantContent) {
        this.messageRepo.create({
          sessionId,
          role: 'assistant',
          content: assistantContent,
        });
      }

      // Store tool results as a user message so the LLM sees them
      this.messageRepo.create({
        sessionId,
        role: 'user',
        content: `[Tool Results]\n${toolResults.join('\n')}`,
      });
    }

    // If we exhausted rounds
    this.emitStreamEvent(streamId, {
      type: 'error',
      message: 'Maximum tool execution rounds reached',
    });
  }

  cancelStream(streamId: string): void {
    this.activeStreams.set(streamId, true);
  }

  private buildSystemPrompt(project: { name: string; rootPath: string | null; instructions: string | null } | null): string {
    const sections: string[] = [];

    sections.push(
      'You are Termimate AI, an intelligent assistant integrated into a terminal emulator. You help developers with their projects by reading files, understanding code, and executing commands when authorized.',
    );

    if (project) {
      sections.push(`## Active Project: ${project.name}`);
      if (project.rootPath) {
        sections.push(`Root path: ${project.rootPath}`);
      }
      if (project.instructions) {
        sections.push(`## Project Instructions\n${project.instructions}`);
      }
    }

    sections.push('## Available Tools');
    sections.push('You can use tools to interact with the user\'s system. When you need to read a file, execute a command, or inspect terminal output, use the appropriate tool.');

    return sections.join('\n\n');
  }

  private emitStreamEvent(streamId: string, event: StreamEvent): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send(IPC_CHANNELS.AGENT_STREAM_EVENT, streamId, event);
    }
  }
}
