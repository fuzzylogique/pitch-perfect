"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { getEvaluationStatus, startEvaluation } from "@/lib/evaluation-client";
import type { EvaluationReport, EvaluationTarget } from "@/lib/evaluation-schema";

const targets: EvaluationTarget[] = [
  "full",
  "pitch_deck",
  "delivery",
  "audio",
  "video",
];

export default function Home() {
  const [target, setTarget] = useState<EvaluationTarget>("full");
  const [context, setContext] = useState("");
  const [deckFile, setDeckFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [metadataRaw, setMetadataRaw] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState("idle");
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const highlights = useMemo(() => report?.summary?.highlights ?? [], [report]);
  const risks = useMemo(() => report?.summary?.risks ?? [], [report]);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const data = await getEvaluationStatus(jobId);
        if (cancelled) {
          return;
        }
        setJobStatus(data.job.status);
        if (data.result) {
          setReport(data.result as EvaluationReport);
        }
        if (data.job.status === "completed" || data.job.status === "failed") {
          if (timer) {
            clearInterval(timer);
          }
        }
      } catch (pollError) {
        if (cancelled) {
          return;
        }
        setError(String(pollError));
        if (timer) {
          clearInterval(timer);
        }
      }
    };

    timer = setInterval(poll, 2500);
    void poll();

    return () => {
      cancelled = true;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [jobId]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    setFiles(selected);
  };

  const handleDeckChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setDeckFile(selected);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setReport(null);
    setJobId(null);
    setJobStatus("idle");

    let metadata: Record<string, string> | undefined;
    if (metadataRaw.trim()) {
      try {
        metadata = JSON.parse(metadataRaw) as Record<string, string>;
      } catch (parseError) {
        setError(`Metadata JSON error: ${String(parseError)}`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await startEvaluation({
        target,
        context: context.trim() || undefined,
        transcript: transcript.trim() || undefined,
        metadata,
        deckFile,
        files,
      });
      setJobId(response.jobId);
      setJobStatus("queued");
    } catch (submitError) {
      setError(String(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_55%),radial-gradient(circle_at_20%_80%,_rgba(94,234,212,0.18),_transparent_45%)]" />
      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="fade-in-up flex flex-col gap-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Pitch Perfect Evaluation
          </p>
          <h1 className="text-3xl font-semibold text-slate-50 sm:text-4xl">
            Gemini-powered critique for decks, delivery, audio, and video.
          </h1>
          <p className="max-w-2xl text-base text-slate-300">
            Upload your pitch deck plus media. Jobs run asynchronously and
            results stream back into the report panel.
          </p>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            onSubmit={handleSubmit}
            className="fade-in-up flex flex-col gap-6 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.9)] backdrop-blur"
          >
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-semibold text-slate-200">
                Target
              </label>
              <select
                value={target}
                onChange={(event) =>
                  setTarget(event.target.value as EvaluationTarget)
                }
                className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100"
              >
                {targets.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <label className="text-sm font-semibold text-slate-200">
              Context
              <textarea
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder="Company, stage, audience, goals..."
                className="mt-2 h-20 w-full rounded-2xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-100"
              />
            </label>

            <label className="text-sm font-semibold text-slate-200">
              Pitch Deck File
              <input
                type="file"
                accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={handleDeckChange}
                className="mt-2 block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-slate-200/10 file:px-4 file:py-2 file:text-sm file:text-slate-100 hover:file:bg-slate-200/20"
              />
              <span className="mt-2 block text-xs text-slate-400">
                Upload a PDF or PowerPoint deck.
              </span>
            </label>

            <label className="text-sm font-semibold text-slate-200">
              Transcript
              <textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="Paste a transcript if available."
                className="mt-2 h-32 w-full rounded-2xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-100"
              />
            </label>

            <label className="text-sm font-semibold text-slate-200">
              Metadata (JSON)
              <textarea
                value={metadataRaw}
                onChange={(event) => setMetadataRaw(event.target.value)}
                placeholder='{"industry":"fintech","stage":"seed"}'
                className="mt-2 h-20 w-full rounded-2xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-100"
              />
            </label>

            <label className="text-sm font-semibold text-slate-200">
              Upload Audio/Video
              <input
                type="file"
                accept="video/*,audio/*"
                multiple
                onChange={handleFileChange}
                className="mt-2 block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-slate-200/10 file:px-4 file:py-2 file:text-sm file:text-slate-100 hover:file:bg-slate-200/20"
              />
              <span className="mt-2 block text-xs text-slate-400">
                Local uploads only. Gemini inline limit ~4 MB per file.
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {isSubmitting ? "Starting..." : "Start Evaluation"}
            </button>

            {error && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}
          </form>

          <div className="fade-in-up flex flex-col gap-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-base font-semibold text-slate-100">
                Job Status
              </h2>
              <div className="mt-3 text-sm text-slate-300">
                <div>Status: {jobStatus}</div>
                <div>Job ID: {jobId ?? "—"}</div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-base font-semibold text-slate-100">
                Summary
              </h2>
              {report ? (
                <div className="mt-4 flex flex-col gap-4 text-sm text-slate-200">
                  <div className="text-2xl font-semibold text-slate-50">
                    {report.summary.overallScore} / 100
                  </div>
                  <p className="text-slate-300">{report.summary.headline}</p>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Highlights
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-200">
                      {highlights.length === 0 && <li>No highlights yet.</li>}
                      {highlights.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Risks
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-200">
                      {risks.length === 0 && <li>No risks flagged.</li>}
                      {risks.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  {report.warnings && report.warnings.length > 0 && (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                      {report.warnings.join(" ")}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  Start an evaluation to see results.
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-base font-semibold text-slate-100">
                Raw Report
              </h2>
              <pre className="mt-3 max-h-80 overflow-auto rounded-2xl bg-slate-950/80 p-3 text-xs text-slate-200">
                {report ? JSON.stringify(report, null, 2) : "No data yet."}
              </pre>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
