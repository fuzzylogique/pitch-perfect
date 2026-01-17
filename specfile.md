Below is a **Codex build-ready technical spec** you can paste into your repo as `SPEC.md`. It is written to be unambiguous for an autonomous coding agent: clear components, APIs, schemas, prompts, and a step-by-step execution plan.

---

# PitchCoach — Codex Build Spec (uOttaHack v1.1 Build Plan)

**Goal:** Build a demo-stable MVP of PitchCoach in 36 hours: **PDF deck critique + pitch video upload/record + transcription + delivery metrics + timeline dashboard + voice coaching clips**, deployed on DigitalOcean with Spaces storage.

**Non-goals (MVP):** Reliable PPTX parsing (best-effort only), real-time coaching, deep camera emotion detection, user accounts.

---

## 0) Repo Structure

```
pitchcoach/
  frontend/                  # React app
  backend/                   # API server + worker
  infra/                     # scripts, env templates
  SPEC.md
  README.md
```

---

## 1) Tech Stack (Lock This)

### Frontend

* React + Vite
* Tailwind CSS
* `react-router` (optional)
* Video playback: native `<video>` + custom overlays
* Recording: MediaRecorder API
* Upload: `fetch` PUT to presigned URL

### Backend

* Python 3.11+
* FastAPI
* Pydantic v2
* `boto3` (S3-compatible Spaces)
* Background processing: **simple worker loop** (process) + DB job state
* DB: SQLite for hackathon (file-based), optional Postgres if time

### Storage

* DigitalOcean Spaces (S3 API)
* Bucket layout:

  * `raw/{sessionId}/{jobId}/deck.pdf`
  * `raw/{sessionId}/{jobId}/pitch.webm`
  * `derived/{sessionId}/{jobId}/slides/{i}.png` (optional)
  * `derived/{sessionId}/{jobId}/coach/{persona}.mp3`
  * `results/{sessionId}/{jobId}/result.json` (optional)

### AI Integrations

* Gemini API (Google): deck critique + coaching synthesis
* ElevenLabs:

  * **Scribe v2 STT** for transcript
  * TTS for personas

---

## 2) Environment Variables

Create `backend/.env.example`:

* `DO_SPACES_REGION`

* `DO_SPACES_ENDPOINT` (example: `https://nyc3.digitaloceanspaces.com`)

* `DO_SPACES_BUCKET`

* `DO_SPACES_ACCESS_KEY`

* `DO_SPACES_SECRET_KEY`

* `GEMINI_API_KEY`

* `ELEVENLABS_API_KEY`

* `ELEVENLABS_VOICE_ID_ENCOURAGING` (or use a default)

* `ELEVENLABS_VOICE_ID_INVESTOR`

* `PUBLIC_APP_URL` (for CORS)

* `DATA_RETENTION_HOURS` (default `12`)

Frontend `.env.example`:

* `VITE_API_BASE_URL`

---

## 3) Core UX Requirements (MVP)

### Pages

1. `/` Landing

   * Start button
   * Short disclaimer
2. `/new`

   * Upload PDF (required)
   * Record or upload pitch video (required)
   * Analyze button (disabled until both present)
3. `/job/:jobId`

   * Processing screen with step progress + rotating “brain rot”
4. `/results/:jobId`

   * Video player + timeline overlay markers
   * Transcript panel (click to jump to timestamp)
   * Summary panel (scores + action items)
   * Voice coach playback with persona toggle
   * Export button (download JSON; PDF export stretch)

### Timeline overlay

Markers types:

* `filler_spike`
* `pace_fast`
* `pace_slow`
* `strong_moment`
* `clarity_issue` (optional)
* `slide_note` (optional)

Click marker:

* Seek video to timestamp
* Highlight transcript segment
* Show detail + suggestion text

---

## 4) Backend Architecture

### Services

* **API Server** (FastAPI)
* **Worker** (python process) polling DB for queued jobs

### DB Tables (SQLite)

**jobs**

* `id` TEXT PK (uuid)
* `session_id` TEXT
* `status` TEXT (`queued|processing|done|error`)
* `progress` INTEGER (0–100)
* `deck_key` TEXT
* `video_key` TEXT
* `result_key` TEXT nullable
* `error_message` TEXT nullable
* `created_at` TEXT (ISO)
* `updated_at` TEXT (ISO)

**results**

