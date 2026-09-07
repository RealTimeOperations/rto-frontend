import { createClient } from '@supabase/supabase-js'

// Supabase client initialized from environment variables
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)