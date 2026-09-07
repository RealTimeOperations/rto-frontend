import { createClient } from '@supabase/supabase-js'

// ⬇️ Yeh dono values apne backend Python file (attendance_sync.py / portal_client.py)
//    se copy karein — wahan SUPABASE_URL aur SUPABASE_KEY likhi hain
const SUPABASE_URL = 'https://eqqkoqulvgxuvwwwjjvd.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcWtvcXVsdmd4dXZ3d3dqanZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTU3MDQsImV4cCI6MjEwMzU3MTcwNH0.7ti283ARXlIhBp2efWahMJw77jd7wDtt_pXdElGCS7M'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)