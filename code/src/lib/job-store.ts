import { promises as fs } from "fs";
import path from "path";
import { EvaluationJob, EvaluationRequest, JobStatus, UploadedMedia } from "./evaluation-schema";

const DATA_DIR = path.join(process.cwd(), ".data");
const JOBS_DIR = path.join(DATA_DIR, "jobs");
const RESULTS_DIR = path.join(DATA_DIR, "results");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

async function ensureDirs() {
  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

function jobPath(id: string) {
  return path.join(JOBS_DIR, `${id}.json`);
}

function resultPath(id: string) {
  return path.join(RESULTS_DIR, `${id}.json`);
}

export async function createJob(params: {
  id: string;
  target: EvaluationRequest["target"];
  input: EvaluationRequest;
  media?: UploadedMedia[];
}) {
  await ensureDirs();
  const now = new Date().toISOString();
  const job: EvaluationJob = {
    id: params.id,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    target: params.target,
    input: params.input,
    media: params.media,
  };
  await fs.writeFile(jobPath(params.id), JSON.stringify(job, null, 2), "utf8");
  return job;
}

export async function getJob(id: string) {
  try {
    const raw = await fs.readFile(jobPath(id), "utf8");
    return JSON.parse(raw) as EvaluationJob;
  } catch {
    return null;
  }
}

export async function updateJob(id: string, update: Partial<EvaluationJob>) {
  const job = await getJob(id);
  if (!job) {
    return null;
  }
  const next: EvaluationJob = {
    ...job,
    ...update,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(jobPath(id), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function saveResult(id: string, data: unknown) {
  await ensureDirs();
  const filePath = resultPath(id);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  return filePath;
}

export async function getResult(id: string) {
  try {
    const raw = await fs.readFile(resultPath(id), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function persistUpload(params: {
  id: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  await ensureDirs();
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(UPLOADS_DIR, `${params.id}-${safeName}`);
  await fs.writeFile(filePath, params.buffer);
  return filePath;
}

export async function updateJobStatus(id: string, status: JobStatus, error?: string) {
  return updateJob(id, { status, error });
}

export function getUploadsDir() {
  return UPLOADS_DIR;
}
