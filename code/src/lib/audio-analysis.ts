import path from "path";
import { GoogleGenAI } from "@google/genai";

const AUDIO_MODEL = process.env.GEMINI_AUDIO_MODEL ?? "gemini-2.0-flash-lite";
const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 60000;

type AnalyzeAudioParams = {
  audioPath: string;
  audioMeta?: string;
  mimeType?: string;
};

type AnalyzeAudioResult =
  | { ok: true; summary: string }
  | { ok: false; error: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function analyzeAudioWithGemini(
  params: AnalyzeAudioParams
): Promise<AnalyzeAudioResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY is not set." };
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const uploadResult = await client.files.upload({
      file: params.audioPath,
      config: {
        mimeType: params.mimeType,
        name: path.basename(params.audioPath),
      },
    });
    const fileName =
      uploadResult.file?.name ?? uploadResult.name ?? uploadResult.fileName;
    if (!fileName) {
      return { ok: false, error: "Gemini audio upload returned no file name." };
    }

    console.debug(
      `[audio-analysis] uploaded ${fileName}`,
      uploadResult.file ?? uploadResult
    );

    let fileRecord = await client.getFile(fileName);
    const start = Date.now();
    while (fileRecord.state === "PROCESSING") {
      if (Date.now() - start > MAX_WAIT_MS) {
        return {
          ok: false,
          error: "Gemini audio file processing timed out.",
        };
      }
      await sleep(POLL_INTERVAL_MS);
      fileRecord = await client.getFile(fileName);
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

    const mimeType = fileRecord.mimeType ?? params.mimeType ?? "audio/mpeg";
    const metadata = params.audioMeta ?? "No metadata provided.";
    const prompt = `Audio metadata: ${metadata}\nDescribe the emotional tone, pacing, and notable background hints. Provide timestamps when possible and summarize key decisions.`;

    const response = await client.models.generateContent({
      model: AUDIO_MODEL,
      contents: [
        {
          fileData: {
            fileUri,
            mimeType,
          },
        },
        { text: prompt },
      ],
      config: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    });

    const summary = response.text?.trim() ?? "";
    if (!summary) {
      return {
        ok: false,
        error: "Gemini audio analysis returned an empty summary.",
      };
    }

    return { ok: true, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Gemini audio analysis failed: ${message}` };
  }
}
