const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface WordAnalysis {
  word: string;
  start_time: number;
  end_time: number;
  confidence: number;
}

export interface TranscriptionResult {
  Transcription: string;
  "Word Analysis": WordAnalysis[];
  Timestamps: [number, number][];
}

export interface SpeechFeature {
  timestamp: number;
  clarity: number;
  pace: number;
  fillers: number;
  structure: number;
}

export interface SummarizeResponse {
  summary: string;
  transcription: TranscriptionResult;
}

export interface AnalyzeResponse {
  Transcription: string;
  "Word Analysis": WordAnalysis[];
  Timestamps: [number, number][];
}

export async function analyzeSpeech(file: File): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/analyze-speech`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Analysis failed" }));
    throw new Error(error.detail || "Failed to analyze speech");
  }

  return response.json();
}

export async function summarizeWithGemini(file: File): Promise<SummarizeResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/summarize-with-gemini`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Summarization failed" }));
    throw new Error(error.detail || "Failed to summarize speech");
  }

  return response.json();
}

export async function healthCheck(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/`);

  if (!response.ok) {
    throw new Error("API health check failed");
  }

  return response.json();
}
