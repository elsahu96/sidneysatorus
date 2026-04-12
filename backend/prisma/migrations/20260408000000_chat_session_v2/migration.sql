-- Chat Session V2: add user link, sliding-window JSONB cache, blob pointer
-- Messages get a real FK to chat_sessions and a token_count column.

-- ── chat_sessions ─────────────────────────────────────────────────────────────

-- New metadata columns
ALTER TABLE "chat_sessions" ADD COLUMN "user_id"        TEXT;
ALTER TABLE "chat_sessions" ADD COLUMN "title"          TEXT NOT NULL DEFAULT '';
ALTER TABLE "chat_sessions" ADD COLUMN "summary"        TEXT;
ALTER TABLE "chat_sessions" ADD COLUMN "context_window" JSONB;
ALTER TABLE "chat_sessions" ADD COLUMN "blob_pointer"   TEXT;

-- Drop the old denormalised messages array
ALTER TABLE "chat_sessions" DROP COLUMN IF EXISTS "messages";

-- FK to users (nullable: sessions created before auth are preserved)
ALTER TABLE "chat_sessions"
  ADD CONSTRAINT "chat_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for per-user session listing
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions"("user_id");

-- ── messages ──────────────────────────────────────────────────────────────────

-- Token tracking
ALTER TABLE "messages" ADD COLUMN "token_count" INTEGER;

-- Proper FK — orphaned rows (chatSessionId not in chat_sessions) must be cleaned
-- first, otherwise the constraint will fail.
DELETE FROM "messages"
WHERE "chatSessionId" NOT IN (SELECT "id" FROM "chat_sessions");

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_chatSessionId_fkey"
  FOREIGN KEY ("chatSessionId") REFERENCES "chat_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
