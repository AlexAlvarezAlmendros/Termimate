import { v4 as uuid } from 'uuid';
import { BrowserWindow } from 'electron';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ILLMProvider, ToolDefinition, RichMessage } from './providers/ILLMProvider';
import type { ITool } from './tools/ITool';
import type { SendMessageParams, StreamEvent, ToolContext, QuestionRequest, ApprovalLevel, Message } from '../../shared/types/agent.types';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { FileReadTool } from './tools/FileReadTool';
import { FileWriteTool } from './tools/FileWriteTool';
import { FileEditTool } from './tools/FileEditTool';
import { FileListTool } from './tools/FileListTool';
import { DirectoryCreateTool } from './tools/DirectoryCreateTool';
import { BashExecutorTool } from './tools/BashExecutorTool';
import { TerminalReadTool } from './tools/TerminalReadTool';
import { WebFetchTool } from './tools/WebFetchTool';
import { GrepTool } from './tools/GrepTool';
import { GlobTool } from './tools/GlobTool';
import { AskUserQuestionTool } from './tools/AskUserQuestionTool';
import { AgentSpawnTool } from './tools/AgentSpawnTool';
import { MessageRepository } from '../database/repositories/MessageRepository';
import { ProjectRepository } from '../database/repositories/ProjectRepository';
import { SessionRepository } from '../database/repositories/SessionRepository';
import { IPC_CHANNELS } from '../../shared/constants';
import { getApiKey } from '../security/KeychainService';
import { getConfig } from '../config/ConfigService';
import { AgentRepository } from '../database/repositories/AgentRepository';
import { ProjectDocumentRepository } from '../database/repositories/ProjectDocumentRepository';
import { PermissionGuard } from '../security/PermissionGuard';
import { HookExecutor } from './hooks/HookExecutor';

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
  private sessionStreams = new Map<string, string>(); // sessionId → streamId
  private pendingConfirmations = new Map<string, (approved: boolean) => void>();
  private pendingQuestions = new Map<string, (answer: string) => void>();

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
    const tools: ITool[] = [
      new FileListTool(),
      new FileReadTool(),
      new FileWriteTool(),
      new FileEditTool(),
      new DirectoryCreateTool(),
      new BashExecutorTool(),
      new TerminalReadTool(),
      new WebFetchTool(),
      new GrepTool(),
      new GlobTool(),
      new AskUserQuestionTool(),
      new AgentSpawnTool(),
    ];
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
    this.sessionStreams.set(params.sessionId, streamId);

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

    // Build system prompt (inject session memory from previous sessions if available)
    const shell = getConfig().terminal.defaultShell;
    const basePrompt = agent?.systemPrompt ?? null;
    const documents = project ? this.docRepo.findByProject(project.id) : [];
    const approvalLevel = params.approvalLevel ?? 'default';

    // Load persisted session memory for this project
    let sessionMemory: string | null = null;
    if (project?.rootPath) {
      try {
        sessionMemory = await fs.readFile(path.join(project.rootPath, '.termimate', 'memory.md'), 'utf-8');
      } catch { /* memory file doesn't exist yet — that's fine */ }
    }

    const systemPrompt = this.buildSystemPrompt(project, shell, basePrompt, documents, approvalLevel === 'plan', sessionMemory);

    // Load project hooks (.termimate/hooks.json) — empty executor if no config found
    const hookExecutor = project?.rootPath ? await HookExecutor.load(project.rootPath, shell) : null;

    // Build tool context (spawnAgent uses late-bound refs to provider/model)
    let resolvedProvider: ILLMProvider | undefined;
    let resolvedModel: string | undefined;
    const toolContext: ToolContext = {
      sessionId: params.sessionId,
      projectRoot: project?.rootPath ?? null,
      outputBuffer: null,
      spawnAgent: (task, systemContext) => {
        if (!resolvedProvider || !resolvedModel) return Promise.resolve('Sub-agent not available: no provider configured.');
        return this.runSubSession(resolvedProvider, resolvedModel, task, project?.rootPath ?? null, systemContext);
      },
      askQuestion: (requestId, payload) => this.requestQuestion(requestId, payload),
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
    resolvedProvider = provider;
    resolvedModel = model;

    try {
      await this.runConversationLoop(streamId, params.sessionId, provider, model, systemPrompt, toolContext, guard, hookExecutor, !!params.enableThinking, params.approvalLevel ?? 'default');
    } catch (error) {
      console.error('Agent error:', error);
      this.emitStreamEvent(streamId, {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    this.activeStreams.delete(streamId);
    this.sessionStreams.delete(params.sessionId);
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
    hookExecutor: HookExecutor | null,
    enableThinking = false,
    approvalLevel: 'default' | 'confirm_all' | 'auto' | 'plan' = 'default',
  ): Promise<void> {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      if (this.activeStreams.get(streamId)) break; // cancelled

      // Get conversation history, trimmed to fit within the model's context window
      const history = this.messageRepo.findBySession(sessionId);
      const richMessages = this.buildRichHistory(history);
      const maxTokens = provider.supportedModels.find((m) => m.id === model)?.maxTokens ?? 8192;
      const messages = this.trimToContextWindow(richMessages, systemPrompt, maxTokens);

      let fullResponse = '';
      const toolCalls: Array<{ name: string; input: unknown }> = [];
      let usage = { inputTokens: 0, outputTokens: 0 };
      const pendingTextEvents: StreamEvent[] = [];

      const stream = await this.streamWithRetry(() => provider.streamMessage({
        model,
        systemPrompt,
        messages,
        tools: this.toolDefinitions,
        enableThinking,
      }));

      for await (const event of stream) {
        if (this.activeStreams.get(streamId)) break;

        if (event.type === 'text_delta') {
          fullResponse += event.content;
          // Buffer text — discard if tool calls follow, emit only on the final round
          pendingTextEvents.push(event);
        } else if (event.type === 'thinking_delta') {
          this.emitStreamEvent(streamId, event);
        } else if (event.type === 'tool_use_start') {
          // Tool calls follow — discard any buffered narration text
          pendingTextEvents.length = 0;
          // Provider emits this when input is fully parsed — collect for execution
          toolCalls.push({ name: event.toolName, input: event.toolInput });
          // Forward to renderer so the UI shows the spinner immediately
          this.emitStreamEvent(streamId, event);
        } else if (event.type === 'message_stop') {
          usage = { inputTokens: event.usage.inputTokens, outputTokens: event.usage.outputTokens };
        }
      }

      // Final round (no tool calls) — emit buffered text to renderer
      if (toolCalls.length === 0) {
        for (const e of pendingTextEvents) this.emitStreamEvent(streamId, e);
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

        // Async session memory extraction: run silently after the conversation ends.
        // Only triggered when there was ≥1 tool round (substantive interaction).
        if (round > 0 && toolContext.projectRoot) {
          this.extractAndSaveMemory(provider, model, sessionId, toolContext.projectRoot).catch(() => {});
        }
        return;
      }

      // Execute tool calls
      // Plan mode: block all mutating tools (only read-only allowed).
      const MUTATING_TOOLS = new Set(['file_write', 'file_edit', 'bash_execute', 'directory_create']);
      if (approvalLevel === 'plan') {
        const blocked = toolCalls.filter((tc) => MUTATING_TOOLS.has(tc.name));
        if (blocked.length > 0) {
          // Inform the LLM that mutating tools are blocked in plan mode
          const blockedNames = blocked.map((tc) => tc.name).join(', ');
          this.messageRepo.create({ sessionId, role: 'assistant', content: `[Plan mode — read-only]: Skipped mutating tools: ${blockedNames}` });
          this.messageRepo.create({ sessionId, role: 'user', content: `[Plan Mode] The following tools are not permitted in read-only plan mode: ${blockedNames}. Describe the changes you would make without executing them.` });
          this.emitStreamEvent(streamId, {
            type: 'text_delta',
            content: `\n\n> **Plan Mode** — the following mutations were blocked: \`${blockedNames}\`.\n`,
          });
          continue;
        }
      }

      // Read-only tools (no confirmation needed) run in parallel; mutating tools remain sequential.
      const toolResults: string[] = new Array(toolCalls.length).fill('');

      // Partition: collect indices of tools that need confirmation (run sequentially)
      // vs read-only tools (run in parallel).
      const sequentialIndices: number[] = [];
      const parallelIndices: number[] = [];
      for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i];
        const tool = this.tools.get(tc.name);
        const needsConfirmation = !tool
          ? false
          : approvalLevel === 'confirm_all' || (approvalLevel !== 'auto' && tool.requiresConfirmation);
        if (needsConfirmation) {
          sequentialIndices.push(i);
        } else {
          parallelIndices.push(i);
        }
      }

      // Run read-only tools in parallel first
      await Promise.all(parallelIndices.map(async (i) => {
        const tc = toolCalls[i];
        const tool = this.tools.get(tc.name);
        if (!tool) {
          const result = { success: false, error: `Unknown tool: ${tc.name}` };
          this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
          toolResults[i] = `Tool ${tc.name}: Error - Unknown tool`;
          return;
        }
        if (!guard.isToolEnabled(tc.name)) {
          const result = { success: false, error: `Tool "${tc.name}" is disabled for this agent.` };
          this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
          toolResults[i] = `Tool ${tc.name}: Disabled`;
          return;
        }
        // PreToolUse hooks (blocking — exit code 2 blocks execution)
        if (hookExecutor && !hookExecutor.isEmpty) {
          const preResult = await hookExecutor.runPreHooks(tc.name, tc.input);
          if (preResult.decision === 'block') {
            const result = { success: false, error: preResult.message ?? `Blocked by PreToolUse hook` };
            this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
            toolResults[i] = `Tool ${tc.name}: Blocked by hook`;
            return;
          }
        }
        try {
          const result = await tool.execute(tc.input, toolContext);
          // PostToolUse hooks (fire-and-forget)
          if (hookExecutor && !hookExecutor.isEmpty) {
            hookExecutor.runPostHooks(tc.name, tc.input, result.success, result.output ?? result.error ?? '');
          }
          this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
          toolResults[i] = `Tool ${tc.name}: ${result.success ? result.output ?? 'Success' : `Error: ${result.error}`}`;
        } catch (error) {
          const result = { success: false, error: error instanceof Error ? error.message : 'Execution failed' };
          this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
          toolResults[i] = `Tool ${tc.name}: Error - ${result.error}`;
        }
      }));

      // Run confirmation-requiring tools sequentially (one dialog at a time)
      for (const i of sequentialIndices) {
        const tc = toolCalls[i];
        const tool = this.tools.get(tc.name);
        if (!tool) {
          const result = { success: false, error: `Unknown tool: ${tc.name}` };
          this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
          toolResults[i] = `Tool ${tc.name}: Error - Unknown tool`;
          continue;
        }
        if (!guard.isToolEnabled(tc.name)) {
          const result = { success: false, error: `Tool "${tc.name}" is disabled for this agent.` };
          this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
          toolResults[i] = `Tool ${tc.name}: Disabled`;
          continue;
        }

        // PreToolUse hooks (blocking) — run before confirmation dialog
        if (hookExecutor && !hookExecutor.isEmpty) {
          const preResult = await hookExecutor.runPreHooks(tc.name, tc.input);
          if (preResult.decision === 'block') {
            const result = { success: false, error: preResult.message ?? `Blocked by PreToolUse hook` };
            this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
            toolResults[i] = `Tool ${tc.name}: Blocked by hook`;
            continue;
          }
        }

        const input = tc.input as Record<string, unknown>;
        const requestId = uuid();
        let confirmed = false;

        if (tc.name === 'bash_execute') {
          const command = typeof input.command === 'string' ? input.command : JSON.stringify(tc.input);
          if (!guard.isBashCommandAllowed(command)) {
            const result = { success: false, error: `Command not in allowlist: ${command.split(/\s+/)[0]}` };
            this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
            toolResults[i] = `Tool ${tc.name}: Blocked by allowlist`;
            continue;
          }
          confirmed = await this.requestConfirmation(requestId, { requestId, type: 'bash_execute', command, sessionId });
        } else if (tc.name === 'file_write' || tc.name === 'file_edit') {
          const filePath = typeof input.path === 'string' ? input.path : '';
          const content = typeof (input.content ?? input.new_string) === 'string'
            ? (input.content ?? input.new_string) as string
            : '';
          confirmed = await this.requestConfirmation(requestId, { requestId, type: 'file_write', path: filePath, content, sessionId });
        } else if (tc.name === 'directory_create') {
          const dirPath = typeof input.path === 'string' ? input.path : '';
          confirmed = await this.requestConfirmation(requestId, { requestId, type: 'directory_create', path: dirPath, sessionId });
        } else {
          const command = JSON.stringify(tc.input);
          confirmed = await this.requestConfirmation(requestId, { requestId, type: 'bash_execute', command, sessionId });
        }

        if (!confirmed) {
          const result = { success: false, error: 'User denied execution.' };
          this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
          toolResults[i] = `Tool ${tc.name}: Denied by user`;
          continue;
        }

        try {
          const result = await tool.execute(tc.input, toolContext);
          // PostToolUse hooks (fire-and-forget)
          if (hookExecutor && !hookExecutor.isEmpty) {
            hookExecutor.runPostHooks(tc.name, tc.input, result.success, result.output ?? result.error ?? '');
          }
          this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
          toolResults[i] = `Tool ${tc.name}: ${result.success ? result.output ?? 'Success' : `Error: ${result.error}`}`;
        } catch (error) {
          const result = { success: false, error: error instanceof Error ? error.message : 'Execution failed' };
          this.emitStreamEvent(streamId, { type: 'tool_use_end', toolName: tc.name, result });
          toolResults[i] = `Tool ${tc.name}: Error - ${result.error}`;
        }
      }

      // Store a minimal assistant record for this tool round with structured tool call data.
      // The tool_calls column holds JSON used to reconstruct native tool_use/tool_result
      // blocks in buildRichHistory() on subsequent rounds.
      const toolCallsWithIds = toolCalls.map((tc) => ({ id: uuid(), name: tc.name, input: tc.input }));
      this.messageRepo.create({
        sessionId,
        role: 'assistant',
        content: fullResponse, // preserve any narration text
        toolCalls: JSON.stringify(toolCallsWithIds),
      });

      // Store tool results as a user message — content is human-readable (shown in UI),
      // tool_calls holds the structured JSON keyed by toolCallId for provider serialization.
      const toolResultsStructured = toolCallsWithIds.map((tc, i) => ({
        toolCallId: tc.id,
        toolName: tc.name,
        content: toolResults[i] ?? '',
        isError: (toolResults[i] ?? '').includes('Error -'),
      }));
      this.messageRepo.create({
        sessionId,
        role: 'user',
        content: `[Tool Results]\n${toolResults.join('\n')}`,
        toolCalls: JSON.stringify(toolResultsStructured),
      });
    }

    // If we exhausted rounds
    this.emitStreamEvent(streamId, {
      type: 'error',
      message: 'Maximum tool execution rounds reached',
    });
  }

  /**
   * Estimates token count from a string.
   * Heuristic: ~4 chars/token for prose, ~2 chars/token for code (average ~3).
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 3);
  }

  /** Estimates tokens for a single RichMessage (including any toolCalls or content). */
  private estimateRichTokens(m: RichMessage): number {
    let tokens = 0;
    if ('content' in m && m.content) tokens += this.estimateTokens(m.content);
    if (m.role === 'assistant' && m.toolCalls) {
      for (const tc of m.toolCalls) tokens += this.estimateTokens(JSON.stringify(tc.input));
    }
    if (m.role === 'tool_result') tokens += this.estimateTokens(m.content);
    return Math.max(tokens, 4); // minimum 4 tokens per message
  }

  /**
   * Trims message history to stay within ~80% of the model context window.
   * Removes the oldest messages first, always keeping the first user message.
   * Preserves structural integrity: never removes a tool_result without its assistant.
   */
  private trimToContextWindow(
    messages: RichMessage[],
    systemPrompt: string,
    maxTokens: number,
  ): RichMessage[] {
    const BUDGET = Math.floor(maxTokens * 0.8);
    const systemTokens = this.estimateTokens(systemPrompt);
    // Reserve ~500 tokens for tool definitions overhead
    const available = BUDGET - systemTokens - 500;

    // Count total tokens
    let total = messages.reduce((sum, m) => sum + this.estimateRichTokens(m), 0);
    if (total <= available) return messages;

    // Drop from the front, preserving structural integrity:
    // never start with orphaned tool_results (they must follow an assistant w/ toolCalls).
    const trimmed = [...messages];
    while (total > available && trimmed.length > 1) {
      const dropped = trimmed.shift()!;
      total -= this.estimateRichTokens(dropped);
      // If we just removed an assistant message that had tool calls, also drop its tool_result(s)
      if (dropped.role === 'assistant' && 'toolCalls' in dropped && dropped.toolCalls?.length) {
        while (trimmed.length > 0 && trimmed[0].role === 'tool_result') {
          total -= this.estimateRichTokens(trimmed.shift()!);
        }
      }
      // Ensure we don't start with orphaned tool_results
      while (trimmed.length > 0 && trimmed[0].role === 'tool_result') {
        total -= this.estimateRichTokens(trimmed.shift()!);
      }
    }
    return trimmed;
  }

  /**
   * Converts DB Message[] to RichMessage[] for provider consumption.
   *
   * Assistant messages with a `toolCalls` JSON column are converted to
   * `{ role: 'assistant', toolCalls: [...] }` blocks.
   *
   * Corresponding user messages that start with "[Tool Results]" and also have
   * a `toolCalls` JSON column are expanded into individual `{ role: 'tool_result' }` entries.
   *
   * Legacy messages (no toolCalls column) gracefully fall back to plain text.
   */
  private buildRichHistory(messages: Message[]): RichMessage[] {
    const rich: RichMessage[] = [];
    for (const m of messages) {
      if (m.role === 'assistant' && m.toolCalls) {
        try {
          const calls = JSON.parse(m.toolCalls) as Array<{ id: string; name: string; input: unknown }>;
          rich.push({ role: 'assistant', content: m.content, toolCalls: calls });
        } catch {
          rich.push({ role: 'assistant', content: m.content });
        }
      } else if (m.role === 'user' && m.toolCalls && m.content.startsWith('[Tool Results]')) {
        try {
          const results = JSON.parse(m.toolCalls) as Array<{
            toolCallId: string;
            toolName: string;
            content: string;
            isError?: boolean;
          }>;
          for (const r of results) {
            rich.push({ role: 'tool_result', toolCallId: r.toolCallId, toolName: r.toolName, content: r.content, isError: r.isError });
          }
        } catch {
          // Fallback: treat as a plain user message
          rich.push({ role: 'user', content: m.content });
        }
      } else {
        rich.push({ role: m.role as 'user' | 'assistant', content: m.content });
      }
    }
    return rich;
  }

  /**
   * Extracts key facts from the current session and saves them to
   * {projectRoot}/.termimate/memory.md for injection into future sessions.
   *
   * This runs async/fire-and-forget so it never blocks the user.
   */
  private async extractAndSaveMemory(
    provider: ILLMProvider,
    model: string,
    sessionId: string,
    projectRoot: string,
  ): Promise<void> {
    const history = this.messageRepo.findBySession(sessionId);
    // Only extract if there was real work (at least a few exchanges)
    if (history.length < 4) return;

    // Build a compact transcript (cap at last 30 messages to keep the call cheap)
    const recent = history.slice(-30);
    const transcript = recent
      .filter((m) => !m.content.startsWith('[Tool Results]') && !m.content.startsWith('[Plan mode'))
      .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content.slice(0, 500)}`)
      .join('\n');

    const memoryPrompt =
      `Extract 3-8 concise bullet-point facts from this conversation that would be useful context in a future session. ` +
      `Focus on: file paths discovered, technologies/versions identified, decisions made, problems solved, build commands, config values. ` +
      `Be terse. Each bullet ≤ 20 words. Output ONLY the bullet list, nothing else.`;

    let memoryContent = '';
    try {
      const stream = provider.streamMessage({
        model,
        systemPrompt: memoryPrompt,
        messages: [{ role: 'user', content: transcript }],
      });
      for await (const event of stream) {
        if (event.type === 'text_delta') memoryContent += event.content;
      }
    } catch {
      return; // Extraction failures are silent
    }

    if (!memoryContent.trim()) return;

    const memDir = path.join(projectRoot, '.termimate');
    await fs.mkdir(memDir, { recursive: true });
    await fs.writeFile(
      path.join(memDir, 'memory.md'),
      `<!-- Auto-generated by Termimate. Do not edit manually. -->\n${memoryContent.trim()}\n`,
      'utf-8',
    );
  }

  /**
   * Wraps a streaming provider call with exponential backoff for transient errors.
   * Retries up to 3 times on rate-limit (429) and transient network failures.
   */
  private async streamWithRetry(
    factory: () => AsyncIterable<StreamEvent>,
    maxRetries = 3,
  ): Promise<AsyncIterable<StreamEvent>> {
    const RETRYABLE = /rate.?limit|429|503|ENOTFOUND|ECONNRESET|ETIMEDOUT|socket hang up/i;
    let delay = 2000;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Collect all events first to catch errors that surface mid-stream
        const events: StreamEvent[] = [];
        for await (const event of factory()) {
          events.push(event);
        }
        return (async function* () { yield* events; })();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const isRetryable = RETRYABLE.test(msg);
        if (!isRetryable || attempt === maxRetries) throw error;
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 16000);
      }
    }
    throw new Error('Unreachable');
  }

  cancelStream(sessionOrStreamId: string): void {
    // The renderer sends the sessionId; resolve it to the active streamId
    const streamId = this.sessionStreams.get(sessionOrStreamId) ?? sessionOrStreamId;
    this.activeStreams.set(streamId, true);
  }

  resolveConfirmation(requestId: string, approved: boolean): void {
    const resolve = this.pendingConfirmations.get(requestId);
    if (resolve) {
      resolve(approved);
      this.pendingConfirmations.delete(requestId);
    }
  }

  resolveQuestion(requestId: string, answer: string): void {
    const resolve = this.pendingQuestions.get(requestId);
    if (resolve) {
      resolve(answer);
      this.pendingQuestions.delete(requestId);
    }
  }

  private async requestQuestion(requestId: string, payload: QuestionRequest): Promise<string> {
    const questionPromise = new Promise<string>((resolve) => {
      this.pendingQuestions.set(requestId, resolve);
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        win.webContents.send(IPC_CHANNELS.AGENT_QUESTION_REQUEST, payload);
      }
    });

    const timeoutPromise = new Promise<string>((resolve) =>
      setTimeout(() => {
        if (this.pendingQuestions.has(requestId)) {
          this.pendingQuestions.delete(requestId);
          resolve('');
        } else {
          resolve('');
        }
      }, 120_000), // 2-minute timeout for questions
    );

    return Promise.race([questionPromise, timeoutPromise]);
  }

  /**
   * Runs an isolated sub-agent session (no DB persistence, depth-limited tools).
   * Used by AgentSpawnTool. Max 5 rounds to keep it focused.
   */
  private async runSubSession(
    provider: ILLMProvider,
    model: string,
    task: string,
    projectRoot: string | null,
    systemContext?: string,
  ): Promise<string> {
    const MAX_SUB_ROUNDS = 5;
    // Sub-agents get a subset of tools — no agent_spawn to prevent recursion
    const subToolNames = new Set(['file_read', 'file_list', 'file_write', 'file_edit', 'directory_create', 'bash_execute', 'glob', 'grep', 'web_fetch', 'ask_user_question']);
    const subTools = [...this.tools.values()].filter((t) => subToolNames.has(t.name));
    const subToolDefs: ToolDefinition[] = subTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema, { target: 'openApi3' }) as Record<string, unknown>,
    }));

    const subContext: ToolContext = { sessionId: 'sub', projectRoot, outputBuffer: null };
    const subPrompt = systemContext
      ? `You are a sub-agent. ${systemContext}\n\nComplete the task precisely and return a concise result.`
      : `You are a sub-agent. Complete the following task precisely and return a concise result.`;

    const messages: RichMessage[] = [
      { role: 'user', content: task },
    ];

    let finalResponse = '';

    for (let round = 0; round < MAX_SUB_ROUNDS; round++) {
      let fullResponse = '';
      const toolCalls: Array<{ name: string; input: unknown }> = [];

      try {
        const stream = await this.streamWithRetry(() => provider.streamMessage({
          model,
          systemPrompt: subPrompt,
          messages,
          tools: subToolDefs,
          enableThinking: false,
        }));

        for await (const event of stream) {
          if (event.type === 'text_delta') fullResponse += event.content;
          else if (event.type === 'tool_use_start') toolCalls.push({ name: event.toolName, input: event.toolInput });
        }
      } catch {
        break;
      }

      if (toolCalls.length === 0) {
        finalResponse = fullResponse;
        break;
      }

      // Execute tools
      const toolResults: string[] = [];
      for (const tc of toolCalls) {
        const tool = this.tools.get(tc.name);
        if (!tool) { toolResults.push(`Tool ${tc.name}: Unknown tool`); continue; }
        try {
          const result = await tool.execute(tc.input, subContext);
          toolResults.push(`Tool ${tc.name}: ${result.success ? result.output ?? 'Success' : `Error: ${result.error}`}`);
        } catch (err) {
          toolResults.push(`Tool ${tc.name}: Error - ${err instanceof Error ? err.message : 'Execution failed'}`);
        }
      }

      // Store assistant+results as RichMessage for native provider format
      const subToolCallsWithIds = toolCalls.map((tc) => ({ id: uuid(), name: tc.name, input: tc.input }));
      messages.push({ role: 'assistant', content: fullResponse, toolCalls: subToolCallsWithIds });
      for (let j = 0; j < subToolCallsWithIds.length; j++) {
        const tc = subToolCallsWithIds[j];
        messages.push({
          role: 'tool_result',
          toolCallId: tc.id,
          toolName: tc.name,
          content: toolResults[j] ?? '',
          isError: (toolResults[j] ?? '').includes('Error -'),
        });
      }
    }

    return finalResponse || '(Sub-agent completed without producing a response)';
  }

  cancelAll(): void {
    for (const streamId of this.activeStreams.keys()) {
      this.activeStreams.set(streamId, true);
    }
    this.sessionStreams.clear();
    for (const resolve of this.pendingConfirmations.values()) {
      resolve(false);
    }
    this.pendingConfirmations.clear();
    for (const resolve of this.pendingQuestions.values()) {
      resolve('');
    }
    this.pendingQuestions.clear();
  }

  private async requestConfirmation(requestId: string, payload: import('../../shared/types/agent.types').ConfirmRequest): Promise<boolean> {
    const confirmPromise = new Promise<boolean>((resolve) => {
      this.pendingConfirmations.set(requestId, resolve);
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        win.webContents.send(IPC_CHANNELS.AGENT_CONFIRM_REQUEST, payload);
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
    planMode = false,
    sessionMemory: string | null = null,
  ): string {
    const sections: string[] = [];
    const shellName = this.resolveShellName(shell);
    const isWindows = shell.endsWith('.exe');
    const shellSyntaxNote = isWindows
      ? `Use PowerShell syntax exclusively: \`Get-ChildItem\`, \`$env:VAR\`, \`New-Item\`, backslash paths. Never use bash commands (\`ls\`, \`cat\`, \`grep\`, \`export\`). IMPORTANT: Never use PowerShell here-strings (@"..."@ or @'...'@) inside bash_execute — they hang the terminal. Use \`file_write\` to create files with multi-line content. For network commands that may run indefinitely, always pass an explicit count: \`ping -n 4 google.com\`.`
      : `Use Unix shell syntax exclusively: \`ls\`, \`cat\`, \`grep\`, \`export VAR=value\`, forward-slash paths. Never use PowerShell/CMD syntax. For network commands that may run indefinitely, always pass an explicit count: \`ping -c 4 google.com\`.`;

    // ── Identity ─────────────────────────────────────────────────────────────
    if (agentBasePrompt) {
      sections.push(agentBasePrompt);
    } else {
      sections.push(
        `You are Termimate AI, a fully autonomous agent integrated into a terminal emulator. ` +
        `Your primary capability is controlling the user's computer through the terminal: ` +
        `you create, read and edit files, install packages, run builds, manage processes, and ` +
        `execute any task the user requests — all through shell commands. ` +
        `You are proactive and self-sufficient: you gather the information you need by running ` +
        `commands yourself instead of asking the user to do it.`,
      );
    }

    // ── Behavioural rules ─────────────────────────────────────────────────────
    sections.push(
      `## Behavioural Rules\n` +
      `Follow these rules strictly on every response:\n\n` +
      `1. **Plan before acting.** When you receive a complex task, first reason through the steps you need to take in your thinking before using any tools. Break the task into a numbered list of steps.\n` +
      `2. **Act, don't ask.** If you need to know the contents of a file, the output of a command, or the state of the system, run the appropriate command yourself. Never ask the user to run something and paste the result back.\n` +
      `3. **No repeated commands.** Never run the same command twice in the same task unless the output explicitly changed. If a command already gave you the information you need, use that result.\n` +
      `4. **Narrate only at the start and end — never between tool calls.** Write ONE short sentence before your very first tool call to tell the user what you are about to do. Then call your tools silently and in sequence without any text in between. Only write text again when ALL tools are done and you are ready to deliver the final answer.\n` +
      `5. **Complete tasks end-to-end.** When given a task, carry it through to completion autonomously. Only pause to ask the user when you reach a genuine decision point that requires their preference or credentials you cannot obtain yourself.\n` +
      `6. **Use file tools — never bash — for all filesystem operations.** \`file_write\`, \`file_read\`, \`file_edit\`, \`file_list\`, \`directory_create\`, \`grep\`, and \`glob\` are faster, safer, and never time out. Rules: (a) To write or overwrite a file: use \`file_write\`. (b) To make a small targeted change inside an existing file: use \`file_edit\` with the exact old_string and new_string. (c) To create a directory: use \`directory_create\`. (d) To read a file: use \`file_read\`. (e) To find files by name pattern: use \`glob\`. (f) To search inside files: use \`grep\`. (g) To explore directory structure: use \`file_list\`. Reserve \`bash_execute\` exclusively for running programs (package installs, build tools, scripts, test runners).\n` +
      `7. **Never use multi-line strings in bash_execute.** PowerShell here-strings (@"...\"@) and multi-line commands in bash_execute hang the terminal. Always keep bash commands on a single line. For writing multi-line file content, use \`file_write\`.\n` +
      `8. **Use web_fetch to verify facts.** When you need to check documentation, verify an API, look up a library version, or research a topic, use the \`web_fetch\` tool on a relevant URL instead of guessing.\n` +
      `9. **Handle errors silently and retry immediately — never write reasoning between tool calls.** If a tool call fails or times out, do NOT output any text. Just call the next tool with an adjusted approach. Never narrate what went wrong or explain your retry logic in the message stream — that text pollutes the conversation. Only surface an error in your final answer if ALL retry approaches are exhausted.\n` +
      `10. **Final answer only — never embed raw tool output.** Your final message must be a clean, natural-language summary written for the user. Never paste raw command output, never write "Tool [name]: ..." prefixes, never include ANSI codes or escape sequences. If the user needs to see specific output, quote only the single most relevant line.`,
    );

    // ── Terminal environment ──────────────────────────────────────────────────
    sections.push(
      `## Terminal Environment\n` +
      `Shell: **${shellName}** (\`${shell}\`)\n` +
      `OS family: ${isWindows ? 'Windows' : 'Unix/Linux/macOS'}\n\n` +
      shellSyntaxNote,
    );

    // ── Project context ───────────────────────────────────────────────────────
    if (project) {
      let projectBlock = `## Active Project: ${project.name}`;
      if (project.rootPath) {
        projectBlock += `\nRoot path: \`${project.rootPath}\``;
        projectBlock += `\n\nAlways operate relative to this root unless the user explicitly specifies another path.`;
      }
      if (project.instructions) {
        projectBlock += `\n\n### Project Instructions\n${project.instructions}`;
      }
      sections.push(projectBlock);
    } else {
      const noProjectPathHint = isWindows
        ? `Use \`file_list\` with path \`"C:\\\\Users"\` to discover the username, then construct absolute paths as needed (e.g. \`C:\\\\Users\\\\alexc\\\\Documents\`). `
        : `Use \`file_list\` with path \`"/home"\` or \`"/Users"\` to discover the username, then construct absolute paths as needed. `;
      sections.push(
        `## No Active Project\n` +
        `This session has no project assigned. ` +
        noProjectPathHint +
        `Never use \`bash_execute\` to query paths, environment variables, or the current directory — use \`file_list\` for all filesystem exploration.`,
      );
    }

    // ── Reference documents ───────────────────────────────────────────────────
    if (documents.length > 0) {
      const docList = documents.map((d) => `- \`${d.fileName}\` → \`${d.filePath}\``).join('\n');
      sections.push(
        `## Reference Documents\n` +
        `The following files have been attached as context for this project. ` +
        `Read them with the file_read tool when they are relevant to the task:\n${docList}`,
      );
    }

    // ── Session memory ────────────────────────────────────────────────────────
    if (sessionMemory) {
      sections.push(
        `## Session Memory\n` +
        `Key facts extracted from previous sessions with this project. Use as background context:\n\n` +
        sessionMemory.trim(),
      );
    }

    if (planMode) {
      sections.push(
        `## PLAN MODE (read-only)\n` +
        `You are running in **Plan Mode**. You MUST NOT use any tools that modify the filesystem or execute commands: ` +
        `\`file_write\`, \`file_edit\`, \`bash_execute\`, and \`directory_create\` are all **blocked**. ` +
        `Use read-only tools (\`file_read\`, \`file_list\`, \`glob\`, \`grep\`, \`web_fetch\`) to explore the codebase, ` +
        `then describe the changes you would make in natural language — code diffs, numbered steps, etc. ` +
        `Do not apologise for being read-only; simply plan clearly.`,
      );
    }

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
