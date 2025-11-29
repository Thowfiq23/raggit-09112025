-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the queue if it doesn't exist
-- Note: pgmq.create is idempotent-ish (throws if exists usually, but we can wrap it)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgmq.q_repo_sync_queue) THEN
    PERFORM pgmq.create('repo_sync_queue');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if it already exists or race condition
  NULL;
END $$;
