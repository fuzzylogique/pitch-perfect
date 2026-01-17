import { randomUUID } from "crypto";
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
  return { target, context, deckText, transcript, metadata, files };
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

async function runEvaluation(jobId: string) {
  try {
    await updateJobStatus(jobId, "running");
    const job = await getJob(jobId);
    if (!job) {
      return;
    }
    const result = await evaluateWithGemini(job.input, job.media ?? []);
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
  const media = await storeUploads(id, payload.files);
  const input: EvaluationRequest = {
    target: payload.target,
    context: payload.context,
    deckText: payload.deckText,
    transcript: payload.transcript,
    metadata: payload.metadata,
  };

  await createJob({ id, target: payload.target, input, media });
  void runEvaluation(id);

  return Response.json({
    jobId: id,
    statusUrl: `/api/evaluate/status/${id}`,
  });
}
