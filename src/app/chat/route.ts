import { NextResponse } from 'next/server';
import { supabaseAdmin, groq } from '../../../lib/serverClients';

export async function POST(request: Request) {
  try {
    const { repoId, query } = await request.json();

    // Validate input
    if (!repoId ||!query) {
      return NextResponse.json(
        { error: 'repoId and query are required' },
        { status: 400 }
      );
    }

    const JINA_API_KEY = process.env.JINA_API_KEY;
    if (!JINA_API_KEY) {
      throw new Error('JINA_API_KEY environment variable is not set');
    }

    // Step 1: Embed the user's query
    const embeddingResponse = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JINA_API_KEY}`,
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
    const queryEmbedding = embeddingData.data.embedding;

    // Step 2: Find relevant context in Supabase
    const { data: matchingChunks, error: matchError } = await supabaseAdmin
     .rpc('match_code_chunks', {
        query_embedding: queryEmbedding,
        repo_id: repoId, // This should be match_repo_id as per your function
        match_count: 5,
      });

    if (matchError) {
      console.error('Supabase match error:', matchError);
      throw new Error(`Failed to find matching code chunks: ${matchError.message}`);
    }

    if (!matchingChunks |

| matchingChunks.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find any relevant code context for this repository to answer your question.",
        sources:
      });
    }

    // Step 3: Format context for AI
    let context = '';
    matchingChunks.forEach((chunk: any) => {
      context += `---\nFile: ${chunk.file_path}\n\n${chunk.chunk_content}\n---\n\n`;
    });

    // Step 4: Call Groq AI
    const systemPrompt = `You are an expert code assistant. Use the following code context from a GitHub repository to answer the user's question. 

If the answer cannot be found in the provided context, clearly state that you don't have enough context to answer accurately.

Context:
${context}

Question: ${query}

Please provide a helpful answer based on the code context above.`;
    
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user', 
          content: query
        }
      ],
      model: 'llama3-8b-8192',
      temperature: 0.1,
      max_tokens: 1024,
    });

    const answer = completion.choices?.message?.content;
    
    if (!answer) {
      throw new Error('No response generated from Groq AI');
    }

    // Format sources from matchingChunks
    const sources = matchingChunks.map((chunk: any) => ({
      file_path: chunk.file_path,
      chunk_content: chunk.chunk_content
    }));

    return NextResponse.json({
      answer,
      sources
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error? error.message : 'Internal server error',
        answer: "I encountered an error while processing your question. Please try again."
      },
      { status: 500 }
    );
  }
}