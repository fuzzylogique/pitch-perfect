import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  AudioEvaluation,
  DeliveryEvaluation,
  EvaluationReport,
  EvaluationRequest,
  PitchDeckCritique,
  UploadedMedia,
  VoiceEvaluation,
} from "./evaluation-schema";
import { renderPrompt } from "./agent-prompts";
import { callGeminiJson, getDefaultModel } from "./agent-llm";
import { prepareAudioForAgent } from "./media-utils";
import { transcribeWithElevenLabs } from "./transcription";
import { analyzeAudioWithGemini } from "./audio-analysis";

type AgentStatus = "ok" | "error";

type AgentResult<T> = {
  status: AgentStatus;
  data?: T;
  error?: string;
  warnings?: string[];
};

type WorkflowInput = {
  request: EvaluationRequest;
  audioMeta?: string;
  audioAvailable: boolean;
};

type CombineOutput = {
  summary: EvaluationReport["summary"];
  timeline: NonNullable<EvaluationReport["timeline"]>;
  recommendations: EvaluationReport["recommendations"];
};

const WorkflowState = Annotation.Root({
  input: Annotation<WorkflowInput>,
  deckResult: Annotation<AgentResult<PitchDeckCritique> | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  textResult: Annotation<AgentResult<DeliveryEvaluation> | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  audioResult: Annotation<AgentResult<AudioEvaluation> | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  voiceResult: Annotation<AgentResult<VoiceEvaluation> | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  combinedResult: Annotation<AgentResult<CombineOutput> | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
});

async function deckAgent(state: typeof WorkflowState.State) {
  const deckText = state.input.request.deckText?.trim();
  if (!deckText) {
    return {
      deckResult: { status: "error", error: "Deck text is missing." },
    };
  }
  const prompt = await renderPrompt("deck-agent", {
    context: state.input.request.context,
    deckText,
  });
  const result = await callGeminiJson<PitchDeckCritique>({ prompt });
  if (!result.ok) {
    return { deckResult: { status: "error", error: result.error } };
  }
  return { deckResult: { status: "ok", data: result.data } };
}

async function textAgent(state: typeof WorkflowState.State) {
  const transcriptText = state.input.request.transcript?.trim();
  if (!transcriptText) {
    return {
      textResult: { status: "error", error: "Transcript is missing." },
    };
  }
  const prompt = await renderPrompt("text-agent", {
    context: state.input.request.context,
    transcript: transcriptText,
  });
  const result = await callGeminiJson<DeliveryEvaluation>({ prompt });
  if (!result.ok) {
    return { textResult: { status: "error", error: result.error } };
  }
  return { textResult: { status: "ok", data: result.data } };
}

async function audioAgent(state: typeof WorkflowState.State) {
  const audioTranscript = state.input.request.transcript?.trim();
  const audioMeta = state.input.audioMeta ?? "No audio metadata.";
  if (!state.input.audioAvailable) {
    return {
      audioResult: { status: "ok" },
    };
  }
  if (!audioTranscript) {
    return {
      audioResult: { status: "error", error: "Transcript is missing." },
    };
  }
  const prompt = await renderPrompt("audio-agent", {
    audioMeta,
    transcript: audioTranscript,
    audioSummary: state.input.request.audioSummary,
  });
  const result = await callGeminiJson<AudioEvaluation>({ prompt });
  if (!result.ok) {
    return { audioResult: { status: "error", error: result.error } };
  }
  return { audioResult: { status: "ok", data: result.data } };
}

async function voiceAgent(state: typeof WorkflowState.State) {
  const audioTranscript = state.input.request.transcript?.trim();
  const audioMeta = state.input.audioMeta ?? "No audio metadata.";
  if (!state.input.audioAvailable) {
    return {
      voiceResult: { status: "ok" },
    };
  }
  if (!audioTranscript) {
    return {
      voiceResult: { status: "error", error: "Transcript is missing." },
    };
  }
  const prompt = await renderPrompt("voice-agent", {
    audioMeta,
    transcript: audioTranscript,
    audioSummary: state.input.request.audioSummary,
  });
  const result = await callGeminiJson<VoiceEvaluation>({ prompt });
  if (!result.ok) {
    return { voiceResult: { status: "error", error: result.error } };
  }
  return { voiceResult: { status: "ok", data: result.data } };
}

async function combineAgent(state: typeof WorkflowState.State) {
  const deckPayload = JSON.stringify(state.deckResult?.data ?? null, null, 2);
  const textPayload = JSON.stringify(state.textResult?.data ?? null, null, 2);
  const audioPayload = JSON.stringify(state.audioResult?.data ?? null, null, 2);
  const voicePayload = JSON.stringify(state.voiceResult?.data ?? null, null, 2);
  const prompt = await renderPrompt("combine-agent", {
    deckAgent: deckPayload,
    textAgent: textPayload,
    audioAgent: audioPayload,
    voiceAgent: voicePayload,
  });
  const result = await callGeminiJson<CombineOutput>({ prompt });
  if (!result.ok) {
    return { combinedResult: { status: "error", error: result.error } };
  }
  return { combinedResult: { status: "ok", data: result.data } };
}

