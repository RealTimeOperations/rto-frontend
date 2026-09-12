import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type ModuleKey = 'attendance' | 'vehicles' | 'containers'

const CONFIG = {
  attendance: {
    heading: 'Attendance Dashboard',
    description: 'Monitor daily check-in / check-out and duty status of your team in real-time.',
    grad: 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]',
    iconBox: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.3)]',
    chip: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    icon: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="m16 11 2 2 4-4" />
      </>
    ),
  },
  vehicles: {
    heading: 'Vehicles Dashboard',
    description: 'Track live vehicle locations, routes and movement history across the tehsil.',
    grad: 'bg-[linear-gradient(180deg,#0ea5e9,#38bdf8,#7dd3fc,#38bdf8,#0ea5e9)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]',
    iconBox: 'border-sky-400/40 bg-sky-500/15 text-sky-300 shadow-[0_0_30px_rgba(56,189,248,0.3)]',
    chip: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
    icon: (
      <>
        <path d="M1 5h13v11H1z" />
        <path d="M14 8h4.6L22 11.6V16h-8z" />
        <circle cx="6" cy="17.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.3 0.9" />
        <circle cx="17.5" cy="17.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.3 0.9" />
      </>
    ),
  },
  containers: {
    heading: 'Containers Dashboard',
    description: 'Monitor dustbin container status, fill levels and collection schedules.',
    grad: 'bg-[linear-gradient(180deg,#84cc16,#a3e635,#d9f99d,#a3e635,#84cc16)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]',
    iconBox: 'border-lime-400/40 bg-lime-500/15 text-lime-300 shadow-[0_0_30px_rgba(163,230,53,0.3)]',
    chip: 'border-lime-400/30 bg-lime-500/10 text-lime-200',
    icon: (
      <>
        <path d="M9 2h6l1 2h5v2H3V4h5z" />
        <path d="M5 7h14l-1.2 15H6.2z" />
      </>
    ),
  },
}

export default function SupervisorModule({ module }: { module: ModuleKey }) {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)

  // Supervisor role guard + name load
  useEffect(() => {
    let alive = true
    let userId: string | null = null
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login')
        return
      }
      userId = session.user.id
      const { data: roleData } = await supabase.rpc('get_my_role')
      const role = (roleData as string | null) ?? null
      if (!alive) return
      if (role !== 'supervisor') {
        navigate('/home')
        return
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('can_attendance, can_vehicles, can_containers')
        .eq('id', userId)
        .maybeSingle()
      if (prof) {
        const allowed =
          (module === 'attendance' && prof.can_attendance) ||
          (module === 'vehicles' && prof.can_vehicles) ||
          (module === 'containers' && prof.can_containers)
        if (!allowed) {
          navigate('/supervisors')
          return
        }
      }
      let name = ''
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle()
      if (data?.username) name = data.username
      else name = (session.user.email ?? '').split('@')[0]
      if (!alive) return
      setUsername(name)
      setLoading(false)

      // ✅ Realtime subscribe — permission remove ho to foran homepage par redirect
      channel = supabase
        .channel('supervisor-module-' + userId)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          (payload) => {
            const rec = payload.new as any
            if (!rec) return
            const stillAllowed =
              (module === 'attendance' && rec.can_attendance) ||
              (module === 'vehicles' && rec.can_vehicles) ||
              (module === 'containers' && rec.can_containers)
            if (!stillAllowed) {
              navigate('/supervisors')
            }
          }
        )
        .subscribe()
    }
    load()
    return () => {
      alive = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [navigate, module])

  async function handleLogout() {
    await supabase.rpc('mark_supervisor_logout')
    await supabase.auth.signOut()
  }

  const c = CONFIG[module]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#021b16] flex items-center justify-center">
        <div className="text-white/60 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#021b16] text-white flex flex-col">
      {/* Top bar: Back + Logout */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex items-center justify-between px-3 sm:px-6 py-3">
          <button
            onClick={() => navigate('/supervisors')}
            className="pointer-events-auto rto-run-border relative flex items-center gap-2 rounded-full border border-transparent bg-[#071b15]/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-emerald-200 transition-all duration-300 hover:bg-emerald-500/15 hover:shadow-[0_0_25px_rgba(0,255,170,0.25)]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back
          </button>
          <button
            onClick={handleLogout}
            className="pointer-events-auto rto-run-border relative flex items-center gap-2 rounded-full border border-transparent bg-[#071b15]/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-red-300 transition-all duration-300 hover:bg-red-500/15 hover:shadow-[0_0_25px_rgba(239,68,68,0.25)]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pt-20 pb-10">
        {/* Module icon */}
        <div className={`relative flex h-20 w-20 items-center justify-center rounded-[22px] border ${c.iconBox}`}>
          <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {c.icon}
          </svg>
        </div>

        {/* Welcome heading */}
        <h1 className="mt-6 text-center text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-none">
          <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
            Welcome to{' '}
          </span>
          <span className={c.grad}>{c.heading}</span>
        </h1>

        <p className="mt-4 max-w-md text-center text-xs sm:text-sm text-white/45">{c.description}</p>

        {/* User chip */}
        <div className={`mt-6 flex items-center gap-2.5 rounded-full border px-5 py-2.5 ${c.chip}`}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="text-xs font-bold font-mono">@{username}</span>
        </div>

        {/* Premium placeholder panel with running border */}
        <div className="relative mt-10 w-full max-w-2xl rounded-[26px] overflow-hidden shadow-[0_0_18px_rgba(16,185,129,0.12)]">
          <div className="absolute -inset-full animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#059669,#34d399,#7acba4,#34d399,#059669)] opacity-50" />
          <div className="relative m-0.5 rounded-[24px] bg-[#071b15] p-8 sm:p-10 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-300">LIVE MONITORING</span>
            </div>
            <div className="text-sm sm:text-base font-semibold text-white/80 text-center">
              Supervisor monitoring modules are being prepared for this dashboard.
            </div>
            <div className="w-full space-y-3 mt-2">
              <div className="h-3 rounded-full bg-white/5 animate-pulse" />
              <div className="h-3 rounded-full bg-white/5 animate-pulse [animation-delay:200ms]" />
              <div className="h-3 rounded-full bg-white/5 animate-pulse [animation-delay:400ms]" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}