import { NextRequest } from "next/server";
import { getJob, getResult } from "@/lib/job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) {
    return Response.json({ error: "Job not found." }, { status: 404 });
  }

  const result = job.status === "completed" ? await getResult(id) : null;
  return Response.json({ job, result });
}
