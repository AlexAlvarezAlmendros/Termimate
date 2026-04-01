import { v4 as uuid } from 'uuid';
import { BrowserWindow } from 'electron';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ILLMProvider, ToolDefinition } from './providers/ILLMProvider';
import type { ITool } from './tools/ITool';
import type { SendMessageParams, StreamEvent, ToolContext } from '../../shared/types/agent.types';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { FileReadTool } from './tools/FileReadTool';
import { FileListTool } from './tools/FileListTool';
import { BashExecutorTool } from './tools/BashExecutorTool';
import { TerminalReadTool } from './tools/TerminalReadTool';
import { MessageRepository } from '../database/repositories/MessageRepository';
import { ProjectRepository } from '../database/repositories/ProjectRepository';
import { SessionRepository } from '../database/repositories/SessionRepository';
import { IPC_CHANNELS } from '../../shared/constants';
import { getApiKey } from '../security/KeychainService';
import { getConfig } from '../config/ConfigService';
import { AgentRepository } from '../database/repositories/AgentRepository';
import { ProjectDocumentRepository } from '../database/repositories/ProjectDocumentRepository';
import { PermissionGuard } from '../security/PermissionGuard';

const MAX_TOOL_ROUNDS = 10;

export class AgentExecutor {
  private static instance: AgentExecutor;
  private providers = new Map<string, ILLMProvider>();
  private tools = new Map<string, ITool>();
  private toolDefinitions: ToolDefinition[] = [];
  private messageRepo = new MessageRepository();
  private projectRepo = new ProjectRepository();
  private sessionRepo = new SessionRepository();
  private agentRepo = new AgentRepository();
  private docRepo = new ProjectDocumentRepository();
  private activeStreams = new Map<string, boolean>(); // streamId → cancelled
  private pendingConfirmations = new Map<string, (approved: boolean) => void>();

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
    const gemini = new GeminiProvider();
    this.providers.set(anthropic.name, anthropic);
    this.providers.set(openai.name, openai);
    this.providers.set(gemini.name, gemini);

    // Register tools
    const tools: ITool[] = [new FileListTool(), new FileReadTool(), new BashExecutorTool(), new TerminalReadTool()];
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

    // Auto-rename session from the first user message
    if (session?.name === 'NewSession') {
      const title = this.generateSessionTitle(params.content);
      this.sessionRepo.update(params.sessionId, { name: title });
      this.emitSessionRenamed(params.sessionId, title);
    }

    // Load agent config (custom system prompt, tools config)
    const agent = params.agentId ? this.agentRepo.findById(params.agentId) : null;
    const guard = new PermissionGuard(agent?.toolsConfig ?? null);

    // Build system prompt
    const shell = getConfig().terminal.defaultShell;
    const basePrompt = agent?.systemPrompt ?? null;
    const documents = project ? this.docRepo.findByProject(project.id) : [];
    const systemPrompt = this.buildSystemPrompt(project, shell, basePrompt, documents);

    // Build tool context
    const toolContext: ToolContext = {
      sessionId: params.sessionId,
      projectRoot: project?.rootPath ?? null,
      outputBuffer: null,
    };

    // Use requested provider, or auto-detect the first one with a configured key
    let provider = params.provider ? this.providers.get(params.provider) : undefined;
    if (!provider) {
      for (const [, p] of this.providers) {
        const key = await getApiKey(p.name);
        if (key) { provider = p; break; }
      }
    }
    if (!provider) {
      this.emitStreamEvent(streamId, { type: 'error', message: 'No API key configured. Open Settings and add an Anthropic, OpenAI or Gemini API key.' });
      this.activeStreams.delete(streamId);
      return streamId;
    }

    const model = params.model ?? provider.supportedModels[0].id;

