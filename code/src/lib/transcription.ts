import { promises as fs } from "fs";
import path from "path";

type TranscriptSegment = {
  startMs?: number;
  endMs?: number;
  text: string;
};

type TranscriptionResult = {
  ok: boolean;
  text?: string;
  segments?: TranscriptSegment[];
  error?: string;
};

function guessMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".wav":
      return "audio/wav";
    case ".mp3":
      return "audio/mpeg";
    case ".m4a":
      return "audio/mp4";
    case ".webm":
      return "audio/webm";
    default:
      return "application/octet-stream";
  }
}

export async function transcribeWithElevenLabs(params: {
  audioPath: string;
  language?: string;
}): Promise<TranscriptionResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ELEVENLABS_API_KEY is not set." };
  }

  const endpoint =
    process.env.ELEVENLABS_STT_ENDPOINT ??
    "https://api.elevenlabs.io/v1/speech-to-text";
  const model = process.env.ELEVENLABS_STT_MODEL ?? "scribe_v2";

  try {
    const buffer = await fs.readFile(params.audioPath);
    const mimeType = guessMimeType(params.audioPath);
    const form = new FormData();
    form.append(
      "file",
      new Blob([buffer], { type: mimeType }),
      path.basename(params.audioPath)
    );
    form.append("model_id", model);
    if (params.language) {
      form.append("language", params.language);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: form,
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        ok: false,
        error: `ElevenLabs STT error: ${response.status} ${body}`,
      };
    }

    const data = (await response.json()) as {
      text?: string;
      transcript?: string;
      segments?: Array<{ start?: number; end?: number; text?: string }>;
    };

    const text = data.text ?? data.transcript ?? "";
    const segments = data.segments?.map((segment) => ({
      startMs: segment.start,
      endMs: segment.end,
      text: segment.text ?? "",
    }));

    if (!text) {
      return { ok: false, error: "ElevenLabs STT returned empty text." };
    }

    return { ok: true, text, segments };
  } catch (error) {
    return { ok: false, error: `ElevenLabs STT failed: ${String(error)}` };
  }
}
