import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'

// 1. Create the Supabase ADMIN client
// This uses the SECRET service_role key and must ONLY be used on the server.
// Prefer SCALEUP_ variables if available
const supabaseUrl = process.env.SCALEUP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SCALEUP_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    // We tell it not to save a session, as this is for server-to-server calls.
    persistSession: false
  }
})

// 2. Create the Groq client
// This uses the SECRET Groq key and must ONLY be used on the server.
export const groq = new Groq({
  apiKey: process.env.SCALEUP_GROQ_API_KEY || process.env.GROQ_API_KEY
})