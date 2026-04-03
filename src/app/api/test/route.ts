import { streamText, createUIMessageStreamResponse } from "ai";
import { getModel } from "@/lib/llm/provider";

export async function POST(req: Request) {
  try {
    const result = streamText({
      model: getModel("openai"),
      messages: [{ role: "user", content: "Say hello in one sentence." }],
    });

    return createUIMessageStreamResponse({
      stream: result.toUIMessageStream(),
    });
  } catch (error) {
    console.error("Test error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
    });
  }
}

export async function GET() {
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "Content-Type": "application/json" },
  });
}
