-- Add MessageType enum and message_type / report_ref columns to messages table.

CREATE TYPE "MessageType" AS ENUM ('TEXT', 'REPORT');

ALTER TABLE "messages"
  ADD COLUMN "message_type" "MessageType" NOT NULL DEFAULT 'TEXT';

ALTER TABLE "messages"
  ADD COLUMN "report_ref" TEXT;
