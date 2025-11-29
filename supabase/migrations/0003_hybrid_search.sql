-- Hybrid Search Function using pgvector
-- Corrected to include repo_id filtering

CREATE OR REPLACE FUNCTION match_code_chunks(
  query_embedding vector(1024),
  match_repo_id uuid,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id bigint,
  repo_id uuid,
  file_path text,
  chunk_index int,
  content text,
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
    rc.chunk_index,
    rc.content,
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
