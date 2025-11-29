// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Declare Deno global for TypeScript tooling outside the Edge runtime
declare const Deno: any

// Environment variables
const SUPABASE_URL = Deno.env.get('SCALEUP_SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SCALEUP_SUPABASE_SERVICE_ROLE_KEY')!
const JINA_API_KEY = Deno.env.get('SCALEUP_JINA_API_KEY')!

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Jina Embeddings Configuration
const JINA_API_URL = 'https://api.jina.ai/v1/embeddings'

interface Job {
  msg_id: number
  read_ct: number
  enqueued_at: string
  vt: string
  message: {
    repo_id: string
    repo_url: string
  }
}

Deno.serve(async (req) => {
  let currentRepoId: string | null = null
  let currentMsgId: number | null = null
  // 1. Security Check (Optional: verify Authorization header if triggered via HTTP)
  // For cron/internal triggers, we might skip strict auth or check a shared secret.

  try {
    console.log('Worker started. Checking for jobs...')

    // 2. Pop a job from the queue
    // We use the RPC wrapper or direct pgmq query if exposed via API.
    // Since pgmq is SQL-based, we use rpc() to call the pgmq extension functions.
    // Note: 'pgmq' schema functions might not be directly exposed via PostgREST unless configured.
    // A common pattern is to wrap pgmq.pop in a public RPC function.
    // Assuming we have a wrapper or direct access. Let's try a direct SQL query via rpc if available,
    // or assume the user set up the 'pop_job' RPC as per common pgmq patterns.
    // If not, we might need to use the raw SQL query via supabase-js if enabled, but RPC is safer.
    
    // Let's assume a helper RPC 'pop_repo_job' exists or we use the raw pgmq function if accessible.
    // For this implementation, I'll use a direct RPC call to a wrapper function we should have created.
    // If it doesn't exist, we'll fail. But wait, the user ran the SQL.
    // The SQL provided in the plan didn't explicitly create a 'pop_repo_job' RPC wrapper.
    // It enabled the extension.
    // Let's try to call 'pgmq.pop' directly via rpc if possible, but usually cross-schema calls are tricky.
    // BETTER APPROACH: We'll use the `pgmq` schema functions directly if the client has permissions.
    // However, supabase-js `rpc` calls public schema functions by default.
    
    // Let's assume we need to create a quick wrapper or use a raw query.
    // Since I can't run SQL right now to create a wrapper, I will try to use the `pgmq_public` wrapper if it exists,
    // or I will simulate the pop by selecting from the queue table directly (not ideal for concurrency).
    
    // WAIT: The standard way to use pgmq with Supabase JS is often via a wrapper function.
    // Let's assume for this "Resume Grade" project we want to be robust.
    // I will implement the worker to call a specific RPC `get_next_repo_job`.
    // I will assume this RPC exists or I will handle the error.
    // Actually, to be safe, I'll implement the logic to fetch the job using a direct SQL query if I can,
    // but supabase-js doesn't allow raw SQL.
    
    // Let's try to call the pgmq function directly.
    // `supabase.rpc('pgmq.pop', { queue_name: 'repo_sync_queue' })` - this often fails due to schema search path.
    
    // FALLBACK STRATEGY:
    // I will assume the user ran the SQL I provided.
    // I will add a step to the plan to create this RPC wrapper if it fails.
    // For now, let's write the code assuming an RPC `pop_repo_job` exists.
    // I will also provide the SQL for this RPC in the next step to be sure.
    
    const { data: jobData, error: jobError } = await supabase
      .rpc('pop_repo_job') // We will define this RPC next

    if (jobError) {
      // If RPC missing, log it.
      console.error('Error popping job (RPC might be missing):', jobError)
      return new Response(JSON.stringify({ error: jobError.message }), { status: 500 })
    }

    console.log('Raw job payload:', jobData)

    if (!jobData) {
      console.log('No jobs in queue.')
      return new Response(JSON.stringify({ message: 'No jobs found' }), { status: 200 })
    }

    const job = jobData as Job
    if (!job?.message) {
      throw new Error(`Job payload missing message: ${JSON.stringify(jobData)}`)
    }
    const jobMessage = typeof job.message === 'string' ? JSON.parse(job.message) : job.message
    const { repo_id, repo_url } = jobMessage
    if (!repo_id || !repo_url) {
      throw new Error(`Job payload missing repo fields: ${JSON.stringify(jobMessage)}`)
    }
    const msg_id = job.msg_id
    currentRepoId = repo_id
    currentMsgId = msg_id

    console.log(`Processing Job ${msg_id}: ${repo_url}`)

    // 3. Update Status to PROCESSING
    await supabase
      .from('repositories')
      .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
      .eq('id', repo_id)

    // 4. Fetch GitHub Content
    // Simple fetch for now. For large repos, we'd need a recursive tree fetch.
    // We'll use the GitHub API to get the file tree.
    if (!repo_url?.startsWith('https://github.com/')) {
      throw new Error(`Invalid repo_url received: ${repo_url}`)
    }

    const ownerRepo = repo_url.replace('https://github.com/', '').replace(/\.git$/, '')
    const [owner, repo] = ownerRepo.split('/')
    
    // Get the default branch (usually main or master)
    // We'll just try to fetch the tree recursively.
    // Note: GitHub API has rate limits. For a demo, unauthenticated is low (60/hr).
    // We should ideally use a GITHUB_TOKEN if available.
    const ghToken = Deno.env.get('GITHUB_TOKEN')
    const githubHeaders: Record<string, string> = { 'User-Agent': 'Raggit-Worker' }
    if (ghToken) {
      githubHeaders.Authorization = `Bearer ${ghToken}`
    }

    // Resolve the default branch first so we can support repos that still use master or custom names
    const repoMetaResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: githubHeaders
    })
    if (!repoMetaResp.ok) {
      throw new Error(`Failed to fetch repo metadata: ${repoMetaResp.statusText}`)
    }
    const repoMeta = await repoMetaResp.json()
    const branchCandidates = Array.from(new Set([
      repoMeta?.default_branch,
      'main',
      'master'
    ].filter(Boolean)))

    let treeData: any = null
    let lastTreeError: string | undefined
    for (const branch of branchCandidates) {
      const treeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
        headers: githubHeaders
      })
      if (treeResp.ok) {
        treeData = await treeResp.json()
        break
      }
      lastTreeError = `${treeResp.status} ${treeResp.statusText}`
    }

    if (!treeData) {
      throw new Error(`Failed to fetch repo tree (branches tried: ${branchCandidates.join(', ')}). Last error: ${lastTreeError}`)
    }
    const files = treeData.tree.filter((f: any) => f.type === 'blob' && isCodeFile(f.path))

    console.log(`Found ${files.length} code files.`)

    // 5. Process Files & Generate Embeddings
    let processedCount = 0
    
    for (const file of files) {
      // Fetch file content
      const fileUrl = file.url // API URL for blob
      const fileResp = await fetch(fileUrl, { headers: githubHeaders })
      const fileJson = await fileResp.json()
      
      // Content is base64 encoded
      const content = atob(fileJson.content.replace(/\n/g, ''))
      
      // Chunking (Simple Regex Split by double newline or max chars)
      const chunks = chunkText(content, 1000)

      // Generate Embeddings for chunks
      // Jina AI supports batching. Let's batch per file for simplicity.
      if (chunks.length > 0) {
        const embeddingResp = await fetch(JINA_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${JINA_API_KEY}`
          },
          body: JSON.stringify({
            model: 'jina-embeddings-v3',
            task: 'retrieval.passage', // Asymmetric embedding for storage
            input: chunks
          })
        })

        if (!embeddingResp.ok) {
            console.error(`Jina API Error: ${await embeddingResp.text()}`)
            continue
        }

        const embeddingData = await embeddingResp.json()
        
        // Prepare rows for insertion
        const rows = chunks.map((chunk, idx) => ({
          repo_id: repo_id,
          file_path: file.path,
          chunk_content: chunk,
          embedding: embeddingData.data[idx].embedding
        }))

        // Insert into Supabase
        const { error: insertError } = await supabase
          .from('repo_chunks')
          .insert(rows)

        if (insertError) {
          console.error('Error inserting chunks:', insertError)
        } else {
          processedCount += rows.length
        }
      }
    }

    // 6. Mark Job Complete & Delete from Queue
    // Delete message from queue
    await supabase.rpc('delete_repo_job', { msg_id })

    // Update Repo Status
    await supabase
      .from('repositories')
      .update({ status: 'COMPLETED', updated_at: new Date().toISOString(), chunk_count: processedCount })
      .eq('id', repo_id)

    console.log(`Job ${msg_id} completed. Processed ${processedCount} files.`)

    return new Response(JSON.stringify({ success: true, processed: processedCount }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('Worker Error:', err)
    
    // Try to update status to FAILED
    // We might not have the repo_id easily if it failed early, but let's try if we have the job.
    // (Skipping complex error recovery for brevity)

    if (currentRepoId) {
      await supabase
        .from('repositories')
        .update({ status: 'FAILED', error_message: err.message, updated_at: new Date().toISOString() })
        .eq('id', currentRepoId)
    }

    if (currentMsgId) {
      await supabase.rpc('delete_repo_job', { msg_id: currentMsgId })
    }

    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})

// --- Helpers ---

function isCodeFile(path: string): boolean {
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.md', '.go', '.rs', '.java', '.c', '.cpp', '.h']
  return extensions.some(ext => path.endsWith(ext))
}

function chunkText(text: string, maxChars: number): string[] {
  const chunks: string[] = []
  let currentChunk = ''
  
  const lines = text.split('\n')
  
  for (const line of lines) {
    if ((currentChunk + line).length > maxChars) {
      chunks.push(currentChunk)
      currentChunk = line + '\n'
    } else {
      currentChunk += line + '\n'
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk)
  }
  
  return chunks
}
