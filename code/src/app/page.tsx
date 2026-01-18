"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getEvaluationStatus, startEvaluation } from "@/lib/evaluation-client";
import type {
  AudioEvaluation,
  CategoryScore,
  DeliveryEvaluation,
  EvaluationReport,
  EvaluationTarget,
  PitchDeckCritique,
  SpeechContentEvaluation,
  TranscriptionEvaluation,
  VoiceEvaluation,
} from "@/lib/evaluation-schema";

const targets: EvaluationTarget[] = [
  "full",
  "pitch_deck",
  "delivery",
  "audio",
  "video",
];

const statusDescriptions: Record<string, string> = {
  idle: "Idle — waiting for inputs to kick off.",
  queued: "Queued — prepping media + ensuring Gemini slots.",
  running: "Running — Gemini agents analyzing deck/audio.",
  completed: "Completed — results available in the report.",
  failed: "Failed — review errors and try again.",
};

export default function Home() {
  const [target, setTarget] = useState<EvaluationTarget>("full");
  const [context, setContext] = useState("");
  const [deckFile, setDeckFile] = useState<File | null>(null);
  const [deckError, setDeckError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [metadataRaw, setMetadataRaw] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [recordedAudio, setRecordedAudio] = useState<File | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "stopped">(
    "idle"
  );
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [submittedInputs, setSubmittedInputs] = useState<string[] | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState("idle");
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRawReport, setShowRawReport] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const isProcessingPhase =
    isSubmitting || jobStatus === "queued" || jobStatus === "running";
  const currentStatusLabel =
    statusDescriptions[jobStatus] ?? "Processing your pitch evaluation.";

  const highlights = useMemo(() => report?.summary?.highlights ?? [], [report]);
  const risks = useMemo(() => report?.summary?.risks ?? [], [report]);

  const renderCategory = (label: string, category?: CategoryScore) => {
    if (!category) {
      return null;
    }
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100">{label}</p>
          <span className="text-xs font-semibold text-slate-300">
            {category.score} / 100
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-300">{category.rationale}</p>
        {category.evidence && category.evidence.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-400">
            {category.evidence.map((item, index) => (
              <li key={`${label}-evidence-${index}`}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const renderDeckFeedback = (deck?: PitchDeckCritique) => {
    if (!deck) {
      return (
        <p className="mt-3 text-sm text-slate-400">
          No deck feedback available yet.
        </p>
      );
    }
    return (
      <div className="mt-4 flex flex-col gap-4 text-sm text-slate-200">
        <div className="text-2xl font-semibold text-slate-50">
          {deck.overallScore} / 100
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {renderCategory("Narrative", deck.narrative)}
          {renderCategory("Structure", deck.structure)}
          {renderCategory("Visuals", deck.visuals)}
          {renderCategory("Clarity", deck.clarity)}
          {renderCategory("Persuasiveness", deck.persuasiveness)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Strengths
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
              {deck.strengths.length === 0 && <li>No strengths listed.</li>}
              {deck.strengths.map((item, index) => (
                <li key={`deck-strength-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Gaps
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
              {deck.gaps.length === 0 && <li>No gaps listed.</li>}
              {deck.gaps.map((item, index) => (
                <li key={`deck-gap-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        {deck.slideNotes && deck.slideNotes.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Slide Notes
            </p>
            <ul className="mt-2 space-y-2 text-sm text-slate-200">
              {deck.slideNotes.map((note, index) => (
                <li
                  key={`slide-note-${index}`}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3"
                >
                  <p className="text-xs text-slate-400">
                    Slide {note.slideNumber ?? index + 1}: {note.title ?? "Untitled"}
                  </p>
                  <p className="mt-1 text-sm text-slate-200">{note.feedback}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderDeliveryFeedback = (delivery?: DeliveryEvaluation) => {
    if (!delivery) {
      return (
        <p className="mt-3 text-sm text-slate-400">
          No delivery feedback available yet.
        </p>
      );
    }
    return (
      <div className="mt-4 flex flex-col gap-4 text-sm text-slate-200">
        <div className="text-2xl font-semibold text-slate-50">
          {delivery.overallScore} / 100
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {renderCategory("Clarity", delivery.clarity)}
          {renderCategory("Pacing", delivery.pacing)}
          {renderCategory("Confidence", delivery.confidence)}
          {renderCategory("Engagement", delivery.engagement)}
          {renderCategory("Vocal Delivery", delivery.vocalDelivery)}
          {renderCategory("Body Language", delivery.bodyLanguage)}
        </div>
      </div>
    );
  };

  const renderAudioFeedback = (audio?: AudioEvaluation) => {
    if (!audio) {
      return (
        <p className="mt-3 text-sm text-slate-400">
          No audio feedback available yet.
        </p>
      );
    }
    return (
      <div className="mt-4 flex flex-col gap-4 text-sm text-slate-200">
        <div className="text-2xl font-semibold text-slate-50">
          {audio.overallScore} / 100
        </div>
        {audio.metrics && (
          <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300 sm:grid-cols-2">
            <div>paceWpm: {audio.metrics.paceWpm ?? "n/a"}</div>
            <div>fillerWordsPerMin: {audio.metrics.fillerWordsPerMin ?? "n/a"}</div>
            <div>silenceRatio: {audio.metrics.silenceRatio ?? "n/a"}</div>
            <div>avgVolumeDb: {audio.metrics.avgVolumeDb ?? "n/a"}</div>
          </div>
        )}
        {audio.issues.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Issues &amp; Strengths
            </p>
            <ul className="mt-2 space-y-2 text-sm text-slate-200">
              {audio.issues.map((issue, index) => (
                <li
                  key={`audio-issue-${index}`}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3"
                >
                  <p className="text-xs text-slate-400">
                    {issue.type} @ {issue.timestampSec ?? "n/a"}s - {issue.severity}
                  </p>
                  <p className="mt-1 text-sm text-slate-200">{issue.description}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
    </div>
  );
  };

  const renderVoiceFeedback = (voice?: VoiceEvaluation) => {
    if (!voice) {
      return (
        <p className="mt-3 text-sm text-slate-400">
          No voice-focused feedback available yet.
        </p>
      );
    }
    const categoryEntries: Array<[string, CategoryScore]> = [
      ["Tone", voice.tone],
      ["Cadence", voice.cadence],
      ["Confidence", voice.confidence],
      ["Clarity", voice.clarity],
      ["Articulation", voice.articulation],
      ["Vocabulary", voice.vocabulary],
      ["Conviction", voice.conviction],
    ];
    const averageScore = Math.round(
      categoryEntries.reduce((sum, [, category]) => sum + category.score, 0) /
        categoryEntries.length
    );
    return (
      <div className="mt-4 flex flex-col gap-4 text-sm text-slate-200">
        <div className="text-2xl font-semibold text-slate-50">
          {averageScore} / 100
        </div>
        <p className="text-xs text-slate-400">{voice.overallSummary}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {categoryEntries.map(([label, category]) =>
            renderCategory(label, category)
          )}
        </div>
    </div>
  );
};

  const renderSpeechContentFeedback = (content?: SpeechContentEvaluation) => {
    if (!content) {
      return (
        <p className="mt-3 text-sm text-slate-400">
          No speech content evaluation available yet.
        </p>
      );
    }
    const categoryEntries: Array<[string, CategoryScore]> = [
      ["Story Arc", content.storyArc],
      ["Value Prop", content.valueProp],
      ["Differentiation", content.differentiation],
      ["Ask", content.ask],
    ];
    return (
      <div className="mt-4 flex flex-col gap-4 text-sm text-slate-200">
        <div className="text-2xl font-semibold text-slate-50">
          {content.overallScore} / 100
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {categoryEntries.map(([label, category]) =>
            renderCategory(label, category)
          )}
        </div>
      </div>
    );
  };

  const renderTranscriptionFeedback = (transcription?: TranscriptionEvaluation) => {
    if (!transcription) {
      return (
        <p className="mt-3 text-sm text-slate-400">
          No transcription evaluation available yet.
        </p>
      );
    }
    const categoryEntries: Array<[string, CategoryScore]> = [
      ["Clarity", transcription.clarity],
      ["Relevance", transcription.relevance],
      ["Structure", transcription.structure],
    ];
    return (
      <div className="mt-4 flex flex-col gap-4 text-sm text-slate-200">
        <div className="text-2xl font-semibold text-slate-50">
          {transcription.overallScore} / 100
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {categoryEntries.map(([label, category]) =>
            renderCategory(label, category)
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Highlights
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
            {transcription.highlights.length === 0 && <li>No highlights listed.</li>}
            {transcription.highlights.map((item, index) => (
              <li key={`transcription-highlight-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Risks
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
            {transcription.risks.length === 0 && <li>No risks flagged.</li>}
            {transcription.risks.map((item, index) => (
              <li key={`transcription-risk-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
        {transcription.recommendations.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Recommendations
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
              {transcription.recommendations.map((item, index) => (
                <li key={`transcription-recommendation-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

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

  useEffect(() => {
    if (recordingState !== "recording") {
      return;
    }
    const timer = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [recordingState]);

  useEffect(() => {
    if (!recordedAudio) {
      setRecordedAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(recordedAudio);
    setRecordedAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordedAudio]);

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    setFiles(selected);
  };

  const handleDeckChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) {
      setDeckFile(null);
      setDeckError(null);
      return;
    }
    const isPdf =
      selected.type === "application/pdf" ||
      selected.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setDeckFile(null);
      setDeckError("Deck must be a PDF for now.");
      event.target.value = "";
      return;
    }
    setDeckFile(selected);
    setDeckError(null);
  };

  const startRecording = async () => {
    setRecordingError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingError("Audio recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const file = new File([blob], `recording-${Date.now()}.webm`, {
          type: blob.type,
        });
        setRecordedAudio(file);
        setRecordingState("stopped");
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      setRecordingState("recording");
    } catch (recordingError) {
      setRecordingError(`Failed to access microphone: ${String(recordingError)}`);
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  };

  const clearRecording = () => {
    setRecordedAudio(null);
    setRecordedAudioUrl(null);
    setRecordingSeconds(0);
    setRecordingState("idle");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setReport(null);
    setJobId(null);
    setJobStatus("idle");

    if (deckError) {
      setError(deckError);
      return;
    }

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
      const allFiles = recordedAudio ? [recordedAudio, ...files] : files;
      const uploadedAudio = allFiles.filter((file) => file.type.startsWith("audio/"));
      const uploadedVideo = allFiles.filter((file) => file.type.startsWith("video/"));
      const summary: string[] = [];
      if (deckFile) {
        summary.push(`Deck: ${deckFile.name}`);
      }
      if (transcript.trim()) {
        summary.push("Transcript: provided");
      } else if (uploadedAudio.length > 0 || uploadedVideo.length > 0) {
        summary.push("Transcript: auto (ElevenLabs)");
      }
      if (recordedAudio) {
        summary.push(`Recorded audio: ${recordedAudio.name}`);
      }
      if (uploadedAudio.length > 0) {
        summary.push(`Audio files: ${uploadedAudio.map((file) => file.name).join(", ")}`);
      }
      if (uploadedVideo.length > 0) {
        summary.push(`Video files: ${uploadedVideo.map((file) => file.name).join(", ")}`);
      }
      if (summary.length === 0) {
        summary.push("Inputs: none");
      }
      setSubmittedInputs(summary);
      const response = await startEvaluation({
        target,
        context: context.trim() || undefined,
        transcript: transcript.trim() || undefined,
        metadata,
        deckFile,
        files: allFiles,
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
      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-12 px-8 py-16">
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

        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] xl:gap-12">
          <form
            onSubmit={handleSubmit}
            className="fade-in-up flex min-w-0 flex-col gap-6 rounded-[32px] border border-slate-800 bg-slate-900/70 p-8 shadow-[0_25px_65px_-45px_rgba(2,6,23,0.85)] backdrop-blur-2xl"
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
              Pitch Deck File (optional)
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleDeckChange}
                className="mt-2 block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-slate-200/10 file:px-4 file:py-2 file:text-sm file:text-slate-100 hover:file:bg-slate-200/20"
              />
              <span className="mt-2 block text-xs text-slate-400">
                PDF only for now.
              </span>
              {deckError && (
                <span className="mt-2 block text-xs text-red-200">
                  {deckError}
                </span>
              )}
            </label>

            <label className="text-sm font-semibold text-slate-200">
              Transcript
              <textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="Paste a transcript or leave blank to auto-generate from audio."
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

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-200">Record Audio</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Timer: {recordingSeconds}s</span>
                  {recordingState === "recording" && (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-emerald-200">
                      Recording
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={recordingState === "recording"}
                  className="rounded-full bg-emerald-400/20 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Start recording
                </button>
                <button
                  type="button"
                  onClick={stopRecording}
                  disabled={recordingState !== "recording"}
                  className="rounded-full bg-amber-400/20 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Stop recording
                </button>
                <button
                  type="button"
                  onClick={clearRecording}
                  disabled={!recordedAudio}
                  className="rounded-full bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear
                </button>
              </div>
              {recordingError && (
                <div className="mt-3 text-xs text-red-200">{recordingError}</div>
              )}
              {recordedAudioUrl && (
                <div className="mt-3">
                  <audio controls className="w-full" src={recordedAudioUrl} />
                  <p className="mt-2 text-xs text-slate-400">
                    Recording ready: {recordedAudio?.name}
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {isSubmitting ? "Starting..." : "Start Evaluation"}
            </button>

            {isProcessingPhase && (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-xs text-slate-200">
                <span
                  className={`inline-flex h-2 w-2 rounded-full bg-emerald-400 ${
                    isProcessingPhase ? "animate-pulse" : ""
                  }`}
                />
                <span>{isSubmitting ? "Submitting inputs..." : currentStatusLabel}</span>
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}
          </form>

          <div className="fade-in-up flex min-w-0 flex-col gap-8">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-base font-semibold text-slate-100">
                Job Status
              </h2>
              <div className="mt-3 text-sm text-slate-300">
                <div>Status: {jobStatus}</div>
                <div>Job ID: {jobId ?? "—"}</div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <span
                  className={`inline-flex h-2 w-2 rounded-full bg-emerald-400 ${
                    jobStatus === "queued" || jobStatus === "running"
                      ? "animate-pulse"
                      : ""
                  }`}
                />
                <span>{statusDescriptions[jobStatus] ?? "Status pending..."}</span>
              </div>
              {submittedInputs && (
                <div className="mt-4 text-xs text-slate-300">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    Inputs
                  </p>
                  <ul className="mt-2 space-y-1">
                    {submittedInputs.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-300">
                <button
                  type="button"
                  onClick={() => setShowRawReport((prev) => !prev)}
                  className="rounded-full border border-slate-700 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-slate-100 transition hover:border-slate-500"
                >
                  {showRawReport ? "Hide raw report" : "Show raw report"}
                </button>
                <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
                  Raw debugging output
                </span>
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
                Deck Feedback
              </h2>
              {renderDeckFeedback(report?.pitchDeck)}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-base font-semibold text-slate-100">
                Delivery &amp; Audio Feedback
              </h2>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Delivery
                  </h3>
                  {renderDeliveryFeedback(report?.delivery)}
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Audio
                  </h3>
                  {renderAudioFeedback(report?.audio)}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-base font-semibold text-slate-100">
                Voice Feedback
              </h2>
              {renderVoiceFeedback(report?.voice)}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-base font-semibold text-slate-100">
                Speech Content Feedback
              </h2>
              {renderSpeechContentFeedback(report?.speechContent)}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-base font-semibold text-slate-100">
                Transcription Feedback
              </h2>
              {renderTranscriptionFeedback(report?.transcription)}
            </div>

            {showRawReport && (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
                <h2 className="text-base font-semibold text-slate-100">
                  Raw Report
                </h2>
                <pre className="mt-3 max-h-80 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950/80 p-3 text-xs text-slate-200">
                  {report ? JSON.stringify(report, null, 2) : "No data yet."}
                </pre>
              </div>
            )}

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-base font-semibold text-slate-100">
                Transcript
              </h2>
              {report?.transcript?.text ? (
                <div className="mt-3 text-sm text-slate-200">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Source: {report.transcript.source}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-slate-200">
                    {report.transcript.text}
                  </p>
                </div>
              ) : transcript.trim() ? (
                <div className="mt-3 text-sm text-slate-200">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Source: user
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-slate-200">
                    {transcript.trim()}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  No transcript available yet.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
