import { z } from 'zod';
import * as cheerio from 'cheerio';
import type { ITool } from './ITool';
import type { ToolResult, ToolContext } from '../../../shared/types/agent.types';

const MAX_OUTPUT_CHARS = 4000;

// Private IP ranges to block (SSRF protection)
const PRIVATE_HOSTNAME_PATTERN =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|::1|0\.0\.0\.0)$/i;

const inputSchema = z.object({
  url: z.string().url().describe('The full URL (http or https) to fetch'),
  query: z.string().optional().describe('Optional description of what information to look for on the page'),
});

export class WebFetchTool implements ITool {
  readonly name = 'web_fetch';
  readonly description =
    'Fetch the text content of a public web page to verify information, read documentation, or research a topic. Returns cleaned plain text extracted from the page.';
  readonly inputSchema = inputSchema;
  readonly requiresConfirmation = false;

  async execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);

    // Validate URL scheme
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(parsed.url);
    } catch {
      return { success: false, error: 'Invalid URL' };
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return { success: false, error: 'Only http:// and https:// URLs are supported' };
    }

    // SSRF protection: block private/local hostnames
    if (PRIVATE_HOSTNAME_PATTERN.test(parsedUrl.hostname)) {
      return { success: false, error: 'Access to local or private network addresses is not allowed' };
    }

    try {
      const response = await fetch(parsed.url, {
        headers: {
          'User-Agent': 'Termimate/1.0 (AI agent; research only)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const contentType = response.headers.get('content-type') ?? '';
      const text = await response.text();

      let extracted: string;

      if (contentType.includes('text/html')) {
        extracted = extractTextFromHtml(text);
      } else {
        // Plain text, JSON, XML — return as-is (truncated)
        extracted = text;
      }

      const truncated = extracted.length > MAX_OUTPUT_CHARS
        ? extracted.slice(0, MAX_OUTPUT_CHARS) + `\n\n[Content truncated — ${extracted.length} chars total]`
        : extracted;

      const queryNote = parsed.query ? `\nSearching for: ${parsed.query}\n\n` : '\n';
      return {
        success: true,
        output: `Content from ${parsedUrl.hostname}:${queryNote}${truncated}`,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        return { success: false, error: 'Request timed out after 15 seconds' };
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}

function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $('script, style, noscript, nav, footer, header, aside, [aria-hidden="true"]').remove();

  // Get title
  const title = $('title').text().trim();

  // Try main content first, fall back to body
  const mainEl = $('main, article, [role="main"], #content, .content, #main').first();
  const rawText = mainEl.length > 0 ? mainEl.text() : $('body').text();

  // Normalize whitespace
  const cleaned = rawText
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return title ? `${title}\n\n${cleaned}` : cleaned;
}
