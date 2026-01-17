import { EvaluationRequest, EvaluationTarget } from "./evaluation-schema";

export async function startEvaluation(params: {
  target?: EvaluationTarget;
  context?: string;
  deckText?: string;
  transcript?: string;
  metadata?: Record<string, string>;
  deckFile?: File | null;
  files?: File[];
}) {
  const formData = new FormData();
  if (params.target) {
    formData.set("target", params.target);
  }
  if (params.context) {
    formData.set("context", params.context);
  }
  if (params.deckText) {
    formData.set("deckText", params.deckText);
  }
  if (params.transcript) {
    formData.set("transcript", params.transcript);
  }
  if (params.metadata) {
    formData.set("metadata", JSON.stringify(params.metadata));
  }
  if (params.deckFile) {
    formData.append("deck", params.deckFile);
  }

  for (const file of params.files ?? []) {
    formData.append("media", file);
  }

  const response = await fetch("/api/evaluate/start", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to start evaluation: ${response.status}`);
  }

  return (await response.json()) as { jobId: string; statusUrl: string };
}

export async function getEvaluationStatus(jobId: string) {
  const response = await fetch(`/api/evaluate/status/${jobId}`);
  if (!response.ok) {
    throw new Error(`Failed to get status: ${response.status}`);
  }
  return (await response.json()) as {
    job: {
      id: string;
      status: string;
      error?: string;
      resultPath?: string;
    };
    result?: unknown;
  };
}

export function buildEvaluationRequest(
  request: EvaluationRequest
): Omit<EvaluationRequest, "target"> & { target?: EvaluationTarget } {
  return {
    target: request.target,
    context: request.context,
    deckText: request.deckText,
    transcript: request.transcript,
    audioSummary: request.audioSummary,
    metadata: request.metadata,
  };
}
