import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/serverClients';

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
        github_url: repoUrl,
        owner,
        repo_name,
        status: 'pending'
      })
      .select('id')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create repository record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      repoId: data.id,
      status: 'pending'
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}