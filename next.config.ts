import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    // FORCE override NEXT_PUBLIC_* with SCALEUP_* values
    // This ensures the correct Supabase project is used even if both are set in env
    NEXT_PUBLIC_SUPABASE_URL: process.env.SCALEUP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SCALEUP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    
    // Make sure server-side keys are available to API routes
    SCALEUP_SUPABASE_URL: process.env.SCALEUP_SUPABASE_URL,
    SCALEUP_SUPABASE_SERVICE_ROLE_KEY: process.env.SCALEUP_SUPABASE_SERVICE_ROLE_KEY,
    SCALEUP_GROQ_API_KEY: process.env.SCALEUP_GROQ_API_KEY,
    SCALEUP_JINA_API_KEY: process.env.SCALEUP_JINA_API_KEY,
  },
};

export default nextConfig;
