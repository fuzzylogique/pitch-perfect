import { randomUUID } from "crypto";
import path from "path";
import { NextRequest } from "next/server";
import {
  createJob,
  getJob,
  persistUpload,
  saveResult,
  updateJob,
  updateJobStatus,
} from "@/lib/job-store";
import {
  EvaluationRequest,
  EvaluationTarget,
  UploadedMedia,
} from "@/lib/evaluation-schema";
import { extractDeckText } from "@/lib/deck-extractor";
import { evaluateWithGemini } from "@/lib/evaluator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeTarget(value: string | null): EvaluationTarget {
  switch (value) {
    case "pitch_deck":
    case "delivery":
    case "audio":
    case "video":
    case "full":
      return value;
    default:
      return "full";
  }
}

function mediaKind(mimeType: string) {
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  return "other";
}

function isDeckFile(mimeType: string, fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (mimeType === "application/pdf" || ext === ".pdf") {
    return true;
  }
  return false;
}

async function parseFormData(request: NextRequest) {
  const formData = await request.formData();
  const target = normalizeTarget(formData.get("target")?.toString() ?? null);
  const context = formData.get("context")?.toString();
  const deckText = formData.get("deckText")?.toString();
  const transcript = formData.get("transcript")?.toString();
  const metadataRaw = formData.get("metadata")?.toString();
  let metadata: Record<string, string> | undefined;
  if (metadataRaw) {
    try {
      metadata = JSON.parse(metadataRaw) as Record<string, string>;
    } catch {
      metadata = undefined;
    }
  }

  const files = formData.getAll("media");
  if (files.length === 0) {
    const single = formData.get("file");
    if (single) {
      files.push(single);
    }
  }

  let deckFile: File | null = null;
  const deckEntry = formData.get("deck");
  if (deckEntry instanceof File) {
    deckFile = deckEntry;
  } else {
    const deckIndex = files.findIndex(
      (entry) =>
        entry instanceof File && isDeckFile(entry.type || "", entry.name)
    );
    if (deckIndex >= 0) {
      deckFile = files[deckIndex] as File;
      files.splice(deckIndex, 1);
    }
  }

  return { target, context, deckText, transcript, metadata, files, deckFile };
}

async function parseJson(request: NextRequest) {
  const payload = (await request.json()) as Partial<EvaluationRequest>;
  return {
    target: normalizeTarget(payload.target ? String(payload.target) : null),
    context: payload.context,
    deckText: payload.deckText,
    transcript: payload.transcript,
    metadata: payload.metadata,
    files: [],
    deckFile: null,
  };
}

async function storeUploads(id: string, files: unknown[]) {
  const media: UploadedMedia[] = [];
  for (const entry of files) {
    if (!(entry instanceof File)) {
      continue;
    }
    const buffer = Buffer.from(await entry.arrayBuffer());
    const storedPath = await persistUpload({
      id,
      fileName: entry.name,
      mimeType: entry.type || "application/octet-stream",
      buffer,
    });
    media.push({
      kind: mediaKind(entry.type || ""),
      path: storedPath,
      mimeType: entry.type || "application/octet-stream",
      originalName: entry.name,
      sizeBytes: buffer.byteLength,
    });
  }
  return media;
}

async function handleDeckFile(id: string, deckFile: File | null) {
  if (!deckFile) {
    return { deckText: undefined, warning: undefined };
  }
  const isPdf =
    deckFile.type === "application/pdf" ||
    deckFile.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return {
      deckText: undefined,
      warning: "Deck file must be a PDF.",
    };
  }
  const buffer = Buffer.from(await deckFile.arrayBuffer());
  await persistUpload({
    id,
    fileName: deckFile.name,
    mimeType: deckFile.type || "application/octet-stream",
    buffer,
  });
  try {
    const extraction = await extractDeckText({
      buffer,
      mimeType: deckFile.type || "application/octet-stream",
      originalName: deckFile.name,
    });
    return { deckText: extraction.text, warning: extraction.warning };
  } catch (error) {
    return {
      deckText: undefined,
      warning: `Deck extraction failed: ${String(error)}`,
    };
  }
}

async function runEvaluation(jobId: string) {
  try {
    await updateJobStatus(jobId, "running");
    const job = await getJob(jobId);
    if (!job) {
      return;
    }
    const result = await evaluateWithGemini(jobId, job.input, job.media ?? []);
    const resultPath = await saveResult(jobId, result);
    await updateJob(jobId, { status: "completed", resultPath });
  } catch (error) {
    await updateJob(jobId, { status: "failed", error: String(error) });
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const payload = contentType.includes("multipart/form-data")
    ? await parseFormData(request)
    : await parseJson(request);

  const id = randomUUID();
  const deckExtraction = await handleDeckFile(id, payload.deckFile);
  const media = await storeUploads(id, payload.files);
  const deckText = payload.deckText ?? deckExtraction.deckText;
  const metadata =
    deckExtraction.warning
      ? {
          ...(payload.metadata ?? {}),
          deckExtractionWarning: deckExtraction.warning,
        }
      : payload.metadata;
  const input: EvaluationRequest = {
    target: payload.target,
    context: payload.context,
    deckText,
    transcript: payload.transcript,
    metadata,
  };

  await createJob({ id, target: payload.target, input, media });
  void runEvaluation(id);

  return Response.json({
    jobId: id,
    statusUrl: `/api/evaluate/status/${id}`,
  });
}
