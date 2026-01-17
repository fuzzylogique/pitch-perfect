import { EvaluationReport, EvaluationRequest, UploadedMedia } from "./evaluation-schema";
import { runAgentWorkflow } from "./agent-workflow";

export async function evaluateWithGemini(
  jobId: string,
  request: EvaluationRequest,
  media: UploadedMedia[]
): Promise<EvaluationReport> {
  return runAgentWorkflow({ jobId, request, media });
}
