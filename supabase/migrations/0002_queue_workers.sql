-- RPC to pop a job from the queue
-- This wraps the pgmq.pop function to be accessible securely
CREATE OR REPLACE FUNCTION pop_repo_job()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_record record;
BEGIN
  -- Pop 1 message from the 'repo_sync_queue'
  SELECT * INTO job_record FROM pgmq.pop('repo_sync_queue');
  
  IF job_record IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN row_to_json(job_record);
END;
$$;

-- RPC to delete a job (archive/delete)
CREATE OR REPLACE FUNCTION delete_repo_job(msg_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM pgmq.delete('repo_sync_queue', msg_id);
END;
$$;

-- Grant execute permissions to service_role (used by Edge Function)
GRANT EXECUTE ON FUNCTION pop_repo_job() TO service_role;
GRANT EXECUTE ON FUNCTION delete_repo_job(bigint) TO service_role;
