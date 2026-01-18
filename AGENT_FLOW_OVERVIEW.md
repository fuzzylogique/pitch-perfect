# Agent Flow Overview

This document summarizes how the Gemini-powered agents work together, the prompts they rely on, and the metrics/schema they return. It also highlights the evaluation flow so you can confirm how scores are produced and surfaced in the UI.

## 1. High-level flow

```
                +--------------------------+
                |  Incoming Evaluation Job |
                +-----------+--------------+
                            |
                            v
            +------------------------------+
            | prepareAudioForAgent (persist|
            |  uploads, derive audioPath)   |
            +------------------------------+
                |             |           \
                v             v            v
        +-------------+  +------------+  +-------------+
        | Deck agent  |  | Speech     |  | Transcript  |
        | (deck text) |  | content    |  | agent (text)|
        +------+------+  +------+-----+  +------+------+
               |                |               |
               v                v               v
        +----------------+  +----------------+  +----------------+
        | Delivery agent |  | Audio agent    |  | Voice agent    |
        | (transcript)   |  | (audio summary)|  | (voice metrics)|
        +-------+--------+  +-------+--------+  +-------+--------+
                \                 |               /
                 \                |              /
                  \               |             /
                   +--------------+------------+
                                  |
                          +-------v--------+
                          | Combine agent  |
                          | (final report) |
                          +----------------+
                                  |
                          +-------v--------+
                          | EvaluationReport|
                          +----------------+
```

Notes:

* **Deck agent** uses the deck text (either extracted from the PDF or submitted by the user) to score narrative/structure/visuals/clarity/persuasiveness.
* **Speech content agent** looks at the transcript (or Gemini audio summary) and rates story arc, value proposition, differentiation, and ask strength.
* **Transcript agent** evaluates the actual phrasing of the pitch for clarity, relevance, structure, highlights, risks, and recommendations.
* **Text (delivery) agent** focuses on pacing, confidence, engagement, and vocal delivery as inferred from the transcript.
* **Audio agent** outputs pace/filler/silence/volume metrics plus issue lists referencing timestamps based on audio metadata or transcript content.
* **Voice agent** scores tone, cadence, confidence, clarity, articulation, vocabulary, and conviction using a mix of transcript snippets and audio cues.
* **Combine agent** ingests every previous output to produce the final `EvaluationReport`, weighting the weakest modality more heavily and generating highlights/risks/timeline/recommendations.

## 2. Prompt & schema brief

| Agent | Prompt file | Key schema/metrics | Scoring focus |
| --- | --- | --- | --- |
| Deck | `prompts/deck-agent.txt` | `overallScore`, plus category scores (narrative, structure, visuals, clarity, persuasiveness) + strengths/gaps/slideNotes | Tech / slide quality, logical flow, evidence references, actionable feedback |
| Delivery (text) | `prompts/text-agent.txt` | `overallScore`, `clarity`, `pacing`, `confidence`, `engagement`, `vocalDelivery`, `bodyLanguage` | Story clarity, energy, pacing, filler words, investor-fit language |
| Speech content | `prompts/speech-content-agent.txt` | `overallScore`, `storyArc`, `valueProp`, `differentiation`, `ask` | Narrative strength, differentiation, clear CTA/ask, story cadence |
| Audio | `prompts/audio-agent.txt` | `overallScore`, `issues`, `metrics` (paceWpm, fillerWordsPerMin, silenceRatio, avgVolumeDb) | Quantitative metrics plus timestamped issues/strengths derived from waveform/transcript |
| Voice | `prompts/voice-agent.txt` | Category scores for tone/cadence/confidence/clarity/articulation/vocabulary/conviction + `overallSummary` | Vocal delivery traits affecting persuasion, ties to timestamps/metadata |
| Transcription | `prompts/transcription-agent.txt` | `overallScore`, `clarity`, `relevance`, `structure`, plus highlights/risks/recommendations | Literal wording, clarity, and language quality for investors |
| Combine | `prompts/combine-agent.txt` | `summary` (scores, highlights, risks), `timeline`, `recommendations` | Aggregated final score; drags down overall score when any modality scores poorly |

Scoring guidance used within prompts:

* **Hard ceilings**: Most agents are instructed to default to mid-60 ranges and only award >80 when multiple strong evidences exist. The audio agent explicitly caps “excellent” cases unless metrics strongly justify it.
* **Evidence-first rationale**: Each rationale requires transcript excerpts, timestamps, or audio metadata (pace/filler/silence data) so the combine agent can trace every claim.
* **Penalty for weak signals**: Combine prompt specifically tells the model to lower the overall score (by 5–15 points) when any agent flags severe issues (score <60 or high-severity issues).

## 3. Rendering in the UI

* Delivery, audio, voice, and speech content feedback cards each display the category scores/metrics returned by their agents from the `EvaluationReport`.
* The transcription feedback card displays the transcript analyst’s scores plus highlight/risk/resolution text.
* Optional raw report toggle lets developers view the JSON output only when needed.

## 4. Coach narration plan

* The combine agent now also produces `voiceNarrations`—a small array with an encouraging persona and a harsher/funny persona, each delivering a 2–4 sentence motivational critique with a concrete action item. These scripts are what we will feed to the ElevenLabs TTS voices later so they don’t simply echo the summary but act as high-energy coach responses.
* Front-end components should show both persona scripts (as we now do under the voice feedback card) and queue them to be rendered via the TTS pipeline, allowing for one positive advocate voice and one critical but humorous voice.
* Future voice playback should use the `tone` metadata to match the correct ElevenLabs voice IDs (encouraging vs harsh) and keep the prompts aligned with the persona instructions defined in `prompts/combine-agent.txt`.

## 4. Future adjustments

* New prompts can be added by creating a schema that maps to `EvaluationReport`. The combine agent will automatically ingest any new modality as long as it is JSON-stringified before injection.
* Additional quantitative metrics (e.g., filler word count per minute) can be appended to the audio agent’s schema and UI `renderAudioFeedback`.
