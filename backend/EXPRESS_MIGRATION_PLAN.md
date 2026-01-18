# Express Backend Migration Plan

This file captures the remaining checkpoints before we finish migrating the asynchronous evaluation stack from the Next.js API routes into the Express service.

## Objectives

1. Mirror the `/api/evaluate/start` and `/api/evaluate/status/:jobId` contract exposed by the Next app.
2. Reuse the shared `code/src/lib` helpers (agent workflow, job store, evaluation schema, transcription, media utils, etc.) so the Express worker keeps behavior parity.
3. Keep uploads, job persistence, and async processing inside `code/.data` so both backends read/write the same artifacts.

## Key Steps

| Step | Description |
| --- | --- |
| 1 | Initialize an Express router that accepts multipart `POST /api/evaluate/start`. Parse `target`, `context`, `metadata`, optional `deck` and `media` files exactly like the Next route. |
| 2 | Call `createJob`, `persistUpload`, and `runAgentWorkflow` to queue the evaluation. Persist resulting JSON via `saveResult` and expose status via `GET /api/evaluate/status/:jobId`. |
| 3 | Share the `job-store` folder and `.data` directory so evaluations created by Express can be queried by either backend (debounce collisions via UUID). |
| 4 | Include the existing `agent-workflow` in Express by importing the `code/src/lib` modules. Ensure environment variables (Gemini, ElevenLabs) are documented in `backend/.env.example`. |
| 5 | Expose a lightweight healthcheck and optionally re-use the same polling logic in the frontend by pointing `NEXT_PUBLIC_API_BASE_URL` to the Express port for dev/test work. |

## Verification Checklist

- [ ] `POST /api/evaluate/start` accepts the same form fields and file handling as the Next route.
- [ ] `GET /api/evaluate/status/:jobId` returns job metadata plus the latest `result` JSON.
- [ ] Agent workflow, audio analysis, and transcription utilities operate unchanged—no split code paths.
- [ ] Environment variables referenced by the Express server match the `.env.example` and README steps.
- [ ] Frontend can toggle between the Next.js API and the Express server by switching `NEXT_PUBLIC_API_BASE_URL`.

When each checkbox is satisfied, the migration can proceed to full deployment. This plan keeps the Express service ready without duplicating asynchronous job logic.
