import { randomUUID } from "crypto";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const AUDIO_MODEL = process.env.GEMINI_AUDIO_MODEL ?? "gemini-2.0-flash-lite";
const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 60000;
const MAX_RETRY_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 600;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isQuotaOrRateLimitError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("resource_exhausted") ||
    message.includes("quota_exceeded") ||
    message.includes("429")
  );
}

async function withGeminiRetry<T>(fn: () => Promise<T>, label: string) {
  let attempt = 0;
  let lastError: unknown;
  while (attempt < MAX_RETRY_ATTEMPTS) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = getErrorMessage(error);
      const isQuotaError = isQuotaOrRateLimitError(error);
      attempt += 1;
      console.warn(`[audio-analysis] ${label} failed on attempt ${attempt}: ${message}`);
      if (isQuotaError || attempt >= MAX_RETRY_ATTEMPTS) {
        throw new Error(`[${label}] ${message}`);
      }
      const wait = BACKOFF_BASE_MS * attempt;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw new Error(
    `[${label}] exceeded retry limit: ${getErrorMessage(lastError)}`
  );
}

export type GeminiAudioFile = {
  fileName: string;
  fileUri: string;
  mimeType: string;
};

type UploadResult = {
  ok: true;
  file: GeminiAudioFile;
} | {
  ok: false;
  error: string;
};

async function ensureGeminiAudioFile(params: {
  audioPath: string;
  mimeType?: string;
  fileName?: string;
  existingFile?: GeminiAudioFile;
}): Promise<UploadResult> {
  if (params.existingFile) {
    return { ok: true, file: params.existingFile };
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY is not set." };
  }
  try {
    const client = new GoogleGenAI({ apiKey });
    const baseName = path
      .basename(params.audioPath)
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const shortName =
      baseName.length <= 24
        ? baseName
        : `${baseName.slice(0, 20)}-${randomUUID().slice(0, 6)}`;
    const uploadResult = await withGeminiRetry(
      () =>
        client.files.upload({
          file: params.audioPath,
          config: {
            mimeType: params.mimeType,
            name: shortName,
          },
        }),
      "Gemini audio upload"
    );
    const fileName =
      uploadResult.name ??
      uploadResult.fileName ??
      uploadResult.file?.name ??
      uploadResult.file?.name;
    if (!fileName) {
      return { ok: false, error: "Gemini audio upload returned no file name." };
    }
    let fileRecord = await client.files.get({ name: fileName });
    const start = Date.now();
    while (fileRecord.state === "PROCESSING") {
      if (Date.now() - start > MAX_WAIT_MS) {
        return { ok: false, error: "Gemini audio file processing timed out." };
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      fileRecord = await client.files.get({ name: fileName });
      console.debug(
        `[audio-analysis] polling ${fileName} state=${fileRecord.state}`
      );
    }
    if (fileRecord.state !== "ACTIVE") {
      return {
        ok: false,
        error: `Uploaded audio file state was ${fileRecord.state ?? "unknown"}.`,
      };
    }
    const fileUri = fileRecord.uri ?? fileRecord.fileUri;
    if (!fileUri) {
      return {
        ok: false,
        error: "Gemini audio upload response lacked a file URI.",
      };
    }
    console.debug(`[audio-analysis] fileUri=${fileUri}`);
    return {
      ok: true,
      file: {
        fileName,
        fileUri,
        mimeType: params.mimeType ?? fileRecord.mimeType ?? "audio/mpeg",
      },
    };
  } catch (error) {
    console.error("[audio-analysis] upload failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Gemini upload failed: ${message}` };
  }
}

export async function transcribeAudioWithGemini(params: {
  audioPath: string;
  mimeType?: string;
  audioMeta?: string;
  existingFile?: GeminiAudioFile;
}) {
  const fileResult = await ensureGeminiAudioFile({
    audioPath: params.audioPath,
    mimeType: params.mimeType,
    existingFile: params.existingFile,
  });
  if (!fileResult.ok) {
    return { ok: false, error: fileResult.error };
  }
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `Transcribe this audio. Mention timestamps when possible and flag filler words: ${params.audioMeta ?? "no metadata"}`;
  try {
    const response = await withGeminiRetry(
      () =>
        client.models.generateContent({
          model: AUDIO_MODEL,
          contents: [
            {
              fileData: {
                fileUri: fileResult.file.fileUri,
                mimeType: fileResult.file.mimeType,
              },
            },
            { text: prompt },
          ],
          config: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        }),
      "Gemini transcription"
    );
    const transcript = response.text?.trim();
    if (!transcript) {
      return { ok: false, error: "Gemini transcription returned empty text." };
    }
    return {
      ok: true,
      transcript,
      fileInfo: fileResult.file,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[audio-analysis] transcription failed", error);
    return { ok: false, error: `Gemini transcription failed: ${message}` };
  }
}

export async function analyzeAudioWithGemini(params: {
  audioPath: string;
  mimeType?: string;
  audioMeta?: string;
  existingFile?: GeminiAudioFile;
}) {
  const fileResult = await ensureGeminiAudioFile({
    audioPath: params.audioPath,
    mimeType: params.mimeType,
    existingFile: params.existingFile,
  });
  if (!fileResult.ok) {
    return { ok: false, error: fileResult.error };
  }
  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const fileUri = fileResult.file.fileUri;
    const prompt = `Audio metadata: ${params.audioMeta ?? "none"}\nAssess tone, pacing, filler usage, and background elements; cite timestamps or metrics when possible.`;
    const response = await withGeminiRetry(
      () =>
        client.models.generateContent({
          model: AUDIO_MODEL,
          contents: [
            {
              fileData: {
                fileUri,
                mimeType: fileResult.file.mimeType,
              },
            },
            { text: prompt },
          ],
          config: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      "Gemini audio analysis"
    );
    const summary = response.text?.trim();
    if (!summary) {
      return { ok: false, error: "Gemini audio analysis returned an empty summary." };
    }
    return { ok: true, summary, fileInfo: fileResult.file };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[audio-analysis] analysis failed", error);
    return { ok: false, error: `Gemini audio analysis failed: ${message}` };
  }
}
