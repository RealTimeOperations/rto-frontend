import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import TotalWorkers from './TotalWorkers'
import { AttendanceView, fetchWorkerAttendance, type WorkerBrief } from './attendance'

type SupervisorWorker = WorkerBrief

type View = 'dashboard' | 'workers' | 'attendance'

const norm = (v: any) => String(v ?? '').replace(/-/g, '').trim().toLowerCase()

// ✅ Normalize UC/Ward value to a stable key — handles "UC-92", "UC 92", "ward 2", "Ward 2" etc.
function ucKey(v: any): string {
  const s = String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  const uc = s.match(/uc[- ]?(\d+)/)
  if (uc) return 'uc-' + uc[1]
  const ward = s.match(/ward[- ]?(\d+)/)
  if (ward) return 'ward-' + ward[1]
  return s
}

// ✅ Short UC/Ward label for display — "UC-101, Chak 150/2L, Haroonabad" → "UC-101"
function ucShort(v: any): string {
  const s = String(v ?? '').trim()
  const uc = s.match(/uc[-\s]?(\d+)/i)
  if (uc) return 'UC-' + uc[1]
  const ward = s.match(/ward[-\s]?(\d+)/i)
  if (ward) return 'Ward ' + ward[1]
  return s.split(',')[0]
}

const GREEN_NUM = 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'
const RED_NUM = 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'
const SKY_NUM = 'bg-[linear-gradient(180deg,#0ea5e9,#38bdf8,#7dd3fc,#38bdf8,#0ea5e9)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'

