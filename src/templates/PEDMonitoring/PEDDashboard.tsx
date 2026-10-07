import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { resetMonitoringTabs } from '../../lib/resetTabs'
import TMOscore from './TMOscore'

type Props = {
  onHomeClick?: () => void
}

type View = 'ped-monthly' | 'tmo-score'
type Row = Record<string, any>

// ✅ API base — Local vs Live detection
// Agar frontend localhost par hai → local backend (http://localhost:8000)
// Agar frontend live hai → ngrok tunnel (https://provable-pulp-leotard.ngrok-free.dev)
const API_BASE = (() => {
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:8000'
  }
  return 'https://provable-pulp-leotard.ngrok-free.dev'
})()

// ✅ Ngrok free-tier ka browser-warning interstitial bypass karne ke liye header —
//    warna simple GET requests interstitial par atak kar CORS error deti hain
const API_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'ngrok-skip-browser-warning': 'rto-web',
}

// ✅ Number formatter (3,992,041 jaisa)
function fmtNum(v: any): string {
  const n = Number(v ?? 0)
  return isFinite(n) ? n.toLocaleString() : '0'
}

// ✅ Fixed column widths — header/body/footer mein same alignment (koi horizontal scroll nahi)
const COL_WIDTHS = ['4%', '9%', '10%', '10%', '8%', '11%', '9%', '12%', '9%', '10%', '8%']
function ColGroup() {
  return (
    <colgroup>
      {COL_WIDTHS.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  )
}

// ✅ Month label: "2026-10" → "October 2026"
function monthLabel(m: string): string {
  const [y, mo] = m.split('-')
  const d = new Date(Number(y), Number(mo) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function PEDDashboard({ onHomeClick }: Props) {
  const navigate = useNavigate()

  // ✅ Tab persistence
  const [view, setView] = useState<View>(() => {
    try {
      const saved = localStorage.getItem('rto_ped_tab') as View | null
      if (saved && ['ped-monthly', 'tmo-score'].includes(saved)) return saved
    } catch {}
    return 'ped-monthly'
  })
  useEffect(() => {
    try { localStorage.setItem('rto_ped_tab', view) } catch {}
  }, [view])

  // ✅ Data states
  const [meta, setMeta] = useState<Row | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [months, setMonths] = useState<{ month: string; fetched_at?: string }[]>([])
  
  // ✅ Current Month Logic (Default)
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // ✅ Persisted month — refresh / tab-switch par yaad rahega, Home par clear hoga
  const PED_MONTH_KEY = 'rto_ped_selected_month'
  function rememberMonth(m: string | null) {
    try {
      if (m) localStorage.setItem(PED_MONTH_KEY, m)
      else localStorage.removeItem(PED_MONTH_KEY)
    } catch {}
  }
  const savedMonth = (() => {
    try {
      const s = localStorage.getItem(PED_MONTH_KEY)
      return s && /^\d{4}-\d{2}$/.test(s) ? s : null
    } catch {
      return null
    }
  })()
  const initialMonth = savedMonth || currentMonth

  // selectedMonth = input mein jo month select hai
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth)
  // activeMonth = jo data currently table mein show ho raha hai
  const [activeMonth, setActiveMonth] = useState<string>(initialMonth)

  // ✅ Jab bhi selectedMonth badle, localStorage mein yaad rakho
  useEffect(() => {
    rememberMonth(selectedMonth)
  }, [selectedMonth])
  
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [syncMsgShow, setSyncMsgShow] = useState(false)
  const msgTimers = useRef<number[]>([])

  // ✅ Slide-in toast: 2s show → slide-out → clear
  function flashMsg(type: 'success' | 'error', text: string) {
    msgTimers.current.forEach(t => window.clearTimeout(t))
    msgTimers.current = []
    setSyncMsg({ type, text })
    setSyncMsgShow(true)
    msgTimers.current.push(window.setTimeout(() => setSyncMsgShow(false), 2000))
    msgTimers.current.push(window.setTimeout(() => setSyncMsg(null), 2400))
  }
  function clearMsg() {
    msgTimers.current.forEach(t => window.clearTimeout(t))
    msgTimers.current = []
    setSyncMsg(null)
    setSyncMsgShow(false)
  }
  useEffect(() => () => msgTimers.current.forEach(t => window.clearTimeout(t)), [])

  // ✅ Sliding pill for tabs
  const navRef = useRef<HTMLDivElement>(null)
  const [slider, setSlider] = useState({ left: 0, width: 0 })

  // ✅ Table 3-region layout: header / body / footer (scrollbar sirf body mein)
  const headRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const footRef = useRef<HTMLDivElement>(null)
  function handleBodyScroll() {
    const x = bodyRef.current?.scrollLeft ?? 0
    if (headRef.current) headRef.current.scrollLeft = x
    if (footRef.current) footRef.current.scrollLeft = x
  }

  useEffect(() => {
    const update = () => {
      if (!navRef.current) return
      const activeBtn = navRef.current.querySelector('[data-active="true"]') as HTMLElement
      if (activeBtn) setSlider({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth })
    }
    update()
    const t = setTimeout(update, 100)
    window.addEventListener('resize', update)
    return () => { clearTimeout(t); window.removeEventListener('resize', update) }
  }, [view])

  // ✅ Load available months from DB (for history reference)
  const loadMonths = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/ped/months`, { headers: API_HEADERS })
      if (res.ok) {
        const json = await res.json()
        setMonths(json.months || [])
      }
    } catch (err) {
      console.error('Failed to load months:', err)
    }
  }, [])

  // ✅ Load month data
  const loadMonthData = useCallback(async (month: string) => {
    if (!month) return
    setLoading(true)
    try {
      const url = `${API_BASE}/ped/data?month=${month}`
      console.log('📥 Fetching data from:', url)
      
      const res = await fetch(url, { headers: API_HEADERS })
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('❌ Data fetch failed:', res.status, errorText)
        setMeta(null)
        setRows([])
        return
      }
      
      const json = await res.json()
      console.log('✅ Data loaded:', json.rows?.length || 0, 'rows')
      setMeta(json.meta || null)
      setRows(json.rows || [])
    } catch (err) {
      console.error('❌ Data fetch exception:', err)
      setMeta(null)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  // ✅ Initial load — persisted month ho to wo, warna current month
  useEffect(() => {
    loadMonths()
    loadMonthData(initialMonth)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ❌ REMOVED: Auto-fetch on selectedMonth change (Ab manual search/reset karega)

  // ✅ Sync (Update PED Data) — calls /ped/sync for the current month
  async function handleSync() {
    if (!selectedMonth) return
    setSyncing(true)
    clearMsg()
    try {
      console.log('🔄 Syncing month:', selectedMonth, 'API_BASE:', API_BASE)
      
      const res = await fetch(`${API_BASE}/ped/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...API_HEADERS },
        body: JSON.stringify({ month: selectedMonth }),
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errorText}`)
      }
      
      const json = await res.json()
      console.log('✅ Sync response:', json)
      
      if (json.status === 'updated') {
        flashMsg('success', 'Successfully Updated')
        await loadMonths()
        // ✅ Wait for data to load
        await loadMonthData(selectedMonth)
        
        // ✅ Verify data actually loaded
        if (rows.length === 0) {
          console.warn('⚠️ Sync succeeded but no rows in table')
          flashMsg('error', 'Data synced but failed to load in table')
        }
      } else if (json.status === 'empty') {
        flashMsg('error', 'No data found on portal for this month')
      } else {
        flashMsg('success', 'Successfully Updated')
        await loadMonths()
        await loadMonthData(selectedMonth)
      }
    } catch (e: any) {
      console.error('❌ Sync error:', e)
      flashMsg('error', e?.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

// ✅ Search Old Month Data: PORTAL se fresh fetch + DB overwrite
async function handleSearch() {
  if (!selectedMonth) return
  setSyncing(true)
  clearMsg()
  try {
    console.log('🔍 Searching month:', selectedMonth, 'API_BASE:', API_BASE)
    
    const sr = await fetch(`${API_BASE}/ped/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...API_HEADERS },
      body: JSON.stringify({ month: selectedMonth }),
    })
    
    if (!sr.ok) {
      const errorText = await sr.text()
      throw new Error(`HTTP ${sr.status}: ${errorText}`)
    }
    
    const sj = await sr.json()
    console.log('✅ Search sync response:', sj)
    
    await loadMonths()
    setActiveMonth(selectedMonth)
    await loadMonthData(selectedMonth)
    
    if (sj.status === 'updated') {
      flashMsg('success', 'Successfully Updated')
      if (rows.length === 0) {
        console.warn('⚠️ Search succeeded but no rows in table')
      }
    } else {
      flashMsg('error', `No data found on portal for ${monthLabel(selectedMonth)}`)
    }
  } catch (e: any) {
    console.error('❌ Search error:', e)
    flashMsg('error', e?.message || 'Search failed')
  } finally {
    setSyncing(false)
  }
}

  // ✅ Reset to Current Month (Jab Reset par click kare)
  async function handleReset() {
    setSelectedMonth(currentMonth)
    setActiveMonth(currentMonth)
    await loadMonthData(currentMonth)
  }

  // ✅ Totals calculation
  const totals = useMemo(() => {
    const t = { rfp: 0, ped: 0, score: 0, penalty: 0, escalation: 0, deduction: 0, invoice: 0 }
    for (const r of rows) {
      t.rfp += Number(r.rfp_amount || 0)
      t.ped += Number(r.ped_amount || 0)
      t.score += Number(r.ped_score || 0)
      t.penalty += Number(r.penalty_amount || 0)
      t.escalation += Number(r.escalation_amount || 0)
      t.deduction += Number(r.deduction_surplus || 0)
      t.invoice += Number(r.total_invoice || 0)
    }
    return t
  }, [rows])

  // ✅ Footer Finalized — portal ke mutabiq: agar sab rows "Yes" hain to Total bhi "Yes"
  const allFinalized = useMemo(
    () => rows.length > 0 && rows.every(r => (r.finalized || 'No') === 'Yes'),
    [rows]
  )

  const tabs: { key: View; label: string }[] = [
    { key: 'ped-monthly', label: 'PED Monthly' },
    { key: 'tmo-score', label: 'TMO Score' },
  ]

  return (
    <div className="h-dvh overflow-hidden bg-[#021b16] text-white">
      {/* ✅ Native calendar indicator hide — sirf EK custom green icon dikhe,
           lekin invisible indicator green icon ke NEECHE hai taake click par picker khule */}
      <style>{`
        .ped-month-input::-webkit-calendar-picker-indicator {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          margin: 0;
          opacity: 0;
          cursor: pointer;
        }
      `}</style>
      {/* ===== Top Navbar ===== */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="pointer-events-none bg-[#021b16] border-b border-white/10 md:border-b-0 shadow-[0_6px_24px_rgba(0,0,0,0.45)] md:shadow-none">
          <div className="relative flex items-center px-3 sm:px-6 py-2 sm:py-3 pointer-events-auto md:pointer-events-none">
            {/* Left: Home button */}
            <div className="flex-1 flex justify-start pointer-events-auto">
            <button
              onClick={async () => {
                rememberMonth(null)   // ✅ Home jate hi saved month clear — next visit par default current month
                await resetMonitoringTabs()
                await onHomeClick?.()
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

            {/* Center: Tabs */}
            <div className="relative pointer-events-auto">
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

            {/* Right: Empty (notification removed) */}
            <div className="flex-1 flex justify-end items-center gap-2.5 pr-1 sm:pr-3 pointer-events-auto">
              {/* Notification icon removed */}
            </div>
          </div>

          {/* Mobile tabs */}
          <div className="md:hidden flex justify-center pb-2 pointer-events-auto">
            <div className="flex items-center gap-1 rounded-full border border-emerald-400/25 bg-[#071b15]/80 px-1.5 py-1">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setView(t.key)}
                  className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all ${
                    view === t.key
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ===== Content ===== */}
      <main className="px-4 sm:px-6 max-w-[1750px] mx-auto flex flex-col h-full pt-24 md:pt-28 lg:pt-24 pb-3 overflow-hidden">
        {/* Center heading */}
        <div className="flex flex-col items-center -mb-1">
          <h1 className="text-center text-lg sm:text-xl md:text-2xl font-extrabold tracking-tight leading-none whitespace-nowrap">
            <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">PED </span>
            <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Dashboard</span>
          </h1>
          <p className="mt-1.5 sm:mt-2 text-center text-[10px] sm:text-xs font-semibold tracking-[0.08em] text-white/40 whitespace-nowrap">
            PED -- {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>

        {/* ===== VIEW: PED Monthly ===== */}
        {view === 'ped-monthly' && (
          <div className="flex flex-col gap-3 mt-4 flex-1 min-h-0">
            {/* Table Card */}
            <div className="rounded-[24px] border border-emerald-400/25 bg-linear-to-b from-[#073b2d] to-[#021d17] shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-full min-h-0">
              {/* Table Header with controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/10 flex-shrink-0">
                {/* Left: Heading */}
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold whitespace-nowrap">
                    <span className="text-white">PED of </span>
                    <span className="text-emerald-300">Tehsil Haroonabad</span>
                  </h2>
                </div>

                {/* Right: Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* ✅ Success/Error toast — month picker ke LEFT se slide-in, 2s baad slide-out */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-out ${
                      syncMsg && syncMsgShow
                        ? 'max-w-[280px] opacity-100 translate-x-0'
                        : 'max-w-0 opacity-0 -translate-x-6'
                    }`}
                  >
                    {syncMsg && (
                      <div
                        className={`mr-1 flex items-center whitespace-nowrap rounded-lg border px-2.5 py-2 text-[10px] sm:text-[11px] font-bold ${
                          syncMsg.type === 'success'
                            ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                            : 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                        }`}
                      >
                        {syncMsg.text}
                      </div>
                    )}
                  </div>

                  {/* ✅ Month Selector (single calendar icon) */}
                  <div className="relative">
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="ped-month-input relative h-10 px-4 pr-10 rounded-xl border border-emerald-400/25 bg-[#071b15]/80 backdrop-blur-md text-xs sm:text-sm font-bold text-white hover:border-emerald-400/50 transition outline-none focus:ring-2 focus:ring-emerald-400/30 cursor-pointer"
                      style={{ colorScheme: 'dark' }}
                    />  
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-300">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                  </div>

                  {/* ✅ Dynamic Action Button (Update / Search / Reset) */}
                  {(() => {
                    const isCurrentMonth = selectedMonth === currentMonth
                    const isViewingSelected = selectedMonth === activeMonth

                    let buttonText = 'Update PED Data'
                    let buttonAction = handleSync
                    let buttonColorClass = 'border-sky-400/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25'
                    let buttonIcon = (
                      <svg className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                        <polyline points="21 3 21 9 15 9" />
                      </svg>
                    )

                    // Agar old month select kiya gaya hai
                    if (!isCurrentMonth) {
                      if (isViewingSelected) {
                        // Data already show ho raha hai -> Reset button
                        buttonText = 'Reset'
                        buttonAction = handleReset
                        buttonColorClass = 'border-amber-400/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                        buttonIcon = (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                          </svg>
                        )
                      } else {
                        // Naya old month select kiya -> Search button
                        buttonText = 'Search'
                        buttonAction = handleSearch
                        buttonColorClass = 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                        buttonIcon = (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                        )
                      }
                    }

                    return (
                      <button
                        type="button"
                        onClick={buttonAction}
                        disabled={syncing || loading}
                        className={`flex items-center gap-2 h-10 px-5 rounded-xl border text-xs sm:text-sm font-bold transition disabled:opacity-50 ${buttonColorClass}`}
                      >
                        {buttonIcon}
                        {syncing ? 'Syncing…' : buttonText}
                      </button>
                    )
                  })()}

                </div>
              </div>
            {/* Table — 3 regions: fixed HEADER / scrollable BODY / fixed FOOTER */}
            <div className="flex flex-col flex-1 min-h-0">
              {/* ✅ HEADER — right border tak attached, koi scrollbar nahi */}
              <div ref={headRef} className="overflow-x-auto flex-shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <table className="w-full table-fixed text-left text-[9px] sm:text-[10px] md:text-[11px] lg:text-xs">
                  <ColGroup />
                  <thead>
                    <tr className="border-b border-emerald-400/20 bg-[#0a4038] shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                      <th className="px-2 sm:px-3 py-2.5 sm:py-3 font-bold tracking-wider text-emerald-200/90 uppercase whitespace-nowrap overflow-hidden text-ellipsis">Sr#</th>
                      <th className="px-2 sm:px-3 py-2.5 sm:py-3 font-bold tracking-wider text-emerald-200/90 uppercase whitespace-nowrap overflow-hidden text-ellipsis">Date</th>
                      <th className="px-2 sm:px-3 py-2.5 sm:py-3 font-bold tracking-wider text-emerald-200/90 uppercase whitespace-nowrap overflow-hidden text-ellipsis text-right">RFP Amount</th>
                      <th className="px-2 sm:px-3 py-2.5 sm:py-3 font-bold tracking-wider text-emerald-200/90 uppercase whitespace-nowrap overflow-hidden text-ellipsis text-right">PED Amount</th>
                      <th className="px-2 sm:px-3 py-2.5 sm:py-3 font-bold tracking-wider text-emerald-200/90 uppercase whitespace-nowrap overflow-hidden text-ellipsis text-right">PED Score</th>
                      <th className="px-2 sm:px-3 py-2.5 sm:py-3 font-bold tracking-wider text-emerald-200/90 uppercase whitespace-nowrap overflow-hidden text-ellipsis text-right">Final Invoice Score</th>
                      <th className="px-2 sm:px-3 py-2.5 sm:py-3 font-bold tracking-wider text-emerald-200/90 uppercase whitespace-nowrap overflow-hidden text-ellipsis text-right">Penalty</th>
                      <th className="px-2 sm:px-3 py-2.5 sm:py-3 font-bold tracking-wider text-emerald-200/90 uppercase whitespace-nowrap overflow-hidden text-ellipsis text-right">Escalation</th>
                      <th className="px-2 sm:px-3 py-2.5 sm:py-3 font-bold tracking-wider text-emerald-200/90 uppercase whitespace-nowrap overflow-hidden text-ellipsis text-right">Deduction</th>
                      <th className="px-2 sm:px-3 py-2.5 sm:py-3 font-bold tracking-wider text-emerald-200/90 uppercase whitespace-nowrap overflow-hidden text-ellipsis text-right">Total Invoice</th>
                      <th className="px-2 sm:px-3 py-2.5 sm:py-3 font-bold tracking-wider text-emerald-200/90 uppercase whitespace-nowrap overflow-hidden text-ellipsis text-center">Finalized</th>
                    </tr>
                  </thead>
                </table>
              </div>

              {/* ✅ BODY — sirf yahan scroll; scrollbar header aur footer ke ANDAR nahi aayega */}
              <div
                ref={bodyRef}
                onScroll={handleBodyScroll}
                className="overflow-auto flex-1 min-h-0 [scrollbar-width:thin] [scrollbar-color:rgba(16,185,129,0.45)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-emerald-500/30 [&::-webkit-scrollbar-thumb]:rounded-full"
              >
                <table className="w-full table-fixed text-left text-[9px] sm:text-[10px] md:text-[11px] lg:text-xs">
                  <ColGroup />
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-12 text-center text-white/50">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-10 w-10 rounded-full border-2 border-emerald-400/30 border-t-emerald-300 animate-spin" />
                            <div className="text-xs font-semibold text-white/70">Loading data…</div>
                          </div>
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-12 text-center text-white/50">
                          {activeMonth ? `No data available for ${monthLabel(activeMonth)}` : 'Select a month to view data'}
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, i) => (
                        <tr key={r.row_date || i} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                          <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-white/50 font-mono whitespace-nowrap overflow-hidden text-ellipsis">{r.sr || i + 1}</td>
                          <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-white/80 font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{r.row_date}</td>
                          <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right text-white/90 font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{fmtNum(r.rfp_amount)}</td>
                          <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right text-emerald-300 font-bold whitespace-nowrap overflow-hidden text-ellipsis">{fmtNum(r.ped_amount)}</td>
                          <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right text-sky-300 font-bold whitespace-nowrap overflow-hidden text-ellipsis">{Number(r.ped_score || 0).toFixed(2)}</td>
                          <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right text-purple-300 font-bold whitespace-nowrap overflow-hidden text-ellipsis">{Number(r.final_invoice_score || 0).toFixed(2)} %</td>
                          <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right text-red-300 font-bold whitespace-nowrap overflow-hidden text-ellipsis">{fmtNum(r.penalty_amount)}</td>
                          <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right text-amber-300 font-bold whitespace-nowrap overflow-hidden text-ellipsis">{fmtNum(Math.round(r.escalation_amount))}</td>
                          <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right text-white/70 whitespace-nowrap overflow-hidden text-ellipsis">{fmtNum(r.deduction_surplus)}</td>
                          <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right text-emerald-200 font-extrabold whitespace-nowrap overflow-hidden text-ellipsis">{fmtNum(Math.round(r.total_invoice))}</td>
                          <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-center whitespace-nowrap overflow-hidden">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border ${
                              r.finalized === 'Yes'
                                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                                : 'bg-red-500/15 border-red-400/40 text-red-300'
                            }`}>
                              {r.finalized || 'No'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* ✅ FOOTER — right border tak attached, koi scrollbar nahi */}
              <div ref={footRef} className="overflow-x-auto flex-shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <table className="w-full table-fixed text-left text-[9px] sm:text-[10px] md:text-[11px] lg:text-xs">
                  <ColGroup />
                  <tfoot>
                    <tr className="bg-[#0a4038] border-t-2 border-emerald-400/40 font-bold shadow-[0_-2px_8px_rgba(0,0,0,0.35)]">
                      <td colSpan={2} className="px-2 sm:px-3 py-2.5 sm:py-3 text-emerald-300 uppercase tracking-wider whitespace-nowrap overflow-hidden">Total</td>
                      <td className="px-2 sm:px-3 py-2.5 sm:py-3 text-right text-amber-300 whitespace-nowrap overflow-hidden">{fmtNum(totals.rfp)}</td>
                      <td className="px-2 sm:px-3 py-2.5 sm:py-3 text-right text-emerald-300 whitespace-nowrap overflow-hidden">{fmtNum(totals.ped)}</td>
                      <td className="px-2 sm:px-3 py-2.5 sm:py-3 text-right text-sky-300 whitespace-nowrap overflow-hidden">{totals.score.toFixed(2)}</td>
                      <td className="px-2 sm:px-3 py-2.5 sm:py-3 text-right text-purple-300 whitespace-nowrap overflow-hidden">—</td>
                      <td className="px-2 sm:px-3 py-2.5 sm:py-3 text-right text-red-300 whitespace-nowrap overflow-hidden">{fmtNum(totals.penalty)}</td>
                      <td className="px-2 sm:px-3 py-2.5 sm:py-3 text-right text-amber-300 whitespace-nowrap overflow-hidden">{fmtNum(Math.round(totals.escalation))}</td>
                      <td className="px-2 sm:px-3 py-2.5 sm:py-3 text-right text-white/70 whitespace-nowrap overflow-hidden">{fmtNum(totals.deduction)}</td>
                      <td className="px-2 sm:px-3 py-2.5 sm:py-3 text-right text-emerald-200 whitespace-nowrap overflow-hidden">{fmtNum(Math.round(totals.invoice))}</td>
                      <td className="px-2 sm:px-3 py-2.5 sm:py-3 text-center whitespace-nowrap overflow-hidden">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border ${
                          allFinalized
                            ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                            : 'bg-red-500/15 border-red-400/40 text-red-300'
                        }`}>
                          {allFinalized ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            </div>
          </div>
        )}

        {/* ===== VIEW: TMO Score ===== */}
        {view === 'tmo-score' && <TMOscore />}
      </main>
    </div>
  )
}