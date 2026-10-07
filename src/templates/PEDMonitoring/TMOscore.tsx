// ✅ TMO Score — PED Dashboard ke "TMO Score" tab ka poora module
//    Data: backend /tmo/sync + /tmo/data (sirf Tehsil Office, Haroonabad — office_id 9827)
import { useCallback, useEffect, useRef, useState } from 'react'

type Row = Record<string, any>

// ✅ API base — Local vs Live detection (PED jaisa)
const API_BASE = (() => {
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8000'
  return 'https://provable-pulp-leotard.ngrok-free.dev'
})()

// ✅ Ngrok free-tier interstitial bypass
const API_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'ngrok-skip-browser-warning': 'rto-web',
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// ✅ Table columns — Division / District / Office JAN BOOHJ kar hidden hain
type ColDef = { key: string; label: string; full?: string; width: string; align?: 'left' | 'right' | 'center'; color?: string }
const COLS: ColDef[] = [
  { key: 'sr', label: 'Sr#', width: '3%', align: 'left', color: 'text-white/50 font-mono' },
  { key: 'date', label: 'Date', width: '8%', align: 'left', color: 'text-white/80 font-semibold' },
  { key: 'percentage_dtd', label: 'Door To Door Waste Collection', width: '10%', align: 'center', color: 'text-emerald-300 font-bold' },
  { key: 'approved_percentage_dtd', label: 'Approved Door To Door Waste Collection', width: '11%', align: 'center', color: 'text-sky-300 font-bold' },
  { key: 'percentage_environment', label: 'Environment Friendly', width: '9%', align: 'center', color: 'text-purple-300 font-bold' },
  { key: 'approved_percentage_environment', label: 'Approved Environment Friendly', width: '10%', align: 'center', color: 'text-sky-300 font-bold' },
  { key: 'percentage_manual_sweeping', label: 'Manual Sweeping', width: '9%', align: 'center', color: 'text-amber-300 font-bold' },
  { key: 'approved_percentage_manual_sweeping', label: 'Approved Manual Sweeping', width: '10%', align: 'center', color: 'text-sky-300 font-bold' },
  { key: 'percentage_street_sweeping', label: 'Street Sweeping (Commercial)', width: '10%', align: 'center', color: 'text-red-300 font-bold' },
  { key: 'approved_percentage_street_sweeping', label: 'Approved Street Sweeping (Commercial)', width: '11%', align: 'center', color: 'text-sky-300 font-bold' },
  { key: 'status', label: 'Status', width: '9%', align: 'center', color: '' },
]

function ColGroup() {
  return (
    <colgroup>
      {COLS.map((c, i) => (
        <col key={i} style={{ width: c.width }} />
      ))}
    </colgroup>
  )
}

