-- Wrapper for pgmq.send to be accessible via Supabase RPC
CREATE OR REPLACE FUNCTION enqueue_repo_job(repo_id uuid, repo_url text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  msg_id bigint;
BEGIN
  -- Send message to 'repo_sync_queue'
  -- We construct the message payload here
  SELECT * INTO msg_id FROM pgmq.send(
    'repo_sync_queue',
    jsonb_build_object(
      'repo_id', repo_id,
      'repo_url', repo_url,
      'created_at', now()
    )
  );
  
  RETURN json_build_object('msg_id', msg_id);
END;
$$;

-- Grant execute to service_role (and anon if needed, but usually service_role for ingestion)
GRANT EXECUTE ON FUNCTION enqueue_repo_job(uuid, text) TO service_role;
