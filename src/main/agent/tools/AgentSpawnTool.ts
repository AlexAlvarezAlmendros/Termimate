import { z } from 'zod';
import type { ITool } from './ITool';
import type { ToolResult, ToolContext } from '../../../shared/types/agent.types';

const inputSchema = z.object({
  task: z.string().describe(
    'A clear, self-contained task description for the sub-agent. ' +
    'Include all the context the sub-agent needs to complete it independently. ' +
    'The sub-agent has access to the same files and tools (except agent_spawn itself).',
  ),
  system_context: z.string().optional().describe(
    'Optional extra instructions for the sub-agent (e.g. "Only read files, do not modify them").',
  ),
});

export class AgentSpawnTool implements ITool {
  readonly name = 'agent_spawn';
  readonly description =
    'Spawn a sub-agent to handle an isolated sub-task and return its result. ' +
    'Use this to delegate a well-defined piece of work that benefits from a fresh context: ' +
    'e.g. "Analyse the test suite and return a summary of all failing tests", ' +
    '"Refactor this module", or "Research this library and return usage examples". ' +
    'The sub-agent runs independently and returns its final response as a string. ' +
    'Sub-agents cannot themselves spawn further sub-agents.';
  readonly inputSchema = inputSchema;
  readonly requiresConfirmation = false;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);

    if (!context.spawnAgent) {
      return { success: false, error: 'agent_spawn is not available in this context (sub-agents cannot spawn further sub-agents).' };
    }

    try {
      const result = await context.spawnAgent(parsed.task, parsed.system_context);
      return { success: true, output: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Sub-agent failed' };
    }
  }
}