function StatusBadge({ v }: { v: any }) {
  const s = String(v ?? '').trim().toLowerCase()
  // ✅ Portal 1/0 bhejta hai → Approved/Pending mein badlo
  const label =
    s === '1' || s.includes('approv')
      ? 'Approved'
      : s === '0' || s.includes('pend')
      ? 'Pending'
      : s.includes('reject')
      ? 'Rejected'
      : String(v || '—')
  const cls =
    label === 'Approved'
      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
      : label === 'Pending'
      ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
      : label === 'Rejected'
      ? 'bg-red-500/15 border-red-400/40 text-red-300'
      : 'bg-white/10 border-white/20 text-white/70'
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border ${cls}`}>{label}</span>
}

// ✅ Module-level cache — tab switch par foran data show ho (koi loading spinner nahi)
let CACHE: { rows: Row[]; meta: Row | null } | null = null

export default function TMOscore() {
  // ✅ Default range: current month (1st → today)
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const defaultFrom = `${currentMonth}-01`

  const [rows, setRows] = useState<Row[]>(CACHE?.rows ?? [])
  const [meta, setMeta] = useState<Row | null>(CACHE?.meta ?? null)
  const [fromDate, setFromDate] = useState<string>(CACHE?.meta?.range_from || defaultFrom)
  const [toDate, setToDate] = useState<string>(CACHE?.meta?.range_to || todayStr)
  const [activeFrom, setActiveFrom] = useState<string>(CACHE?.meta?.range_from || defaultFrom)
  const [activeTo, setActiveTo] = useState<string>(CACHE?.meta?.range_to || todayStr)
  const [loading, setLoading] = useState(!CACHE)
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

  // ✅ DB se loaded data (jo range DB mein hai wahi picker mein set hoti hai)
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/tmo/data`, { headers: API_HEADERS })
      const json = res.ok ? await res.json().catch(() => null) : null
      if (json) {
        setRows(json.rows || [])
        setMeta(json.meta || null)
        CACHE = { rows: json.rows || [], meta: json.meta || null }
        if (json.meta?.range_from && json.meta?.range_to) {
          setFromDate(json.meta.range_from)
          setToDate(json.meta.range_to)
          setActiveFrom(json.meta.range_from)
          setActiveTo(json.meta.range_to)
        }
        return json
      }
      if (!silent) {
        setRows([])
        setMeta(null)
      }
      return null
    } catch {
      if (!silent) {
        setRows([])
        setMeta(null)
      }
      return null
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // ✅ Portal se sync + DB rewrite + table load
  async function syncAndLoad(from: string, to: string) {
    setSyncing(true)
    try {
      const res = await fetch(`${API_BASE}/tmo/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...API_HEADERS },
        body: JSON.stringify({ date_from: from, date_to: to }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.detail || 'Sync failed')
      await loadData()
      return json
    } catch (e: any) {
      console.error('❌ TMO sync error:', e)
      setLoading(false)
      return null
    } finally {
      setSyncing(false)
    }
  }

  // ✅ Initial load — sirf pehli dafa (jab meta hi na ho) current month sync karo;
  //    agar meta mojood hai (chahe rows 0 hon) to wahi range show karo
  useEffect(() => {
    ;(async () => {
      if (CACHE) {
        loadData(true) // ✅ Cache foran show, background mein silent refresh (koi spinner nahi)
        return
      }
      const json = await loadData()
      if (!json || !json.meta) {
        await syncAndLoad(defaultFrom, todayStr)
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ Update / Search — selected range sync karo
  async function handleUpdate() {
    if (!fromDate || !toDate || fromDate > toDate) {
      flashMsg('error', 'From date, To date se baad nahi ho sakti')
      return
    }
    clearMsg()
    const json = await syncAndLoad(fromDate, toDate)
    if (!json) flashMsg('error', 'Sync failed')
    else if (json.status === 'updated') flashMsg('success', 'Successfully Updated')
    else flashMsg('error', 'No data found on portal for this range')
  }

  // ✅ Reset — current month range par wapis
  async function handleReset() {
    clearMsg()
    setFromDate(defaultFrom)
    setToDate(todayStr)
    const json = await syncAndLoad(defaultFrom, todayStr)
    if (json?.status === 'updated') flashMsg('success', 'Successfully Updated')
  }

  // ✅ Dynamic button logic (PED jaisi)
  const isCurrentRange = fromDate === defaultFrom && toDate === todayStr
  const isViewing = fromDate === activeFrom && toDate === activeTo

  let buttonText = 'Update'
  let buttonAction = handleUpdate
  let buttonColorClass = 'border-sky-400/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25'
  let buttonIcon = (
    <svg className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  )
  if (!isCurrentRange) {
    if (isViewing) {
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
      buttonText = 'Search'
      buttonAction = handleUpdate
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
    <div className="flex flex-col gap-3 mt-8 flex-1 min-h-0">
      {/* Table Card */}
      <div className="rounded-[24px] border border-emerald-400/25 bg-linear-to-b from-[#073b2d] to-[#021d17] shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-full min-h-0">
        {/* Card header + controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold whitespace-nowrap">
              <span className="text-white">TMO Score of </span>
              <span className="text-emerald-300">Tehsil Haroonabad</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* ✅ Slide-in toast */}
            <div
              className={`overflow-hidden transition-all duration-300 ease-out ${
                syncMsg && syncMsgShow ? 'max-w-[280px] opacity-100 translate-x-0' : 'max-w-0 opacity-0 -translate-x-6'
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

            {/* ✅ From date */}
            <label className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold text-white/50 uppercase">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="h-10 px-3 rounded-xl border border-emerald-400/25 bg-[#071b15]/80 backdrop-blur-md text-xs sm:text-sm font-bold text-white hover:border-emerald-400/50 transition outline-none focus:ring-2 focus:ring-emerald-400/30 cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
            </label>

            {/* ✅ To date */}
            <label className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold text-white/50 uppercase">To</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="h-10 px-3 rounded-xl border border-emerald-400/25 bg-[#071b15]/80 backdrop-blur-md text-xs sm:text-sm font-bold text-white hover:border-emerald-400/50 transition outline-none focus:ring-2 focus:ring-emerald-400/30 cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
            </label>

            {/* ✅ Dynamic button */}
            <button
              type="button"
              onClick={buttonAction}
              disabled={syncing || loading}
              className={`flex items-center gap-2 h-10 px-5 rounded-xl border text-xs sm:text-sm font-bold transition disabled:opacity-50 ${buttonColorClass}`}
            >
              {buttonIcon}
              {syncing ? 'Syncing…' : buttonText}
            </button>
          </div>
        </div>

        {/* ✅ HEADER (fixed) */}
        <div className="overflow-x-auto flex-shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full table-fixed text-left text-[9px] sm:text-[10px] md:text-[11px] lg:text-xs">
            <ColGroup />
            <thead>
              <tr className="border-b border-emerald-400/20 bg-[#0a4038] shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                {COLS.map((c, i) => (
                  <th
                    key={i}
                    title={c.full || c.label}
                    className={`px-2 sm:px-3 py-2.5 sm:py-3 font-bold tracking-wider text-emerald-200/90 uppercase leading-tight ${
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* ✅ BODY (scrollable) */}
        <div className="overflow-auto flex-1 min-h-0 [scrollbar-width:thin] [scrollbar-color:rgba(16,185,129,0.45)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-emerald-500/30 [&::-webkit-scrollbar-thumb]:rounded-full">
          <table className="w-full table-fixed text-left text-[9px] sm:text-[10px] md:text-[11px] lg:text-xs">
            <ColGroup />
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COLS.length} className="px-4 py-12 text-center text-white/50">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 rounded-full border-2 border-emerald-400/30 border-t-emerald-300 animate-spin" />
                      <div className="text-xs font-semibold text-white/70">Loading data…</div>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length} className="px-4 py-12 text-center text-white/50">
                    No Data Available for {activeFrom} → {activeTo}
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={`${r.report_date}-${r.sr_no}-${i}`} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                    {COLS.map((c, ci) => {
                      const alignCls = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                      if (c.key === 'sr') {
                        return (
                          <td key={ci} className={`px-2 sm:px-3 py-2 sm:py-2.5 whitespace-nowrap overflow-hidden text-ellipsis ${alignCls} ${c.color}`}>
                            {r.sr_no || i + 1}
                          </td>
                        )
                      }
                      if (c.key === 'date') {
                        return (
                          <td key={ci} className={`px-2 sm:px-3 py-2 sm:py-2.5 whitespace-nowrap overflow-hidden text-ellipsis ${alignCls} ${c.color}`}>
                            {r.report_date}
                          </td>
                        )
                      }
                      if (c.key === 'status') {
                        return (
                          <td key={ci} className={`px-2 sm:px-3 py-2 sm:py-2.5 whitespace-nowrap overflow-hidden ${alignCls}`}>
                            <StatusBadge v={r.row_data?.status} />
                          </td>
                        )
                      }
                      const v = r.row_data?.[c.key]
                      return (
                        <td key={ci} title={c.full} className={`px-2 sm:px-3 py-2 sm:py-2.5 whitespace-nowrap overflow-hidden text-ellipsis ${alignCls} ${c.color}`}>
                          {v === null || v === undefined || v === '' ? '—' : String(v)}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}