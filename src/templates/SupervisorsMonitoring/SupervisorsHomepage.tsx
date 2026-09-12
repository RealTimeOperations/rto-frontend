import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function SupervisorsHomepage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [permissions, setPermissions] = useState<{ attendance: boolean; vehicles: boolean; containers: boolean }>({ attendance: true, vehicles: true, containers: true })

  // Verify supervisor role and load the logged-in user's name
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
      const { data: prof } = await supabase
        .from('profiles')
        .select('can_attendance, can_vehicles, can_containers')
        .eq('id', userId)
        .maybeSingle()
      if (prof) {
        setPermissions({
          attendance: Boolean(prof.can_attendance),
          vehicles: Boolean(prof.can_vehicles),
          containers: Boolean(prof.can_containers),
        })
      }
      setLoading(false)

      // ✅ Realtime subscribe — admin toggle kare to foran update
      channel = supabase
        .channel('supervisor-perms-' + userId)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          (payload) => {
            const rec = payload.new as any
            if (rec) {
              setPermissions({
                attendance: Boolean(rec.can_attendance),
                vehicles: Boolean(rec.can_vehicles),
                containers: Boolean(rec.can_containers),
              })
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
  }, [navigate])

  async function handleLogout() {
    await supabase.rpc('mark_supervisor_logout')
    await supabase.auth.signOut()
  }

  const allModules = [
    {
      key: 'attendance',
      title: 'Attendance',
      desc: 'Daily check-in / check-out & duty monitoring',
      path: '/supervisors/attendance',
      accent: 'emerald' as const,
      icon: (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="m16 11 2 2 4-4" />
        </>
      ),
    },
    {
      key: 'vehicles',
      title: 'Vehicles',
      desc: 'Live vehicle location & movement tracking',
      path: '/supervisors/vehicles',
      accent: 'sky' as const,
      icon: (
        <>
          <path d="M1 5h13v11H1z" />
          <path d="M14 8h4.6L22 11.6V16h-8z" />
          <circle cx="6" cy="17.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.3 0.9" />
          <circle cx="17.5" cy="17.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.3 0.9" />
        </>
      ),
    },
    {
      key: 'containers',
      title: 'Containers',
      desc: 'Dustbin container status & collections',
      path: '/supervisors/containers',
      accent: 'lime' as const,
      icon: (
        <>
          <path d="M9 2h6l1 2h5v2H3V4h5z" />
          <path d="M5 7h14l-1.2 15H6.2z" />
        </>
      ),
    },
  ]

  // ✅ Sirf wahi modules dikhao jinke permissions admin ne ON ki hain
  const modules = allModules.filter(m => {
    if (m.key === 'attendance') return permissions.attendance
    if (m.key === 'vehicles') return permissions.vehicles
    if (m.key === 'containers') return permissions.containers
    return false
  })

  const accentMap = {
    emerald: {
      box: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300',
      glow: 'bg-emerald-500/10 group-hover:bg-emerald-500/25',
      text: 'text-emerald-300',
      hoverBorder: 'hover:border-emerald-400/50',
      line: 'bg-emerald-400/60 shadow-[0_0_12px_2px_rgba(16,185,129,0.7)]',
      run: 'bg-[linear-gradient(90deg,transparent,#d1fae5,transparent)]',
    },
    sky: {
      box: 'border-sky-400/40 bg-sky-500/15 text-sky-300',
      glow: 'bg-sky-500/10 group-hover:bg-sky-500/25',
      text: 'text-sky-300',
      hoverBorder: 'hover:border-sky-400/50',
      line: 'bg-sky-400/60 shadow-[0_0_12px_2px_rgba(56,189,248,0.7)]',
      run: 'bg-[linear-gradient(90deg,transparent,#e0f2fe,transparent)]',
    },
    lime: {
      box: 'border-lime-400/40 bg-lime-500/15 text-lime-300',
      glow: 'bg-lime-500/10 group-hover:bg-lime-500/25',
      text: 'text-lime-300',
      hoverBorder: 'hover:border-lime-400/50',
      line: 'bg-lime-400/60 shadow-[0_0_12px_2px_rgba(163,230,53,0.7)]',
      run: 'bg-[linear-gradient(90deg,transparent,#fef9c3,transparent)]',
    },
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#021b16] flex items-center justify-center">
        <div className="text-white/60 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#021b16] text-white flex flex-col items-center px-4 pb-10">
      {/* ===== Top bar: portal label (left) + Logout (right) ===== */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex items-center justify-between px-3 sm:px-6 py-3">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-emerald-400/25 bg-[#071b15]/80 px-4 py-2.5">
            <svg className="h-4 w-4 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-xs sm:text-sm font-bold tracking-wide text-emerald-200">Supervisor Portal</span>
          </div>
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

      {/* Welcome heading */}
      <h1 className="mt-24 text-center text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-none">
        <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
          Welcome to{' '}
        </span>
        <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
          Supervisors Homepage
        </span>
      </h1>

      {/* Logged-in user badge */}
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

      <p className="mt-4 text-xs sm:text-sm text-white/45">Select a monitoring module to continue</p>

      {/* ===== Module cards ===== */}
      <div className="mt-8 w-full max-w-5xl">
        {modules.length === 0 ? (
          <div className="rounded-[26px] border border-red-400/30 bg-red-500/10 p-10 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-red-400/40 bg-red-500/15 text-red-300 mb-4">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="text-base font-bold text-red-200">You Do Not Have Any Access</div>
            <div className="text-xs text-red-300/70 mt-2">
              Please contact your administrator.
            </div>
          </div>
        ) : (
        <div className="flex flex-wrap justify-center gap-5 sm:gap-6">
        {modules.map(m => {
          const a = accentMap[m.accent]
          return (
            <button
              key={m.key}
              onClick={() => navigate(m.path)}
              className={`w-full sm:w-80 group relative overflow-hidden rounded-[26px] border border-white/10 ${a.hoverBorder} bg-linear-to-br from-[#0c2b23] to-[#081f19] p-6 text-left shadow-[0_15px_40px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_55px_rgba(0,0,0,0.5)]`}
            >
              {/* Corner glow */}
              <div className={`absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl transition-all duration-300 ${a.glow}`} />
              {/* Faint arc */}
              <div className="absolute -right-8 top-12 h-32 w-32 rounded-full border border-white/5" />

              {/* Icon */}
              <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border ${a.box}`}>
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {m.icon}
                </svg>
              </div>

              <div className="mt-5 text-lg font-extrabold tracking-wide text-white">{m.title}</div>
              <div className="mt-1.5 text-[11px] sm:text-xs text-white/50 leading-relaxed">{m.desc}</div>

              <div className={`mt-5 flex items-center gap-2 text-[11px] font-bold tracking-widest ${a.text}`}>
                OPEN DASHBOARD
                <svg className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>

              {/* Bottom glow line + running highlight */}
              <div className={`absolute bottom-0 left-0 right-0 h-px ${a.line}`} />
              <div className="absolute bottom-0 left-0 right-0 h-px overflow-hidden">
                <div className={`absolute inset-0 ${a.run} bg-[length:40%_100%] bg-no-repeat animate-[line-run_2.5s_linear_infinite]`} />
              </div>
            </button>
          )
        })}
        </div>
        )}
      </div>
    </div>
  )
}