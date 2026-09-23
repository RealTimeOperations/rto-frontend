import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import ContainersMap from './ContainersMap'
import ContainersReport from './ContainersReport'

type Props = {
  onHomeClick?: () => void
}

type Row = Record<string, any>
type View = 'stats' | 'map' | 'report'
// ✅ Python naive local time ko LOCAL samjho (Supabase timestamptz use UTC assume karta hai)
function parseLocal(s: string): Date {
  const clean = String(s).replace('Z', '').replace(/[+-]\d{2}:\d{2}$/, '').replace(' ', 'T')
  const d = new Date(clean)
  return isNaN(d.getTime()) ? new Date(s) : d
}
// Fixed vehicle lists (old project jaisi)
const COMPACTORS = ['HND-CT001', 'HND-CT003', 'HND-CT004', 'HND-CT005', 'HND-CT006']
const ARMROLLS = ['HND-AR002', 'HND-AR003', 'HND-AR004', 'HND-AR005']

// Running gradient number styles (RTO theme) — POORI literal strings, taake Tailwind JIT ye classes generate kare
const WHITE_NUM = 'bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'
const EMERALD_NUM = 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'
const SKY_NUM = 'bg-[linear-gradient(180deg,#0ea5e9,#38bdf8,#7dd3fc,#38bdf8,#0ea5e9)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'
const RED_NUM = 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'
const AMBER_NUM = 'bg-[linear-gradient(180deg,#f59e0b,#fbbf24,#fde68a,#fbbf24,#f59e0b)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'
const PURPLE_NUM = 'bg-[linear-gradient(180deg,#a855f7,#c084fc,#d8b4fe,#c084fc,#a855f7)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'
const ORANGE_NUM = 'bg-[linear-gradient(180deg,#f97316,#fb923c,#fdba74,#fb923c,#f97316)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'

type ContainerInfo = {
  site: string
  category: '0.8cm' | '5cm'
  status: 'Completed' | 'Pending' | 'Mismatch'
  supervisor: string
  vehicle: string
  lat: number
  lon: number
}

// Locations + portal_data join -> per-container status (old logic jaisi)
function buildContainers(locations: Row[], portal: Row[]): ContainerInfo[] {
  const bySite = new Map<string, Row>()
  for (const p of portal) bySite.set(String(p.site ?? ''), p)
  return locations.map(loc => {
    const site = String(loc.site ?? '')
    const p = bySite.get(site)
    const tracker = String(p?.serviced_by_tracker ?? '').trim().toUpperCase()
    const app = String(p?.serviced_on_app ?? '').trim().toUpperCase()
    let status: ContainerInfo['status']
    if (!p || tracker === '' || app === '') status = 'Mismatch'
    else if (tracker === 'YES' && app === 'YES') status = 'Completed'
    else if (tracker === 'NO' && app === 'NO') status = 'Pending'
    else status = 'Mismatch'
    return {
      site,
      category: String(loc.category ?? '').includes('0.8') ? '0.8cm' : '5cm',
      status,
      supervisor: String(loc.supervisor ?? '').trim() || 'Unknown',
      vehicle: String(p?.app_vehicle ?? '').trim(),
      lat: Number(loc.lat ?? 0),
      lon: Number(loc.lon ?? 0),
    }
  })
}

function vehicleCode(v: string) {
  return v.includes('/') ? v.split('/').pop()!.trim() : v.trim()
}

