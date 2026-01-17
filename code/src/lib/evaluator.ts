import { promises as fs } from "fs";
import { GoogleGenAI, createPartFromBase64, createPartFromText } from "@google/genai";
import {
  EvaluationReport,
  EvaluationRequest,
  UploadedMedia,
} from "./evaluation-schema";

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";
const MAX_INLINE_BYTES = 4_000_000;

function buildPrompt(request: EvaluationRequest, media: UploadedMedia[]) {
  const sections = [
    "You are evaluating a startup pitch deck and delivery.",
    "Return only JSON that matches the requested schema.",
    "Scores must be 0-100.",
    `Target: ${request.target}`,
  ];

  if (request.context) {
    sections.push(`Context: ${request.context}`);
  }

  if (request.deckText) {
    sections.push(`Deck Text:\n${request.deckText}`);
  }

  if (request.transcript) {
    sections.push(`Transcript:\n${request.transcript}`);
  }

  if (request.metadata && Object.keys(request.metadata).length > 0) {
    sections.push(`Metadata: ${JSON.stringify(request.metadata)}`);
  }

  if (media.length > 0) {
    sections.push(
      `Media provided: ${media.map((item) => `${item.kind} (${item.mimeType})`).join(", ")}.`
    );
  }

  sections.push(`Schema:
{
  "version": "1.0",
  "summary": {
    "overallScore": number,
    "headline": string,
    "highlights": string[],
    "risks": string[]
  },
  "pitchDeck": {
    "overallScore": number,
    "narrative": { "score": number, "rationale": string, "evidence": string[] },
    "structure": { "score": number, "rationale": string, "evidence": string[] },
    "visuals": { "score": number, "rationale": string, "evidence": string[] },
    "clarity": { "score": number, "rationale": string, "evidence": string[] },
    "persuasiveness": { "score": number, "rationale": string, "evidence": string[] },
    "strengths": string[],
    "gaps": string[],
    "slideNotes": [{ "slideNumber": number, "title": string, "feedback": string }]
  },
  "delivery": {
    "overallScore": number,
    "clarity": { "score": number, "rationale": string, "evidence": string[] },
    "pacing": { "score": number, "rationale": string, "evidence": string[] },
    "confidence": { "score": number, "rationale": string, "evidence": string[] },
    "engagement": { "score": number, "rationale": string, "evidence": string[] },
    "vocalDelivery": { "score": number, "rationale": string, "evidence": string[] },
    "bodyLanguage": { "score": number, "rationale": string, "evidence": string[] }
  },
  "audio": {
    "overallScore": number,
    "issues": [{ "timestampSec": number, "type": string, "description": string, "severity": "low"|"medium"|"high" }],
    "metrics": { "paceWpm": number, "fillerWordsPerMin": number, "silenceRatio": number, "avgVolumeDb": number }
  },
  "video": {
    "overallScore": number,
    "issues": [{ "timestampSec": number, "type": string, "description": string, "severity": "low"|"medium"|"high" }],
    "metrics": { "eyeContactPct": number, "onScreenPresencePct": number, "gestureVarietyScore": number }
  },
  "timeline": [{ "startSec": number, "endSec": number, "category": string, "note": string, "severity": "low"|"medium"|"high" }],
  "recommendations": [{ "title": string, "priority": "low"|"medium"|"high", "rationale": string, "actionItems": string[] }]
}`);

  return sections.join("\n\n");
}

function safeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

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

function buildFallbackReport(request: EvaluationRequest, warnings: string[]): EvaluationReport {
  return {
    version: "1.0",
    summary: {
      overallScore: 0,
      headline: "Evaluation pending",
      highlights: [],
      risks: [],
    },
    recommendations: [],
    warnings,
    meta: {
      model: DEFAULT_MODEL,
      generatedAt: new Date().toISOString(),
      target: request.target,
    },
  };
}

function normalizeReport(
  report: EvaluationReport,
  request: EvaluationRequest
): EvaluationReport {
  return {
    ...report,
    summary: {
      ...report.summary,
      overallScore: safeNumber(report.summary?.overallScore, 0),
    },
    meta: {
      model: report.meta?.model ?? DEFAULT_MODEL,
      generatedAt: report.meta?.generatedAt ?? new Date().toISOString(),
      target: request.target,
    },
  };
}

async function callGemini(params: {
  model: string;
  prompt: string;
  media: UploadedMedia[];
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY is not set." } as const;
  }

  const parts = [createPartFromText(params.prompt)];

  for (const item of params.media) {
    try {
      const buffer = await fs.readFile(item.path);
      if (buffer.byteLength > MAX_INLINE_BYTES) {
        parts.push(
          createPartFromText(
            `Media '${item.originalName}' skipped due to size (${buffer.byteLength} bytes).`
          )
        );
        continue;
      }
      parts.push(createPartFromBase64(buffer.toString("base64"), item.mimeType));
    } catch (error) {
      parts.push(
        createPartFromText(
          `Failed to read media '${item.originalName}': ${String(error)}`
        )
      );
    }
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: params.model,
      contents: parts,
      config: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    });
    return { ok: true, text: response.text ?? "" } as const;
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? String((error as { status?: unknown }).status)
      : null;
    const message = error instanceof Error ? error.message : String(error);
    const detail = status ? ` (status ${status})` : "";
    return { ok: false, error: `Gemini error${detail}: ${message}` } as const;
  }
}

export async function evaluateWithGemini(
  request: EvaluationRequest,
  media: UploadedMedia[]
): Promise<EvaluationReport> {
  const prompt = buildPrompt(request, media);
  const result = await callGemini({ model: DEFAULT_MODEL, prompt, media });

  if (!result.ok) {
    return buildFallbackReport(request, [result.error]);
  }

  const jsonPayload = extractJson(result.text);
  if (!jsonPayload) {
    return buildFallbackReport(request, ["Gemini response did not include JSON."]);
  }

  try {
    const parsed = JSON.parse(jsonPayload) as EvaluationReport;
    return normalizeReport(parsed, request);
  } catch (error) {
    return buildFallbackReport(request, [`Failed to parse Gemini JSON: ${String(error)}`]);
  }
}