* `job_id` TEXT PK
* `result_json` TEXT (full analysis)
* `created_at` TEXT

---

## 5) API Contract (Exact)

### 5.1 Session Handling (No accounts)

Frontend creates `sessionId = uuidv4()` once and stores in localStorage.

Every API call includes header:

* `X-Session-Id: <uuid>`

Backend trusts this for hackathon.

---

### 5.2 Endpoints

#### `POST /v1/uploads/presign`

**Purpose:** Get presigned PUT URL to upload to Spaces.

Request JSON:

```json
{
  "kind": "deck" | "video",
  "contentType": "application/pdf" | "video/webm" | "video/mp4",
  "sizeBytes": 1234567
}
```

Response JSON:

```json
{
  "objectKey": "raw/<sessionId>/<jobId or temp>/<filename>",
  "putUrl": "https://....",
  "headers": {
    "Content-Type": "..."
  },
  "expiresInSeconds": 900
}
```

Rules:

* Validate `sizeBytes` max:

  * deck <= 10MB
  * video <= 100MB (hackathon practical)
* For object key:

  * allow a temporary prefix `raw/<sessionId>/tmp/<uuid>/...` until job created, OR require frontend to request a `jobId` first.
* Choose one approach:

  * **Preferred:** create job first → presign includes `jobId` path.

#### `POST /v1/jobs`

Request JSON:

```json
{
  "deckKey": "raw/.../deck.pdf",
  "videoKey": "raw/.../pitch.webm",
  "languageHint": "en" | "fr" | null
}
```

Response:

```json
{
  "jobId": "<uuid>",
  "status": "queued"
}
```

#### `GET /v1/jobs/{jobId}`

Response:

```json
{
  "jobId": "<uuid>",
  "status": "queued|processing|done|error",
  "progress": 0,
  "errorMessage": null,
  "resultAvailable": false
}
```

#### `GET /v1/results/{jobId}`

* 404 if not done
  Response: full `AnalysisResult` JSON (schema below)

#### `GET /v1/health`

Returns `{ "ok": true }`

---

## 6) Analysis Result Schema (Frontend Renders This)

### 6.1 `AnalysisResult` JSON

```json
{
  "jobId": "uuid",
  "sessionId": "uuid",
  "createdAt": "ISO",
  "deck": {
    "format": "pdf",
    "slideCount": 10,
    "overallSummary": "string",
    "topFixes": [
      { "title": "string", "why": "string", "how": "string" }
    ],
    "perSlide": [
      {
        "slideIndex": 0,
        "title": "string|null",
        "summary": "string",
        "issues": [
          { "type": "clarity|density|story|visual", "detail": "string" }
        ],
        "rewriteSuggestions": [
          { "before": "string|null", "after": "string", "rationale": "string" }
        ]
      }
    ]
  },
  "speech": {
    "language": "en",
    "transcript": [
      {
        "startMs": 0,
        "endMs": 1800,
        "text": "string",
        "tokens": ["optional"],
        "tags": ["filler"] 
      }
    ],
    "metrics": {
      "durationSec": 180,
      "wpmOverall": 152,
      "fillerCount": 23,
      "fillerRatePerMin": 7.6,
      "pauseCount": 14,
      "avgPauseMs": 520,
      "paceSeries": [
        { "tMs": 0, "wpm": 140 },
        { "tMs": 30000, "wpm": 180 }
      ]
    }
  },
  "events": [
    {
      "id": "uuid",
      "tMs": 72000,
      "type": "filler_spike|pace_fast|pace_slow|strong_moment|clarity_issue",
      "severity": 1,
      "title": "string",
      "detail": "string",
      "suggestion": "string",
      "evidence": "string|null"
    }
  ],
  "scores": {
    "overall": 82,
    "content": 86,
    "delivery": 78,
    "clarity": 80
  },
  "voice": {
    "clips": [
      {
        "persona": "encouraging_coach|strict_investor",
        "audioUrl": "https://signed-get-url-or proxied endpoint",
        "durationSec": 32,
        "script": "string"
      }
    ]
  },
  "retention": {
    "rawDeleteAt": "ISO",
    "derivedDeleteAt": "ISO|null"
  }
}
```

Frontend must be robust to missing optional fields (e.g., `perSlide` may exist but have fewer slides, `voice` may be absent).

---

## 7) Processing Pipeline (Worker Step-by-Step)

