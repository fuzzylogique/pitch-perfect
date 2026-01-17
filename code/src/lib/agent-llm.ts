import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return trimmed.slice(first, last + 1);
  }

  return null;
}

export async function callGeminiJson<T>(params: {
  prompt: string;
  model?: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY is not set." } as const;
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: params.model ?? DEFAULT_MODEL,
      contents: params.prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    });
    const text = response.text ?? "";
    const jsonPayload = extractJson(text);
    if (!jsonPayload) {
      return { ok: false, error: "Gemini response did not include JSON." } as const;
    }
    const parsed = JSON.parse(jsonPayload) as T;
    return { ok: true, data: parsed } as const;
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? String((error as { status?: unknown }).status)
      : null;
    const message = error instanceof Error ? error.message : String(error);
    const detail = status ? ` (status ${status})` : "";
    return { ok: false, error: `Gemini error${detail}: ${message}` } as const;
  }
}

export function getDefaultModel() {
  return DEFAULT_MODEL;
}
