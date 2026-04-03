"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check } from "lucide-react";
import { clsx } from "clsx";
import { motion } from "framer-motion";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  isStreaming?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-green-400" />
          <span className="text-green-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={clsx(
        "px-4 py-3",
        isUser ? "flex justify-end" : "flex justify-start"
      )}
    >
      <div className={clsx("max-w-[85%]", isUser ? "items-end" : "items-start")}>
        {/* Assistant label */}
        {!isUser && (
          <div className="mb-1.5 ml-1">
            <span className="text-xs font-medium text-violet-400/70">ChatBridge</span>
          </div>
        )}

        <div
          className={clsx(
            "text-[15px] leading-relaxed",
            isUser
              ? "rounded-2xl rounded-br-md bg-violet-600 px-4 py-2.5 text-white"
              : "text-zinc-200"
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              p: ({ children }) => (
                <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>
              ),
              code: ({ children, className, ...props }) => {
                const isInline = !className;
                if (isInline) {
                  return (
                    <code className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[13px] text-violet-300">
                      {children}
                    </code>
                  );
                }
                const lang = className?.replace("language-", "") || "";
                const codeText = String(children).replace(/\n$/, "");
                return (
                  <div className="group relative my-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                    <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
                      <span className="text-xs text-zinc-500">{lang || "code"}</span>
                      <CopyButton text={codeText} />
                    </div>
                    <pre className="overflow-x-auto p-4">
                      <code className={clsx("text-[13px] leading-relaxed", className)} {...props}>
                        {children}
                      </code>
                    </pre>
                  </div>
                );
              },
              pre: ({ children }) => <>{children}</>,
              ul: ({ children }) => (
                <ul className="mb-2.5 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-2.5 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>
              ),
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-400 underline decoration-violet-400/30 underline-offset-2 transition-colors hover:text-violet-300 hover:decoration-violet-300/50"
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-2.5 border-l-2 border-violet-500/50 pl-4 text-zinc-400 italic">
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div className="my-3 overflow-x-auto rounded-lg border border-zinc-800">
                  <table className="w-full text-sm">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border-b border-zinc-800 bg-zinc-900 px-4 py-2 text-left font-medium text-zinc-300">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border-b border-zinc-800/50 px-4 py-2 text-zinc-400">
                  {children}
                </td>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
          {isStreaming && (
            <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-violet-400" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