### 7.1 Worker Loop

* Poll DB every 1–2 seconds for `status='queued'`
* Lock one job, set status `processing`, progress updates
* On success: write to `results` table and set job `done`
* On failure: set job `error` with `error_message`

### 7.2 Steps & Progress Mapping

1. **Fetch files from Spaces** (progress 5–10)
2. **Extract audio from video** (progress 10–20)

   * Use `ffmpeg` on server
3. **STT transcription — ElevenLabs Scribe v2** (progress 20–45)
4. **Compute metrics & events** (progress 45–55)
5. **Deck processing** (progress 55–75)

   * Render slide images OR extract text
6. **Gemini analysis (deck + coaching synthesis)** (progress 75–90)
7. **Generate voice coaching clips — ElevenLabs TTS** (progress 90–98)
8. **Persist results + finalize** (progress 98–100)

---

## 8) Media Handling Details

### 8.1 Video upload formats

* Prefer WebM from MediaRecorder (Chrome)
* Accept MP4 upload

### 8.2 Audio extraction

* Use `ffmpeg`:

  * `ffmpeg -i input.webm -vn -ac 1 -ar 16000 output.wav`
* Keep audio max length ~5 minutes

### 8.3 Deck processing (PDF required)

**Option A (fast, consistent):** server-side render PDF pages to PNG

* Use `poppler` tools or `pdf2image`
* Limit to first 15 slides for MVP

**Option B (frontend):** pdf.js text extraction + optional thumbnails

* Simpler but can lose visual context for critique
  **Recommendation:** Do server-side rendering if possible for best demo.

---

## 9) Delivery Metrics & Event Generation (Deterministic)

Given transcript segments with timestamps:

### 9.1 Fillers

Filler lexicon (English MVP):

* `["um","uh","like","you know","sort of","kind of","basically","actually"]`

Algorithm:

* tokenize lowercase transcript text
* count occurrences
* create `filler_spike` event if fillers in a 15s window exceed threshold (e.g., >=3)

### 9.2 Pace (WPM)

* For each 30s window:

  * wpm = words / (windowSeconds/60)
* Create `pace_fast` event if wpm > 175
* Create `pace_slow` event if wpm < 110
  (These thresholds are tunable; keep stable for demo.)

### 9.3 Pauses

* pause = gap between consecutive transcript segments
* count pauses > 400ms
* compute avg pause

### 9.4 Strong moments (simple heuristic)

* Segment with lower fillers and stable pace around 140–165 and contains “hook keywords”
* Or ask Gemini to label 1–2 “strong moments” after receiving transcript

---

## 10) Gemini Prompts (Exact)

### 10.1 Deck Critique Prompt (JSON Output)

System:

* “You are a world-class pitch coach and slide design reviewer…”

User payload includes:

* `slide_images[]` (base64 or file references if supported)
* `slide_text[]` extracted (if available)

Instruction:

* Return STRICT JSON conforming to:

  * `deck.overallSummary`
  * `deck.topFixes` (3)
  * `deck.perSlide[]` with `issues` + `rewriteSuggestions`
* Do not include markdown.
* Keep rewrite suggestions short and practical.

### 10.2 Coaching Synthesis Prompt

Inputs:

* transcript (shortened / key excerpts)
* computed metrics
* draft events (from heuristics)
* deck top fixes

Output STRICT JSON:

* `scores`
* `events` refine: title/detail/suggestion/evidence
* `voice` scripts for two personas:

  * `encouraging_coach` summary
  * `strict_investor` top 3 fixes

Constraints:

* No medical claims
* Suggestions actionable
* Mention timestamps in natural language (“Around 1:12…”)

---

## 11) ElevenLabs Integration

### 11.1 STT — Scribe v2

* Upload extracted audio file
* Request timestamps (if supported)
* Store transcript segments

Fallback:

* If STT fails: compute deck-only feedback and show an error for speech module

### 11.2 TTS

Generate two clips:

1. Encouraging coach summary
2. Strict investor top 3 fixes

Keep scripts short (<= 900 chars each).

Store mp3 back into Spaces and return signed GET URLs or proxy via backend.

---

## 12) DigitalOcean Spaces Presigned URL Implementation

### 12.1 PUT Presign

* Use boto3 `generate_presigned_url('put_object', ...)`
* Include `ContentType`
* Expiry 15 minutes

