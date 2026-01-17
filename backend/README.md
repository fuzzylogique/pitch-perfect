# Pitch Perfect Express Backend

This folder hosts a standalone Express backend that mirrors the previous Next.js API routes. It exposes the same evaluation endpoints so any frontend (Next.js or otherwise) can post media + context, let the Gemini-powered workflow run asynchronously, then poll for results.

## Setup

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in the required keys:
   ```
   PORT=4000
   GEMINI_API_KEY=<your-key>
   GEMINI_AUDIO_MODEL=gemini-2.0-flash-lite
   ELEVENLABS_API_KEY=<your-key>
   ```
3. Start the server:
   - Development (with `ts-node`):
     ```bash
     npm run dev
     ```
   - Production (compile + run):
     ```bash
     npm run build
     npm start
     ```

## Endpoints

### `POST /api/evaluate/start`

Accepts `multipart/form-data` with up to three fields:

| field | description |
| --- | --- |
| `target` | Optional. One of `full`, `pitch_deck`, `delivery`, `audio`, `video`. Defaults to `full`. |
| `context` | Optional string describing stage/audience/goal. |
| `deckText` | Optional raw deck text (falls back to extracted slides). |
| `transcript` | Optional transcript string. If omitted and audio/video is sent, the server will try ElevenLabs first and then Gemini native audio analysis. |
| `metadata` | Optional JSON string (e.g. `{"industry":"fintech"}`). |

Plus files:
* `deck` (PDF) or a file with `.pdf` extension to be treated as the pitch deck.
* Additional `media` files for audio/video evidence.

The response:

```json
{ "jobId": "uuid", "statusUrl": "/api/evaluate/status/<jobId>" }
```

### `GET /api/evaluate/status/:jobId`

Returns the persisted job record plus the last evaluation result (if available):

```json
{
  "job": { ... },
  "result": { ... } // optional, will appear after processing completes
}
```

## Integration hints

- The Express server reuses the shared `job-store` + agent workflow in `code/src/lib`, so the behavior matches the existing Next.js backend.
- Point your frontend to the new server by setting `NEXT_PUBLIC_API_BASE_URL` (or wherever you configure the evaluation client) to `http://localhost:4000` (or whichever host/port you choose).
- The server keeps job data inside `code/.data` so the frontend can continue using the same polling/states.

