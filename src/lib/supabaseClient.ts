import { createClient } from '@supabase/supabase-js'

// IMPORTANT: Prefer SCALEUP_* variables (the active project with data)
// over NEXT_PUBLIC_* which may point to an old/different project.
// The next.config.ts maps SCALEUP_* to NEXT_PUBLIC_* at build time,
// but if NEXT_PUBLIC_* is already set in the environment, it takes precedence.
const supabaseUrl = process.env.SCALEUP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.SCALEUP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase keys are missing. Ensure SCALEUP_ secrets are set in Codespaces.')
}

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')