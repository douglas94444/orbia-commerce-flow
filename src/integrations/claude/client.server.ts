import { getServerConfig } from "@/lib/config.server";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
}

export async function callClaude(
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  const { anthropic } = getServerConfig();
  if (!anthropic.apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const messages: ClaudeMessage[] = [{ role: "user", content: prompt }];

  const body: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    messages,
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropic.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as ClaudeResponse;
  return data.content.find((b) => b.type === "text")?.text ?? "";
}
