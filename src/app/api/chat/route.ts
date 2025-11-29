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

    const JINA_API_KEY = process.env.SCALEUP_JINA_API_KEY || process.env.JINA_API_KEY;
    if (!JINA_API_KEY) {
      throw new Error('JINA_API_KEY environment variable is not set');
    }

    // Step 1: Embed the user's query using Jina v3 (Asymmetric)
    const embeddingResponse = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${JINA_API_KEY}`,
      },
      body: JSON.stringify({
        input: [query],
        model: 'jina-embeddings-v3',
        task: 'retrieval.query' // Optimized for query embedding
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

    // Step 2: Find relevant context in Supabase
    const { data: matchingChunksRaw, error: matchError } = await supabaseAdmin.rpc('match_code_chunks', {
      query_embedding: queryEmbedding,
      match_repo_id: repoId, // Filter by repo
      match_threshold: 0.0,  // Low threshold to ensure results (cosine similarity can be low for code)
      match_count: 10,       // Top 10 chunks
    });

    if (matchError) {
      console.warn('Supabase match error (falling back to no-context):', matchError);
    }

    const matchingChunks = Array.isArray(matchingChunksRaw) ? matchingChunksRaw : [];

    // Step 3: Format context for AI
    let context = '';
    if (matchingChunks.length > 0) {
      matchingChunks.forEach((chunk: any) => {
        const content = chunk.chunk_content ?? chunk.content ?? '';
        context += `---\nFile: ${chunk.file_path}\n\n${content}\n---\n\n`;
      });
    } else {
      context = 'No relevant code context was found in the repository for this question.';
    }

    // Step 4: Call Groq AI with Structured Output (JSON Schema)
    // We want a structured answer with: answer, relevant_files (array), confidence_score
    const systemPrompt = `You are an expert code assistant. Use the provided code context to answer the user's question.
    
    You must respond in JSON format with the following structure:
    {
      "answer": "Your detailed answer here in Markdown format",
      "relevant_files": ["file/path/1", "file/path/2"],
      "confidence_score": 0.95
    }

    Context:
    ${context}
    `;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: "json_object" }
    });

    // Step 5: Parse Groq response
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response generated from Groq AI');
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content);
    } catch (e) {
      // Fallback if JSON parsing fails
      parsedResponse = {
        answer: content,
        relevant_files: [],
        confidence_score: 0
      };
    }

    return NextResponse.json({
      answer: parsedResponse.answer,
      sources: matchingChunks.map((chunk: any) => ({
        file_path: chunk.file_path,
        chunk_index: chunk.chunk_index,
        content: chunk.content ?? chunk.chunk_content ?? ''
      })),
      relevant_files: parsedResponse.relevant_files,
      confidence_score: parsedResponse.confidence_score ?? null
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