### 12.2 GET for clips/results (optional)

Either:

* Provide presigned GET URLs for mp3 assets
  OR
* Proxy through backend endpoint that streams from Spaces

For hackathon speed, use presigned GET.

---

## 13) Data Retention & Cleanup

### 13.1 Policy

* Raw objects under `raw/...` deleted after `DATA_RETENTION_HOURS` (default 12)
* Derived clips may persist for the same retention window
* Results JSON:

  * keep for demo duration; optional deletion after 24h

### 13.2 Cleanup Job

Worker or cron-like loop runs every hour:

* list jobs older than retention
* delete raw keys and derived assets
* update result retention fields

---

## 14) Frontend Implementation Details

### 14.1 Components

* `UploadDeckCard`
* `RecordPitchCard`
* `UploadPitchCard`
* `AnalyzeButton`
* `ProcessingScreen`
* `VideoPlayerWithTimeline`
* `TranscriptPanel`
* `SummaryPanel`
* `VoiceCoachPlayer` (orb UI)
* `BrainRotCarousel`

### 14.2 State Model

* `sessionId` from localStorage
* `deckUploadState`
* `videoUploadState`
* `jobState` (status/progress/result)

### 14.3 Upload Flow

1. Create job first (optional approach) OR presign temp keys
2. For each file:

   * `POST /uploads/presign`
   * `PUT` file blob to `putUrl`
3. `POST /jobs` with deckKey + videoKey
4. Navigate to `/job/:jobId` and poll

---

## 15) Step-by-Step Build Plan (Assigned Tasks)

### Phase 1 — Skeleton (2–4 hours)

* Backend:

  * Create FastAPI app
  * Implement `/health`, CORS, session header handling
  * Implement SQLite DB + jobs table
* Frontend:

  * Vite + Tailwind + routes
  * Landing + New Pitch page stubs

### Phase 2 — Upload Infrastructure (4–6 hours)

* Backend:

  * Implement `/uploads/presign` (PUT)
  * Implement `/jobs` create + `/jobs/{id}` status
* Frontend:

  * PDF upload + video record/upload
  * Direct PUT to Spaces via presigned URLs
  * Create job + poll status

### Phase 3 — Worker & STT (6–10 hours)

* Worker:

  * Poll queued jobs
  * Download video from Spaces
  * Extract audio via ffmpeg
  * Call ElevenLabs Scribe v2 STT
  * Save transcript, compute basic metrics
  * Persist partial result

### Phase 4 — Deck Analysis + Gemini (8–12 hours)

* Render PDF slides to images (server-side) OR extract text
* Gemini deck critique prompt
* Coaching synthesis prompt merges:

  * deck fixes
  * transcript + metrics
  * events

### Phase 5 — Dashboard UI (8–12 hours)

* Render:

  * video player
  * timeline markers
  * transcript click-to-seek
  * summary cards and scores

### Phase 6 — TTS Personas + Polish (4–8 hours)

* Generate two coaching scripts
* ElevenLabs TTS → upload mp3 to Spaces
* Orb UI playback
* Brain rot loading + progress indicator

### Phase 7 — Deployment (2–4 hours)

* DigitalOcean droplet/app platform
* Configure env vars
* Set CORS and bucket settings
* Point .tech domain

---

## 16) Acceptance Criteria (Demo-Ready)

MVP is complete when:

* User can upload **PDF** and record/upload video
* App shows processing screen with progress
* Results page shows:

  * transcript with timestamps (click seeks video)
  * 8–15 timeline events
  * deck feedback summary + per-slide notes
  * two voice coaching clips playable
* No request timeouts during analysis (async job works)
* Raw uploads delete automatically within retention window OR at least the policy is enforced manually by cleanup script

---

## 17) Known Shortcuts Allowed (Hackathon Pragmatism)

* Store results JSON only in DB (no results in Spaces)
* Limit slide rendering to first 10–15 pages
* If slide images are hard: do text-only deck critique
* If word-level timestamps unavailable: sentence-level timestamps acceptable

---

If you want, I can also generate:

* the exact FastAPI Pydantic models and endpoint stubs,
* a worker `process_job(jobId)` skeleton,
* and a minimal React UI scaffold with the components above.

Just say “generate starter code for backend + worker + frontend skeleton” and tell me whether you prefer **job-first** (create jobId before presigning) or **temp-key-first** uploads.
