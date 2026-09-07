import { createClient } from '@supabase/supabase-js'

// ✅ Hardcoded fallback — Cloudflare static Worker mein env vars add nahi ho sakte
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://eqqkoqulvgxuvwwwjjvd.supabase.co'

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcWtvcXVsdmd4dXZ3d3dqanZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTU3MDQsImV4cCI6MjEwMzU3MTcwNH0.7ti283ARXlIhBp2efWahMJw77jd7wDtt_pXdElGCS7M'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)