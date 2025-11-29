## RagGit Scale-Up Plan

### 0. Executive Summary: Locked-In Architecture

The architecture is fixed—the `scale-up` branch layers the async ingestion, hybrid RAG, and Groq streaming on top of the existing stack without touching `main`.

| Component | Service | Tier | Role |
| --- | --- | --- | --- |
| Frontend | Next.js 14/15 (App Router) | — | UI, Codespaces development |
| API Gateway | Vercel (future) / Next dev server | Hobby Free | `/api/process-repo`, `/api/chat` |
| Job Queue | Supabase pgmq | Free | Durable ingestion queue |
| Worker | Supabase Edge Function | Free (150s+) | Long-running repo processing |
| Database | Supabase PostgreSQL | Free | `repositories`, `repo_chunks`, `chat_sessions`, `chat_messages` |
| Vector Store | Supabase pgvector | Free | `VECTOR(1024)` embeddings in `repo_chunks` |
| FTS | PostgreSQL `tsvector` | Free | `content_ts` column for keyword search |
| Embeddings | Jina Embeddings V3 | Free (10M tokens/no CC) | `retrieval.passage` for ingestion, `retrieval.query` for chat |
| LLM | Groq API | Free | `mixtral-8x7b-32768` with structured JSON output |
| Code Parsing | tree-sitter | Open-source | AST-based chunks (functions/classes) |

**Goals**: solve the Vercel timeout via async ingestion, deliver Hybrid RAG (pgvector + FTS + RRF), enforce Groq JSON schema, polish UX with statuses/streaming, and tell a resume-grade story while staying on free tiers.

### 1. Async Ingestion Pipeline

#### 1.1 Problem → Solution

The current `main` route performs cloning, tree-sitter parsing, Jina embeddings, and inserts inside the request. The total time easily exceeds 60 seconds, so the function fails. The scale-up architecture refactors this into a fast `/api/process-repo` that enqueues a pgmq job and a Supabase Edge Function worker (`repo-processor`) that does the heavy lifting with a 150s+ timeout.

#### 1.2 `/api/process-repo`
1. Validate GitHub URL (`https://github.com/owner/repo`), normalize, strip `.git`, reject invalid/private repos.
2. Insert a row into `repositories` (`status = 'PENDING'`, `owner_id`, timestamps). Use the server-side Supabase client with `SUPABASE_SERVICE_ROLE_KEY`.
3. Call `pgmq_send` to enqueue `{ repository_id, repo_url, created_at }` on queue `repo_processing`.
4. Return `HTTP 202 Accepted` with `{ repository_id, status: 'PENDING', message: 'Queued for processing' }`.
5. If queue fails, update `status = 'FAILED'` and return `500`.

#### 1.3 `repo-processor` Edge Function
1. Dequeue jobs (`pgmq_read`, `vt=300`).
2. Mark `repositories.status = 'PROCESSING'`, set `processing_started_at`.
3. Fetch GitHub tree (Octokit), filter code files (<1MB saves). 
4. Use tree-sitter per language to extract `function_declaration`, `class_declaration`, `method_definition`, etc.
5. Split large semantic chunks (>256-512 tokens) by line while keeping metadata.
6. Batch embeddings via Jina `retrieval.passage` (dimensions 1024) and `response.data[].embedding`.
7. Insert chunks into `repo_chunks` (batch size ~100) with `embedding`, `content_ts` (generated column), `function_name`, `start_line`, `end_line`, `language`.
8. On success update `status = 'COMPLETED'`, `chunk_count`, `processing_completed_at`; on failure `status = 'FAILED'`, `error_message`.
9. Ack queue messages on success (`pgmq_ack`); leave them for retry on transient errors.

### 2. Hybrid Retrieval + Groq

#### 2.1 `match_code_chunks` RPC
Fuses pgvector semantic search and PostgreSQL FTS using Reciprocal Rank Fusion (RRF):
1. Semantic `vector_search`: `(embedding <=> query_embedding)` ranks.
2. Full-text `fulltext_search`: `content_ts @@ plainto_tsquery('simple', query_text)`.
3. `rrf_scores`: full outer join + `score = 1/(60+vec_rank) + 1/(60+fts_rank)`.
4. Filter by threshold (0.3) and limit to `match_count`.