export default function DashboardAttendance() {
  const navigate = useNavigate()
  // ✅ View persistence: refresh ke baad wahi page khule jo pehle tha
  const [view, setView] = useState<View>(() => {
    const saved = localStorage.getItem('rto_sup_att_view') as View | null
    if (saved && ['dashboard', 'workers', 'attendance'].includes(saved)) return saved
    return 'dashboard'
  })
  const [username, setUsername] = useState('')
  const [workers, setWorkers] = useState<SupervisorWorker[]>([])
  const [logs, setLogs] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [supervisorId, setSupervisorId] = useState<string | null>(null)
  const [assignedUc, setAssignedUc] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)
  const [slider, setSlider] = useState({ left: 0, width: 0 })

  const tabs: { key: View; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'workers', label: 'Total Workers' },
    { key: 'attendance', label: 'Attendance' },
  ]

  // ✅ Save view on every change (refresh par wahi page khule)
  useEffect(() => {
    localStorage.setItem('rto_sup_att_view', view)
  }, [view])

  // ✅ Sliding pill position — view change + window resize + font load par update
  useEffect(() => {
    const update = () => {
      if (!navRef.current) return
      const activeBtn = navRef.current.querySelector('[data-active="true"]') as HTMLElement
      if (activeBtn) setSlider({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth })
    }
    update()
    const t = setTimeout(update, 100)
    window.addEventListener('resize', update)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', update)
    }
  }, [view])

  useEffect(() => {
    let alive = true

    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const userId = session.user.id
      setSupervisorId(userId)

      const { data: prof } = await supabase
        .from('profiles')
        .select('username, cnic')
        .eq('id', userId)
        .maybeSingle()
      if (prof?.username && alive) setUsername(prof.username)

      // ✅ Supervisor's own record from assigned_supervisors (match by CNIC)
      const myCnic = norm(prof?.cnic)
      const { data: supRows } = await supabase
        .from('assigned_supervisors')
        .select('cnic, uc_ward')
      const myRow = (supRows ?? []).find((r: any) => norm(r.cnic) === myCnic)
      const myUc = myRow ? String(myRow.uc_ward ?? '') : ''
      if (alive) setAssignedUc(myUc)

      // ✅ Workers: ONLY those whose UC/Ward matches the supervisor's assigned UC/Ward
      let list: SupervisorWorker[] = []
      if (myUc) {
        const key = ucKey(myUc)
        const { data: workersData } = await supabase
          .from('assigned_employees')
          .select('id, name, father_name, cnic, designation, uc_ward, attendance_point, work_type, employee_code')
        list = ((workersData as SupervisorWorker[]) ?? []).filter(w => ucKey(w.uc_ward) === key)
      }
      if (!alive) return
      setWorkers(list)

      // ✅ All attendance logs (check-in / check-out) for these workers
      const allLogs = await fetchWorkerAttendance(list.map(w => w.cnic).filter(Boolean))
      if (!alive) return
      setLogs(allLogs)
      setLoading(false)
    }

    load()

    // ✅ Silent auto-refresh: har 30s data foran update — koi loading/flicker nahi
    const timer = setInterval(load, 30_000)

    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  // ✅ Stats — sirf AAJ ke logs se (cards daily status dikhate hain)
  const todayStr = new Date().toLocaleDateString('en-CA') // local YYYY-MM-DD
  const todayLogs = logs.filter(l => String(l.date ?? String(l.date_time ?? '').split(' ')[0]) === todayStr)
  const checkinSet = new Set(todayLogs.filter(l => String(l.check_type ?? '').toLowerCase() === 'checkin').map(l => norm(l.cnic)))
  const checkoutSet = new Set(todayLogs.filter(l => String(l.check_type ?? '').toLowerCase() === 'checkout').map(l => norm(l.cnic)))
  const totalCheckins = todayLogs.filter(l => String(l.check_type ?? '').toLowerCase() === 'checkin').length
  const totalCheckouts = todayLogs.filter(l => String(l.check_type ?? '').toLowerCase() === 'checkout').length
  const present = workers.filter(w => checkinSet.has(norm(w.cnic)) && checkoutSet.has(norm(w.cnic))).length
  const onDuty = workers.filter(w => checkinSet.has(norm(w.cnic)) && !checkoutSet.has(norm(w.cnic))).length
  const absent = workers.length - checkinSet.size

  const cards = [
    { label: 'TOTAL WORKERS', value: workers.length, num: GREEN_NUM, ring: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300', icon: <PeopleIcon /> },
    { label: 'TOTAL CHECK-IN', value: totalCheckins, num: GREEN_NUM, ring: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300', icon: <CheckInIcon /> },
    { label: 'TOTAL CHECK-OUT', value: totalCheckouts, num: SKY_NUM, ring: 'border-sky-400/40 bg-sky-500/15 text-sky-300', icon: <CheckOutIcon /> },
    { label: 'PRESENT', value: present, num: GREEN_NUM, ring: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300', icon: <PresentIcon /> },
    { label: 'ON DUTY', value: onDuty, num: SKY_NUM, ring: 'border-sky-400/40 bg-sky-500/15 text-sky-300', icon: <DutyIcon /> },
    { label: 'ABSENT', value: absent, num: RED_NUM, ring: 'border-red-400/40 bg-red-500/15 text-red-300', icon: <AbsentIcon /> },
  ]

  return (
    <div className="min-h-screen bg-[#021b16] text-white">
      {/* ===== Top Navbar (same design as Attendance Monitoring) ===== */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="relative flex items-center px-3 sm:px-6 py-2 sm:py-3 pointer-events-auto md:pointer-events-none bg-[#021b16] md:bg-transparent border-b border-white/10 md:border-b-0 shadow-[0_6px_24px_rgba(0,0,0,0.45)] md:shadow-none">
          {/* Left: Home (mobile par sirf icon) */}
          <div className="flex-1 flex justify-start pointer-events-auto">
            <button
              onClick={() => navigate('/supervisors')}
              aria-label="Back to Home"
              className="rto-run-border relative flex items-center gap-2 rounded-full border border-transparent bg-[#071b15]/80 px-3 sm:px-4 py-1.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-emerald-200 transition-all duration-300 hover:bg-emerald-500/15 hover:shadow-[0_0_25px_rgba(0,255,170,0.25)]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span className="hidden sm:inline">Home</span>
            </button>
          </div>

          {/* Center: Desktop tabs + Mobile dropdown */}
          <div className="relative pointer-events-auto">
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="fixed right-3 top-16 z-40 w-56 rounded-2xl border border-white/10 bg-[#071b15] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/10 text-xs font-bold tracking-widest text-white/70">NAVIGATION</div>
                  {tabs.map(t => (
                    <button
                      key={t.key}
                      onClick={() => { setView(t.key); setMenuOpen(false) }}
                      className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors ${
                        view === t.key
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Desktop: sliding pill tabs */}
            <nav
              ref={navRef}
              className="hidden md:flex relative items-center gap-1.5 sm:gap-2 rounded-full border border-transparent bg-[#071b15]/90 backdrop-blur-md px-2 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_12px_35px_rgba(0,0,0,0.6)]"
            >
              <div
                className="absolute top-1.5 bottom-1.5 rounded-full bg-linear-to-r from-[#00764c] to-[#058962] shadow-[0_0_15px_rgba(0,255,170,0.15)] transition-all duration-300 ease-out pointer-events-none"
                style={{ left: slider.left, width: slider.width }}
              />
              {tabs.map(t => (
                <button
                  key={t.key}
                  data-active={view === t.key}
                  onClick={() => setView(t.key)}
                  className={`relative z-10 px-2.5 sm:px-5 py-2 rounded-full text-[11px] sm:text-sm font-bold tracking-wide transition-all duration-300 whitespace-nowrap ${
                    view === t.key
                      ? 'text-white drop-shadow-[0_0_6px_rgba(167,243,208,0.4)]'
                      : 'text-white/60 hover:text-emerald-200 hover:drop-shadow-[0_0_4px_rgba(167,243,208,0.2)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right: Hamburger (mobile only) */}
          <div className="flex-1 flex justify-end items-center gap-2.5 pr-1 sm:pr-3 pointer-events-auto">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
              className="md:hidden relative flex items-center justify-center rounded-full border border-transparent bg-[#071b15]/80 p-2 sm:p-2.5 text-white/70 hover:text-white transition"
            >
              {menuOpen ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ===== Content ===== */}
      <main className="pt-16 sm:pt-24 pb-6 px-4 sm:px-6 max-w-[1750px] mx-auto w-full">
        {view === 'dashboard' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
                Attendance Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-white/45 mt-2">
                Monitor your team's daily attendance
              </p>
              <p className="text-[11px] sm:text-sm mt-1">
                <span className="text-emerald-200 font-semibold font-mono">@{username}</span>
                {assignedUc && (
                  <span className="ml-2 text-emerald-300 font-semibold">• {ucShort(assignedUc)}</span>
                )}
              </p>
            </div>

            {loading ? (
              <div className="text-white/60 text-sm py-10 text-center">Loading your team…</div>
            ) : workers.length === 0 ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-10 text-center">
                <div className="text-base font-bold text-amber-200 mb-2">No Workers Assigned</div>
                <div className="text-xs text-amber-300/70">
                  Your supervisor account has no workers assigned yet. Please contact your administrator.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                {cards.map(c => (
                  <div key={c.label} className="relative overflow-hidden rounded-[24px] border border-emerald-400/25 bg-linear-to-b from-[#073b2d] to-[#021d17] px-2 py-4 sm:px-4 sm:py-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
                    <div className={`mx-auto mb-2 sm:mb-4 flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-full border [&_svg]:h-4 [&_svg]:w-4 sm:[&_svg]:h-6 sm:[&_svg]:w-6 ${c.ring}`}>
                      {c.icon}
                    </div>
                    <div className={`text-xl sm:text-4xl font-extrabold ${c.num}`}>
                      {loading ? '—' : c.value.toLocaleString()}
                    </div>
                    <div className="mt-1 sm:mt-2 text-[9px] sm:text-sm font-bold tracking-wider sm:tracking-widest text-white/60">{c.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'workers' && <TotalWorkers workers={workers} supervisorId={supervisorId ?? ''} />}

        {view === 'attendance' && <AttendanceView logs={logs} workers={workers} loading={loading} />}
      </main>
    </div>
  )
}

/* =========================================================
   CARD ICONS
========================================================= */
function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function PresentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9.5" cy="6.5" r="3.5" />
      <path d="M3 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 1.8.33" />
      <circle cx="17" cy="17" r="4.5" />
      <path d="m15.2 17 1.3 1.3 2.3-2.3" />
    </svg>
  )
}

function CheckInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="5.5" r="2.5" />
      <path d="M4 20v-1a4 4 0 0 1 4-4h.5" />
      <path d="M8.5 12.5 12 14" />
      <rect x="14" y="3" width="7" height="18" rx="2" />
      <path d="m16 12.5 1.5 1.5 2.5-2.5" />
    </svg>
  )
}

function CheckOutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="4.5" r="2" />
      <path d="M6.5 7.5v5l-2 7" />
      <path d="M6.5 12.5l3 7" />
      <path d="M6.5 8.5 10 10" />
      <path d="M14 3.5h6v17h-6" />
      <path d="M13.5 12H20" />
      <path d="m17.5 9.5 2.5 2.5-2.5 2.5" />
    </svg>
  )
}

function DutyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function AbsentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9.5" cy="6.5" r="3.5" />
      <path d="M3 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 1.8.33" />
      <circle cx="17" cy="17" r="4.5" />
      <path d="m15.5 15.5 3 3" />
      <path d="m18.5 15.5-3 3" />
    </svg>
  )
}