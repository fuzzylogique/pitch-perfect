# Evaluation API (Local Async)

This module provides local, async evaluation jobs for pitch deck critique and
audio/video delivery analysis using Gemini.

## Endpoints

### POST `/api/evaluate/start`

Accepts `multipart/form-data` (preferred for media) or JSON.

Form fields:
- `target`: `pitch_deck | delivery | audio | video | full`
- `context`: text
- `deckText`: text (optional; use if no deck file)
- `transcript`: text
- `metadata`: JSON string
- `deck`: pitch deck file (optional, PDF only for now)
- `media`: one or more files (video/audio)

Response:
```json
{
  "jobId": "uuid",
  "statusUrl": "/api/evaluate/status/{jobId}"
}
```

### GET `/api/evaluate/status/{jobId}`

Response:
```json
{
  "job": {
    "id": "uuid",
    "status": "queued|running|completed|failed",
    "error": "optional",
    "resultPath": "optional"
  },
  "result": {
    "version": "1.0",
    "summary": { "overallScore": 0, "headline": "...", "highlights": [], "risks": [] },
    "recommendations": [],
    "meta": { "model": "gemini-1.5-flash", "generatedAt": "ISO", "target": "full" }
  }
}
```

## Environment

- `GEMINI_API_KEY`: required for live responses.
- `GEMINI_MODEL`: defaults to `gemini-1.5-flash`.
- `ELEVENLABS_API_KEY`: required for auto-generated transcripts from audio/video.
- `ELEVENLABS_STT_ENDPOINT`: optional override (defaults to ElevenLabs speech-to-text endpoint).
- `ELEVENLABS_STT_MODEL`: optional override (defaults to `scribe_v2`).

## Notes

- Media is stored locally in `code/.data/uploads` and results in `code/.data/results`.
- Deck files are parsed locally into text (PDF) before Gemini evaluation.
- If no transcript is provided and audio/video is available, the server attempts
  to generate a transcript via ElevenLabs STT.
- Large files are skipped for inline Gemini input (limit ~4 MB).
- Jobs are queued in-process; replace with a proper worker for production.

## UI Demo

The default page at `code/src/app/page.tsx` includes a simple evaluation form that
posts to the API and polls job status. Use it for local testing.
