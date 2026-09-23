import { useEffect, useMemo, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { supabase } from '../../lib/supabase'

type Row = Record<string, any>

type Props = {
  penalties: Row[]
  loading?: boolean
  permissions?: any
}

function isYes(v: any) {
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'yes' || s === '1' || s === 'true' || s === 'y'
}

function todayStr() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function fmtDateLabel(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const API = 'http://localhost:8000'

export default function FMOStatistics({ penalties, loading = false, permissions }: Props) {
  const [detailFmo, setDetailFmo] = useState<string | null>(null)
  const [imposedOpen, setImposedOpen] = useState(false)
  const [copying, setCopying] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  const [pickerDate, setPickerDate] = useState<string>(todayStr())
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [histRows, setHistRows] = useState<Row[] | null>(null)

  const [fmoAssignments, setFmoAssignments] = useState<{ fmo_name: string; hnd_office: boolean; faqirwali_office: boolean }[]>([])
  useEffect(() => {
    async function loadAssignments() {
      const { data } = await supabase.from('fmo_office_assignments').select('fmo_name, hnd_office, faqirwali_office')
      setFmoAssignments(data || [])
    }
    loadAssignments()
  }, [])

  const allowedOffices = useMemo(() => {
    if (!permissions) return ['hnd', 'faqirwali']
    const offices = []
    if (permissions.penalties_hnd) offices.push('hnd')
    if (permissions.penalties_faqirwali) offices.push('faqirwali')
    return offices
  }, [permissions])

  const filteredPenalties = useMemo(() => {
    if (allowedOffices.length === 2) return penalties
    return penalties.filter((p: Row) => {
      const fmo = fmoAssignments.find(f => f.fmo_name === p.added_by)
      if (!fmo) return false
      if (allowedOffices.includes('hnd') && fmo.hnd_office) return true
      if (allowedOffices.includes('faqirwali') && fmo.faqirwali_office) return true
      return false
    })
  }, [penalties, fmoAssignments, allowedOffices])

  const showImposedReport = permissions?.isAdmin === true

  const reportRows = histRows ?? filteredPenalties
  const isHist = histRows !== null
  const reportDateLabel = isHist ? fmtDateLabel(pickerDate) : fmtDateLabel(todayStr())

  async function handleSearchReport() {
    if (!pickerDate || searching) return
    if (pickerDate > todayStr()) {
      setSearchError('Future date is not allowed')
      return
    }
    setSearching(true)
    setSearchError('')
    try {
      const res = await fetch(`${API}/penalties/imposed-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: pickerDate }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.message || `Server error: ${res.status}`)
      setHistRows(json.rows ?? [])
    } catch (e: any) {
      setSearchError(e?.message || 'Fetch failed')
    } finally {
      setSearching(false)
    }
  }

  function handleBackToToday() {
    setHistRows(null)
    setPickerDate(todayStr())
    setSearchError('')
  }

  function closeImposed() {
    setImposedOpen(false)
    setHistRows(null)
    setPickerDate(todayStr())
    setSearchError('')
  }

  async function copyReportAsImage() {
    if (!reportRef.current || copying) return
    setCopying(true)
    try {
      const blob = await toBlob(reportRef.current, { backgroundColor: '#06281f', pixelRatio: 2 })
      if (!blob) throw new Error('Image not generated')
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && 'write' in navigator.clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `TM-Imposed-Report.png`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e: any) {
      alert(`Copy failed: ${e?.message ?? e}`)
    } finally {
      setCopying(false)
    }
  }

  const imposedMatrix = useMemo(() => {
    const fmoTotals = new Map<string, number>()
    const subTotals = new Map<string, number>()
    const cells = new Map<string, Map<string, number>>()
    let grand = 0
    for (const p of reportRows) {
      if (!isYes(p.tm_imposed)) continue
      const amt = Number(p.penalty_amount || 0)
      const fmo = String(p.added_by || '').trim() || 'Unknown'
      const sub = String(p.penalty_sub_type || '').trim() || '—'
      fmoTotals.set(fmo, (fmoTotals.get(fmo) || 0) + amt)
      subTotals.set(sub, (subTotals.get(sub) || 0) + amt)
      let row = cells.get(sub)
      if (!row) { row = new Map(); cells.set(sub, row) }
      row.set(fmo, (row.get(fmo) || 0) + amt)
      grand += amt
    }
    const fmos = [...fmoTotals.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([n]) => n)
    const subs = [...subTotals.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([s]) => s)
    return { fmos, subs, cells, fmoTotals, subTotals, grand }
  }, [reportRows])

  const fmoStats = useMemo(() => {
    type SubStat = { total: number; resolved: number; unresolved: number }
    type UcStat = { ucTotal: number; ucResolved: number; ucUnresolved: number; subs: Map<string, SubStat> }
    type FmoStat = { total: number; resolved: number; unresolved: number; ucs: Map<string, UcStat> }
    const map = new Map<string, FmoStat>()
    for (const p of filteredPenalties) {
      const name = String(p.added_by || '').trim() || 'Unknown'
      const uc = String(p.uc_ward || '').trim() || '—'
      const st = String(p.penalty_sub_type || '').trim() || '—'
      const isRes = /resolved|closed/i.test(String(p.status || ''))
      let e = map.get(name)
      if (!e) { e = { total: 0, resolved: 0, unresolved: 0, ucs: new Map() }; map.set(name, e) }
      e.total += 1
      if (isRes) e.resolved += 1; else e.unresolved += 1
      let u = e.ucs.get(uc)
      if (!u) { u = { ucTotal: 0, ucResolved: 0, ucUnresolved: 0, subs: new Map() }; e.ucs.set(uc, u) }
      u.ucTotal += 1
      if (isRes) u.ucResolved += 1; else u.ucUnresolved += 1
      let s = u.subs.get(st)
      if (!s) { s = { total: 0, resolved: 0, unresolved: 0 }; u.subs.set(st, s) }
      s.total += 1
      if (isRes) s.resolved += 1; else s.unresolved += 1
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total)
  }, [filteredPenalties])

  const dateLabel = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }, [])

  const detail = detailFmo ? fmoStats.find(([n]) => n === detailFmo) : null
  const ucCount = detail ? detail[1].ucs.size : 0
  const modalWidthCls = ucCount <= 1 ? 'max-w-lg' : ucCount === 2 ? 'max-w-4xl' : 'max-w-7xl'
  const ucGridCls = ucCount <= 1 ? 'grid-cols-1' : ucCount === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'

  // ✅ Search button sirf tab show ho jab user ne purani date pick ki ho (today se alag)
  const showSearchBtn = pickerDate !== todayStr()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold flex flex-wrap items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </span>
          <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">FMO </span>
          <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Statistics</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 text-[10px] sm:text-xs font-bold whitespace-nowrap">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            {dateLabel}
          </span>
        </h2>

        {showImposedReport && (
          <button type="button" onClick={() => setImposedOpen(true)} className="h-9 sm:h-10 px-4 rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 text-[11px] sm:text-xs font-bold hover:bg-emerald-500/25 hover:text-white transition flex items-center gap-2 whitespace-nowrap">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
            Imposed Report
          </button>
        )}
      </div>

      {fmoStats.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-xs text-white/40">{loading ? 'Loading FMO data…' : 'No FMO data available'}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {fmoStats.map(([name, s]) => (
            <div key={name} className="rounded-2xl border border-emerald-400/25 bg-linear-to-b from-[#073b2d] to-[#021d17] shadow-[0_15px_40px_rgba(0,0,0,0.3)] p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 text-xs font-extrabold">{name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-white truncate">{name}</div>
                  <div className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Field Monitoring Officer</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/15 text-white/60 text-[10px] font-bold whitespace-nowrap">UC/Wards: {s.ucs.size}</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[10px] font-bold whitespace-nowrap">Total: {s.total}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold whitespace-nowrap">Resolved: {s.resolved}</span>
                <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-400/40 text-red-300 text-[10px] font-bold whitespace-nowrap">Unresolved: {s.unresolved}</span>
              </div>
              <button type="button" onClick={() => setDetailFmo(name)} className="w-full h-9 rounded-xl border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 text-[11px] sm:text-xs font-bold hover:bg-emerald-500/25 hover:text-white transition flex items-center justify-center gap-2">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                Details
              </button>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setDetailFmo(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className={`pointer-events-auto w-full ${modalWidthCls} max-h-[92vh] overflow-y-auto rounded-2xl border border-emerald-400/30 bg-[#04231c] shadow-[0_30px_80px_rgba(0,0,0,0.6)] [scrollbar-width:thin] [scrollbar-color:rgba(16,185,129,0.4)_transparent]`}>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 bg-[#04231c]">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 text-xs font-extrabold">{detail[0].split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-extrabold text-white truncate">{detail[0]}</div>
                    <div className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Field Monitoring Officer • {dateLabel}</div>
                  </div>
                </div>
                <button type="button" onClick={() => setDetailFmo(null)} aria-label="Close details" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/70 hover:bg-red-500/15 hover:border-red-400/40 hover:text-red-300 transition">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/15 text-white/60 text-[10px] font-bold whitespace-nowrap">UC/Wards: {detail[1].ucs.size}</span>
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[10px] font-bold whitespace-nowrap">Total: {detail[1].total}</span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold whitespace-nowrap">Resolved: {detail[1].resolved}</span>
                  <span className="px-2.5 py-1 rounded-full bg-red-500/15 border border-red-400/40 text-red-300 text-[10px] font-bold whitespace-nowrap">Unresolved: {detail[1].unresolved}</span>
                </div>
                <div className={`grid ${ucGridCls} gap-3`}>
                  {[...detail[1].ucs.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([uc, u]) => (
                    <div key={uc} className="rounded-xl border border-white/10 bg-white/5 p-3.5 flex flex-col gap-2">
                      <div className="flex items-start gap-1.5">
                        <svg className="h-3.5 w-3.5 text-emerald-300 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                        <span className="text-[11px] font-bold text-white/90 leading-snug">{uc}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[9px] font-bold whitespace-nowrap">Total: {u.ucTotal}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[9px] font-bold whitespace-nowrap">Resolved: {u.ucResolved}</span>
                        <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-400/40 text-red-300 text-[9px] font-bold whitespace-nowrap">Unresolved: {u.ucUnresolved}</span>
                      </div>
                      <div className="h-px bg-white/10" />
                      <div className="flex flex-col gap-1.5">
                        {[...u.subs.entries()].sort((a, b) => b[1].total - a[1].total).map(([st, v]) => (
                          <div key={st} className="flex flex-col gap-0.5">
                            <div className="text-[11px] font-semibold text-emerald-200 leading-snug">{st} : <span className="font-extrabold text-emerald-300">{v.total}</span></div>
                            <div className="flex items-center gap-2 text-[10px] font-semibold">
                              <span className="text-emerald-300 whitespace-nowrap">Resolved: {v.resolved}</span>
                              <span className="text-white/25">•</span>
                              <span className="text-red-300 whitespace-nowrap">Unresolved: {v.unresolved}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {imposedOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={closeImposed} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-7xl max-h-[92vh] overflow-y-auto rounded-2xl border border-emerald-400/30 bg-[#04231c] shadow-[0_30px_80px_rgba(0,0,0,0.6)] [scrollbar-width:thin] [scrollbar-color:rgba(16,185,129,0.4)_transparent]">
              <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/10 bg-[#04231c]">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                  </span>
                  <div className="text-sm sm:text-base font-extrabold text-white">Penalties Imposed Report</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={copyReportAsImage} disabled={copying} className="h-9 px-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 text-[10px] sm:text-xs font-bold hover:bg-emerald-500/25 hover:text-white transition flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    {copying ? 'Copying…' : 'Copy as Image'}
                  </button>
                  <button type="button" onClick={closeImposed} aria-label="Close imposed report" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/70 hover:bg-red-500/15 hover:border-red-400/40 hover:text-red-300 transition">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              </div>

              <div className="p-5 flex flex-col gap-3">
                {/* ✅ Date search toolbar — Search button only visible after picking non-today date */}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={pickerDate}
                    max={todayStr()}
                    disabled={searching}
                    onChange={e => setPickerDate(e.target.value)}
                    className="h-9 px-3 rounded-xl border border-emerald-400/25 bg-[#071b15]/80 backdrop-blur-md text-[11px] sm:text-xs font-medium text-white outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50 transition"
                  />
                  {showSearchBtn && (
                    <button
                      type="button"
                      onClick={handleSearchReport}
                      disabled={searching}
                      className="h-9 px-4 rounded-xl border border-sky-400/40 bg-sky-500/15 text-sky-300 text-[11px] sm:text-xs font-bold hover:bg-sky-500/25 disabled:opacity-50 transition whitespace-nowrap"
                    >
                      {searching ? 'Searching…' : 'Search'}
                    </button>
                  )}
                  {isHist && (
                    <button
                      type="button"
                      onClick={handleBackToToday}
                      disabled={searching}
                      className="h-9 px-4 rounded-xl border border-amber-400/40 bg-amber-500/15 text-amber-300 text-[11px] sm:text-xs font-bold hover:bg-amber-500/25 disabled:opacity-50 transition whitespace-nowrap"
                    >
                      Reset
                    </button>
                  )}
                  <span className={`text-[10px] sm:text-[11px] font-bold whitespace-nowrap ${isHist ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {isHist ? `Historical report: ${reportDateLabel}` : `Live report: ${reportDateLabel}`}
                  </span>
                  {searchError && (
                    <span className="text-[10px] sm:text-[11px] font-bold text-red-300 whitespace-nowrap">⚠ {searchError}</span>
                  )}
                </div>

                {searching && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-sky-400/40 bg-sky-500/15 text-sky-300 text-xs font-semibold">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                    <span>Fetching data from portal for {pickerDate}…</span>
                  </div>
                )}

                {imposedMatrix.subs.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-xs text-white/40">No TM imposed penalties found for {reportDateLabel}</div>
                ) : (
                  <div ref={reportRef} className="rounded-xl border border-white/10 bg-[#06281f] p-2 sm:p-3 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[11px] sm:text-sm font-extrabold text-white">Penalties Imposed Report</div>
                        <div className="text-[9px] sm:text-xs font-bold text-emerald-300 whitespace-nowrap">• {reportDateLabel}</div>
                      </div>
                      <div className="text-[9px] sm:text-xs font-bold text-amber-300 whitespace-nowrap">Grand Total: Rs. {imposedMatrix.grand.toLocaleString()}</div>
                    </div>
                    <table className="w-full table-fixed">
                      <thead>
                        <tr className="text-left text-[10px] sm:text-xs font-bold tracking-wider text-emerald-200/90 bg-[#0a4038] border-b border-emerald-400/20">
                          <th className="w-[20%] px-2 py-2 text-left uppercase">Penalty Sub Types</th>
                          {imposedMatrix.fmos.map(f => (
                            <th key={f} title={f} className="px-0.5 py-2 text-center border-l border-white/10">
                              <span className="block leading-tight text-[8px] sm:text-[9px] [overflow-wrap:normal]">{f}</span>
                            </th>
                          ))}
                          <th className="w-[8%] px-1 py-2 text-center whitespace-nowrap border-l border-white/10 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imposedMatrix.subs.map((s, i) => (
                          <tr key={s} className="border-b border-white/10 last:border-0 hover:bg-white/5 transition">
                            <td className="px-2 py-1.5 text-[9px] sm:text-[10px] font-semibold text-white/85">
                              <div className="flex items-start gap-1">
                                <span className="text-white/40 font-bold shrink-0">{i + 1}:</span>
                                <span className="leading-snug">{s}</span>
                              </div>
                            </td>
                            {imposedMatrix.fmos.map(f => {
                              const v = imposedMatrix.cells.get(s)?.get(f) || 0
                              return (
                                <td key={f} className="px-1 py-1.5 text-center border-l border-white/10">
                                  {v > 0 ? <span className="text-[9px] sm:text-[10px] font-bold text-emerald-300">{v.toLocaleString()}</span> : <span className="text-white/30 text-[9px] sm:text-[10px] font-bold">-</span>}
                                </td>
                              )
                            })}
                            <td className="px-1 py-1.5 text-center border-l border-white/10">
                              <span className="text-[9px] sm:text-[10px] font-extrabold text-amber-300">{(imposedMatrix.subTotals.get(s) || 0).toLocaleString()}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#0a4038] border-t border-emerald-400/20 text-[10px] sm:text-xs font-bold">
                          <td className="px-2 py-2 uppercase tracking-wider text-emerald-200/90">Total (FMO wise)</td>
                          {imposedMatrix.fmos.map(f => (
                            <td key={f} className="px-1 py-2 text-center text-amber-300 border-l border-white/10">
                              <span className="text-[9px] sm:text-[10px] font-bold">{(imposedMatrix.fmoTotals.get(f) || 0).toLocaleString()}</span>
                            </td>
                          ))}
                          <td className="px-1 py-2 text-center text-amber-300 border-l border-white/10">
                            <span className="text-[9px] sm:text-[10px] font-extrabold">{imposedMatrix.grand.toLocaleString()}</span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}