#### 2.2 `/api/chat`
1. Accept `{ repository_id, query, session_id? }`.
2. Embed query using Jina `retrieval.query` (dimensions 1024) for intent-focused embeddings.
3. Call `match_code_chunks` with embeddings + text.
4. Build context from retrieved chunks (file path, function, code). Limit to top 6–8 chunks.
5. Call Groq streaming completions: system prompt enforces the assistant to cite file paths and include only `{ answer, citations[] }` via `response_format` JSON schema.
6. Stream tokens back as `ReadableStream`, accumulate buffer, parse final JSON.
7. Persist chat history: insert into `chat_sessions` and `chat_messages` (user + assistant entries). `citations` stored as text array.

### 3. UI/UX Polish

#### 3.1 `RepoInputForm`
- Show loading, success, and error states.
- After `202`, display “Queued for background processing. Check the list below.”
- Encourage users to monitor statuses.

#### 3.2 `RepoList`
- Fetch additional metadata (`chunk_count`, `processing_started_at`, `processing_completed_at`, `error_message`).
- Render status badges (gray pending, blue processing with pulse, green completed, red failed) and metrics.
- Provide CTAs: “Open Chat” for completed repos and “View context preview” if needed.
- Optionally subscribe to Supabase realtime channel for live status updates.

#### 3.3 `app/chat/[id]/page.tsx`
- Stream Groq response (typing indicator, progressive text). Accumulate buffer until valid JSON is parsed, then update assistant message and citations.
- Render citations list beneath answers with file paths.
- Optional context filters (language, folder) or chunk limit slider; use Zustand or similar to avoid re-rendering entire chat on filter updates.

### 4. Supabase + CI Guardrails

#### 4.1 Migration SQL (`supabase/migrations/0001_initial_scale_up_schema.sql`)
Include: enable `vector` & `pgmq` extensions; create tables (`repositories`, `repo_chunks`, `chat_sessions`, `chat_messages`); RLS policies (owner access); indexes (status, repo id, embedding HNSW, FTS GIN); create queue `pgmq.create('repo_processing')`.

#### 4.2 GitHub Action
`.github/workflows/push-supabase-migrations.yml`: triggered on `main` pushes to `supabase/migrations/**`, links Supabase project, runs `supabase db push`. `scale-up` runs `supabase db diff` locally; only merge once migrations validated.

### 5. Free-Tier Constraints & Strategy

| Resource | Limit | Strategy |
| --- | --- | --- |
| Supabase DB | 500MB | 2–3 repos fit; clean old repos if needed; monitor storage. |
| Edge Functions | 1K/day | Each repo ~5 minutes; stay under limit. |
| pgmq | unlimited | Use retries; don’t ack if transient. |
| Jina | 10M tokens/month | Keep chunks ≤ 512 tokens; batch 64–128 embeddings; use asymmetric encoder. |
| Groq | generous free tier | JSON schema reduces token waste; keep prompts compact. |

### 6. Execution Timeline (7 Days)

| Day | Task | Deliverable |
| --- | --- | --- |
| 1 | Finalize `docs/scale-up-plan.md`, refactor `/api/process-repo` to enqueue jobs | API returns `202`, jobs land in `pgmq`. |
| 2–3 | Build `repo-processor` Edge Function (tree-sitter + Jina) | Worker processes repo, chunks land in DB. |
| 4 | Harden `/api/chat` (match_code_chunks + Groq schema + streaming) | Chat returns structured `{ answer, citations }`. |
| 5 | Polish UI (status badges, queue hints, streaming chat) | Interactive UI. |
| 6 | Test 2–3 repos, log ingestion/query metrics | Performance metrics documented. |
| 7 | Update README, architecture notes, prep PR | Scale-up merge-ready. |

### 7. Success Metrics

- API returns `202` in <100ms; worker processes large repo without timeout.
- Hybrid recovery yields accurate citations from both vector + FTS.
- Groq responses always conform to JSON schema.
- UI shows status progression, streaming text, clickable citations.
- Entire stack runs on free tiers; documentation explains support strategy.
- CI/migrations documented via GitHub Actions.

### 8. Summary

Implement order:
1. Document plan (`docs/scale-up-plan.md`).
2. Refactor `/api/process-repo` to enqueue jobs.
3. Build Supabase Edge Function worker.
4. Strengthen `/api/chat` with hybrid retrieval + Groq.
5. Polish UI components.
6. Test several repos.
7. Merge into `main` once stable.

Keep all Supabase changes scoped to this branch’s dedicated project; apply them via CLI (SQL migrations, edge function deployment) so `main` stays untouched.