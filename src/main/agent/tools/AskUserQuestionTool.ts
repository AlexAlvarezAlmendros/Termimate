import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type { ITool } from './ITool';
import type { ToolResult, ToolContext } from '../../../shared/types/agent.types';

const inputSchema = z.object({
  question: z.string().describe('The question to ask the user. Be concise and specific — the user must respond with text.'),
});

export class AskUserQuestionTool implements ITool {
  readonly name = 'ask_user_question';
  readonly description =
    'Ask the user a question and wait for their text response. ' +
    'Use this when you genuinely cannot proceed without human input: ' +
    'unclear requirements, a choice between multiple approaches, credentials, or confirmation of intent. ' +
    'Do NOT use this for routine information you can discover via file_read, glob, or grep.';
  readonly inputSchema = inputSchema;
  readonly requiresConfirmation = false;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);

    if (!context.askQuestion) {
      return { success: false, error: 'ask_user_question is not available in this context.' };
    }

    const requestId = uuid();
    const answer = await context.askQuestion(requestId, {
      requestId,
      question: parsed.question,
      sessionId: context.sessionId,
    });

    if (!answer) {
      return { success: true, output: '(User did not provide an answer — proceed with your best judgment.)' };
    }

    return { success: true, output: answer };
  }
}
