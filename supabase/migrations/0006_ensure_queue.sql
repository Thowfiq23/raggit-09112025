-- Ensure the queue exists using the official list_queues check
DO $$
DECLARE
    q_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pgmq.list_queues() WHERE queue_name = 'repo_sync_queue'
    ) INTO q_exists;

    IF NOT q_exists THEN
        PERFORM pgmq.create('repo_sync_queue');
    END IF;
END $$;
