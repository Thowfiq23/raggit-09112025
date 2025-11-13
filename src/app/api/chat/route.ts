import { NextResponse } from 'next/server';
import { supabaseAdmin, groq } from '@/lib/serverClients';

export async function POST(request: Request) {
  try {
    const { repoId, query } = await request.json();

    if (!repoId || !query) {
      return NextResponse.json(
        { error: 'repoId and query are required' },
        { status: 400 }
      );
    }

    const JINA_API_KEY = process.env.JINA_API_KEY;
    if (!JINA_API_KEY) {
      throw new Error('JINA_API_KEY environment variable is not set');
    }

    // Step 1: Embed the user's query (defensive extraction for different Jina response shapes)
    const embeddingResponse = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${JINA_API_KEY}`,
      },
      body: JSON.stringify({
        input: [query],
        model: 'jina-embeddings-v2-base-code',
      }),
    });

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      throw new Error(`Jina API error: ${embeddingResponse.status} - ${errorText}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = Array.isArray(embeddingData?.data)
      ? embeddingData.data[0]?.embedding
      : embeddingData?.data?.embedding;

    if (!queryEmbedding) {
      throw new Error('Failed to extract embedding from Jina response');
    }

    // Step 2: Find relevant context in Supabase (safe fallback when RPC fails)
    const { data: matchingChunksRaw, error: matchError } = await supabaseAdmin.rpc('match_code_chunks', {
      query_embedding: queryEmbedding,
      match_repo_id: repoId,
      match_count: 5,
    });

    if (matchError) {
      console.warn('Supabase match error (falling back to no-context):', matchError);
    }

    const matchingChunks = Array.isArray(matchingChunksRaw) ? matchingChunksRaw : [];

    // Step 3: Format context for AI (fallback message when none found)
    let context = '';
    if (matchingChunks.length > 0) {
      matchingChunks.forEach((chunk: any) => {
        const content = chunk.chunk_content ?? chunk.content ?? '';
        context += `---\nFile: ${chunk.file_path}\n\n${content}\n---\n\n`;
      });
    } else {
      context = 'No relevant code context was found in the repository for this question.';
    }

    // Step 4: Call Groq AI
    const systemPrompt = `You are an expert code assistant. Use the following code context from a GitHub repository to answer the user's question.\n\nIf the answer cannot be found in the provided context, clearly state that.\n\nContext:\n${context}\n\nQuestion: ${query}\n\nPlease provide a helpful answer based on the code context above.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      model: process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant',
      temperature: 0.1,
      max_tokens: 1024,
    });

    // Step 5: Defensive extraction of Groq answer
    const c: any = completion as any;
    const answer =
      c?.choices?.[0]?.message?.content ||
      c?.choices?.[0]?.text ||
      c?.output?.[0]?.content ||
      c?.text ||
      '';

    if (!answer) {
      throw new Error('No response generated from Groq AI');
    }

    // Step 6: Format sources for frontend
    const sources = matchingChunks.map((chunk: any) => ({
      file_path: chunk.file_path,
      chunk_content: chunk.chunk_content ?? chunk.content ?? '',
    }));

    return NextResponse.json({
      answer,
      sources,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        answer: 'I encountered an error while processing your question. Please try again.',
      },
      { status: 500 }
    );
  }
}
