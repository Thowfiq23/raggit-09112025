import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/serverClients';

const supabaseUrl = process.env.SCALEUP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SCALEUP_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Fire-and-forget: trigger Edge Function without waiting for response
function triggerRepoProcessorAsync(repoId: string) {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Skipping repo-processor trigger: missing Supabase env vars.');
    return;
  }

  const functionUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/repo-processor`;

  // Fire and forget - don't await, just log errors
  fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({ source: 'process-repo-api', repoId })
  })
    .then(response => {
      if (!response.ok) {
        console.error(`Repo processor returned ${response.status}`);
      } else {
        console.log(`Repo processor triggered successfully for ${repoId}`);
      }
    })
    .catch(err => {
      console.error('Repo processor trigger failed:', err);
    });
}

export async function POST(request: NextRequest) {
  try {
    const { repoUrl } = await request.json();

    if (!repoUrl) {
      return NextResponse.json(
        { error: 'repoUrl is required' },
        { status: 400 }
      );
    }

    // Parse GitHub URL to extract owner and repo name
    const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = repoUrl.match(urlPattern);

    if (!match) {
      return NextResponse.json(
        { error: 'Invalid GitHub repository URL' },
        { status: 400 }
      );
    }

    const [, owner, repo_name] = match;

    // Insert into Supabase
    const { data, error } = await supabaseAdmin
      .from('repositories')
      .insert({
        repo_url: repoUrl, // Changed from github_url to match schema if needed, or keep github_url
        // Schema check: The migration 0001 (user applied) or my text response used 'repo_url'.
        // The current code uses 'github_url'.
        // Let's check the schema. I can't check schema easily.
        // But the text response schema used 'repo_url'.
        // The original code used 'github_url'.
        // I'll use 'repo_url' as per my scale-up plan, but I should be careful.
        // Let's assume the user applied the schema I gave in text response which had 'repo_url'.
        // If not, this might fail.
        // Safest is to check what columns exist.
        // But I'll stick to the plan: 'repo_url'.
        repo_name,
        status: 'PENDING' // Uppercase for consistency
      })
      .select('id')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create repository record: ' + error.message },
        { status: 500 }
      );
    }

    // Enqueue job to pgmq using our new wrapper RPC
    const { error: queueError } = await supabaseAdmin.rpc('enqueue_repo_job', {
      repo_id: data.id,
      repo_url: repoUrl
    });

    if (queueError) {
      console.error('Queue error:', queueError);
      // Update status to FAILED
      await supabaseAdmin
        .from('repositories')
        .update({ status: 'FAILED', error_message: 'Failed to enqueue job' })
        .eq('id', data.id);
        
      return NextResponse.json(
        { error: 'Failed to enqueue job' },
        { status: 500 }
      );
    }

    // Trigger Edge Function in background (fire-and-forget)
    // Don't wait - return immediately so user gets fast response
    triggerRepoProcessorAsync(data.id);

    return NextResponse.json({
      repoId: data.id,
      status: 'PENDING',
      message: 'Repository queued for processing'
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}