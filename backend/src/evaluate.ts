import { randomUUID } from "crypto";
import express, { Request } from "express";
import multer from "multer";
import path from "path";
import {
  createJob,
  getJob,
  getResult,
  persistUpload,
  saveResult,
  updateJob,
  updateJobStatus,
} from "../../code/src/lib/job-store";
import { extractDeckText } from "../../code/src/lib/deck-extractor";
import { evaluateWithGemini } from "../../code/src/lib/evaluator";
import {
  EvaluationRequest,
  EvaluationTarget,
  UploadedMedia,
} from "../../code/src/lib/evaluation-schema";

const upload = multer({ storage: multer.memoryStorage() });
export const evaluateRouter = express.Router();

const TARGETS: EvaluationTarget[] = [
  "full",
  "pitch_deck",
  "delivery",
  "audio",
  "video",
];

function normalizeTarget(value: string | undefined): EvaluationTarget {
  return TARGETS.includes(value as EvaluationTarget)
    ? (value as EvaluationTarget)
    : "full";
}

function mediaKind(mimeType: string, name: string) {
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
  return mimeType === "application/pdf" || ext === ".pdf";
}

async function storeUploads(id: string, files: Express.Multer.File[]) {
  const media: UploadedMedia[] = [];
  for (const file of files) {
    const buffer = file.buffer;
    const storedPath = await persistUpload({
      id,
      fileName: file.originalname,
      mimeType: file.mimetype || "application/octet-stream",
      buffer,
    });
    media.push({
      kind: mediaKind(file.mimetype || "", file.originalname),
      path: storedPath,
      mimeType: file.mimetype || "application/octet-stream",
      originalName: file.originalname,
      sizeBytes: buffer.byteLength,
    });
  }
  return media;
}

async function handleDeckFile(
  id: string,
  deckFile?: Express.Multer.File
): Promise<{ deckText?: string; warning?: string }> {
  if (!deckFile) {
    return { deckText: undefined, warning: undefined };
  }
  const isPdf =
    deckFile.mimetype === "application/pdf" ||
    deckFile.originalname.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return {
      deckText: undefined,
      warning: "Deck file must be a PDF.",
    };
  }
  const buffer = deckFile.buffer;
  await persistUpload({
    id,
    fileName: deckFile.originalname,
    mimeType: deckFile.mimetype || "application/octet-stream",
    buffer,
  });
  try {
    const extraction = await extractDeckText({
      buffer,
      mimeType: deckFile.mimetype || "application/octet-stream",
      originalName: deckFile.originalname,
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
    await updateJob(jobId, {
      status: "failed",
      error: String(error),
    });
  }
}

evaluateRouter.post(
  "/start",
  upload.any(),
  async (req: Request, res) => {
    try {
      const target = normalizeTarget(req.body.target as string | undefined);
      const context = req.body.context as string | undefined;
      const transcript = (req.body.transcript as string | undefined)?.trim();
      const deckTextOverride = req.body.deckText as string | undefined;
      const metadataRaw = req.body.metadata as string | undefined;
      let metadata: Record<string, string> | undefined;
      if (metadataRaw) {
        try {
          metadata = JSON.parse(metadataRaw);
        } catch {
          metadata = undefined;
        }
      }

      const files = Array.isArray(req.files)
        ? (req.files as Express.Multer.File[])
        : [];
      const deckIndex = files.findIndex((file) =>
        isDeckFile(file.mimetype || "", file.originalname)
      );
      const deckFile =
        deckIndex >= 0 ? files.splice(deckIndex, 1)[0] : undefined;

      const id = randomUUID();
      const deckResult = await handleDeckFile(id, deckFile);
      const uploadedMedia = await storeUploads(id, files);
      const finalDeckText = deckTextOverride ?? deckResult.deckText;
      const mergedMetadata = deckResult.warning
        ? { ...(metadata ?? {}), deckExtractionWarning: deckResult.warning }
        : metadata;

      const input: EvaluationRequest = {
        target,
        context,
        deckText: finalDeckText,
        transcript: transcript || undefined,
        metadata: mergedMetadata,
      };

      await createJob({
        id,
        target,
        input,
        media: uploadedMedia,
      });
      void runEvaluation(id);

      res.json({
        jobId: id,
        statusUrl: `/api/evaluate/status/${id}`,
      });
    } catch (error) {
      console.error("evaluate/start failed", error);
      res.status(500).json({
        error: `Failed to start evaluation: ${String(error)}`,
      });
    }
  }
);

evaluateRouter.get("/status/:jobId", async (req, res) => {
  const jobId = req.params.jobId;
  const job = await getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found." });
  }
  const result = await getResult(jobId);
  res.json({ job, result });
});