    try {
      await this.runConversationLoop(streamId, params.sessionId, provider, model, systemPrompt, toolContext, guard);
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
    guard: PermissionGuard,
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
          // Provider emits this when input is fully parsed — collect for execution
          toolCalls.push({ name: event.toolName, input: event.toolInput });
          // Forward to renderer so the UI shows the spinner immediately
          this.emitStreamEvent(streamId, event);
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

        // Check if the tool is enabled for this agent
        if (!guard.isToolEnabled(tc.name)) {
          const result = { success: false, error: `Tool "${tc.name}" is disabled for this agent.` };
          this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
          toolResults.push(`Tool ${tc.name}: Disabled`);
          continue;
        }

        // Gate bash_execute (and any other confirmation-requiring tools) behind user approval
        if (tool.requiresConfirmation) {
          const command = typeof (tc.input as Record<string, unknown>).command === 'string'
            ? (tc.input as Record<string, unknown>).command as string
            : JSON.stringify(tc.input);

          // Check bash allowlist
          if (!guard.isBashCommandAllowed(command)) {
            const result = { success: false, error: `Command not in allowlist: ${command.split(/\s+/)[0]}` };
            this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
            toolResults.push(`Tool ${tc.name}: Blocked by allowlist`);
            continue;
          }

          const confirmed = await this.requestConfirmation(uuid(), sessionId, command);
          if (!confirmed) {
            const result = { success: false, error: 'User denied execution.' };
            this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
            toolResults.push(`Tool ${tc.name}: Denied by user`);
            continue;
          }
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

  resolveConfirmation(requestId: string, approved: boolean): void {
    const resolve = this.pendingConfirmations.get(requestId);
    if (resolve) {
      resolve(approved);
      this.pendingConfirmations.delete(requestId);
    }
  }

  cancelAll(): void {
    for (const streamId of this.activeStreams.keys()) {
      this.activeStreams.set(streamId, true);
    }
    for (const resolve of this.pendingConfirmations.values()) {
      resolve(false);
    }
    this.pendingConfirmations.clear();
  }

  private async requestConfirmation(requestId: string, sessionId: string, command: string): Promise<boolean> {
    const confirmPromise = new Promise<boolean>((resolve) => {
      this.pendingConfirmations.set(requestId, resolve);
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        win.webContents.send(IPC_CHANNELS.AGENT_CONFIRM_REQUEST, { requestId, type: 'bash_execute', command, sessionId });
      }
    });

    const timeoutPromise = new Promise<boolean>((resolve) =>
      setTimeout(() => {
        if (this.pendingConfirmations.has(requestId)) {
          this.pendingConfirmations.delete(requestId);
          resolve(false);
        } else {
          resolve(false);
        }
      }, 60_000),
    );

    return Promise.race([confirmPromise, timeoutPromise]);
  }

  private buildSystemPrompt(
    project: { name: string; rootPath: string | null; instructions: string | null } | null,
    shell: string,
    agentBasePrompt: string | null,
    documents: Array<{ fileName: string; filePath: string }>,
  ): string {
    const sections: string[] = [];

    if (agentBasePrompt) {
      sections.push(agentBasePrompt);
    } else {
      sections.push(
        'You are Termimate AI, an intelligent assistant integrated into a terminal emulator. You help developers with their projects by reading files, understanding code, and executing commands when authorized.',
      );
    }

    // Shell / OS context
    const shellName = this.resolveShellName(shell);
    const isWindows = shell.endsWith('.exe');
    sections.push(
      `## Terminal Environment\n` +
      `Shell: ${shellName} (${shell})\n` +
      `OS family: ${isWindows ? 'Windows' : 'Unix/Linux/macOS'}\n\n` +
      `IMPORTANT: Always use syntax and commands appropriate for **${shellName}**. ` +
      (isWindows
        ? `Use PowerShell/CMD syntax (e.g. \`Get-ChildItem\`, \`$env:VAR\`, backslash paths). Do NOT use bash/Unix commands like \`ls\`, \`grep\`, \`cat\`, \`export\`.`
        : `Use Unix shell syntax (e.g. \`ls\`, \`grep\`, \`export VAR=value\`, forward-slash paths). Do NOT use PowerShell/CMD syntax.`)
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

    if (documents.length > 0) {
      const docList = documents.map((d) => `- ${d.fileName} → ${d.filePath}`).join('\n');
      sections.push(
        `## Project Context Documents\nThe user has attached the following files as reference material for this project. Use the file_read tool to read them when relevant:\n${docList}`,
      );
    }

    sections.push('## Available Tools');
    sections.push('You can use tools to interact with the user\'s system. When you need to read a file, execute a command, or inspect terminal output, use the appropriate tool.');

    return sections.join('\n\n');
  }

  private resolveShellName(shell: string): string {
    const map: Record<string, string> = {
      'powershell.exe': 'PowerShell',
      'pwsh.exe': 'PowerShell Core (pwsh)',
      'cmd.exe': 'Command Prompt (cmd)',
      'bash.exe': 'Git Bash',
      '/bin/bash': 'Bash',
      '/bin/zsh': 'Zsh',
      '/usr/bin/fish': 'Fish',
    };
    return map[shell] ?? shell;
  }

  private generateSessionTitle(content: string): string {
    const cleaned = content.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= 40) return cleaned;
    const truncated = cleaned.slice(0, 40);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > 10 ? truncated.slice(0, lastSpace) : truncated) + '…';
  }

  private emitSessionRenamed(sessionId: string, name: string): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send(IPC_CHANNELS.SESSION_RENAMED, sessionId, name);
    }
  }

  private emitStreamEvent(streamId: string, event: StreamEvent): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send(IPC_CHANNELS.AGENT_STREAM_EVENT, streamId, event);
    }
  }
}
