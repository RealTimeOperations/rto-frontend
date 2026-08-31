import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Login from './templates/authentication/login/Login'
import Admin from './templates/admin/Admin'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch role with localStorage cache for instant loading
  async function loadRole(userId: string) {
    const cached = localStorage.getItem('rto_role_' + userId)
    if (cached) {
      // Instant render from cache, verify in background
      setRole(cached)
      setLoading(false)
      const { data } = await supabase.rpc('get_my_role')
      const fresh = (data as string | null) ?? null
      localStorage.setItem('rto_role_' + userId, fresh ?? '')
      setRole(fresh)
      return
    }
    const { data } = await supabase.rpc('get_my_role')
    const fresh = (data as string | null) ?? null
    localStorage.setItem('rto_role_' + userId, fresh ?? '')
    setRole(fresh)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    if (data.session) loadRole(data.session.user.id)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      if (sess) loadRole(sess.user.id)
      else {
        setRole(null)
        setLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/70 text-sm bg-linear-to-br from-[#06231c] to-[#0b352a]">
        Loading…
      </div>
    )
  }

  const isAdmin = Boolean(session) && role === 'admin'

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAdmin ? <Navigate to="/admin" replace /> : <Login />} />
        <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={isAdmin ? '/admin' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}