// Animated goal ring (SVG)
function GoalRing({ percent, label, gradientId, colors, textClass }: {
  percent: number
  label: string
  gradientId: string
  colors: [string, string]
  textClass: string
}) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setShown(percent), 150)
    return () => clearTimeout(t)
  }, [percent])
  const circumference = 408.4
  const offset = circumference - (circumference * shown) / 100
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-[105px] sm:max-w-[120px]">
        <svg viewBox="0 0 160 160" className="block w-full h-auto" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={80} cy={80} r={65} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={14} />
          <circle
            cx={80} cy={80} r={65} fill="none"
            stroke={`url(#${gradientId})`} strokeWidth={14}
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.5s ease' }}
          />
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors[0]} />
              <stop offset="100%" stopColor={colors[1]} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg sm:text-xl font-extrabold ${textClass}`}>{shown}%</span>
        </div>
      </div>
      <span className="mt-2 text-[11px] sm:text-xs font-semibold text-white/70">{label}</span>
    </div>
  )
}

export default function ContainersDashboard({ onHomeClick }: Props) {
  const navigate = useNavigate()

  // ✅ Tab persistence: refresh par wahi tab khule jo pehle khula tha
  const [view, setView] = useState<View>(() => {
    try {
      const saved = localStorage.getItem('rto_containers_tab') as View | null
      if (saved && ['stats', 'map', 'report'].includes(saved)) return saved
    } catch {}
    return 'stats'
  })

  useEffect(() => {
    try { localStorage.setItem('rto_containers_tab', view) } catch {}
  }, [view])
  const [locations, setLocations] = useState<Row[]>([])
  const [portal, setPortal] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)   // portal_data ka last sync time

  // Server status (containers heartbeat id=2)
  const [serverStatus, setServerStatus] = useState<'live' | 'error'>(() => {
    try { return localStorage.getItem('rto_cont_server_status') === 'error' ? 'error' : 'live' } catch { return 'live' }
  })
  const statusRef = useRef<'live' | 'error'>(serverStatus)
  const lastErrMsgRef = useRef<string>((() => {
    try {
      const saved = localStorage.getItem('rto_cont_latest_notification')
      const n = saved ? JSON.parse(saved) : null
      return n?.type === 'error' ? String(n.message || '') : ''
    } catch { return '' }
  })())
  function setStatus(s: 'live' | 'error') {
    if (statusRef.current === s) return
    const prev = statusRef.current
    statusRef.current = s
    setServerStatus(s)
    try { localStorage.setItem('rto_cont_server_status', s) } catch {}
    // ✅ error -> live transition (VBS/bat se start) par foran Server Started notify
    if (s === 'live' && prev === 'error') notifyServerStarted()
  }

  // Notifications (same pattern as attendance)
  const [notifications, setNotifications] = useState<{ id: number; type: 'success' | 'error'; message: string; time: string; unread?: boolean }[]>(() => {
    try {
      const saved = localStorage.getItem('rto_cont_latest_notification')
      if (saved) {
        const item = JSON.parse(saved)
        if (item && item.message) return [item]
      }
    } catch {}
    return []
  })
  const [unread, setUnread] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('rto_cont_latest_notification')
      if (saved) return JSON.parse(saved)?.unread ? 1 : 0
    } catch {}
    return 0
  })
  const [popup, setPopup] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const popupTimer = useRef<number | null>(null)
  const notifId = useRef(0)

  function pushNotification(type: 'success' | 'error', message: string, at?: Date) {
    notifId.current += 1
    const d = at ?? new Date()   // ✅ Event time pass ho to wahi use ho
    const item = {
      id: notifId.current,
      type,
      message,
      time: d.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
    }
    const savedItem = { ...item, unread: true }
    setNotifications([savedItem])
    setUnread(1)
    try { localStorage.setItem('rto_cont_latest_notification', JSON.stringify(savedItem)) } catch {}
    setPopup({ type, message })
    if (popupTimer.current) window.clearTimeout(popupTimer.current)
    popupTimer.current = window.setTimeout(() => setPopup(null), 1000)
  }
  function notifyError(msg: string) {
    if (statusRef.current !== 'error' || lastErrMsgRef.current !== msg) {
      pushNotification('error', msg)
    }
    lastErrMsgRef.current = msg
    setStatus('error')
  }

  // Heartbeat event dedup key
  const lastHbKeyRef = useRef<string>((() => {
    try { return localStorage.getItem('rto_cont_hb_key') || '' } catch { return '' }
  })())
  function rememberHbKey(key: string) {
    lastHbKeyRef.current = key
    try { localStorage.setItem('rto_cont_hb_key', key) } catch {}
  }
  // ✅ Server-start notification with 20s dedup (VBS / bat / admin — har tarika cover)
  const lastStartNotifyRef = useRef(0)
  function notifyServerStarted() {
    const nowMs = Date.now()
    if (nowMs - lastStartNotifyRef.current < 20_000) return
    lastStartNotifyRef.current = nowMs
    pushNotification('success', 'Server Started')
  }

  // Data change fingerprint
  const fpRef = useRef<string | null>(null)

  // ---- Load locations + portal data + containers heartbeat
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [loc, por, hb] = await Promise.all([
        supabase.from('contanerlocations').select('site, category, supervisor, lat, lon').order('site', { ascending: true }),
        supabase.from('conatnersportaldata').select('site, container_serviced, serviced_on_app, serviced_by_tracker, app_vehicle, app_date_time, fetched_at'),
        supabase.from('system_heartbeat').select('status, message, updated_at').eq('id', 2).maybeSingle(),
      ])
      if (loc.error) throw loc.error
      if (por.error) throw por.error
      if (hb.error) throw hb.error

      const locRows = loc.data ?? []
      const porRows = por.data ?? []
      setLocations(locRows)
      setPortal(porRows)
      // ✅ Last Updated = portal_data ka sab se naya fetched_at — LOCAL parse (timezone shift fix)
      let maxT = 0
      for (const r of porRows) {
        const t = r.fetched_at ? parseLocal(r.fetched_at).getTime() : 0
        if (t > maxT) maxT = t
      }
      const syncTime = maxT ? new Date(maxT) : null
      if (syncTime) setLastUpdated(syncTime)
      // ✅ Data change detection → EK hi time (syncTime) pill + notification DONO mein same
      const fp = porRows
        .map(r => `${r.site}|${r.container_serviced}|${r.serviced_on_app}|${r.serviced_by_tracker}|${r.app_vehicle}`)
        .join('~')
      if (fpRef.current === null) fpRef.current = fp
      else if (fp !== fpRef.current) {
        fpRef.current = fp
        if (syncTime) pushNotification('success', 'Data successfully updated', syncTime)
      }
      // Containers heartbeat (id = 2)
      const h = hb.data
      const hbKeyRaw = h?.updated_at ? String(h.updated_at) : ''
      const hbTime = hbKeyRaw ? parseLocal(hbKeyRaw).getTime() : 0
      const ageMs = hbTime ? Date.now() - hbTime : Infinity
      const status = String(h?.status ?? '').toLowerCase()
      const hbKey = hbKeyRaw
      const evTime = hbTime ? new Date(hbTime) : new Date()
      if (status === 'containers_stopped') {
        if (hbKey && hbKey !== lastHbKeyRef.current) pushNotification('error', 'Server Stopped', evTime)
        if (hbKey) rememberHbKey(hbKey)
        setStatus('error')
      } else if (status === 'containers_started') {
        if (hbKey && hbKey !== lastHbKeyRef.current) notifyServerStarted()
        if (hbKey) rememberHbKey(hbKey)
        setStatus('live')
      } else if (status === 'containers_data_updated') {
        // ✅ Notification upar fp-detection se ho chuki (SAME syncTime) — yahan sirf key + live
        if (hbKey) rememberHbKey(hbKey)
        setStatus('live')
      } else if (status === 'containers_error') {
        if (hbKey) rememberHbKey(hbKey)
        notifyError('Error: Portal Issue')
      } else if (!h || ageMs > 90_000) {
        notifyError('Server Stopped')
      } else {
        if (hbKey) rememberHbKey(hbKey)
        if (statusRef.current === 'error') setStatus('live')
      }
    } catch (e) {
      console.error('Containers load error:', e)
      notifyError('Error: Portal Issue')
    } finally {
      if (!silent) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load(false)
    const t = setInterval(() => load(true), 15_000)
    return () => clearInterval(t)
  }, [load])

  // ---- Sliding pill (header tabs)
  const navRef = useRef<HTMLDivElement>(null)
  const [slider, setSlider] = useState({ left: 0, width: 0 })
  const [menuOpen, setMenuOpen] = useState(false)
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

  // ---- Stats computation (client-side)
  const containers = useMemo(() => buildContainers(locations, portal), [locations, portal])
  const stats = useMemo(() => {
    const per: Record<'0.8cm' | '5cm', { total: number; completed: number; pending: number; mismatch: number }> = {
      '0.8cm': { total: 0, completed: 0, pending: 0, mismatch: 0 },
      '5cm': { total: 0, completed: 0, pending: 0, mismatch: 0 },
    }
    const vehicleCounts: Record<string, number> = {}
    const supMap = new Map<string, { total: number; vehicles: Record<string, number> }>()

    for (const c of containers) {
      const bucket = per[c.category]
      bucket.total += 1
      if (c.status === 'Completed') bucket.completed += 1
      else if (c.status === 'Pending') bucket.pending += 1
      else bucket.mismatch += 1

      if (c.status === 'Completed') {
        const code = vehicleCode(c.vehicle)
        if (COMPACTORS.includes(code) || ARMROLLS.includes(code)) {
          vehicleCounts[code] = (vehicleCounts[code] ?? 0) + 1
        }
        const rec = supMap.get(c.supervisor) ?? { total: 0, vehicles: {} }
        rec.total += 1
        if (code) rec.vehicles[code] = (rec.vehicles[code] ?? 0) + 1
        supMap.set(c.supervisor, rec)
      }
    }

    const totalAll = containers.length
    const completedAll = per['0.8cm'].completed + per['5cm'].completed
    const pendingAll = per['0.8cm'].pending + per['5cm'].pending
    const mismatchAll = per['0.8cm'].mismatch + per['5cm'].mismatch
    const targetCount = Math.round(totalAll * 0.9)
    const remaining = Math.max(0, targetCount - completedAll)
    const supervisors = [...supMap.entries()].sort((a, b) => b[1].total - a[1].total)

    return { per, totalAll, completedAll, pendingAll, mismatchAll, targetCount, remaining, vehicleCounts, supervisors }
  }, [containers])

  const completedPct = stats.totalAll ? Math.round((stats.completedAll / stats.totalAll) * 100) : 0
  const pendingPct = stats.totalAll ? Math.round((stats.pendingAll / stats.totalAll) * 100) : 0
  const mismatchPct = stats.totalAll ? Math.round((stats.mismatchAll / stats.totalAll) * 100) : 0
  const targetPct = stats.targetCount ? Math.min(100, Math.round((stats.completedAll / stats.targetCount) * 100)) : 0

  const tabs: { key: View; label: string }[] = [
    { key: 'stats', label: 'Containers Statistics' },
    { key: 'map', label: 'Containers Map' },
    { key: 'report', label: 'Containers Report' },
  ]

  const cardCls = 'rounded-[24px] border border-emerald-400/25 bg-linear-to-b from-[#073b2d] to-[#021d17] shadow-[0_20px_60px_rgba(0,0,0,0.3)]'

  return (
    <div className="rto-cont-scroll min-h-dvh overflow-x-clip bg-[#021b16] text-white">
      {/* ✅ Theme scrollbars — sirf Containers monitoring ke mount hone par active */}
      <style>{`
        html { scrollbar-color: rgba(16,185,129,0.45) #021b16; scrollbar-width: thin; }
        html::-webkit-scrollbar { width: 10px; height: 10px; }
        html::-webkit-scrollbar-track { background: #021b16; }
        html::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.45); border-radius: 8px; }
        html::-webkit-scrollbar-thumb:hover { background: rgba(16,185,129,0.7); }
        html::-webkit-scrollbar-corner { background: transparent; }
        .rto-cont-scroll * { scrollbar-width: thin; scrollbar-color: rgba(16,185,129,0.45) rgba(2,27,22,0.6); }
        .rto-cont-scroll *::-webkit-scrollbar { width: 8px; height: 8px; }
        .rto-cont-scroll *::-webkit-scrollbar-track { background: rgba(2,27,22,0.6); border-radius: 8px; }
        .rto-cont-scroll *::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.45); border-radius: 8px; }
        .rto-cont-scroll *::-webkit-scrollbar-thumb:hover { background: rgba(16,185,129,0.7); }
        .rto-cont-scroll *::-webkit-scrollbar-corner { background: transparent; }
      `}</style>
      {/* ===== Top Navbar (attendance jaisa) ===== */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="relative flex items-center px-3 sm:px-6 py-3 pointer-events-auto md:pointer-events-none bg-[#021b16] border-b border-white/10 md:border-b-0 shadow-[0_6px_24px_rgba(0,0,0,0.45)] md:shadow-none">
          {/* Left: Home */}
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

          {/* Center: tabs */}
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
                        view === t.key ? 'bg-emerald-500/15 text-emerald-300' : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}

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

          {/* Right: live pill + bell + hamburger */}
          <div className="flex-1 flex justify-end items-center gap-2.5 pr-1 sm:pr-3 pointer-events-auto">
            {lastUpdated && (
              <div className="rto-run-border relative hidden lg:flex items-center gap-1 xl:gap-1.5 2xl:gap-2 rounded-full border border-transparent bg-[#071b15]/80 px-2.5 py-1 xl:px-3 xl:py-1.5 2xl:px-4 2xl:py-2">
                {serverStatus === 'live' ? (
                  <span className="relative flex h-1.5 w-1.5 xl:h-2 xl:w-2 2xl:h-2.5 2xl:w-2.5" title="Containers fetching live">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 xl:h-2 xl:w-2 2xl:h-2.5 2xl:w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                  </span>
                ) : (
                  <span className="relative flex h-1.5 w-1.5 xl:h-2 xl:w-2 2xl:h-2.5 2xl:w-2.5" title="Containers fetching band hai">
                    <span className="relative inline-flex h-1.5 w-1.5 xl:h-2 xl:w-2 2xl:h-2.5 2xl:w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse" />
                  </span>
                )}
                <span className={`text-[7px] xl:text-[8px] 2xl:text-[9px] font-bold tracking-[0.12em] xl:tracking-[0.14em] 2xl:tracking-[0.18em] ${serverStatus === 'live' ? 'text-emerald-300' : 'text-red-300'}`}>
                  {serverStatus === 'live' ? 'LIVE' : 'ERROR'}
                </span>
                <div className="h-2 xl:h-2.5 2xl:h-3 w-px bg-white/15" />
                <span className="hidden xl:inline text-[8px] 2xl:text-[9px] font-bold tracking-[0.14em] 2xl:tracking-[0.18em] text-white/45">LAST UPDATED</span>
                <span className="xl:hidden text-[9px] font-bold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap">
                  {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </span>
                <span className="hidden xl:inline 2xl:hidden text-[9px] font-bold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap">
                  {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </span>
                <span className="hidden 2xl:inline text-[11px] font-bold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap">
                  {`${String(lastUpdated.getDate()).padStart(2, '0')}-${String(lastUpdated.getMonth() + 1).padStart(2, '0')}-${lastUpdated.getFullYear()}`} — {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </span>
              </div>
            )}

            {/* Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(v => !v)
                  setUnread(0)
                  try {
                    const saved = localStorage.getItem('rto_cont_latest_notification')
                    if (saved) {
                      const item = JSON.parse(saved)
                      item.unread = false
                      localStorage.setItem('rto_cont_latest_notification', JSON.stringify(item))
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
                {unread > 0 && <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]" />}
              </button>

              {popup && (
                <div className={`absolute right-0 top-full mt-2 z-50 px-3 py-2 rounded-xl border text-[11px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.4)] whitespace-nowrap ${
                  popup.type === 'success' ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300' : 'bg-red-500/15 border-red-400/40 text-red-300'
                }`}>
                  {popup.type === 'success' ? '✓ ' : '⚠ '}{popup.message}
                </div>
              )}

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
                                n.type === 'success' ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-red-400/30 bg-red-500/10'
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

            {/* Hamburger */}
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

          {/* Mobile center pill */}
          {lastUpdated && (
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
                {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ===== Content ===== */}
      {view === 'map' && <ContainersMap containers={containers} />}

      {view !== 'map' && (
      <main className={`px-4 sm:px-6 max-w-[1750px] mx-auto flex flex-col ${view === 'report' ? 'pt-24 pb-4 h-dvh overflow-hidden' : 'pt-24 pb-6'}`}>
        {view === 'stats' && (
          <div className="flex flex-col gap-6">
            {/* ===== Sticky heading block — scroll par cards is ke PEECHE se guzarti hain ===== */}
            <div className="sticky top-[60px] sm:top-[64px] z-30 -mx-4 sm:-mx-6 -mt-8 px-4 sm:px-6 pt-6 sm:pt-8 pb-4 bg-[#021b16]">
              <h1 className="text-center text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-none">
                <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Containers </span>
                <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Dashboard</span>
              </h1>
              <p className="mt-2 sm:mt-3 text-center text-[11px] sm:text-sm md:text-[15px] font-semibold tracking-[0.08em] text-white/40 whitespace-nowrap">
                Live monitoring — {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>

            {/* ===== Section heading ===== */}
            <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold flex items-center gap-3 -mb-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                </svg>
              </span>
              <span className={WHITE_NUM}>Containers </span>
              <span className={EMERALD_NUM}>Statistics</span>
            </h2>

            {/* Main 3-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Column 1: Overall Containers */}
              <div className={`${cardCls} p-5`}>
                <h3 className="text-sm sm:text-base font-bold flex items-center gap-2 text-white mb-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-emerald-300">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                    </svg>
                  </span>
                  Overall Containers Statistics
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-xs font-semibold text-white">Total</span>
                    <span className={`text-2xl font-extrabold ${WHITE_NUM}`}>{loading && !stats.totalAll ? '—' : stats.totalAll.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-xs font-semibold text-white">Completed</span>
                    <span className={`text-xl font-extrabold ${EMERALD_NUM}`}>{stats.completedAll.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-xs font-semibold text-white">Pending</span>
                    <span className={`text-xl font-extrabold ${SKY_NUM}`}>{stats.pendingAll.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-xs font-semibold text-white">Mismatch</span>
                    <span className={`text-xl font-extrabold ${RED_NUM}`}>{stats.mismatchAll.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 pt-3 mt-1 border-t-2 border-white/15">
                    <span className="text-xs font-semibold text-white">Target (90%)</span>
                    <span className={`text-lg font-extrabold ${AMBER_NUM}`}>379</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xs font-semibold text-white">Remaining</span>
                    <span className={`text-lg font-extrabold ${RED_NUM}`}>{stats.remaining.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Column 2: Goal Progress */}
              <div className={`${cardCls} p-5`}>
                <h3 className="text-base font-bold mb-4 flex items-center gap-2 text-white">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-amber-300">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  </span>
                  Goal Progress
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <GoalRing percent={completedPct} label="Completed" gradientId="cgCompleted" colors={['#34d399', '#10b981']} textClass="text-emerald-300" />
                  <GoalRing percent={pendingPct} label="Pending" gradientId="cgPending" colors={['#60a5fa', '#3b82f6']} textClass="text-sky-300" />
                  <GoalRing percent={mismatchPct} label="Mismatch" gradientId="cgMismatch" colors={['#f87171', '#ef4444']} textClass="text-red-300" />
                  <GoalRing percent={targetPct} label="Target (90%)" gradientId="cgTarget" colors={['#fbbf24', '#f59e0b']} textClass="text-amber-300" />
                </div>
                <div className="w-full space-y-2 mt-4">
                  <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-black/25">
                    <span className="text-xs text-white/90 font-semibold flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Completed
                    </span>
                    <span className={`text-sm font-extrabold ${EMERALD_NUM}`}>{stats.completedAll.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-black/25">
                    <span className="text-xs text-white/90 font-semibold flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Pending
                    </span>
                    <span className={`text-sm font-extrabold ${SKY_NUM}`}>{stats.pendingAll.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-black/25">
                    <span className="text-xs text-white/90 font-semibold flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Mismatch
                    </span>
                    <span className={`text-sm font-extrabold ${RED_NUM}`}>{stats.mismatchAll.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-black/25 border border-amber-400/30">
                    <span className="text-xs text-white/90 font-semibold flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Target (90%)
                    </span>
                    <span className={`text-sm font-extrabold ${AMBER_NUM}`}>379</span>
                  </div>
                </div>
              </div>

              {/* Column 3: 0.8cm + 5cm */}
              <div className="flex flex-col gap-6">
                <div className={`${cardCls} p-5 flex-1`}>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <span className="w-3 h-3 bg-emerald-400 rounded-full shadow-lg" /> 0.8cm Containers
                    </h4>
                    <span className="text-xs text-white px-3 py-1 rounded-full font-semibold border border-white/20 bg-white/10">
                      Total: <span className={EMERALD_NUM}>{stats.per['0.8cm'].total}</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-xl border border-emerald-400/30 bg-emerald-500/15">
                      <div className={`text-2xl font-extrabold ${EMERALD_NUM} mb-1`}>{stats.per['0.8cm'].completed}</div>
                      <div className="text-xs text-white/80 font-semibold">Completed</div>
                    </div>
                    <div className="text-center p-3 rounded-xl border border-sky-400/30 bg-sky-500/15">
                      <div className={`text-2xl font-extrabold ${SKY_NUM} mb-1`}>{stats.per['0.8cm'].pending}</div>
                      <div className="text-xs text-white/80 font-semibold">Pending</div>
                    </div>
                    <div className="text-center p-3 rounded-xl border border-red-400/30 bg-red-500/15">
                      <div className={`text-2xl font-extrabold ${RED_NUM} mb-1`}>{stats.per['0.8cm'].mismatch}</div>
                      <div className="text-xs text-white/80 font-semibold">Mismatch</div>
                    </div>
                  </div>
                </div>

                <div className={`${cardCls} p-5 flex-1`}>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <span className="w-3 h-3 bg-purple-400 rounded-full shadow-lg" /> 5cm Containers
                    </h4>
                    <span className="text-xs text-white px-3 py-1 rounded-full font-semibold border border-white/20 bg-white/10">
                      Total: <span className={PURPLE_NUM}>{stats.per['5cm'].total}</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-xl border border-purple-400/30 bg-purple-500/15">
                      <div className={`text-2xl font-extrabold ${PURPLE_NUM} mb-1`}>{stats.per['5cm'].completed}</div>
                      <div className="text-xs text-white/80 font-semibold">Completed</div>
                    </div>
                    <div className="text-center p-3 rounded-xl border border-amber-400/30 bg-amber-500/15">
                      <div className={`text-2xl font-extrabold ${AMBER_NUM} mb-1`}>{stats.per['5cm'].pending}</div>
                      <div className="text-xs text-white/80 font-semibold">Pending</div>
                    </div>
                    <div className="text-center p-3 rounded-xl border border-orange-400/30 bg-orange-500/15">
                      <div className={`text-2xl font-extrabold ${ORANGE_NUM} mb-1`}>{stats.per['5cm'].mismatch}</div>
                      <div className="text-xs text-white/80 font-semibold">Mismatch</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle Performance */}
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/10 text-sky-300">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 17h4V5H2v12h3" />
                    <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" />
                    <circle cx="7.5" cy="17.5" r="2.5" />
                    <circle cx="17.5" cy="17.5" r="2.5" />
                  </svg>
                </span>
                <span className={WHITE_NUM}>Vehicle </span>
                <span className={EMERALD_NUM}>Performance</span>
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`${cardCls} p-6`}>
                  <h4 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-base">🚚</span>
                    Compactors (0.8cm Containers)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {COMPACTORS.map(code => {
                      const count = stats.vehicleCounts[code] ?? 0
                      return (
                        <div key={code} className={`rounded-xl p-4 text-center border ${count > 0 ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-white/10 bg-white/5 opacity-50'}`}>
                          <div className="text-xs font-bold text-white/80 mb-2">{code}</div>
                          <div className={`text-3xl font-extrabold mb-1 ${count > 0 ? EMERALD_NUM : 'text-white/30'}`}>{count}</div>
                          <div className="text-xs text-white/60">Containers</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className={`${cardCls} p-6`}>
                  <h4 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-base">🚛</span>
                    Arm Roll Trucks (5cm Containers)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {ARMROLLS.map(code => {
                      const count = stats.vehicleCounts[code] ?? 0
                      return (
                        <div key={code} className={`rounded-xl p-4 text-center border ${count > 0 ? 'border-sky-400/30 bg-sky-500/10' : 'border-white/10 bg-white/5 opacity-50'}`}>
                          <div className="text-xs font-bold text-white/80 mb-2">{code}</div>
                          <div className={`text-3xl font-extrabold mb-1 ${count > 0 ? SKY_NUM : 'text-white/30'}`}>{count}</div>
                          <div className="text-xs text-white/60">Containers</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Supervisor Performance */}
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-base">👥</span>
                <span className={WHITE_NUM}>Supervisor </span>
                <span className={EMERALD_NUM}>Performance</span>
              </h3>
              {stats.supervisors.length === 0 ? (
                <div className={`${cardCls} p-6 text-center text-white/50 text-sm`}>
                  {loading ? 'Loading supervisor data…' : 'No completed containers yet — supervisor stats will appear here.'}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3">
                  {stats.supervisors.map(([sup, info]) => (
                    <div key={sup} className="rounded-xl border border-emerald-400/20 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-emerald-400/30 bg-emerald-500/15 text-emerald-300 flex-shrink-0">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
                              <path d="M12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" />
                            </svg>
                          </span>
                          <span className="text-xs font-bold text-white/90 truncate">{sup}</span>
                        </div>
                        <span className="text-[10px] font-bold text-white/80 bg-white/10 border border-white/15 rounded-full px-2 py-0.5 whitespace-nowrap flex-shrink-0">
                          {info.total} Total
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(info.vehicles).map(([v, n]) => (
                          <span key={v} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10">
                            <span className="text-[9px] font-bold text-white/80">{v}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white ${v.includes('CT') ? 'bg-emerald-500/40' : v.includes('AR') ? 'bg-sky-500/40' : 'bg-white/20'}`}>
                              {n}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'report' && <ContainersReport locations={locations} portal={portal} />}
      </main>
      )}
    </div>
  )
}