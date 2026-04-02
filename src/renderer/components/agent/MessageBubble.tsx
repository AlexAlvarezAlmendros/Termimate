import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
      {/* ── Message bubble ── */}
      {(content || isStreaming) && (
        <div
          className={`max-w-[85%] px-3 py-2.5 rounded-xl text-sm leading-relaxed ${
            isUser
              ? 'bg-primary/15 text-on-surface rounded-br-sm'
              : 'bg-surface-container-high text-on-surface rounded-bl-sm'
          }`}
        >
          {isUser ? (
            <pre className="whitespace-pre-wrap font-body text-sm">{content}</pre>
          ) : (
            <div className="prose-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node: _node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{ borderRadius: '6px', fontSize: '12px', margin: '6px 0' }}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code
                        className="bg-surface-container px-1 py-0.5 rounded font-mono text-xs"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  p({ children }) {
                    return <p className="mb-2 last:mb-0">{children}</p>;
                  },
                  ul({ children }) {
                    return <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>;
                  },
                  ol({ children }) {
                    return <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>;
                  },
                  a({ children, href }) {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline hover:brightness-125"
                      >
                        {children}
                      </a>
                    );
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote className="border-l-2 border-outline-variant pl-3 text-on-surface/70 my-2">
                        {children}
                      </blockquote>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-1.5 h-3.5 bg-primary/70 animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Waiting indicator: streaming but nothing yet ── */}
      {!isUser && isStreaming && !content && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-high text-outline/50 text-xs">
          <span className="block w-1.5 h-1.5 rounded-full bg-outline/40 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="block w-1.5 h-1.5 rounded-full bg-outline/40 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="block w-1.5 h-1.5 rounded-full bg-outline/40 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  );
}
