import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Penalties from './Penalties'
import FMOStatistics from './FMOStatistics'
import { resetMonitoringTabs } from '../../lib/resetTabs'
import { toBlob } from 'html-to-image'

type Row = Record<string, any>
type View = 'dashboard' | 'list' | 'fmo'

type Props = {
  onHomeClick?: () => void
  permissions?: any
}

// ✅ Supabase timestamptz ko UTC samajh kar store karta hai (Python naive local time bhejta hai) —
// is liye offset ignore kar ke string ko LOCAL time samjho, taake pill ka time notification se match kare
function parseLocal(s: string): Date {
  const clean = String(s).replace('Z', '').replace(/[+-]\d{2}:\d{2}$/, '').replace(' ', 'T')
  const d = new Date(clean)
  return isNaN(d.getTime()) ? new Date(s) : d
}

/* ✅ Circular percentage ring (donut chart) — responsive */
function RingChart({ label, value, percent, color }: { label: string; value: number; percent: number; color: string }) {
  const r = 40
  const c = 2 * Math.PI * r
  const off = c - (Math.max(0, Math.min(100, percent)) / 100) * c
  return (
    <div className="flex flex-col items-center gap-1 sm:gap-2">
      <div className="relative h-20 w-20 sm:h-28 sm:w-28 md:h-32 md:w-32 lg:h-36 lg:w-36">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={off}
            className="transition-all duration-700 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-extrabold" style={{ color }}>
            {Math.round(percent)}%
          </span>
          <span className="text-[9px] sm:text-[11px] md:text-xs font-bold text-white/50">{value}</span>
        </div>
      </div>
      <span className="text-[10px] sm:text-xs md:text-sm font-bold tracking-wide text-white/70 text-center leading-tight">{label}</span>
    </div>
  )
}

// ✅ Title case — har word ka sirf pehla letter capital (MUHAMMAD SALEEM → Muhammad Saleem)
function titleCase(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1))
}

// ✅ "Yes" normalize (FMO / TM imposed flags)
function isYes(v: any) {
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'yes' || s === '1' || s === 'true' || s === 'y'
}

