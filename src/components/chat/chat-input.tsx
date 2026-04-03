"use client";

import { useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowUp, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}

const MAX_CHARS = 4000;

export function ChatInput({ input, isLoading, onInputChange, onSubmit }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  return (
    <div className="relative bg-zinc-950 pb-4 pt-2">
      {/* Gradient fade above input */}
      <div className="pointer-events-none absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-zinc-950 to-transparent" />

      <div className="mx-auto max-w-3xl px-4">
        <motion.div
          animate={{
            boxShadow: isFocused
              ? "0 0 0 1px rgba(139, 92, 246, 0.3), 0 0 20px rgba(139, 92, 246, 0.1), 0 4px 20px rgba(0, 0, 0, 0.3)"
              : "0 0 0 1px rgba(63, 63, 70, 0.5), 0 4px 12px rgba(0, 0, 0, 0.2)",
          }}
          transition={{ duration: 0.2 }}
          className="relative overflow-hidden rounded-2xl bg-zinc-900"
        >
          <TextareaAutosize
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) {
                onInputChange(e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Message ChatBridge..."
            className="w-full resize-none bg-transparent px-4 pb-2 pt-4 text-[15px] leading-relaxed text-zinc-100 placeholder-zinc-500 outline-none"
            maxRows={8}
            minRows={2}
          />

          {/* Bottom bar with character count and send */}
          <div className="flex items-center justify-between px-3 pb-2.5">
            <div className="flex items-center gap-2">
              {input.length > 0 && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`text-xs tabular-nums ${
                    input.length > MAX_CHARS * 0.9
                      ? "text-amber-400"
                      : "text-zinc-600"
                  }`}
                >
                  {input.length.toLocaleString()}/{MAX_CHARS.toLocaleString()}
                </motion.span>
              )}
              {!input.length && (
                <span className="text-xs text-zinc-600">
                  Shift+Enter for new line
                </span>
              )}
            </div>

            <button
              onClick={onSubmit}
              disabled={!input.trim() || isLoading}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white transition-all duration-200 hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-600/20 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:shadow-none"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </motion.div>

        <p className="mt-2.5 text-center text-xs text-zinc-600">
          ChatBridge may make mistakes. Built for K-12 education.
        </p>
      </div>
    </div>
  );
}
