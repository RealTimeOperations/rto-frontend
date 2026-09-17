import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AttendanceLogs from './AttendanceLogs'
import TotalHR from './TotalHR'
import AttendanceReport from './AttendanceReport'

type Props = {
  onHomeClick?: () => void
}

type Row = Record<string, any>
type View = 'dashboard' | 'attendance' | 'hr' | 'report'

export default function AttendanceDashboard({ onHomeClick }: Props) {
  const navigate = useNavigate()
  // ✅ Tab persistence: refresh ke baad wahi tab khule jo pehle open tha
  const [view, setView] = useState<View>(() => {
    const saved = localStorage.getItem('rto_attendance_tab') as View | null
    if (saved && ['dashboard', 'attendance', 'hr', 'report'].includes(saved)) return saved
    return 'dashboard'
  })
  
  // ✅ Save tab to localStorage on every change
  useEffect(() => {
    localStorage.setItem('rto_attendance_tab', view)
  }, [view])
  const [attendance, setAttendance] = useState<Row[]>([])
  const [employees, setEmployees] = useState<Row[]>([])
  const [baseValues, setBaseValues] = useState<{ label: string; value: number; sort_order: number; type: string; present_target?: number | null }[]>([])
  const [loading, setLoading] = useState(true)
  const navRef = useRef<HTMLDivElement>(null)
  const [slider, setSlider] = useState({ left: 0, width: 0 })
  const [menuOpen, setMenuOpen] = useState(false)

  // ✅ Last sync time + notifications system
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [notifications, setNotifications] = useState<{ id: number; type: 'success' | 'error'; message: string; time: string; unread?: boolean }[]>(() => {
    try {
      const saved = localStorage.getItem('rto_latest_notification')
      if (saved) {
        const item = JSON.parse(saved)
        if (item && item.message) return [item]
      }
    } catch {}
    return []
  })
  const [unread, setUnread] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('rto_latest_notification')
      if (saved) return JSON.parse(saved)?.unread ? 1 : 0
    } catch {}
    return 0
  })
  const [popup, setPopup] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const popupTimer = useRef<number | null>(null)
  const notifId = useRef(0)

  function pushNotification(type: 'success' | 'error', message: string) {
    notifId.current += 1
    const item = {
      id: notifId.current,
      type,
      message,
      time: new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
    }
    // ✅ Sirf latest notification rakho — purani foran remove
    // ✅ localStorage mein save — refresh ke baad bhi rahegi jab tak nayi na aa
    const savedItem = { ...item, unread: true }
    setNotifications([savedItem])
    setUnread(1)
    try { localStorage.setItem('rto_latest_notification', JSON.stringify(savedItem)) } catch {}
    // Popup sirf 1 second ke liye
    setPopup({ type, message })
    if (popupTimer.current) window.clearTimeout(popupTimer.current)
    popupTimer.current = window.setTimeout(() => setPopup(null), 1000)
  }

  // ✅ Sliding pill position — view change + window resize + font load par update
  useEffect(() => {
    const update = () => {
      if (!navRef.current) return
      const activeBtn = navRef.current.querySelector('[data-active="true"]') as HTMLElement
      if (activeBtn) setSlider({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth })
    }
    update()
    const t = setTimeout(update, 100) // font load ke baad dobara measure
    window.addEventListener('resize', update)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', update)
    }
  }, [view])
  // ✅ Backend sync API (Update HR button) — deploy par apna server URL dalein
  const SYNC_API = 'http://localhost:8000'
  const [isAdmin, setIsAdmin] = useState(false)
  const [hrSync, setHrSync] = useState<null | { stage: 'confirm' } | { stage: 'loading' } | { stage: 'done'; type: 'success' | 'warn' | 'error'; message: string }>(null)

  // ✅ Role check — Update HR sirf admin ke liye
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const cached = localStorage.getItem('rto_role_' + session.user.id)
      if (cached) {
        if (alive) setIsAdmin(cached === 'admin')
        return
      }
      const { data } = await supabase.rpc('get_my_role')
      if (alive) setIsAdmin(data === 'admin')
    })()
    return () => { alive = false }
  }, [])

  // ✅ Update HR: backend ka /sync/employees trigger karo (employees_sync.py)
  async function runHrSync() {
    setHrSync({ stage: 'loading' })
    try {
      const res = await fetch(SYNC_API + '/sync/employees', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.detail || 'Server error: ' + res.status)
      if (json.status === 'updated') {
        setHrSync({ stage: 'done', type: 'success', message: 'HR data successfully updated' })
        pushNotification('success', 'HR data successfully updated')
        load()
      } else {
        setHrSync({ stage: 'done', type: 'warn', message: 'No Updated data on portal' })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sync failed'
      setHrSync({ stage: 'done', type: 'error', message: msg })
      pushNotification('error', 'HR sync error: ' + msg)
    }
  }

  // ✅ Server status: live = fetching process OK, error = portal/internet issue
  //    localStorage se initial value — refresh par galat green flash nahi hota
  const [serverStatus, setServerStatus] = useState<'live' | 'error'>(() => {
    try { return localStorage.getItem('rto_server_status') === 'error' ? 'error' : 'live' } catch { return 'live' }
  })
  const statusRef = useRef<'live' | 'error'>(serverStatus)
  // ✅ Aakhri error message — refresh par wahi ongoing error dobara notify na ho
  const lastErrMsgRef = useRef<string>((() => {
    try {
      const saved = localStorage.getItem('rto_latest_notification')
      const n = saved ? JSON.parse(saved) : null
      return n?.type === 'error' ? String(n.message || '') : ''
    } catch { return '' }
  })())
  function setStatus(s: 'live' | 'error') {
    if (statusRef.current === s) return
    statusRef.current = s
    setServerStatus(s)
    try { localStorage.setItem('rto_server_status', s) } catch {}
  }
  function notifyError(msg: string) {
    // Sirf tab notify karo: status pehli dafa error ho YA error message badla ho
    if (statusRef.current !== 'error' || lastErrMsgRef.current !== msg) {
      pushNotification('error', msg)
    }
    lastErrMsgRef.current = msg
    setStatus('error')
  }
  const lastLogIdRef = useRef<string | null>(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  // ✅ Paginated fetch — Supabase ek request mein max 1000 rows deta hai
  async function fetchAll(table: string) {
    let all: Row[] = []
    let from = 0
    const PAGE = 1000
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw error
      const rows = data ?? []
      all = all.concat(rows)
      if (rows.length < PAGE) break
      from += PAGE
    }
    return all
  }

  // ✅ Sirf FMO / staff exclude (khali CNIC ya FMO/Weighbridge/Manager designation)
  const isStaff = (r: Row) => {
    const cnic = String(r.cnic ?? '').replace(/-/g, '').trim()
    const desig = String(r.designation ?? '').toLowerCase()
    return (
      cnic === '' ||
      desig.includes('field monitoring') ||
      desig.includes('weighbridge') ||
      desig.includes('manager')
    )
  }

  const load = useCallback(async (notify = false, silent = false) => {
    // ✅ Silent update: loading state change nahi hoti — values foran swap hoti hain
    if (!silent) setLoading(true)
    try {
      const [att, emp, bv] = await Promise.all([
        fetchAll('attendance_logs'),
        fetchAll('assigned_employees'),
        supabase.from('base_values').select('label, value, sort_order, type, present_target').order('sort_order', { ascending: true }),
      ])
      if (!aliveRef.current) return
      setAttendance(att.filter(r => !isStaff(r)))
      setEmployees(emp)
      setBaseValues((bv.data ?? []) as { label: string; value: number; sort_order: number; type: string; present_target?: number | null }[])
      setLastSync(new Date())
      // ✅ Notification sirf jab naya data aaya ho — refresh/mount par nahi
      if (notify) pushNotification('success', 'Data successfully fetched and updated')
    } catch (e) {
      console.error('Load error:', e)
      notifyError('Error in data fetch')
    } finally {
      if (aliveRef.current && !silent) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ✅ Heartbeat poll: har 5 second mein backend ki health check karo
  //    - Heartbeat fresh + status running  → GREEN
  //    - Heartbeat purani (>15 sec) / missing → RED (server band) — max ~20 sec mein
  //    - Status portal_error → RED (portal issue message ke sath)
  //    - Naya attendance row aaya → full refresh + success notification
  useEffect(() => {
    const POLL_MS = 3_000   // ✅ Fast reaction: har 3 sec check
    // ✅ Grace period: portal fetch cycle mein heartbeat kuch der ruk sakti hai (process busy) —
    //    40s tak stale = normal fetch, 90s+ stale = process band
    const HEARTBEAT_MAX_MS = 40_000
    const HEARTBEAT_HARD_MS = 90_000
    // ✅ Ye statuses "process alive/busy" count hoti hain (error nahi)
    const ALIVE_STATUSES = ['running', 'fetching', 'syncing', 'loading']
    // ✅ Sirf ye statuses explicit error hain
    const ERROR_STATUSES = ['error', 'portal_error', 'failed', 'stopped']
    async function check() {
      try {
        const { data: hb, error: hbErr } = await supabase
          .from('system_heartbeat')
          .select('status, message, updated_at')
          .eq('id', 1)
          .maybeSingle()
        if (hbErr) throw hbErr
        const hbTime = hb?.updated_at ? new Date(hb.updated_at).getTime() : 0
        const ageMs = hbTime ? Date.now() - hbTime : Infinity
        const status = String(hb?.status ?? '').toLowerCase()
        if (ERROR_STATUSES.includes(status)) {
          // ❌ Backend ne khud error report kiya
          notifyError(hb?.message || 'Error in Data Fetching (Portal issue)')
        } else if (!hb || ageMs > HEARTBEAT_HARD_MS) {
          // ❌ Heartbeat missing ya 90s+ purani — server/process band
          notifyError('Error in data fetch')
        } else if (ageMs > HEARTBEAT_MAX_MS && !ALIVE_STATUSES.includes(status)) {
          // ❌ 40s+ purani aur status alive nahi — process band
          notifyError('Error in data fetch')
        } else if (statusRef.current === 'error') {
          // ✅ Process dobara chalu hua — wapis green + notification
          setStatus('live')
          pushNotification('success', 'Fetching process start')
        }

        // Naya attendance data check
        const { data: latest, error: latErr } = await supabase
          .from('attendance_logs')
          .select('id')
          .order('id', { ascending: false })
          .limit(1)
        if (latErr) throw latErr
        const latestId = (latest?.[0]?.id as string | undefined) ?? null
        if (lastLogIdRef.current === null) {
          lastLogIdRef.current = latestId
        } else if (latestId !== lastLogIdRef.current) {
          lastLogIdRef.current = latestId
          setStatus('live')
          await load(true, true) // ✅ Silent refresh — koi flicker / reload nahi
        }
      } catch (e) {
        // ❌ Supabase se connect hi nahi ho raha (internet down)
        notifyError('Error in data fetch')
      }
    }
    check()   // ✅ Mount par FORAN check — 5 second ka intezar nahi
    const timer = setInterval(check, POLL_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const tabs: { key: View; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'hr', label: 'Assigned HR' }, // ✅ Naam badal kar 2nd position par
    { key: 'attendance', label: 'Attendance' },
    { key: 'report', label: 'Report' },
  ]

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#021b16] text-white">
      {/* ===== Top Navbar (solid + visible) ===== */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="relative flex items-center px-3 sm:px-6 py-3 pointer-events-auto md:pointer-events-none bg-[#021b16] border-b border-white/10 md:border-b-0 shadow-[0_6px_24px_rgba(0,0,0,0.45)] md:shadow-none">
          {/* Left: Home button only */}
          <div className="flex-1 flex justify-start pointer-events-auto">
            <button
              onClick={() => { onHomeClick?.(); navigate('/home') }}
              aria-label="Back to Home"
              className="rto-run-border relative flex items-center gap-2 rounded-full border border-transparent bg-[#071b15]/80 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-emerald-200 transition-all duration-300 hover:bg-emerald-500/15 hover:shadow-[0_0_25px_rgba(0,255,170,0.25)]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span className="hidden sm:inline">Home</span>
            </button>
          </div>

          {/* Center: Mobile LIVE pill (center aligned) + Desktop tabs */}
          <div className="relative pointer-events-auto">
            {/* ✅ Mobile: Dropdown menu (hamburger se trigger hota hai) */}
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="fixed right-3 top-16 z-40 w-56 rounded-2xl border border-white/10 bg-[#071b15] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/10 text-xs font-bold tracking-widest text-white/70">NAVIGATION</div>
                  {tabs.map(t => (
                    <button
                      key={t.key}
                      onClick={() => {
                        setView(t.key)
                        setMenuOpen(false)
                      }}
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

            {/* ✅ Desktop: Original tabs nav */}
            <nav
              ref={navRef}
              className="hidden md:flex relative items-center gap-1.5 sm:gap-2 rounded-full border border-transparent bg-[#071b15]/90 backdrop-blur-md px-2 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_12px_35px_rgba(0,0,0,0.6)]">
              {/* ✅ Sliding green pill */}
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

          {/* Right: Last Sync pill + Notification bell + Hamburger (top par) */}
          <div className="flex-1 flex justify-end items-center gap-2.5 pr-1 sm:pr-3 pointer-events-auto">

                {/* ✅ Update HR modal: confirm → loading → result */}
                {hrSync && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-linear-to-br from-[#0d372c] to-[#08261f] border border-emerald-400/20 rounded-2xl p-7 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
                      {hrSync.stage === 'confirm' && (
                        <>
                          <h3 className="text-lg font-bold text-white mb-2">Update HR Data</h3>
                          <p className="text-white/60 text-sm mb-6">
                            Portal se assigned employees ka taza data fetch kar ke Supabase mein upload kiya jayega. Continue karein?
                          </p>
                          <div className="flex gap-3">
                            <button onClick={() => setHrSync(null)} className="flex-1 py-2.5 bg-white/5 border border-white/15 rounded-full text-white/70 text-sm font-semibold hover:bg-white/10 transition">Cancel</button>
                            <button onClick={runHrSync} className="running-button flex-1 py-2.5 rounded-full text-white text-sm font-bold hover:opacity-90 transition">Yes, Update</button>
                          </div>
                        </>
                      )}
                      {hrSync.stage === 'loading' && (
                        <div className="flex flex-col items-center gap-4 py-4">
                          <div className="h-10 w-10 rounded-full border-2 border-emerald-400/30 border-t-emerald-300 animate-spin" />
                          <div className="text-sm font-semibold text-white/80">Syncing HR data from portal…</div>
                          <div className="text-[11px] text-white/45">Please wait — process running hai</div>
                        </div>
                      )}
                      {hrSync.stage === 'done' && (
                        <>
                          <div className="flex flex-col items-center gap-3 mb-6">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-full border ${
                              hrSync.type === 'success' ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                              : hrSync.type === 'warn' ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                              : 'bg-red-500/15 border-red-400/40 text-red-300'
                            }`}>
                              {hrSync.type === 'success' ? (
                                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                              ) : (
                                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                              )}
                            </div>
                            <div className={`text-sm font-bold text-center ${
                              hrSync.type === 'success' ? 'text-emerald-300'
                              : hrSync.type === 'warn' ? 'text-amber-300'
                              : 'text-red-300'
                            }`}>{hrSync.message}</div>
                          </div>
                          <button onClick={() => setHrSync(null)} className="running-button w-full py-2.5 rounded-full text-white text-sm font-bold hover:opacity-90 transition">Close</button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {lastSync && (
                  <div className="rto-run-border relative hidden lg:flex items-center gap-1 xl:gap-1.5 min-[1700px]:gap-2 rounded-full border border-transparent bg-[#071b15]/80 px-2.5 py-1 xl:px-3 xl:py-1.5 min-[1700px]:px-4 min-[1700px]:py-2">
                    {serverStatus === 'live' ? (
                      <span className="relative flex h-1.5 w-1.5 xl:h-2 xl:w-2 min-[1700px]:h-2.5 min-[1700px]:w-2.5" title="Server live — data fetching OK">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                        <span className="relative inline-flex h-1.5 w-1.5 xl:h-2 xl:w-2 min-[1700px]:h-2.5 min-[1700px]:w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                      </span>
                    ) : (
                      <span className="relative flex h-1.5 w-1.5 xl:h-2 xl:w-2 min-[1700px]:h-2.5 min-[1700px]:w-2.5" title="Server error — data fetching band hai">
                        <span className="relative inline-flex h-1.5 w-1.5 xl:h-2 xl:w-2 min-[1700px]:h-2.5 min-[1700px]:w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse" />
                      </span>
                    )}
                    <span className={`text-[7px] xl:text-[8px] min-[1700px]:text-[9px] font-bold tracking-[0.12em] xl:tracking-[0.14em] min-[1700px]:tracking-[0.18em] ${serverStatus === 'live' ? 'text-emerald-300' : 'text-red-300'}`}>
                      {serverStatus === 'live' ? 'LIVE' : 'ERROR'}
                    </span>
                    <div className="h-2 xl:h-2.5 min-[1700px]:h-3 w-px bg-white/15" />
                    <span className="hidden xl:inline text-[8px] min-[1700px]:text-[9px] font-bold tracking-[0.14em] min-[1700px]:tracking-[0.18em] text-white/45">LAST UPDATED</span>
                    <span className="xl:hidden text-[9px] font-bold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap">
                      {lastSync.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                    </span>
                    <span className="hidden xl:inline min-[1700px]:hidden text-[9px] font-bold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap">
                      {lastSync.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                    </span>
                    <span className="hidden min-[1700px]:inline text-[11px] font-bold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap">
                      {lastSync.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} — {lastSync.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                    </span>
                  </div>
                )}

                {/* ✅ Notification bell — mobile + desktop dono par top-right */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setNotifOpen(v => !v)
                      setUnread(0)
                      try {
                        const saved = localStorage.getItem('rto_latest_notification')
                        if (saved) {
                          const item = JSON.parse(saved)
                          item.unread = false
                          localStorage.setItem('rto_latest_notification', JSON.stringify(item))
                        }
                      } catch {}
                    }}
                    aria-label="Notifications"
                    className="rto-run-border relative flex items-center justify-center rounded-full border border-transparent bg-[#071b15]/80 p-2.5 text-white/70 hover:text-white transition"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    {unread > 0 && (
                      <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
                    )}
                  </button>

                  {/* 1-second popup */}
                  {popup && (
                    <div className={`absolute right-0 top-full mt-2 z-50 px-3 py-2 rounded-xl border text-[11px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.4)] whitespace-nowrap ${
                      popup.type === 'success'
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                        : 'bg-red-500/15 border-red-400/40 text-red-300'
                    }`}>
                      {popup.type === 'success' ? '✓ ' : '⚠ '}{popup.message}
                    </div>
                  )}

                  {/* Notifications dropdown */}
                  {notifOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-white/10 bg-[#071b15] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-white/10 text-xs font-bold tracking-widest text-white/70">NOTIFICATIONS</div>
                        <div className="max-h-64 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="px-4 py-6 text-center text-xs text-white/40">No notifications yet</div>
                          ) : (
                            notifications.map(n => (
                              <div key={n.id} className="px-4 py-2.5 flex items-start gap-2.5">
                                <span className={`mt-0.5 text-xs font-bold ${n.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
                                  {n.type === 'success' ? '✓' : '⚠'}
                                </span>
                                <div>
                                  <div className="text-[11px] text-white/85">{n.message}</div>
                                  <div className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                                    n.type === 'success'
                                      ? 'border-emerald-400/30 bg-emerald-500/10'
                                      : 'border-red-400/30 bg-red-500/10'
                                  }`}>
                                    <svg className={`h-3 w-3 ${n.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="10" />
                                      <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <span className={`text-[10px] font-bold bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] ${
                                      n.type === 'success'
                                        ? 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]'
                                        : 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]'
                                    }`}>
                                      {n.time}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* ✅ Hamburger button — mobile only, top-right */}
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="Menu"
                  className="md:hidden relative flex items-center justify-center rounded-full border border-transparent bg-[#071b15]/80 p-2.5 text-white/70 hover:text-white transition"
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

          {/* ✅ Mobile: LIVE pill — header ke EXACT center mein (absolute, flex par depend nahi) */}
          {lastSync && (
            <div className="rto-run-border absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 lg:hidden flex items-center gap-1.5 rounded-full border border-transparent bg-[#071b15]/80 px-2.5 py-1.5 pointer-events-none">
              {serverStatus === 'live' ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                </span>
              ) : (
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse" />
                </span>
              )}
              <span className={`text-[8px] font-bold tracking-[0.14em] ${serverStatus === 'live' ? 'text-emerald-300' : 'text-red-300'}`}>
                {serverStatus === 'live' ? 'LIVE' : 'ERROR'}
              </span>
              <div className="h-2.5 w-px bg-white/15" />
              <span className={`text-[9px] font-bold bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap ${
                serverStatus === 'live'
                  ? 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]'
                  : 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]'
              }`}>
                {lastSync.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ===== Content ===== */}
      <main className="pt-24 pb-4 px-4 sm:px-6 max-w-[1750px] mx-auto flex flex-col">
        {view === 'dashboard' && <StatsView attendance={attendance} employees={employees} baseValues={baseValues} loading={loading} />}
        {view === 'attendance' && <AttendanceLogs rows={attendance} loading={loading} />}
        {view === 'hr' && <TotalHR rows={employees} loading={loading} onRefresh={load} />}
        {view === 'report' && <AttendanceReport rows={attendance} employees={employees} loading={loading} />}
      </main>
    </div>
  )
}

/* =========================================================
   DASHBOARD STATS VIEW (FIXED)
========================================================= */
function StatsView({ attendance, employees, baseValues, loading }: { attendance: Row[]; employees: Row[]; baseValues: { label: string; value: number; sort_order: number; type: string; present_target?: number | null }[]; loading: boolean }) {
  const normCnic = (v: any) => String(v ?? '').replace(/-/g, '').trim().toLowerCase()

  // ✅ FIX 2: Employees ko bhi filter karein taake FMOs/Managers TOTAL HR mein count na hon
  const validEmployees = employees.filter(e => {
    const desig = String(e.designation ?? '').toLowerCase()
    return !desig.includes('field monitoring') &&
           !desig.includes('weighbridge') &&
           !desig.includes('manager')
  })

  const latestDate = attendance.length > 0
    ? attendance.reduce((max, curr) => {
        const currDate = String(curr.date ?? curr.date_time ?? '').split(' ')[0]
        return currDate > max ? currDate : max
      }, '')
    : ''

  const valid = attendance.filter(r => {
    const cnic = String(r.cnic ?? '').replace(/-/g, '').trim()
    const desig = String(r.designation ?? '').toLowerCase()
    return cnic !== '' &&
      !desig.includes('field monitoring') &&
      !desig.includes('weighbridge') &&
      !desig.includes('manager')
  })

  const checkins = valid.filter(r => String(r.check_type ?? '').toLowerCase() === 'checkin').length
  const checkouts = valid.filter(r => String(r.check_type ?? '').toLowerCase() === 'checkout').length

  const checkinCnics = new Set(
    valid.filter(r => String(r.check_type ?? '').toLowerCase() === 'checkin').map(r => normCnic(r.cnic))
  )
  
  // ✅ FIX 3: PRESENT Logic Bug Fix!
  // Pehle aap checkin AUR checkout dono check kar rahe thay. CSV data mein abhi sirf 'checkin' hai.
  // Is wajah se har wo shakhs ABSENT count ho raha tha jis ne sirf check-in kiya tha.
  // Ab sirf check-in ko PRESENT count karenge.
  // ✅ Present = check-in AND check-out both; Absent = never checked in
  const checkoutCnics = new Set(
    valid.filter(r => String(r.check_type ?? '').toLowerCase() === 'checkout').map(r => normCnic(r.cnic))
  )
  const present = validEmployees.filter(e => {
    const k = normCnic(e.cnic)
    return checkinCnics.has(k) && checkoutCnics.has(k)
  }).length
  const absent = validEmployees.filter(e => !checkinCnics.has(normCnic(e.cnic))).length

  // ✅ Designation-wise breakdown: sirf 4 fixed rows, Total fixed, baqi real-time
  // ✅ Dashboard table: base_values se aayega (TOTAL HR bhi yahan hoga lekin usay skip karenge)
  // ✅ Map every employee CNIC to their designation, so attendance logs match
  // even if the log row's own designation text is different
  // ✅ Strip "(Fixed)" from designation for matching + display
  const stripFixed = (s: string) => s.replace(/\(fixed\)/gi, '').trim().toLowerCase()

  const empDesigByCnic = new Map<string, string>()
  for (const e of validEmployees) {
    empDesigByCnic.set(normCnic(e.cnic), stripFixed(String(e.designation ?? '')))
  }

  const designationBVs = baseValues.filter((b: { label: string; type?: string }) => b.label !== 'TOTAL HR' && (b.type ?? 'designation') === 'designation')
  const categoryBVs = baseValues
    .filter((b: { type?: string }) => (b.type ?? 'designation') === 'category')
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
  const desigList = designationBVs.map((row: { label: string; value: number }) => {
    const key = stripFixed(row.label)
    const hired = validEmployees.filter((e: Row) => stripFixed(String(e.designation ?? '')) === key).length
    const checkinSet = new Set<string>()
    const checkoutSet = new Set<string>()
    for (const r of valid) {
      const d = empDesigByCnic.get(normCnic(r.cnic))
      if (d !== key) continue
      const k = normCnic(r.cnic)
      const t = String(r.check_type ?? '').toLowerCase()
      if (t === 'checkin') checkinSet.add(k)
      else if (t === 'checkout') checkoutSet.add(k)
    }
    // Present = check-in AND check-out both (same logic as Report)
    const present = [...checkinSet].filter(k => checkoutSet.has(k)).length
    // Absent = employees who never checked in
    const absent = hired - checkinSet.size
    return {
      desig: row.label,
      total: row.value,
      hired,
      checkin: checkinSet.size,
      checkout: checkoutSet.size,
      present,
      absent,
    }
  })
  const totals = desigList.reduce(
    (acc: { total: number; hired: number; checkin: number; checkout: number; present: number; absent: number }, g: any) => ({
      total: acc.total + g.total,
      hired: acc.hired + g.hired,
      checkin: acc.checkin + g.checkin,
      checkout: acc.checkout + g.checkout,
      present: acc.present + g.present,
      absent: acc.absent + g.absent,
    }),
    { total: 0, hired: 0, checkin: 0, checkout: 0, present: 0, absent: 0 }
  )

  // ✅ Category-wise breakdown (work_type field): Total fixed, baqi real-time
  const empCatByCnic = new Map<string, string>()
  for (const e of validEmployees) {
    empCatByCnic.set(normCnic(e.cnic), String(e.work_type ?? '').trim().toLowerCase())
  }
  const catList = categoryBVs.map((row: { label: string; value: number; present_target?: number | null }) => {
    const key = row.label.toLowerCase()
    const hired = validEmployees.filter((e: Row) => String(e.work_type ?? '').trim().toLowerCase() === key).length
    const checkinSet = new Set<string>()
    const checkoutSet = new Set<string>()
    for (const r of valid) {
      // Match via employee CNIC → category (log row ke work_type par depend nahi)
      const c = empCatByCnic.get(normCnic(r.cnic))
      if (c !== key) continue
      const k = normCnic(r.cnic)
      const t = String(r.check_type ?? '').toLowerCase()
      if (t === 'checkin') checkinSet.add(k)
      else if (t === 'checkout') checkoutSet.add(k)
    }
    // Present = check-in AND check-out both; Absent = never checked in
    const present = [...checkinSet].filter(k => checkoutSet.has(k)).length
    const absent = hired - checkinSet.size
    return { cat: row.label, total: row.value, hired, checkin: checkinSet.size, checkout: checkoutSet.size, present, absent, target: row.present_target ?? null }
  })
  const catTotals = catList.reduce(
    (acc: { total: number; hired: number; checkin: number; checkout: number; present: number; absent: number }, g: any) => ({
      total: acc.total + g.total,
      hired: acc.hired + g.hired,
      checkin: acc.checkin + g.checkin,
      checkout: acc.checkout + g.checkout,
      present: acc.present + g.present,
      absent: acc.absent + g.absent,
    }),
    { total: 0, hired: 0, checkin: 0, checkout: 0, present: 0, absent: 0 }
  )

  // ✅ Total present target (Category Wise Total HR row ke liye)
  const totalPresentTarget = baseValues.find(b => b.type === 'total_present_target')?.value ?? null

  const showDate = latestDate
    ? new Date(latestDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const GREEN_NUM = 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'
  const RED_NUM = 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'

  const cards = [
    { label: 'TOTAL HR', value: 818, icon: <PeopleIcon />, num: GREEN_NUM, ring: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' },
    { label: 'ASSIGNED HR', value: validEmployees.length, icon: <PeopleIcon />, num: GREEN_NUM, ring: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' },
    { label: 'TOTAL CHECK-IN', value: checkins, icon: <CheckInIcon />, num: GREEN_NUM, ring: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' },
    { label: 'TOTAL CHECK-OUT', value: checkouts, icon: <CheckOutIcon />, num: GREEN_NUM, ring: 'border-sky-400/40 bg-sky-500/15 text-sky-300' },
    { label: 'PRESENT', value: present, icon: <PresentIcon />, num: GREEN_NUM, ring: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' },
    { label: 'ABSENT', value: absent, icon: <AbsentIcon />, num: RED_NUM, ring: 'border-red-400/40 bg-red-500/15 text-red-300' },
  ]

  return (
    <div>
      {/* ✅ Sticky heading block — scroll par cards is ke PEECHE se guzarti hain */}
      <div className="sticky top-[60px] sm:top-[64px] z-30 -mx-4 sm:-mx-6 -mt-8 px-4 sm:px-6 pt-6 sm:pt-8 pb-4 bg-[#021b16]">
        <h1 className="text-center text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-none">
          <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Attendance </span>
          <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Dashboard</span>
        </h1>
        <p className="mt-2 sm:mt-3 text-center text-[13px] font-bold tracking-wide text-emerald-400/70 sm:text-sm sm:font-normal sm:tracking-normal sm:text-white/45">Live monitoring — {showDate}</p>
      </div>

      <div className="mt-8 sm:mt-10 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-5">
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

      {/* ===== Designation + Category Wise — large screens par ek line mein ===== */}
      <div className="mt-10 mb-6 grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8 items-stretch">
        <div className="flex flex-col">
          <h2 className="text-center text-lg sm:text-xl font-extrabold tracking-wide bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
            Designation Wise
          </h2>

          <div className="mt-4 flex-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden rounded-[24px] border border-emerald-400/25 bg-linear-to-b from-[#073b2d] to-[#021d17] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <table className="h-full w-full table-fixed sm:table-auto min-w-[320px] sm:min-w-0 lg:min-w-0 text-left text-[10px] sm:text-sm [&_td]:px-2 sm:[&_td]:px-3 xl:[&_td]:px-2.5 [&_td]:py-2 sm:[&_td]:py-2.5 xl:[&_td]:py-3 [&_th]:px-2 sm:[&_th]:px-3 xl:[&_th]:px-2.5 [&_th]:py-2 sm:[&_th]:py-2.5 xl:[&_th]:py-3">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-2 sm:px-3 xl:px-2.5 py-2 sm:py-2.5 xl:py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">DESIGNATION</th>
                  <th className="px-2 sm:px-3 xl:px-2.5 py-2 sm:py-2.5 xl:py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">TOTAL</th>
                  <th className="px-2 sm:px-3 xl:px-2.5 py-2 sm:py-2.5 xl:py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">HIRED</th>
                  <th className="px-2 sm:px-3 xl:px-2.5 py-2 sm:py-2.5 xl:py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">CHECKIN</th>
                  <th className="px-2 sm:px-3 xl:px-2.5 py-2 sm:py-2.5 xl:py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">CHECKOUT</th>
                  <th className="px-2 sm:px-3 xl:px-2.5 py-2 sm:py-2.5 xl:py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">PRESENT</th>
                  <th className="px-2 sm:px-3 xl:px-2.5 py-2 sm:py-2.5 xl:py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">ABSENT</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-white/50">Loading statistics…</td>
                  </tr>
                ) : (
                  <>
                    {/* Total row (Excel ki tarah sab se upar) */}
                    <tr className="border-b border-white/10 bg-emerald-500/10">
                      <td className="px-4 py-3 font-extrabold text-white">Total HR</td>
                      <td className="px-4 py-3 font-extrabold text-emerald-300">{totals.total.toLocaleString()}</td>
                      <td className="px-4 py-3 font-extrabold text-emerald-300">{totals.hired.toLocaleString()}</td>
                      <td className="px-4 py-3 font-extrabold text-emerald-300">{totals.checkin.toLocaleString()}</td>
                      <td className="px-4 py-3 font-extrabold text-sky-300">{totals.checkout.toLocaleString()}</td>
                      <td className="px-4 py-3 font-extrabold text-emerald-300">{totals.present.toLocaleString()}</td>
                      <td className="px-4 py-3 font-extrabold text-red-300">{totals.absent.toLocaleString()}</td>
                    </tr>
                    {desigList.map(g => (
                      <tr key={g.desig} className="border-b border-white/5 last:border-0 transition-colors hover:bg-white/5">
                        <td className="px-4 py-3 font-semibold text-white/90">{g.desig}</td>
                        <td className="px-4 py-3 text-white/70">{g.total.toLocaleString()}</td>
                        <td className="px-4 py-3 text-white/70">{g.hired.toLocaleString()}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-300">{g.checkin.toLocaleString()}</td>
                        <td className="px-4 py-3 font-semibold text-sky-300">{g.checkout.toLocaleString()}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-300">{g.present.toLocaleString()}</td>
                        <td className="px-4 py-3 font-semibold text-red-300">{g.absent.toLocaleString()}</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== Category Wise Statistics Table ===== */}
        <div className="flex flex-col">
          <h2 className="text-center text-lg sm:text-xl font-extrabold tracking-wide bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
            Category Wise
          </h2>

          <div className="mt-4 flex-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden rounded-[24px] border border-emerald-400/25 bg-linear-to-b from-[#073b2d] to-[#021d17] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <table className="h-full w-full table-fixed sm:table-auto min-w-[320px] sm:min-w-0 lg:min-w-0 text-left text-[10px] sm:text-sm [&_td]:px-2 sm:[&_td]:px-3 xl:[&_td]:px-2.5 [&_td]:py-2 sm:[&_td]:py-2.5 xl:[&_td]:py-3 [&_th]:px-2 sm:[&_th]:px-3 xl:[&_th]:px-2.5 [&_th]:py-2 sm:[&_th]:py-2.5 xl:[&_th]:py-3">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-2 sm:px-3 xl:px-2.5 py-2 sm:py-2.5 xl:py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">CATEGORY</th>
                  <th className="px-2 sm:px-3 xl:px-2.5 py-2 sm:py-2.5 xl:py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">TOTAL</th>
                  <th className="px-2 sm:px-3 xl:px-2.5 py-2 sm:py-2.5 xl:py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">HIRED</th>
                  <th className="px-2 sm:px-3 xl:px-2.5 py-2 sm:py-2.5 xl:py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">CHECKIN</th>
                  <th className="px-2 sm:px-3 xl:px-2.5 py-2 sm:py-2.5 xl:py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">CHECKOUT</th>
                  <th className="px-2 sm:px-3 xl:px-2.5 py-2 sm:py-2.5 xl:py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">PRESENT</th>
                  <th className="px-2 sm:px-3 xl:px-2.5 py-2 sm:py-2.5 xl:py-3 font-bold tracking-widest text-white/70 whitespace-nowrap">ABSENT</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-white/50">Loading statistics…</td>
                  </tr>
                ) : (
                  <>
                    {/* Total row */}
                    <tr className="border-b border-white/10 bg-emerald-500/10">
                      <td className="px-4 py-3 font-extrabold text-white">Total HR</td>
                      <td className="px-4 py-3 font-extrabold text-emerald-300">{catTotals.total.toLocaleString()}</td>
                      <td className="px-4 py-3 font-extrabold text-emerald-300">{catTotals.hired.toLocaleString()}</td>
                      <td className="px-4 py-3 font-extrabold text-emerald-300">{catTotals.checkin.toLocaleString()}</td>
                      <td className="px-4 py-3 font-extrabold text-sky-300">{catTotals.checkout.toLocaleString()}</td>
                      <td className={`px-4 py-3 font-extrabold ${totalPresentTarget != null && catTotals.present < totalPresentTarget ? 'text-yellow-300' : 'text-emerald-300'}`}>{catTotals.present.toLocaleString()}</td>
                      <td className="px-4 py-3 font-extrabold text-red-300">{catTotals.absent.toLocaleString()}</td>
                    </tr>
                    {catList.map(g => (
                      <tr key={g.cat} className="border-b border-white/5 last:border-0 transition-colors hover:bg-white/5">
                        <td className="px-4 py-3 font-semibold text-white/90">{g.cat}</td>
                        <td className="px-4 py-3 text-white/70">{g.total.toLocaleString()}</td>
                        <td className="px-4 py-3 text-white/70">{g.hired.toLocaleString()}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-300">{g.checkin.toLocaleString()}</td>
                        <td className="px-4 py-3 font-semibold text-sky-300">{g.checkout.toLocaleString()}</td>
                        <td
                          className={`px-4 py-3 font-semibold ${g.target != null && g.present < g.target ? 'text-yellow-300' : 'text-emerald-300'}`}
                          title={g.target != null ? `Present target: ${g.target.toLocaleString()}` : undefined}
                        >
                          {g.present.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-red-300">{g.absent.toLocaleString()}</td>
                      </tr>
                    ))} 
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function PeopleIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function CheckInIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

function TotalIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </svg>
  )
}

function PresentIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9.5" cy="6.5" r="3.5" />
      <path d="M3 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 1.8.33" />
      <circle cx="17" cy="17" r="4.5" />
      <path d="m15.2 17 1.3 1.3 2.3-2.3" />
    </svg>
  )
}

function AbsentIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9.5" cy="6.5" r="3.5" />
      <path d="M3 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 1.8.33" />
      <circle cx="17" cy="17" r="4.5" />
      <path d="m15.5 15.5 3 3" />
      <path d="m18.5 15.5-3 3" />
    </svg>
  )
}