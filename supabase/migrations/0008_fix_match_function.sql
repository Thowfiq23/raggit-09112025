-- Fix match_code_chunks to use repo_chunks table instead of code_chunks

DROP FUNCTION IF EXISTS match_code_chunks(vector(1024), uuid, float, int);

CREATE FUNCTION match_code_chunks(
  query_embedding vector(1024),
  match_repo_id uuid,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id bigint,
  repo_id uuid,
  file_path text,
  chunk_content text,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id,
    rc.repo_id,
    rc.file_path,
    rc.chunk_content,
    1 - (rc.embedding <=> query_embedding) as similarity
  FROM
    repo_chunks rc
  WHERE
    rc.repo_id = match_repo_id
    AND 1 - (rc.embedding <=> query_embedding) > match_threshold
  ORDER BY
    rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
