import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

export type LLMProvider = "openai" | "anthropic";

export function getModel(provider: LLMProvider = "openai") {
  switch (provider) {
    case "openai":
      return openai("gpt-4o");
    case "anthropic":
      return anthropic("claude-sonnet-4-20250514");
    default:
      return openai("gpt-4o");
  }
}

export function getModerationModel() {
  return openai("gpt-4o-mini");
}
