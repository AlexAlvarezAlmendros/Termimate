/**
 * Stateful parser that splits a text stream into `text_delta` and `thinking_delta`
 * events based on `<think>...</think>` tags.  Works correctly even when tag
 * boundaries arrive across multiple chunks.
 */
export type ParsedEvent = { type: 'text_delta' | 'thinking_delta'; content: string };

const OPEN_TAG = '<think>';
const CLOSE_TAG = '</think>';

export class ThinkingStreamParser {
  private buffer = '';
  private inThinking = false;

  process(text: string): ParsedEvent[] {
    this.buffer += text;
    const events: ParsedEvent[] = [];

    while (true) {
      if (this.inThinking) {
        const closeIdx = this.buffer.indexOf(CLOSE_TAG);
        if (closeIdx === -1) {
          // Tag may span the next chunk — keep (CLOSE_TAG.length - 1) chars in buffer
          const safe = this.buffer.slice(0, Math.max(0, this.buffer.length - (CLOSE_TAG.length - 1)));
          if (safe.length > 0) {
            events.push({ type: 'thinking_delta', content: safe });
            this.buffer = this.buffer.slice(safe.length);
          }
          break;
        } else {
          if (closeIdx > 0) events.push({ type: 'thinking_delta', content: this.buffer.slice(0, closeIdx) });
          this.buffer = this.buffer.slice(closeIdx + CLOSE_TAG.length);
          this.inThinking = false;
        }
      } else {
        const openIdx = this.buffer.indexOf(OPEN_TAG);
        if (openIdx === -1) {
          const safe = this.buffer.slice(0, Math.max(0, this.buffer.length - (OPEN_TAG.length - 1)));
          if (safe.length > 0) {
            events.push({ type: 'text_delta', content: safe });
            this.buffer = this.buffer.slice(safe.length);
          }
          break;
        } else {
          if (openIdx > 0) events.push({ type: 'text_delta', content: this.buffer.slice(0, openIdx) });
          this.buffer = this.buffer.slice(openIdx + OPEN_TAG.length);
          this.inThinking = true;
        }
      }
    }

    return events;
  }

  /** Call once after the stream ends to emit any remaining buffered content. */
  flush(): ParsedEvent[] {
    if (this.buffer.length === 0) return [];
    const event: ParsedEvent = { type: this.inThinking ? 'thinking_delta' : 'text_delta', content: this.buffer };
    this.buffer = '';
    return [event];
  }
}

export const THINKING_SYSTEM_INSTRUCTION =
  'When reasoning about a problem, wrap your internal reasoning inside <think>...</think> tags before writing your final answer. ' +
  'Put ALL of your deliberation inside <think> — only the final, polished answer should appear outside the tags.';
