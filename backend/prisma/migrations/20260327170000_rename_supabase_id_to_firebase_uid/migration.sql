-- Rename supabase_id to firebase_uid on users table
ALTER TABLE "users" RENAME COLUMN "supabase_id" TO "firebase_uid";

-- Update the unique index name for clarity
DROP INDEX IF EXISTS "users_supabase_id_key";
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");
