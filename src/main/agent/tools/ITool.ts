import type { ZodSchema } from 'zod';
import type { ToolResult, ToolContext } from '../../../shared/types/agent.types';

export interface ITool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ZodSchema;
  readonly requiresConfirmation: boolean;

  execute(input: unknown, context: ToolContext): Promise<ToolResult>;
}
