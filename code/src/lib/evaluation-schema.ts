export type EvaluationTarget = "pitch_deck" | "delivery" | "audio" | "video" | "full";

export type Severity = "low" | "medium" | "high";

export type Priority = "low" | "medium" | "high";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface EvaluationRequest {
  target: EvaluationTarget;
  context?: string;
  deckText?: string;
  transcript?: string;
  audioSummary?: string;
  metadata?: Record<string, string>;
}

export interface UploadedMedia {
  kind: "video" | "audio" | "other";
  path: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
}

export interface CategoryScore {
  score: number;
  rationale: string;
  evidence?: string[];
}

export interface PitchDeckCritique {
  overallScore: number;
  narrative: CategoryScore;
  structure: CategoryScore;
  visuals: CategoryScore;
  clarity: CategoryScore;
  persuasiveness: CategoryScore;
  strengths: string[];
  gaps: string[];
  slideNotes?: Array<{
    slideNumber?: number;
    title?: string;
    feedback: string;
  }>;
}

export interface DeliveryEvaluation {
  overallScore: number;
  clarity: CategoryScore;
  pacing: CategoryScore;
  confidence: CategoryScore;
  engagement: CategoryScore;
  vocalDelivery: CategoryScore;
  bodyLanguage?: CategoryScore;
}

export interface AudioEvaluation {
  overallScore: number;
  issues: Array<{
    timestampSec?: number;
    type: string;
    description: string;
    severity: Severity;
  }>;
  metrics?: {
    paceWpm?: number;
    fillerWordsPerMin?: number;
    silenceRatio?: number;
    avgVolumeDb?: number;
  };
}

export interface VideoEvaluation {
  overallScore: number;
  issues: Array<{
    timestampSec?: number;
    type: string;
    description: string;
    severity: Severity;
  }>;
  metrics?: {
    eyeContactPct?: number;
    onScreenPresencePct?: number;
    gestureVarietyScore?: number;
  };
}

export interface VoiceEvaluation {
  tone: CategoryScore;
  cadence: CategoryScore;
  confidence: CategoryScore;
  clarity: CategoryScore;
  articulation: CategoryScore;
  vocabulary: CategoryScore;
  conviction: CategoryScore;
  overallSummary: string;
}

export interface TimelineEvent {
  startSec: number;
  endSec: number;
  category: string;
  note: string;
  severity: Severity;
}

export interface Recommendation {
  title: string;
  priority: Priority;
  rationale: string;
  actionItems?: string[];
}

export interface TranscriptInfo {
  source: "user" | "elevenlabs";
  text: string;
  segments?: Array<{ startMs?: number; endMs?: number; text: string }>;
}

export interface EvaluationReport {
  version: "1.0";
  summary: {
    overallScore: number;
    headline: string;
    highlights: string[];
    risks: string[];
  };
  pitchDeck?: PitchDeckCritique;
  delivery?: DeliveryEvaluation;
  audio?: AudioEvaluation;
  video?: VideoEvaluation;
  voice?: VoiceEvaluation;
  transcript?: TranscriptInfo;
  timeline?: TimelineEvent[];
  recommendations: Recommendation[];
  warnings?: string[];
  meta: {
    model: string;
    generatedAt: string;
    target: EvaluationTarget;
  };
}

export interface EvaluationJob {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  target: EvaluationTarget;
  input: EvaluationRequest;
  media?: UploadedMedia[];
  resultPath?: string;
  error?: string;
}
