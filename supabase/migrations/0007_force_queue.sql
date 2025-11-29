-- Force creation of queue with error handling
DO $$
BEGIN
  -- Try to create the queue
  PERFORM pgmq.create('repo_sync_queue');
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the migration
  RAISE NOTICE 'Queue creation attempt failed (likely exists): %', SQLERRM;
END;
$$;