function buildFallbackReport(
  request: EvaluationRequest,
  warnings: string[],
  partial?: Partial<EvaluationReport>
): EvaluationReport {
  return {
    version: "1.0",
    summary: {
      overallScore: 0,
      headline: "Evaluation pending",
      highlights: [],
      risks: [],
    },
    pitchDeck: partial?.pitchDeck,
    delivery: partial?.delivery,
    audio: partial?.audio,
    transcript: partial?.transcript,
    voice: partial?.voice,
    timeline: partial?.timeline,
    recommendations: partial?.recommendations ?? [],
    warnings,
    meta: {
      model: getDefaultModel(),
      generatedAt: new Date().toISOString(),
      target: request.target,
    },
  };
}

function buildWorkflow() {
  return new StateGraph(WorkflowState)
    .addNode("deckAgent", deckAgent)
    .addNode("textAgent", textAgent)
    .addNode("audioAgent", audioAgent)
    .addNode("voiceAgent", voiceAgent)
    .addNode("combineAgent", combineAgent)
    .addEdge(START, "deckAgent")
    .addEdge(START, "textAgent")
    .addEdge(START, "audioAgent")
    .addEdge(START, "voiceAgent")
    .addEdge("deckAgent", "combineAgent")
    .addEdge("textAgent", "combineAgent")
    .addEdge("audioAgent", "combineAgent")
    .addEdge("voiceAgent", "combineAgent")
    .addEdge("combineAgent", END)
    .compile();
}

const workflow = buildWorkflow();

export async function runAgentWorkflow(params: {
  jobId: string;
  request: EvaluationRequest;
  media: UploadedMedia[];
}) {
  const warnings: string[] = [];
  const audioPrep = await prepareAudioForAgent({
    jobId: params.jobId,
    media: params.media,
  });
  warnings.push(...audioPrep.warnings);
  const { audioPath, audioMeta, mimeType } = audioPrep;

  const transcriptText = params.request.transcript?.trim();
  let transcriptInfo: EvaluationReport["transcript"] | undefined;
  let resolvedTranscript = transcriptText;

  let audioSummary: string | undefined = params.request.audioSummary;
  if (transcriptText) {
    transcriptInfo = { source: "user", text: transcriptText };
  } else if (audioPath) {
    const transcriptResult = await transcribeWithElevenLabs({
      audioPath,
    });
    if (transcriptResult.ok && transcriptResult.text) {
      resolvedTranscript = transcriptResult.text;
      transcriptInfo = {
        source: "elevenlabs",
        text: transcriptResult.text,
        segments: transcriptResult.segments,
      };
    } else if (transcriptResult.error) {
      warnings.push(transcriptResult.error);
    }
  }

  if (!resolvedTranscript && audioPath) {
    const audioAnalysis = await analyzeAudioWithGemini({
      audioPath,
      audioMeta,
      mimeType,
    });
    if (audioAnalysis.ok) {
      resolvedTranscript = audioAnalysis.summary;
      audioSummary = audioAnalysis.summary;
      transcriptInfo = {
        source: "gemini-audio",
        text: audioAnalysis.summary,
      };
    } else if (audioAnalysis.error) {
      warnings.push(audioAnalysis.error);
    }
  }

  const requestWithTranscript: EvaluationRequest = {
    ...params.request,
    transcript: resolvedTranscript,
    audioSummary,
  };

  const finalState = await workflow.invoke({
    input: {
      request: requestWithTranscript,
      audioMeta: audioPrep.audioMeta,
      audioAvailable: Boolean(audioPrep.audioPath),
    },
  });

  const deck = finalState.deckResult?.data;
  const delivery = finalState.textResult?.data;
  const audio = finalState.audioResult?.data;
  const voice = finalState.voiceResult?.data;

  if (finalState.deckResult?.status === "error" && finalState.deckResult.error) {
    warnings.push(`Deck agent failed: ${finalState.deckResult.error}`);
  }
  if (finalState.textResult?.status === "error" && finalState.textResult.error) {
    warnings.push(`Text agent failed: ${finalState.textResult.error}`);
  }
  if (finalState.audioResult?.status === "error" && finalState.audioResult.error) {
    warnings.push(`Audio agent failed: ${finalState.audioResult.error}`);
  }
  if (finalState.voiceResult?.status === "error" && finalState.voiceResult.error) {
    warnings.push(`Voice agent failed: ${finalState.voiceResult.error}`);
  }

  if (
    !finalState.combinedResult ||
    finalState.combinedResult.status === "error"
  ) {
    if (finalState.combinedResult?.error) {
      warnings.push(`Combiner failed: ${finalState.combinedResult.error}`);
    }
    return buildFallbackReport(requestWithTranscript, warnings, {
      pitchDeck: deck,
      delivery,
      audio,
      transcript: transcriptInfo,
      voice,
    });
  }

  return {
    version: "1.0",
    summary: finalState.combinedResult.data.summary,
    pitchDeck: deck,
    delivery,
    audio,
    voice,
    transcript: transcriptInfo,
    timeline: finalState.combinedResult.data.timeline,
    recommendations: finalState.combinedResult.data.recommendations,
    warnings: warnings.length > 0 ? warnings : undefined,
    meta: {
      model: getDefaultModel(),
      generatedAt: new Date().toISOString(),
      target: params.request.target,
    },
  } satisfies EvaluationReport;
}
