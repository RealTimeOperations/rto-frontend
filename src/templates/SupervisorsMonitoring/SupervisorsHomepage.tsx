import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function SupervisorsHomepage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  // Verify supervisor role and load the logged-in user's name
  useEffect(() => {
    let alive = true
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login')
        return
      }
      // Role check via RPC
      const { data: roleData } = await supabase.rpc('get_my_role')
      const role = (roleData as string | null) ?? null
      if (!alive) return
      if (role !== 'supervisor') {
        navigate('/home')
        return
      }
      // Display name: profiles table, fallback to email prefix
      let name = ''
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .maybeSingle()
      if (data?.username) name = data.username
      else name = (session.user.email ?? '').split('@')[0]
      if (!alive) return
      setUsername(name)
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [navigate])

  // Sign out — App shows the goodbye transition and redirects to /login
  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#021b16] flex items-center justify-center">
        <div className="text-white/60 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#021b16] text-white flex flex-col items-center justify-center px-4">
      {/* ===== Top bar: portal label (left) + Logout (right) ===== */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex items-center justify-between px-3 sm:px-6 py-3">
          {/* Left: portal label */}
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-emerald-400/25 bg-[#071b15]/80 px-4 py-2.5">
            <svg className="h-4 w-4 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-xs sm:text-sm font-bold tracking-wide text-emerald-200">Supervisor Portal</span>
          </div>

          {/* Right: Logout button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="pointer-events-auto rto-run-border relative flex items-center gap-2 rounded-full border border-transparent bg-[#071b15]/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-red-300 transition-all duration-300 hover:bg-red-500/15 hover:shadow-[0_0_25px_rgba(239,68,68,0.25)] disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {loggingOut ? 'Logging out…' : 'Logout'}
          </button>
        </div>
      </header>

      {/* Welcome heading with running gradient animation */}
      <h1 className="text-center text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-none">
        <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
          Welcome to{' '}
        </span>
        <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
          Supervisors Homepage
        </span>
      </h1>

      {/* Logged-in user name badge */}
      <div className="mt-6 flex items-center gap-3 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-6 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div className="text-left">
          <div className="text-[10px] font-bold tracking-widest text-white/50">LOGGED IN AS</div>
          <div className="text-sm sm:text-base font-bold text-emerald-200 font-mono">@{username}</div>
        </div>
      </div>

      <p className="mt-4 text-xs sm:text-sm text-white/45">Supervisor monitoring portal — coming soon</p>
    </div>
  )
}