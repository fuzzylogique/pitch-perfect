import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  AudioEvaluation,
  DeliveryEvaluation,
  EvaluationReport,
  EvaluationRequest,
  PitchDeckCritique,
  UploadedMedia,
} from "./evaluation-schema";
import { renderPrompt } from "./agent-prompts";
import { callGeminiJson, getDefaultModel } from "./agent-llm";
import { prepareAudioForAgent } from "./media-utils";
import { transcribeWithElevenLabs } from "./transcription";

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
};

type CombineOutput = {
  summary: EvaluationReport["summary"];
  timeline: NonNullable<EvaluationReport["timeline"]>;
  recommendations: EvaluationReport["recommendations"];
};

const WorkflowState = Annotation.Root({
  input: Annotation<WorkflowInput>,
  deck: Annotation<AgentResult<PitchDeckCritique> | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  text: Annotation<AgentResult<DeliveryEvaluation> | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  audio: Annotation<AgentResult<AudioEvaluation> | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  combined: Annotation<AgentResult<CombineOutput> | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
});

async function deckAgent(state: typeof WorkflowState.State) {
  const deckText = state.input.request.deckText?.trim();
  if (!deckText) {
    return {
      deck: { status: "error", error: "Deck text is missing." },
    };
  }
  const prompt = await renderPrompt("deck-agent", {
    context: state.input.request.context,
    deckText,
  });
  const result = await callGeminiJson<PitchDeckCritique>({ prompt });
  if (!result.ok) {
    return { deck: { status: "error", error: result.error } };
  }
  return { deck: { status: "ok", data: result.data } };
}

async function textAgent(state: typeof WorkflowState.State) {
  const transcript = state.input.request.transcript?.trim();
  if (!transcript) {
    return {
      text: { status: "error", error: "Transcript is missing." },
    };
  }
  const prompt = await renderPrompt("text-agent", {
    context: state.input.request.context,
    transcript,
  });
  const result = await callGeminiJson<DeliveryEvaluation>({ prompt });
  if (!result.ok) {
    return { text: { status: "error", error: result.error } };
  }
  return { text: { status: "ok", data: result.data } };
}

async function audioAgent(state: typeof WorkflowState.State) {
  const transcript = state.input.request.transcript?.trim();
  const audioMeta = state.input.audioMeta ?? "No audio metadata.";
  if (!transcript) {
    return {
      audio: { status: "error", error: "Transcript is missing." },
    };
  }
  const prompt = await renderPrompt("audio-agent", {
    audioMeta,
    transcript,
  });
  const result = await callGeminiJson<AudioEvaluation>({ prompt });
  if (!result.ok) {
    return { audio: { status: "error", error: result.error } };
  }
  return { audio: { status: "ok", data: result.data } };
}

async function combineAgent(state: typeof WorkflowState.State) {
  const deckPayload = JSON.stringify(state.deck?.data ?? null, null, 2);
  const textPayload = JSON.stringify(state.text?.data ?? null, null, 2);
  const audioPayload = JSON.stringify(state.audio?.data ?? null, null, 2);
  const prompt = await renderPrompt("combine-agent", {
    deckAgent: deckPayload,
    textAgent: textPayload,
    audioAgent: audioPayload,
  });
  const result = await callGeminiJson<CombineOutput>({ prompt });
  if (!result.ok) {
    return { combined: { status: "error", error: result.error } };
  }
  return { combined: { status: "ok", data: result.data } };
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
    .addNode("combineAgent", combineAgent)
    .addEdge(START, "deckAgent")
    .addEdge(START, "textAgent")
    .addEdge(START, "audioAgent")
    .addEdge("deckAgent", "combineAgent")
    .addEdge("textAgent", "combineAgent")
    .addEdge("audioAgent", "combineAgent")
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

  const transcriptText = params.request.transcript?.trim();
  let transcriptInfo: EvaluationReport["transcript"];
  let resolvedTranscript = transcriptText;

  if (transcriptText) {
    transcriptInfo = { source: "user", text: transcriptText };
  } else if (audioPrep.audioPath) {
    const transcriptResult = await transcribeWithElevenLabs({
      audioPath: audioPrep.audioPath,
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

  const requestWithTranscript: EvaluationRequest = {
    ...params.request,
    transcript: resolvedTranscript,
  };

  const finalState = await workflow.invoke({
    input: {
      request: requestWithTranscript,
      audioMeta: audioPrep.audioMeta,
    },
  });

  const deck = finalState.deck?.data;
  const delivery = finalState.text?.data;
  const audio = finalState.audio?.data;

  if (finalState.deck?.status === "error" && finalState.deck.error) {
    warnings.push(`Deck agent failed: ${finalState.deck.error}`);
  }
  if (finalState.text?.status === "error" && finalState.text.error) {
    warnings.push(`Text agent failed: ${finalState.text.error}`);
  }
  if (finalState.audio?.status === "error" && finalState.audio.error) {
    warnings.push(`Audio agent failed: ${finalState.audio.error}`);
  }

  if (!finalState.combined || finalState.combined.status === "error") {
    if (finalState.combined?.error) {
      warnings.push(`Combiner failed: ${finalState.combined.error}`);
    }
    return buildFallbackReport(requestWithTranscript, warnings, {
      pitchDeck: deck,
      delivery,
      audio,
      transcript: transcriptInfo,
    });
  }

  return {
    version: "1.0",
    summary: finalState.combined.data.summary,
    pitchDeck: deck,
    delivery,
    audio,
    transcript: transcriptInfo,
    timeline: finalState.combined.data.timeline,
    recommendations: finalState.combined.data.recommendations,
    warnings: warnings.length > 0 ? warnings : undefined,
    meta: {
      model: getDefaultModel(),
      generatedAt: new Date().toISOString(),
      target: params.request.target,
    },
  } satisfies EvaluationReport;
}