export default function PenaltiesDashboard({ onHomeClick, permissions }: Props) {
  const navigate = useNavigate()

  // ✅ Tab persistence: refresh par wahi tab khule
  const [view, setView] = useState<View>(() => {
    try {
      const saved = localStorage.getItem('rto_penalties_tab') as View | null
      if (saved && ['dashboard', 'list', 'fmo'].includes(saved)) return saved
    } catch {}
    return 'dashboard'
  })
  useEffect(() => {
    try { localStorage.setItem('rto_penalties_tab', view) } catch {}
  }, [view])

  const [penalties, setPenalties] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Server status (penalties heartbeat id = 3)
  const [serverStatus, setServerStatus] = useState<'live' | 'error'>(() => {
    try { return localStorage.getItem('rto_pen_server_status') === 'error' ? 'error' : 'live' } catch { return 'live' }
  })
  const statusRef = useRef<'live' | 'error'>(serverStatus)
  const lastErrMsgRef = useRef<string>((() => {
    try {
      const saved = localStorage.getItem('rto_pen_latest_notification')
      const n = saved ? JSON.parse(saved) : null
      return n?.type === 'error' ? String(n.message || '') : ''
    } catch { return '' }
  })())
  function setStatus(s: 'live' | 'error') {
    if (statusRef.current === s) return
    statusRef.current = s
    setServerStatus(s)
    try { localStorage.setItem('rto_pen_server_status', s) } catch {}
  }

  // Notifications
  const [notifications, setNotifications] = useState<{ id: number; type: 'success' | 'error'; message: string; time: string; unread?: boolean }[]>(() => {
    try {
      const saved = localStorage.getItem('rto_pen_latest_notification')
      if (saved) {
        const item = JSON.parse(saved)
        if (item && item.message) return [item]
      }
    } catch {}
    return []
  })
  const [unread, setUnread] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('rto_pen_latest_notification')
      if (saved) return JSON.parse(saved)?.unread ? 1 : 0
    } catch {}
    return 0
  })
  const [popup, setPopup] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  // ✅ HND Office secret report popup — sirf "Penalties" heading par double-click se khulta hai
  const [hndReportOpen, setHndReportOpen] = useState(false)
  const hndReportRef = useRef<HTMLDivElement>(null)
  const reportHeadingRef = useRef<HTMLDivElement>(null)
  const [copying, setCopying] = useState(false)

  // ✅ Report heading date label (dd Mmm yyyy)
  const hndReportDateLabel = useMemo(
    () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    []
  )

  // ✅ Copy Report as image — SIRF report area copy hoga (buttons include nahi honge)
  async function copyHndReportAsImage() {
    if (!hndReportRef.current || copying) return
    setCopying(true)
    const headingEl = reportHeadingRef.current
    headingEl?.classList.remove('hidden')   // ✅ Copy ke waqt heading temporary show
    try {
      const blob = await toBlob(hndReportRef.current, { backgroundColor: '#04231c', pixelRatio: 2 })
      if (!blob) throw new Error('Image not generated')
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && 'write' in navigator.clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'Penalties-Report.png'
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e: any) {
      alert(`Copy failed: ${e?.message ?? e}`)
    } finally {
      headingEl?.classList.add('hidden')   // ✅ copy ke baad wapis hide
      setCopying(false)
    }
  }

  // ✅ HND Popup Temporary Edits (double-click to edit)
  const HND_EDITS_KEY = 'rto_hnd_report_edits_temp'
  const [hndEdits, setHndEdits] = useState<Record<string, string>>({})
  const [editingHndKey, setEditingHndKey] = useState<string | null>(null)
  const [editHndVal, setEditHndVal] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const popupTimer = useRef<number | null>(null)
  const notifId = useRef(0)
    // ✅ HND Popup Edits Logic
  useEffect(() => {
    if (hndReportOpen) {
      try {
        const raw = localStorage.getItem(HND_EDITS_KEY)
        setHndEdits(raw ? JSON.parse(raw) : {})
      } catch { setHndEdits({}) }
      setEditingHndKey(null)
    } else {
      // ✅ Popup band hote hi temporary edits remove
      setHndEdits({})
      setEditingHndKey(null)
      try { localStorage.removeItem(HND_EDITS_KEY) } catch {}
    }
  }, [hndReportOpen])

  const fmtNum = (s: string) => {
    const n = Number(s)
    return s !== '' && isFinite(n) ? n.toLocaleString() : s
  }
  function commitHndEdit(key: string) {
    const val = editHndVal.trim()
    setHndEdits(prev => {
      const next = { ...prev }
      if (val === '') delete next[key]
      else next[key] = val
      try { localStorage.setItem(HND_EDITS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
    setEditingHndKey(null)
  }
  const hndEditInput = (key: string) => (
    <input
      autoFocus
      type="text"
      value={editHndVal}
      onChange={e => setEditHndVal(e.target.value)}
      onBlur={() => commitHndEdit(key)}
      onKeyDown={e => {
        if (e.key === 'Enter') commitHndEdit(key)
        else if (e.key === 'Escape') setEditingHndKey(null)
      }}
      className="w-20 sm:w-24 bg-[#021b16] border border-emerald-400/60 rounded-md px-2 py-1 text-emerald-200 text-sm sm:text-base font-bold text-right outline-none"
    />
  )
  const hndCellView = (key: string, computed: number | string, cls: string) => {
    if (editingHndKey === key) return hndEditInput(key)
    const ev = hndEdits[key]
    const shown = ev !== undefined ? fmtNum(ev) : (typeof computed === 'number' ? computed.toLocaleString() : computed)
    return (
      <span
        onDoubleClick={() => { setEditingHndKey(key); setEditHndVal(ev !== undefined ? ev : String(computed)) }}
        title="Double-click to edit (temporary)"
        className={`cursor-pointer ${cls}`}
      >
        {shown}
      </span>
    )
  }

  function pushNotification(type: 'success' | 'error', message: string, at?: Date) {
    notifId.current += 1
    const d = at ?? new Date()
    const item = {
      id: notifId.current,
      type,
      message,
      time: d.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
    }
    const savedItem = { ...item, unread: true }
    setNotifications([savedItem])
    setUnread(1)
    try { localStorage.setItem('rto_pen_latest_notification', JSON.stringify(savedItem)) } catch {}
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

  const lastHbKeyRef = useRef<string>((() => {
    try { return localStorage.getItem('rto_pen_hb_key') || '' } catch { return '' }
  })())
  const lastSeenHbKeyRef = useRef<string>((() => {
    try { return localStorage.getItem('rto_pen_last_seen_hb') || '' } catch { return '' }
  })())
  function rememberHbKey(key: string) {
    lastHbKeyRef.current = key
    try { localStorage.setItem('rto_pen_hb_key', key) } catch {}
  }
  const lastDataNotifyRef = useRef<number>((() => {
    try { return Number(localStorage.getItem('rto_pen_last_notify_ms')) || 0 } catch { return 0 }
  })())
  function notifyDataUpdated(at?: Date) {
    const nowMs = Date.now()
    if (nowMs - lastDataNotifyRef.current < 20_000) return
    lastDataNotifyRef.current = nowMs
    try { localStorage.setItem('rto_pen_last_notify_ms', String(nowMs)) } catch {}
    pushNotification('success', 'Data successfully updated', at)
  }

  // ---- Load penalties + heartbeat (id = 3)
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      const query = supabase
        .from('penaltiesdata')
        .select('*')
        .eq('penalty_date', today)
        .order('created_at', { ascending: false })

      const [pen, hb] = await Promise.all([
        query,
        supabase.from('system_heartbeat').select('status, message, updated_at').eq('id', 3).maybeSingle(),
      ])
      if (pen.error) throw pen.error
      if (hb.error) throw hb.error

      const rows = pen.data ?? []
      setPenalties(rows)

      let maxT = 0
      for (const r of rows) {
        const t = r.fetched_at ? parseLocal(r.fetched_at).getTime() : 0
        if (t > maxT) maxT = t
      }
      if (maxT) setLastUpdated(prev => prev ?? new Date(maxT))

      const h = hb.data
      const hbTime = h?.updated_at ? parseLocal(h.updated_at).getTime() : 0
      const ageMs = hbTime ? Date.now() - hbTime : Infinity
      const status = String(h?.status ?? '').toLowerCase()
      const hbKey = h?.updated_at ? String(h.updated_at) : ''

      if (!h || ageMs > 120_000) {
        notifyError('Server Stopped')
      } else if (status === 'penalties_stopped') {
        if (hbKey && hbKey !== lastHbKeyRef.current) pushNotification('error', 'Server Stopped')
        if (hbKey) rememberHbKey(hbKey)
        setStatus('error')
      } else if (status === 'penalties_started') {
        if (hbKey && hbKey !== lastHbKeyRef.current) pushNotification('success', 'Server Started', hbTime ? new Date(hbTime) : undefined)
        if (hbKey) rememberHbKey(hbKey)
        setStatus('live')
      } else if (status === 'penalties_data_updated') {
        if (hbKey) rememberHbKey(hbKey)
        const ev = hbTime ? new Date(hbTime) : new Date()
        setLastUpdated(ev)
        if (hbKey && hbKey !== lastSeenHbKeyRef.current) {
          notifyDataUpdated(ev)
          lastSeenHbKeyRef.current = hbKey
          try { localStorage.setItem('rto_pen_last_seen_hb', hbKey) } catch {}
        }
        setStatus('live')
      } else if (status === 'penalties_error') {
        if (hbKey) rememberHbKey(hbKey)
        notifyError('Error: Portal Issue')
      } else {
        if (hbKey) rememberHbKey(hbKey)
        if (statusRef.current === 'error') setStatus('live')
      }
    } catch (e) {
      console.error('Penalties load error:', e)
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

  const tabs: { key: View; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'list', label: 'Penalties' },
    { key: 'fmo', label: 'FMO Statistics' },
  ]

  // ---- Office-wise FMO assignments (Supabase se)
  const [fmoAssignments, setFmoAssignments] = useState<{ fmo_name: string; hnd_office: boolean; faqirwali_office: boolean }[]>([])

  useEffect(() => {
    async function loadAssignments() {
      const { data } = await supabase
        .from('fmo_office_assignments')
        .select('fmo_name, hnd_office, faqirwali_office')
      setFmoAssignments(data || [])
    }
    loadAssignments()
  }, [])

  // ✅ 1. Employee ki allowed offices check karein
  const allowedOffices = useMemo(() => {
    if (!permissions) return ['hnd', 'faqirwali']
    const offices = []
    if (permissions.penalties_hnd) offices.push('hnd')
    if (permissions.penalties_faqirwali) offices.push('faqirwali')
    return offices
  }, [permissions])

  // ✅ 2. Penalties ko filter karein
  const filteredPenalties = useMemo(() => {
    if (allowedOffices.length === 2) return penalties
    return penalties.filter(p => {
      const addedByName = (p.added_by || '').trim().toLowerCase()
      const fmo = fmoAssignments.find(f => f.fmo_name.trim().toLowerCase() === addedByName)
      if (!fmo) return false
      if (allowedOffices.includes('hnd') && fmo.hnd_office) return true
      if (allowedOffices.includes('faqirwali') && fmo.faqirwali_office) return true
      return false
    })
  }, [penalties, fmoAssignments, allowedOffices])

  // ✅ 3. Office-wise penalties filters
  const hndFmos = useMemo(() =>
    new Set(fmoAssignments.filter(f => f.hnd_office).map(f => f.fmo_name)),
  [fmoAssignments])

  const faqirwaliFmos = useMemo(() =>
    new Set(fmoAssignments.filter(f => f.faqirwali_office).map(f => f.fmo_name)),
  [fmoAssignments])

  const hndPenalties = useMemo(() =>
    filteredPenalties.filter(p => hndFmos.has(p.added_by)),
  [filteredPenalties, hndFmos])

  const faqirwaliPenalties = useMemo(() =>
    filteredPenalties.filter(p => faqirwaliFmos.has(p.added_by)),
  [filteredPenalties, faqirwaliFmos])

  // ✅ 4. Dashboard stats
  const resolvedCount = filteredPenalties.filter(p => /resolved|closed/i.test(String(p.status || ''))).length
  const unresolvedCount = filteredPenalties.length - resolvedCount
  const fmoImposedCount = filteredPenalties.filter(p => isYes(p.penalty_imposed)).length
  const tmImposedCount = filteredPenalties.filter(p => isYes(p.tm_imposed)).length

  const hndResolved = hndPenalties.filter(p => /resolved|closed/i.test(String(p.status || ''))).length
  const hndUnresolved = hndPenalties.length - hndResolved
  const hndFmoImposed = hndPenalties.filter(p => isYes(p.penalty_imposed)).length
  const hndTmImposed = hndPenalties.filter(p => isYes(p.tm_imposed)).length

  // ✅ First Imposed Time: HND ki UNRESOLVED penalties mein se jis ka deadline (Created + TAT) sab se pehle
  //    ⚠️ TAT = 0 (ya missing/NaN) wali penalties IGNORE — sirf TAT > 0 consider hoti hain
  const lastImposedInfo = useMemo(() => {
    let earliest: Date | null = null
    for (const p of hndPenalties) {
      const st = String(p.status || '').toLowerCase()
      if (/resolved|closed|finalized/.test(st)) continue          // sirf unresolved penalties
      const tat = Number(p.tat)
      if (!isFinite(tat) || tat <= 0) continue                    // ✅ TAT 0 ignore — sirf 0 se upar value
      const raw = String(p.created_at ?? '').trim()
      if (!raw) continue
      const created = parseLocal(raw)
      if (isNaN(created.getTime())) continue
      const deadline = new Date(created.getTime() + tat * 3_600_000)   // Created + TAT hours
      if (!earliest || deadline.getTime() < earliest.getTime()) earliest = deadline
    }
    return earliest
  }, [hndPenalties])
  const lastImposedOverdue = lastImposedInfo ? lastImposedInfo.getTime() < Date.now() : false

  const faqirwaliResolved = faqirwaliPenalties.filter(p => /resolved|closed/i.test(String(p.status || ''))).length
  const faqirwaliUnresolved = faqirwaliPenalties.length - faqirwaliResolved
  const faqirwaliFmoImposed = faqirwaliPenalties.filter(p => isYes(p.penalty_imposed)).length
  const faqirwaliTmImposed = faqirwaliPenalties.filter(p => isYes(p.tm_imposed)).length

  // ✅ Overall Penalty Sub Type × FMO matrix
  const subTypeFmoMatrix = useMemo(() => {
    const fmoTotals = new Map<string, number>()
    const subTotals = new Map<string, number>()
    const cells = new Map<string, Map<string, number>>()
    for (const p of filteredPenalties) {
      const fmo = String(p.added_by || '').trim() || 'Unknown'
      const sub = String(p.penalty_sub_type || '').trim() || '—'
      fmoTotals.set(fmo, (fmoTotals.get(fmo) || 0) + 1)
      subTotals.set(sub, (subTotals.get(sub) || 0) + 1)
      let row = cells.get(sub)
      if (!row) { row = new Map(); cells.set(sub, row) }
      row.set(fmo, (row.get(fmo) || 0) + 1)
    }
    const fmos = [...fmoTotals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
    const subs = [...subTotals.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
    return { fmos, subs, cells, fmoTotals, subTotals }
  }, [filteredPenalties])

  const hndSubTypeFmoMatrix = useMemo(() => {
    const fmoTotals = new Map<string, number>()
    const subTotals = new Map<string, number>()
    const cells = new Map<string, Map<string, number>>()
    for (const p of hndPenalties) {
      const fmo = String(p.added_by || '').trim() || 'Unknown'
      const sub = String(p.penalty_sub_type || '').trim() || '—'
      fmoTotals.set(fmo, (fmoTotals.get(fmo) || 0) + 1)
      subTotals.set(sub, (subTotals.get(sub) || 0) + 1)
      let row = cells.get(sub)
      if (!row) { row = new Map(); cells.set(sub, row) }
      row.set(fmo, (row.get(fmo) || 0) + 1)
    }
    const fmos = [...fmoTotals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
    const subs = [...subTotals.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
    return { fmos, subs, cells, fmoTotals, subTotals }
  }, [hndPenalties])

  const faqirwaliSubTypeFmoMatrix = useMemo(() => {
    const fmoTotals = new Map<string, number>()
    const subTotals = new Map<string, number>()
    const cells = new Map<string, Map<string, number>>()
    for (const p of faqirwaliPenalties) {
      const fmo = String(p.added_by || '').trim() || 'Unknown'
      const sub = String(p.penalty_sub_type || '').trim() || '—'
      fmoTotals.set(fmo, (fmoTotals.get(fmo) || 0) + 1)
      subTotals.set(sub, (subTotals.get(sub) || 0) + 1)
      let row = cells.get(sub)
      if (!row) { row = new Map(); cells.set(sub, row) }
      row.set(fmo, (row.get(fmo) || 0) + 1)
    }
    const fmos = [...fmoTotals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
    const subs = [...subTotals.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
    return { fmos, subs, cells, fmoTotals, subTotals }
  }, [faqirwaliPenalties])

  const cardCls = 'rounded-[24px] border border-emerald-400/25 bg-linear-to-b from-[#073b2d] to-[#021d17] shadow-[0_20px_60px_rgba(0,0,0,0.3)]'

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#021b16] text-white">
      {/* ===== Top Navbar ===== */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="relative flex items-center px-3 sm:px-6 py-3 pointer-events-auto md:pointer-events-none bg-[#021b16] border-b border-white/10 md:border-b-0 shadow-[0_6px_24px_rgba(0,0,0,0.45)] md:shadow-none">
          <div className="flex-1 flex justify-start pointer-events-auto">
            <button
              onClick={() => {
                resetMonitoringTabs()
                onHomeClick?.()
                navigate('/home')
              }}
              aria-label="Back to Home"
              className="relative flex items-center gap-2 rounded-full border border-emerald-400/40 bg-[#021b16]/60 px-4 py-2.5 text-xs sm:text-sm font-bold text-emerald-200 transition-all duration-300 hover:bg-emerald-500/15 hover:shadow-[0_0_25px_rgba(0,255,170,0.25)]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span className="hidden sm:inline">Home</span>
            </button>
          </div>

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

          <div className="flex-1 flex justify-end items-center gap-2.5 pr-1 sm:pr-3 pointer-events-auto">
            {lastUpdated && (
              <div className="relative hidden lg:flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-[#021b16]/60 px-3 py-1.5">
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
                <span className="text-[8px] font-bold tracking-[0.14em] text-white/45">LAST UPDATED</span>
                <span className="text-[9px] font-bold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap">
                  {`${String(lastUpdated.getDate()).padStart(2, '0')}-${String(lastUpdated.getMonth() + 1).padStart(2, '0')}-${lastUpdated.getFullYear()} — ${lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`}
                </span>
              </div>
            )}

            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(v => !v)
                  setUnread(0)
                  try {
                    const saved = localStorage.getItem('rto_pen_latest_notification')
                    if (saved) {
                      const item = JSON.parse(saved)
                      item.unread = false
                      localStorage.setItem('rto_pen_latest_notification', JSON.stringify(item))
                    }
                    if (lastHbKeyRef.current) {
                      lastSeenHbKeyRef.current = lastHbKeyRef.current
                      localStorage.setItem('rto_pen_last_seen_hb', lastHbKeyRef.current)
                    }
                  } catch {}
                }}
                aria-label="Notifications"
                className="relative flex items-center justify-center rounded-full border border-emerald-400/40 bg-[#021b16]/60 p-2.5 text-emerald-200 hover:text-white transition"
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
        </div>

        {/* ✅ Mobile: compact LIVE pill */}
        {lastUpdated && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 lg:hidden flex items-center gap-1 rounded-full border border-emerald-400/40 bg-[#021b16]/70 px-2 py-[3px] pointer-events-none">
            {serverStatus === 'live' ? (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
              </span>
            ) : (
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)] animate-pulse" />
              </span>
            )}
            <span className={`text-[7px] font-bold tracking-[0.1em] ${serverStatus === 'live' ? 'text-emerald-300' : 'text-red-300'}`}>
              {serverStatus === 'live' ? 'LIVE' : 'ERROR'}
            </span>
            <div className="h-2 w-px bg-white/15" />
            <span className="text-[7px] font-bold tracking-[0.08em] text-white/45">LAST UPDATED</span>
            <span className={`text-[8px] font-bold bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap ${
              serverStatus === 'live'
                ? 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]'
                : 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]'
            }`}>
              {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          </div>
        )}
      </header>

      {/* ===== Content ===== */}
      <main className="px-4 sm:px-6 max-w-[1750px] mx-auto flex flex-col gap-6 pt-24 pb-6">
        {view === 'dashboard' && (
          <div className="flex flex-col gap-4">
            {/* ✅ No Access Message */}
            {permissions && permissions.penalties && allowedOffices.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="bg-red-500/10 border border-red-400/40 rounded-2xl p-8 max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
                  <svg className="h-12 w-12 text-red-400 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <h2 className="text-xl font-extrabold text-red-300 mb-2">Access Restricted</h2>
                  <p className="text-white/70 text-sm">Currently no access to any office. Please contact the admin.</p>
                </div>
              </div>
            ) : (
              <>
                {/* ✅ Center heading */}
                <div className="flex flex-col items-center -mb-1">
                  <h1 className="text-center text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-none whitespace-nowrap">
                    <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Penalties </span>
                    <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Dashboard</span>
                  </h1>
                  <p className="mt-2 sm:mt-3 text-center text-[11px] sm:text-sm font-semibold tracking-[0.08em] text-white/40 whitespace-nowrap">
                    Live monitoring — {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                {/* ✅ OVERALL STATS (Sirf Admin ya dono offices walon ke liye) */}
                {allowedOffices.length === 2 && (
                  <>
                    {/* ROW 1: Overall Stats + Graphs */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
                      {/* Overall Stats Card */}
                      <div className={`${cardCls} p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col gap-2 sm:gap-3 md:gap-4`}>
                        <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold flex items-center gap-2 sm:gap-3">
                          <span className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-lg sm:rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-300">
                            <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 3v18h18" />
                              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                            </svg>
                          </span>
                          <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Overall Penalties </span>
                          <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Statistics</span>
                        </h2>
                        <div className="flex flex-col gap-1.5 sm:gap-2">
                          {[
                            { label: 'Total Penalties', value: loading && !penalties.length ? '—' : penalties.length, border: 'border-amber-400/25', bg: 'bg-amber-500/10', grad: 'bg-[linear-gradient(180deg,#f59e0b,#fbbf24,#fde68a,#fbbf24,#f59e0b)]' },
                            { label: 'Resolved', value: resolvedCount, border: 'border-emerald-400/25', bg: 'bg-emerald-500/10', grad: 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]' },
                            { label: 'Un Resolved', value: unresolvedCount, border: 'border-red-400/25', bg: 'bg-red-500/10', grad: 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]' },
                            { label: 'FMO Imposed', value: fmoImposedCount, border: 'border-sky-400/25', bg: 'bg-sky-500/10', grad: 'bg-[linear-gradient(180deg,#0ea5e9,#38bdf8,#7dd3fc,#38bdf8,#0ea5e9)]' },
                            { label: 'TM Imposed', value: tmImposedCount, border: 'border-purple-400/25', bg: 'bg-purple-500/10', grad: 'bg-[linear-gradient(180deg,#a855f7,#c084fc,#d8b4fe,#c084fc,#a855f7)]' },
                          ].map(row => (
                            <div key={row.label} className={`flex items-center justify-between gap-2 sm:gap-3 rounded-lg sm:rounded-xl border ${row.border} ${row.bg} px-2.5 sm:px-4 py-2 sm:py-3`}>
                              <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-white/70">{row.label}</span>
                              <span className={`text-base sm:text-xl md:text-2xl font-extrabold ${row.grad} bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]`}>
                                {row.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Overall Rings Card */}
                      <div className={`${cardCls} p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col items-center justify-center gap-2 sm:gap-3 md:gap-4`}>
                        <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold flex items-center gap-2 sm:gap-3 w-full">
                          <span className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-lg sm:rounded-xl border border-sky-400/30 bg-sky-500/10 text-sky-300">
                            <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2 2 7l10 5 10-5-10-5z" />
                              <path d="m2 17 10 5 10-5" />
                              <path d="m2 12 10 5 10-5" />
                            </svg>
                          </span>
                          <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Overall Penalties </span>
                          <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Graphs</span>
                        </h2>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-6 sm:gap-y-6 md:gap-x-8 md:gap-y-8 place-items-center w-full">
                          <RingChart label="Resolved" value={resolvedCount} percent={penalties.length ? (resolvedCount / penalties.length) * 100 : 0} color="#34d399" />
                          <RingChart label="Un Resolved" value={unresolvedCount} percent={penalties.length ? (unresolvedCount / penalties.length) * 100 : 0} color="#f87171" />
                          <RingChart label="FMO Imposed" value={fmoImposedCount} percent={penalties.length ? (fmoImposedCount / penalties.length) * 100 : 0} color="#38bdf8" />
                          <RingChart label="TM Imposed" value={tmImposedCount} percent={penalties.length ? (tmImposedCount / penalties.length) * 100 : 0} color="#c084fc" />
                        </div>
                      </div>
                    </div>

                    {/* ROW 2: Overall Penalty Sub Types */}
                    <div className={`${cardCls} p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col gap-2 sm:gap-3 md:gap-4`}>
                      <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold flex items-center gap-2 sm:gap-3">
                        <span className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-lg sm:rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                          <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2 2 7l10 5 10-5-10-5z" />
                            <path d="m2 17 10 5 10-5" />
                            <path d="m2 12 10 5 10-5" />
                          </svg>
                        </span>
                        <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Overall Penalty Sub Types </span>
                        <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Statistics</span>
                      </h2>
                      {subTypeFmoMatrix.subs.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-xs text-white/40">
                          {loading ? 'Loading sub type data…' : 'No sub type data available'}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/10 overflow-hidden">
                          <table className="w-full table-fixed text-[8px] sm:text-[10px] md:text-xs">
                            <thead>
                              <tr className="text-left font-bold tracking-wider text-emerald-200/90 bg-[#0a4038] border-b border-emerald-400/20">
                                <th className="w-[18%] sm:w-[20%] px-1.5 sm:px-2 py-2 sm:py-3 uppercase whitespace-nowrap">Sub Type</th>
                                {subTypeFmoMatrix.fmos.map(f => (
                                  <th key={f} title={titleCase(f)} className="px-1 sm:px-2 py-2 sm:py-3 text-center border-l border-white/10">
                                    <span className="block leading-tight break-words md:[overflow-wrap:normal] text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">{titleCase(f)}</span>
                                  </th>
                                ))}
                                <th className="w-[10%] sm:w-[8%] px-1.5 sm:px-2 py-2 sm:py-3 text-center border-l border-emerald-400/40 uppercase text-emerald-300 whitespace-nowrap">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {subTypeFmoMatrix.subs.map((s, i) => {
                                const rowTotal = subTypeFmoMatrix.fmos.reduce((sum, f) => sum + (subTypeFmoMatrix.cells.get(s)?.get(f) || 0), 0)
                                return (
                                  <tr key={s} className="border-b border-white/10 last:border-0 hover:bg-white/5 transition">
                                    <td className="px-1.5 sm:px-2 py-1.5 sm:py-2.5 font-semibold text-white/85 break-words">
                                      <span className="text-white/40 font-bold">{i + 1}.</span> {s}
                                    </td>
                                    {subTypeFmoMatrix.fmos.map(f => {
                                      const c = subTypeFmoMatrix.cells.get(s)?.get(f) || 0
                                      return (
                                        <td key={f} className="px-1 sm:px-2 py-1.5 sm:py-2.5 text-center border-l border-white/10">
                                          {c > 0 ? <span className="font-bold text-emerald-300">{c}</span> : <span className="text-white/30 font-bold">-</span>}
                                        </td>
                                      )
                                    })}
                                    <td className="px-1.5 sm:px-2 py-1.5 sm:py-2.5 text-center border-l border-emerald-400/40">
                                      <span className="font-extrabold text-amber-300">{rowTotal}</span>
                                    </td>
                                  </tr>
                                )
                              })}
                              <tr className="bg-[#0a4038]/60 border-t-2 border-emerald-400/40 font-bold">
                                <td className="px-1.5 sm:px-2 py-2 sm:py-3 text-emerald-300 uppercase tracking-wider whitespace-nowrap">Total</td>
                                {subTypeFmoMatrix.fmos.map(f => {
                                  const colTotal = subTypeFmoMatrix.subs.reduce((sum, s) => sum + (subTypeFmoMatrix.cells.get(s)?.get(f) || 0), 0)
                                  return (
                                    <td key={f} className="px-1 sm:px-2 py-2 sm:py-3 text-center border-l border-emerald-400/40">
                                      <span className="font-extrabold text-amber-300">{colTotal}</span>
                                    </td>
                                  )
                                })}
                                <td className="px-1.5 sm:px-2 py-2 sm:py-3 text-center border-l border-emerald-400/40">
                                  <span className="font-extrabold text-emerald-300">{penalties.length}</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* ROW 3: HND Office - Stats + Graphs */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      <div className={`${cardCls} p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col gap-2 sm:gap-3 md:gap-4`}>
                        <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold flex items-center gap-2 sm:gap-3">
                          <span className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-lg sm:rounded-xl border border-sky-400/30 bg-sky-500/10 text-sky-300">
                            <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                              <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                          </span>
                          <span className="bg-[linear-gradient(180deg,#0ea5e9,#38bdf8,#7dd3fc,#38bdf8,#0ea5e9)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">HND Office Penalties Statistics</span>
                        </h2>
                        <div className="flex flex-col gap-1.5 sm:gap-2">
                          {[
                            { label: 'Total Penalties', value: loading ? '—' : hndPenalties.length, border: 'border-amber-400/25', bg: 'bg-amber-500/10', grad: 'bg-[linear-gradient(180deg,#f59e0b,#fbbf24,#fde68a,#fbbf24,#f59e0b)]' },
                            { label: 'Resolved', value: hndResolved, border: 'border-emerald-400/25', bg: 'bg-emerald-500/10', grad: 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]' },
                            { label: 'Un Resolved', value: hndUnresolved, border: 'border-red-400/25', bg: 'bg-red-500/10', grad: 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]' },
                            { label: 'FMO Imposed', value: hndFmoImposed, border: 'border-sky-400/25', bg: 'bg-sky-500/10', grad: 'bg-[linear-gradient(180deg,#0ea5e9,#38bdf8,#7dd3fc,#38bdf8,#0ea5e9)]' },
                            { label: 'TM Imposed', value: hndTmImposed, border: 'border-purple-400/25', bg: 'bg-purple-500/10', grad: 'bg-[linear-gradient(180deg,#a855f7,#c084fc,#d8b4fe,#c084fc,#a855f7)]' },
                          ].map(row => (
                            <div key={row.label} className={`flex items-center justify-between gap-2 sm:gap-3 rounded-lg sm:rounded-xl border ${row.border} ${row.bg} px-2.5 sm:px-4 py-2 sm:py-3`}>
                              <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-white/70">{row.label}</span>
                              <span className={`text-base sm:text-xl md:text-2xl font-extrabold ${row.grad} bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]`}>{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={`${cardCls} p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col items-center justify-center gap-2 sm:gap-3 md:gap-4`}>
                        <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold flex items-center gap-2 sm:gap-3 w-full">
                          <span className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-lg sm:rounded-xl border border-sky-400/30 bg-sky-500/10 text-sky-300">
                            <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2 2 7l10 5 10-5-10-5z" />
                              <path d="m2 17 10 5 10-5" />
                              <path d="m2 12 10 5 10-5" />
                            </svg>
                          </span>
                          <span className="bg-[linear-gradient(180deg,#0ea5e9,#38bdf8,#7dd3fc,#38bdf8,#0ea5e9)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">HND Office Penalties Graphs</span>
                        </h2>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-6 sm:gap-y-6 md:gap-x-8 md:gap-y-8 place-items-center w-full">
                          <RingChart label="Resolved" value={hndResolved} percent={hndPenalties.length ? (hndResolved / hndPenalties.length) * 100 : 0} color="#34d399" />
                          <RingChart label="Un Resolved" value={hndUnresolved} percent={hndPenalties.length ? (hndUnresolved / hndPenalties.length) * 100 : 0} color="#f87171" />
                          <RingChart label="FMO Imposed" value={hndFmoImposed} percent={hndPenalties.length ? (hndFmoImposed / hndPenalties.length) * 100 : 0} color="#38bdf8" />
                          <RingChart label="TM Imposed" value={hndTmImposed} percent={hndPenalties.length ? (hndTmImposed / hndPenalties.length) * 100 : 0} color="#c084fc" />
                        </div>
                      </div>
                    </div>

                    {/* ROW 4: HND Office Penalty Types */}
                    <div className={`${cardCls} p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col gap-2 sm:gap-3 md:gap-4`}>
                      <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold flex items-center gap-2 sm:gap-3">
                        <span className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-lg sm:rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                          <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2 2 7l10 5 10-5-10-5z" />
                            <path d="m2 17 10 5 10-5" />
                            <path d="m2 12 10 5 10-5" />
                          </svg>
                        </span>
                        <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">HND Office Penalty Types </span>
                        <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Statistics</span>
                      </h2>
                      {hndSubTypeFmoMatrix.subs.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-xs text-white/40">{loading ? 'Loading…' : 'No data available'}</div>
                      ) : (
                        <div className="rounded-xl border border-white/10 overflow-hidden">
                          <table className="w-full table-fixed text-[8px] sm:text-[10px] md:text-xs">
                            <thead>
                              <tr className="text-left font-bold tracking-wider text-emerald-200/90 bg-[#0a4038] border-b border-emerald-400/20">
                                <th className="w-[18%] sm:w-[20%] px-1.5 sm:px-2 py-2 sm:py-3 uppercase whitespace-nowrap">Sub Type</th>
                                {hndSubTypeFmoMatrix.fmos.map(f => (
                                  <th key={f} title={titleCase(f)} className="px-0.5 sm:px-1 py-2 sm:py-3 text-center border-l border-white/10 align-top">
                                    <span className="block leading-tight break-words md:[overflow-wrap:normal] text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">{titleCase(f)}</span>
                                  </th>
                                ))}
                                <th className="w-[10%] sm:w-[8%] px-1.5 sm:px-2 py-2 sm:py-3 text-center border-l border-emerald-400/40 uppercase text-emerald-300 whitespace-nowrap">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hndSubTypeFmoMatrix.subs.map((s, i) => {
                                const rowTotal = hndSubTypeFmoMatrix.fmos.reduce((sum, f) => sum + (hndSubTypeFmoMatrix.cells.get(s)?.get(f) || 0), 0)
                                return (
                                  <tr key={s} className="border-b border-white/10 last:border-0 hover:bg-white/5 transition">
                                    <td className="px-1.5 sm:px-2 py-1.5 sm:py-2.5 font-semibold text-white/85 break-words">
                                      <span className="text-white/40 font-bold">{i + 1}.</span> {s}
                                    </td>
                                    {hndSubTypeFmoMatrix.fmos.map(f => {
                                      const c = hndSubTypeFmoMatrix.cells.get(s)?.get(f) || 0
                                      return (
                                        <td key={f} className="px-1 sm:px-2 py-1.5 sm:py-2.5 text-center border-l border-white/10">
                                          {c > 0 ? <span className="font-bold text-emerald-300">{c}</span> : <span className="text-white/30 font-bold">-</span>}
                                        </td>
                                      )
                                    })}
                                    <td className="px-1.5 sm:px-2 py-1.5 sm:py-2.5 text-center border-l border-emerald-400/40">
                                      <span className="font-extrabold text-amber-300">{rowTotal}</span>
                                    </td>
                                  </tr>
                                )
                              })}
                              <tr className="bg-[#0a4038]/60 border-t-2 border-emerald-400/40 font-bold">
                                <td className="px-1.5 sm:px-2 py-2 sm:py-3 text-emerald-300 uppercase tracking-wider whitespace-nowrap">Total</td>
                                {hndSubTypeFmoMatrix.fmos.map(f => {
                                  const colTotal = hndSubTypeFmoMatrix.subs.reduce((sum, s) => sum + (hndSubTypeFmoMatrix.cells.get(s)?.get(f) || 0), 0)
                                  return (
                                    <td key={f} className="px-1 sm:px-2 py-2 sm:py-3 text-center border-l border-emerald-400/40">
                                      <span className="font-extrabold text-amber-300">{colTotal}</span>
                                    </td>
                                  )
                                })}
                                <td className="px-1.5 sm:px-2 py-2 sm:py-3 text-center border-l border-emerald-400/40">
                                  <span className="font-extrabold text-emerald-300">{hndPenalties.length}</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* ROW 5: FaqirWali Office - Stats + Graphs */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      <div className={`${cardCls} p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col gap-2 sm:gap-3 md:gap-4`}>
                        <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold flex items-center gap-2 sm:gap-3">
                          <span className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-lg sm:rounded-xl border border-purple-400/30 bg-purple-500/10 text-purple-300">
                            <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                              <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                          </span>
                          <span className="bg-[linear-gradient(180deg,#a855f7,#c084fc,#d8b4fe,#c084fc,#a855f7)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">FaqirWali Office Penalties Statistics</span>
                        </h2>
                        <div className="flex flex-col gap-1.5 sm:gap-2">
                          {[
                            { label: 'Total Penalties', value: loading ? '—' : faqirwaliPenalties.length, border: 'border-amber-400/25', bg: 'bg-amber-500/10', grad: 'bg-[linear-gradient(180deg,#f59e0b,#fbbf24,#fde68a,#fbbf24,#f59e0b)]' },
                            { label: 'Resolved', value: faqirwaliResolved, border: 'border-emerald-400/25', bg: 'bg-emerald-500/10', grad: 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]' },
                            { label: 'Un Resolved', value: faqirwaliUnresolved, border: 'border-red-400/25', bg: 'bg-red-500/10', grad: 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]' },
                            { label: 'FMO Imposed', value: faqirwaliFmoImposed, border: 'border-sky-400/25', bg: 'bg-sky-500/10', grad: 'bg-[linear-gradient(180deg,#0ea5e9,#38bdf8,#7dd3fc,#38bdf8,#0ea5e9)]' },
                            { label: 'TM Imposed', value: faqirwaliTmImposed, border: 'border-purple-400/25', bg: 'bg-purple-500/10', grad: 'bg-[linear-gradient(180deg,#a855f7,#c084fc,#d8b4fe,#c084fc,#a855f7)]' },
                          ].map(row => (
                            <div key={row.label} className={`flex items-center justify-between gap-2 sm:gap-3 rounded-lg sm:rounded-xl border ${row.border} ${row.bg} px-2.5 sm:px-4 py-2 sm:py-3`}>
                              <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-white/70">{row.label}</span>
                              <span className={`text-base sm:text-xl md:text-2xl font-extrabold ${row.grad} bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]`}>{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={`${cardCls} p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col items-center justify-center gap-2 sm:gap-3 md:gap-4`}>
                        <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold flex items-center gap-2 sm:gap-3 w-full">
                          <span className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-lg sm:rounded-xl border border-purple-400/30 bg-purple-500/10 text-purple-300">
                            <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2 2 7l10 5 10-5-10-5z" />
                              <path d="m2 17 10 5 10-5" />
                              <path d="m2 12 10 5 10-5" />
                            </svg>
                          </span>
                          <span className="bg-[linear-gradient(180deg,#a855f7,#c084fc,#d8b4fe,#c084fc,#a855f7)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">FaqirWali Office Penalties Graphs</span>
                        </h2>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-6 sm:gap-y-6 md:gap-x-8 md:gap-y-8 place-items-center w-full">
                          <RingChart label="Resolved" value={faqirwaliResolved} percent={faqirwaliPenalties.length ? (faqirwaliResolved / faqirwaliPenalties.length) * 100 : 0} color="#34d399" />
                          <RingChart label="Un Resolved" value={faqirwaliUnresolved} percent={faqirwaliPenalties.length ? (faqirwaliUnresolved / faqirwaliPenalties.length) * 100 : 0} color="#f87171" />
                          <RingChart label="FMO Imposed" value={faqirwaliFmoImposed} percent={faqirwaliPenalties.length ? (faqirwaliFmoImposed / faqirwaliPenalties.length) * 100 : 0} color="#38bdf8" />
                          <RingChart label="TM Imposed" value={faqirwaliTmImposed} percent={faqirwaliPenalties.length ? (faqirwaliTmImposed / faqirwaliPenalties.length) * 100 : 0} color="#c084fc" />
                        </div>
                      </div>
                    </div>

                    {/* ROW 6: FaqirWali Office Penalty Types */}
                    <div className={`${cardCls} p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col gap-2 sm:gap-3 md:gap-4`}>
                      <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold flex items-center gap-2 sm:gap-3">
                        <span className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-lg sm:rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                          <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2 2 7l10 5 10-5-10-5z" />
                            <path d="m2 17 10 5 10-5" />
                            <path d="m2 12 10 5 10-5" />
                          </svg>
                        </span>
                        <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">FaqirWali Office Penalty Types </span>
                        <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Statistics</span>
                      </h2>
                      {faqirwaliSubTypeFmoMatrix.subs.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-xs text-white/40">{loading ? 'Loading…' : 'No data available'}</div>
                      ) : (
                        <div className="rounded-xl border border-white/10 overflow-hidden">
                          <table className="w-full table-fixed text-[8px] sm:text-[10px] md:text-xs">
                            <thead>
                              <tr className="text-left font-bold tracking-wider text-emerald-200/90 bg-[#0a4038] border-b border-emerald-400/20">
                                <th className="w-[18%] sm:w-[20%] px-1.5 sm:px-2 py-2 sm:py-3 uppercase whitespace-nowrap">Sub Type</th>
                                {faqirwaliSubTypeFmoMatrix.fmos.map(f => (
                                  <th key={f} title={titleCase(f)} className="px-1 sm:px-2 py-2 sm:py-3 text-center border-l border-white/10">
                                    <span className="block leading-tight break-words md:[overflow-wrap:normal] text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">{titleCase(f)}</span>
                                  </th>
                                ))}
                                <th className="w-[10%] sm:w-[8%] px-1.5 sm:px-2 py-2 sm:py-3 text-center border-l border-emerald-400/40 uppercase text-emerald-300 whitespace-nowrap">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {faqirwaliSubTypeFmoMatrix.subs.map((s, i) => {
                                const rowTotal = faqirwaliSubTypeFmoMatrix.fmos.reduce((sum, f) => sum + (faqirwaliSubTypeFmoMatrix.cells.get(s)?.get(f) || 0), 0)
                                return (
                                  <tr key={s} className="border-b border-white/10 last:border-0 hover:bg-white/5 transition">
                                    <td className="px-1.5 sm:px-2 py-1.5 sm:py-2.5 font-semibold text-white/85 break-words">
                                      <span className="text-white/40 font-bold">{i + 1}.</span> {s}
                                    </td>
                                    {faqirwaliSubTypeFmoMatrix.fmos.map(f => {
                                      const c = faqirwaliSubTypeFmoMatrix.cells.get(s)?.get(f) || 0
                                      return (
                                        <td key={f} className="px-1 sm:px-2 py-1.5 sm:py-2.5 text-center border-l border-white/10">
                                          {c > 0 ? <span className="font-bold text-emerald-300">{c}</span> : <span className="text-white/30 font-bold">-</span>}
                                        </td>
                                      )
                                    })}
                                    <td className="px-1.5 sm:px-2 py-1.5 sm:py-2.5 text-center border-l border-emerald-400/40">
                                      <span className="font-extrabold text-amber-300">{rowTotal}</span>
                                    </td>
                                  </tr>
                                )
                              })}
                              <tr className="bg-[#0a4038]/60 border-t-2 border-emerald-400/40 font-bold">
                                <td className="px-1.5 sm:px-2 py-2 sm:py-3 text-emerald-300 uppercase tracking-wider whitespace-nowrap">Total</td>
                                {faqirwaliSubTypeFmoMatrix.fmos.map(f => {
                                  const colTotal = faqirwaliSubTypeFmoMatrix.subs.reduce((sum, s) => sum + (faqirwaliSubTypeFmoMatrix.cells.get(s)?.get(f) || 0), 0)
                                  return (
                                    <td key={f} className="px-1 sm:px-2 py-2 sm:py-3 text-center border-l border-emerald-400/40">
                                      <span className="font-extrabold text-amber-300">{colTotal}</span>
                                    </td>
                                  )
                                })}
                                <td className="px-1.5 sm:px-2 py-2 sm:py-3 text-center border-l border-emerald-400/40">
                                  <span className="font-extrabold text-emerald-300">{faqirwaliPenalties.length}</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ✅ SINGLE OFFICE DASHBOARD */}
                {allowedOffices.length === 1 && (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      <div className={`${cardCls} p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col gap-2 sm:gap-3 md:gap-4`}>
                        <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold flex items-center gap-2 sm:gap-3">
                          <span className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-lg sm:rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-300">
                            <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 3v18h18" />
                              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                            </svg>
                          </span>
                          <span
                            className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] select-none"
                            onDoubleClick={() => { if (allowedOffices.includes('hnd')) setHndReportOpen(true) }}
                          >Penalties </span>
                          <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Statistics</span>
                        </h2>
                        <div className="flex flex-col gap-1.5 sm:gap-2">
                          {[
                            { label: 'Total Penalties', value: loading ? '—' : filteredPenalties.length, border: 'border-amber-400/25', bg: 'bg-amber-500/10', grad: 'bg-[linear-gradient(180deg,#f59e0b,#fbbf24,#fde68a,#fbbf24,#f59e0b)]' },
                            { label: 'Resolved', value: resolvedCount, border: 'border-emerald-400/25', bg: 'bg-emerald-500/10', grad: 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]' },
                            { label: 'Un Resolved', value: unresolvedCount, border: 'border-red-400/25', bg: 'bg-red-500/10', grad: 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]' },
                            { label: 'FMO Imposed', value: fmoImposedCount, border: 'border-sky-400/25', bg: 'bg-sky-500/10', grad: 'bg-[linear-gradient(180deg,#0ea5e9,#38bdf8,#7dd3fc,#38bdf8,#0ea5e9)]' },
                            { label: 'TM Imposed', value: tmImposedCount, border: 'border-purple-400/25', bg: 'bg-purple-500/10', grad: 'bg-[linear-gradient(180deg,#a855f7,#c084fc,#d8b4fe,#c084fc,#a855f7)]' },
                          ].map(row => (
                            <div key={row.label} className={`flex items-center justify-between gap-2 sm:gap-3 rounded-lg sm:rounded-xl border ${row.border} ${row.bg} px-2.5 sm:px-4 py-2 sm:py-3`}>
                              <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-white/70">{row.label}</span>
                              <span className={`text-base sm:text-xl md:text-2xl font-extrabold ${row.grad} bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]`}>{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={`${cardCls} p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col items-center justify-center gap-2 sm:gap-3 md:gap-4`}>
                        <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold flex items-center gap-2 sm:gap-3 w-full">
                          <span className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-lg sm:rounded-xl border border-sky-400/30 bg-sky-500/10 text-sky-300">
                            <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2 2 7l10 5 10-5-10-5z" />
                              <path d="m2 17 10 5 10-5" />
                              <path d="m2 12 10 5 10-5" />
                            </svg>
                          </span>
                          <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Penalties </span>
                          <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Graphs</span>
                        </h2>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-6 sm:gap-y-6 md:gap-x-8 md:gap-y-8 place-items-center w-full">
                          <RingChart label="Resolved" value={resolvedCount} percent={filteredPenalties.length ? (resolvedCount / filteredPenalties.length) * 100 : 0} color="#34d399" />
                          <RingChart label="Un Resolved" value={unresolvedCount} percent={filteredPenalties.length ? (unresolvedCount / filteredPenalties.length) * 100 : 0} color="#f87171" />
                          <RingChart label="FMO Imposed" value={fmoImposedCount} percent={filteredPenalties.length ? (fmoImposedCount / filteredPenalties.length) * 100 : 0} color="#38bdf8" />
                          <RingChart label="TM Imposed" value={tmImposedCount} percent={filteredPenalties.length ? (tmImposedCount / filteredPenalties.length) * 100 : 0} color="#c084fc" />
                        </div>
                      </div>
                    </div>

                    <div className={`${cardCls} p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col gap-2 sm:gap-3 md:gap-4`}>
                      <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold flex items-center gap-2 sm:gap-3">
                        <span className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-lg sm:rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                          <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2 2 7l10 5 10-5-10-5z" />
                            <path d="m2 17 10 5 10-5" />
                            <path d="m2 12 10 5 10-5" />
                          </svg>
                        </span>
                        <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Penalty Types </span>
                        <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Statistics</span>
                      </h2>
                      {subTypeFmoMatrix.subs.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-xs text-white/40">{loading ? 'Loading…' : 'No data available'}</div>
                      ) : (
                        <div className="rounded-xl border border-white/10 overflow-hidden">
                          <table className="w-full table-fixed text-[8px] sm:text-[10px] md:text-xs">
                            <thead>
                              <tr className="text-left font-bold tracking-wider text-emerald-200/90 bg-[#0a4038] border-b border-emerald-400/20">
                                <th className="w-[18%] sm:w-[20%] px-1.5 sm:px-2 py-2 sm:py-3 uppercase whitespace-nowrap">Sub Type</th>
                                {subTypeFmoMatrix.fmos.map(f => (
                                  <th key={f} title={titleCase(f)} className="px-1 sm:px-2 py-2 sm:py-3 text-center border-l border-white/10">
                                    <span className="block leading-tight break-words md:[overflow-wrap:normal] text-[6px] lg:text-[7px] xl:text-[8px] 2xl:text-[10px]">{titleCase(f)}</span>
                                  </th>
                                ))}
                                <th className="w-[10%] sm:w-[8%] px-1.5 sm:px-2 py-2 sm:py-3 text-center border-l border-emerald-400/40 uppercase text-emerald-300 whitespace-nowrap">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {subTypeFmoMatrix.subs.map((s, i) => {
                                const rowTotal = subTypeFmoMatrix.fmos.reduce((sum, f) => sum + (subTypeFmoMatrix.cells.get(s)?.get(f) || 0), 0)
                                return (
                                  <tr key={s} className="border-b border-white/10 last:border-0 hover:bg-white/5 transition">
                                    <td className="px-1.5 sm:px-2 py-1.5 sm:py-2.5 font-semibold text-white/85 break-words">
                                      <span className="text-white/40 font-bold">{i + 1}.</span> {s}
                                    </td>
                                    {subTypeFmoMatrix.fmos.map(f => {
                                      const c = subTypeFmoMatrix.cells.get(s)?.get(f) || 0
                                      return (
                                        <td key={f} className="px-1 sm:px-2 py-1.5 sm:py-2.5 text-center border-l border-white/10">
                                          {c > 0 ? <span className="font-bold text-emerald-300">{c}</span> : <span className="text-white/30 font-bold">-</span>}
                                        </td>
                                      )
                                    })}
                                    <td className="px-1.5 sm:px-2 py-1.5 sm:py-2.5 text-center border-l border-emerald-400/40">
                                      <span className="font-extrabold text-amber-300">{rowTotal}</span>
                                    </td>
                                  </tr>
                                )
                              })}
                              <tr className="bg-[#0a4038]/60 border-t-2 border-emerald-400/40 font-bold">
                                <td className="px-1.5 sm:px-2 py-2 sm:py-3 text-emerald-300 uppercase tracking-wider whitespace-nowrap">Total</td>
                                {subTypeFmoMatrix.fmos.map(f => {
                                  const colTotal = subTypeFmoMatrix.subs.reduce((sum, s) => sum + (subTypeFmoMatrix.cells.get(s)?.get(f) || 0), 0)
                                  return (
                                    <td key={f} className="px-1 sm:px-2 py-2 sm:py-3 text-center border-l border-emerald-400/40">
                                      <span className="font-extrabold text-amber-300">{colTotal}</span>
                                    </td>
                                  )
                                })}
                                <td className="px-1.5 sm:px-2 py-2 sm:py-3 text-center border-l border-emerald-400/40">
                                  <span className="font-extrabold text-emerald-300">{filteredPenalties.length}</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ===== VIEW: Penalties (table list) ===== */}
        {view === 'list' && (
          <Penalties
            penalties={penalties}
            loading={loading}
            permissions={permissions}
          />
        )}

        {/* ===== VIEW: FMO Statistics ===== */}
        {view === 'fmo' && (
          <FMOStatistics
            penalties={penalties}
            loading={loading}
            permissions={permissions}
          />
        )}
      </main>

      {/* ✅ HND Office Report Popup — sirf HND access walon ke liye, double-click se khulta hai */}
      {hndReportOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setHndReportOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-emerald-400/30 bg-[#04231c] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
              {/* ✅ Popup top bar — title top-LEFT (brackets removed) + buttons right */}
              <div className="flex items-center justify-between gap-3 px-5 pt-4">
                <div className="flex items-baseline gap-2 min-w-0">
                  <div className="text-sm sm:text-base font-extrabold truncate">
                    <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Penalties </span>
                    <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Report</span>
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-bold text-emerald-300 whitespace-nowrap">{hndReportDateLabel}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={copyHndReportAsImage}
                  disabled={copying}
                  className="h-9 px-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 text-[10px] sm:text-xs font-bold hover:bg-emerald-500/25 hover:text-white transition flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  {copying ? 'Copying…' : 'Copy Report'}
                </button>
                <button
                  type="button"
                  onClick={() => setHndReportOpen(false)}
                  aria-label="Close report"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/70 hover:bg-red-500/15 hover:border-red-400/40 hover:text-red-300 transition"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
              </div>

              <div ref={hndReportRef} className="p-5 flex flex-col gap-2">
                {/* ✅ Image heading — popup mein hidden, sirf copied image mein dikhegi */}
                <div ref={reportHeadingRef} className="hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
                    <div className="text-sm sm:text-base font-extrabold">
                      <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Penalties </span>
                      <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Report</span>
                    </div>
                    <div className="text-[10px] sm:text-xs font-extrabold text-emerald-300 whitespace-nowrap">{hndReportDateLabel}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3">
                  <span className="text-xs sm:text-sm font-semibold text-white/70">Total Penalties</span>
                  {hndCellView('total', loading ? '—' : hndPenalties.length, 'text-xl sm:text-2xl font-extrabold bg-[linear-gradient(180deg,#f59e0b,#fbbf24,#fde68a,#fbbf24,#f59e0b)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]')}
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3">
                  <span className="text-xs sm:text-sm font-semibold text-white/70">Resolved</span>
                  {hndCellView('resolved', loading ? '—' : hndResolved, 'text-xl sm:text-2xl font-extrabold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]')}
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3">
                  <span className="text-xs sm:text-sm font-semibold text-white/70">Un Resolved</span>
                  {hndCellView('unresolved', loading ? '—' : hndUnresolved, 'text-xl sm:text-2xl font-extrabold bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]')}
                </div>
                {/* ✅ First Imposed Time: sab se pehle expire hone wali unresolved penalty ka deadline */}
                <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${lastImposedOverdue ? 'border-red-400/25 bg-red-500/10' : 'border-sky-400/25 bg-sky-500/10'}`}>
                  <span className="text-xs sm:text-sm font-semibold text-white/70">First Imposed Time</span>
                  <span
                    title="Earliest deadline among unresolved penalties (Created + TAT)"
                    className={`text-sm sm:text-lg font-extrabold bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap ${
                      lastImposedOverdue
                        ? 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]'
                        : 'bg-[linear-gradient(180deg,#0ea5e9,#38bdf8,#7dd3fc,#38bdf8,#0ea5e9)]'
                    }`}
                  >
                    {loading ? '—' : lastImposedInfo
                      ? lastImposedInfo.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}