# Pitch Perfect (feature/gemini-eval)

Local dev setup for the agentic Gemini evaluation flow (deck + transcript + audio).

## Requirements

- Node.js 20+
- ffmpeg + ffprobe (required if you upload video and want audio extraction)

## Setup

```bash
cd code
npm install
```

Create `code/.env.local` with your API keys:

```
GEMINI_API_KEY=your_gemini_key
# Optional overrides
GEMINI_MODEL=gemini-2.5-flash-lite

# Required if you want auto-transcripts from audio/video
ELEVENLABS_API_KEY=your_elevenlabs_key

# Optional overrides for ElevenLabs STT
ELEVENLABS_STT_ENDPOINT=https://api.elevenlabs.io/v1/speech-to-text
ELEVENLABS_STT_MODEL=scribe_v2
```

## Run

```bash
cd code
npm run dev
```

Open http://localhost:3000

## Usage

- Deck is optional, but if provided it must be a PDF.
- If you paste a transcript, the agents use it directly.
- If no transcript is provided and you upload/record audio or upload video, the server
  attempts to generate a transcript using ElevenLabs STT.
- You can record audio in the UI or upload audio/video files.

The UI will list the inputs submitted and show detailed feedback panels.

## API endpoints (local)

- `POST /api/evaluate/start`
  - Accepts `multipart/form-data`
  - Fields: `target`, `context`, `deckText`, `transcript`, `metadata`, `deck`, `media`
- `GET /api/evaluate/status/{jobId}`

## Prompt templates

Prompt files live in `code/prompts/` and can be edited directly:

- `deck-agent.txt`
- `text-agent.txt`
- `audio-agent.txt`
- `combine-agent.txt`

