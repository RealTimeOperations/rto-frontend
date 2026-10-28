import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

// ✅ Daily targets (type-wise mileage) — 6 ghantay working hours sab ke liye
export const TARGETS: Record<string, number> = {
  'Arm Roller': 25,
  'Compactor': 20,
  'Dumper': 35,
  'Front Blade Tractor': 2,
  'Front End Loader': 2,
  'Loader Rickshaw': 12,
  'Mechanical Sweeper': 10,
  'Mini Tipper': 10,
  'Road Washer': 10,
  'Tractor Trolley': 20,
  'Container-Repair Vehicle': 3,
  'Drain Cleaner': 2,
}
export const HOURS_TARGET = 6 * 3600

type MileageRow = {
  code: string
  type: string
  driver: string
  usedFor: string
  supervisor: string
  mileage: number | null
  hours: string
  hoursSec: number
  target: number
  status: 'ok' | 'low' | 'nodata'
  lastUpdated: string
}

export function parseHours(h: string): number {
  if (!h) return 0
  const p = h.split(':').map(Number)
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 3600 + p[1] * 60
  return 0
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return String(s).replace('T', ' ').slice(0, 19)
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`
}

const COLUMNS = [
  { key: 'sr', label: 'SR', width: '4%' },
  { key: 'code', label: 'Vehicle Code', width: '10%' },
  { key: 'type', label: 'Veh Type', width: '12%' },
  { key: 'driver', label: 'Driver Name', width: '13%' },
  { key: 'usedFor', label: 'Used For', width: '13%' },
  { key: 'supervisor', label: 'Supervisor', width: '12%' },
  { key: 'mileage', label: 'Mileage', width: '8%' },
  { key: 'hours', label: 'Working Hours', width: '9%' },
  { key: 'status', label: 'Status', width: '8%' },
  { key: 'updated', label: 'Last Updated', width: '11%' },
]

function StatusBadge({ s }: { s: MileageRow['status'] }) {
  if (s === 'ok')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[9px] sm:text-[10px] font-extrabold text-white shadow-[0_0_12px_rgba(16,185,129,0.35)]">
        <span className="h-1.5 w-1.5 rounded-full bg-white" /> OK
      </span>
    )
  if (s === 'low')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/90 px-2.5 py-1 text-[9px] sm:text-[10px] font-extrabold text-white shadow-[0_0_12px_rgba(249,115,22,0.35)]">
        <span className="h-1.5 w-1.5 rounded-full bg-white" /> LOW
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[9px] sm:text-[10px] font-extrabold text-white/50">
      <span className="h-1.5 w-1.5 rounded-full bg-white/40" /> NO DATA
    </span>
  )
}

export default function MileageReport() {
  const [rows, setRows] = useState<MileageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [reportDate, setReportDate] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'low' | 'zero'>('all')
  const [ddOpen, setDdOpen] = useState(false)
  const [driversMissing, setDriversMissing] = useState(false)

  // ✅ 3 tables ka join — SILENT polling (har 15s background refresh)
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [dRes, distRes, trRes] = await Promise.all([
        supabase.from('vehicledriversdata').select('*'),
        supabase.from('vehicle_distance_reports').select('*'),
        supabase.from('vehicle_tracking_status').select('id, reporting_datetime, reporting_status'),
      ])

      if (dRes.error) console.error('❌ vehicledriversdata load error:', dRes.error)
      const driversRaw = (dRes.data || []) as any[]
      setDriversMissing(driversRaw.length === 0)
      // ✅ Flexible column mapping (agar headers quoted/space wale hon to bhi chal jaye)
      const drivers = driversRaw.map((d: any) => ({
        vehicle_code: String(d.vehicle_code ?? d['Vehicle Code'] ?? ''),
        vehicle_type: d.vehicle_type ?? d['Vehicle Type'] ?? null,
        driver_name: d.driver_name ?? d['Driver Name'] ?? null,
        used_for: d.used_for ?? d['Used For'] ?? null,
        supervisor: d.supervisor ?? d['Supervisor'] ?? null,
      }))

      const distances = (distRes.data || []) as any[]
      const tracking = (trRes.data || []) as any[]

      // Latest distance report per vehicle
      const latest = new Map<string, any>()
      for (const r of distances) {
        const key = String(r.vehicle_reg_number || '').toUpperCase()
        const cur = latest.get(key)
        if (!cur || String(r.report_date || '') > String(cur.report_date || '')) latest.set(key, r)
      }
      if (latest.size) {
        const dates = [...latest.values()].map(r => String(r.report_date || '')).sort()
        setReportDate(dates[dates.length - 1] || '')
      }
      const trMap = new Map<string, any>(tracking.map(t => [String(t.id || '').toUpperCase(), t]))

      const build = (code: string, vType: string | null, driver: string | null, usedFor: string | null, supervisor: string | null): MileageRow => {
        const dist = latest.get(code)
        const tr = trMap.get(code)
        const dispType = usedFor === 'Container-Repair Vehicle' || usedFor === 'Drain Cleaner'
          ? usedFor
          : (vType || dist?.veh_type || 'Other')
        const target = TARGETS[dispType] ?? 0
        const mileage = dist ? Number(dist.mileage ?? 0) : null
        const hours = dist?.ig_on_time || ''
        const hoursSec = parseHours(hours)
        let status: MileageRow['status'] = 'nodata'
        if (dist) {
          const mileageOk = target ? (mileage !== null && mileage >= target) : true
          status = mileageOk && hoursSec >= HOURS_TARGET ? 'ok' : 'low'
        }
        return {
          code,
          type: dispType,
          driver: driver || '—',
          usedFor: usedFor || '—',
          supervisor: supervisor || '—',
          mileage,
          hours: hours || '—',
          hoursSec,
          target,
          status,
          lastUpdated: fmtDateTime(tr?.reporting_datetime || dist?.fetched_at || null),
        }
      }

      let out: MileageRow[]
      if (drivers.length) {
        out = drivers.map(d =>
          build(String(d.vehicle_code || '').toUpperCase(), d.vehicle_type, d.driver_name, d.used_for, d.supervisor)
        )
      } else {
        out = [...latest.entries()].map(([code, r]) => build(code, r.veh_type, null, null, null))
      }
      out.sort((a, b) => a.code.localeCompare(b.code))
      setRows(out)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(false)
    const t = setInterval(() => load(true), 15_000)   // ✅ Silent refresh har 15s
    return () => clearInterval(t)
  }, [load])

  const counts = useMemo(() => ({
    ok: rows.filter(r => r.status === 'ok').length,
    low: rows.filter(r => r.status === 'low').length,
    nodata: rows.filter(r => r.status === 'nodata').length,
    zero: rows.filter(r => r.mileage !== null && r.mileage === 0).length,
  }), [rows])

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim()
    return rows.filter(r => {
      if (statusFilter === 'zero') {
        if (!(r.mileage !== null && r.mileage === 0)) return false
      } else if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (s) return [r.code, r.type, r.driver, r.usedFor, r.supervisor].some(x => x.toLowerCase().includes(s))
      return true
    })
  }, [rows, search, statusFilter])

  const STATUS_OPTIONS: { key: typeof statusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All Status', count: rows.length },
    { key: 'ok', label: 'OK', count: counts.ok },
    { key: 'low', label: 'LOW', count: counts.low },
    { key: 'zero', label: '0 Mileage', count: counts.zero },
  ]

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 sm:gap-4">
      {/* ✅ Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h2 className="running-text text-base sm:text-xl font-bold whitespace-nowrap">Mileage Report</h2>
          <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[9px] sm:text-xs font-bold whitespace-nowrap">
            Total: {rows.length}
          </span>
          {reportDate && (
            <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-sky-500/15 border border-sky-400/40 text-sky-300 text-[9px] sm:text-xs font-bold whitespace-nowrap">
              📅 {reportDate}
            </span>
          )}
          {driversMissing && (
            <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-red-500/15 border border-red-400/40 text-red-300 text-[9px] sm:text-xs font-bold whitespace-nowrap">
              ⚠ Drivers data missing (RLS check karein)
            </span>
          )}
          {(statusFilter !== 'all' || search.trim() !== '') && (
            <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[9px] sm:text-xs font-bold whitespace-nowrap">
              Showing: {filtered.length}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 ml-auto">
          {/* Summary pills */}
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[9px] sm:text-[10px] font-extrabold text-emerald-300">
            OK: {counts.ok}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-orange-400/40 bg-orange-500/10 px-2.5 py-1 text-[9px] sm:text-[10px] font-extrabold text-orange-300">
            LOW: {counts.low}
          </span>

          {/* Status filter dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDdOpen(v => !v)}
              className="flex items-center gap-2 h-9 sm:h-10 pl-3 sm:pl-4 pr-2.5 sm:pr-3 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 text-[11px] sm:text-xs font-bold hover:bg-emerald-500/20 transition whitespace-nowrap"
            >
              <span className="max-w-[120px] truncate">{STATUS_OPTIONS.find(o => o.key === statusFilter)?.label}</span>
              <svg className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 ${ddOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {ddOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDdOpen(false)} />
                <div className="absolute right-0 mt-2 w-full min-w-[160px] rounded-xl border border-white/15 bg-[#071b15] shadow-2xl overflow-hidden z-50">
                  {STATUS_OPTIONS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => { setStatusFilter(o.key); setDdOpen(false) }}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[11px] sm:text-xs font-bold transition-colors ${
                        statusFilter === o.key ? 'text-emerald-300 bg-emerald-500/10' : 'text-white/80 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{o.label}</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 text-[9px] font-extrabold">{o.count}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Search */}
          <div className="relative w-36 sm:w-52">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vehicle / driver..."
              className="w-full h-9 sm:h-10 pl-9 pr-9 rounded-full border border-emerald-400/25 bg-[#071b15]/80 backdrop-blur-md text-[11px] sm:text-xs font-medium text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
            </svg>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-red-300 transition"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ✅ Table */}
      <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-emerald-400/25 bg-[#04231c]/60 overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.35)]">
        <div className="flex-1 min-h-0 overflow-x-auto max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden">
          <div className="min-w-[1100px] lg:min-w-0 h-full flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 bg-[#0a4038] lg:pr-[10px]">
              <table className="w-full table-fixed">
                <colgroup>
                  {COLUMNS.map((c, i) => <col key={i} style={{ width: c.width }} />)}
                </colgroup>
                <thead>
                  <tr className="text-center text-[10px] sm:text-xs font-bold tracking-wider text-emerald-200/90 uppercase border-b border-emerald-400/20">
                    {COLUMNS.map(c => (
                      <th key={c.key} className={`px-2 sm:px-3 py-3 ${c.key === 'sr' ? 'text-left' : ''}`}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
              </table>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(16,185,129,0.45)_rgba(2,27,22,0.6)] [&::-webkit-scrollbar]:w-[10px] [&::-webkit-scrollbar-track]:bg-[rgba(2,27,22,0.6)] [&::-webkit-scrollbar-thumb]:bg-[rgba(16,185,129,0.45)] [&::-webkit-scrollbar-thumb]:rounded-full">
              <table className="w-full table-fixed">
                <colgroup>
                  {COLUMNS.map((c, i) => <col key={i} style={{ width: c.width }} />)}
                </colgroup>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-white/40 text-sm">Loading mileage report…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-white/40 text-sm">No matching records found</td></tr>
                  ) : (
                    filtered.map((r, i) => (
                      <tr key={r.code} className={`border-b border-white/5 last:border-0 hover:bg-white/5 transition text-center ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                        <td className="px-2 sm:px-3 py-3 text-left text-[11px] sm:text-sm text-white/40 font-mono">{i + 1}</td>
                        <td className="px-2 sm:px-3 py-3 text-[11px] sm:text-sm font-mono font-bold text-amber-300">{r.code}</td>
                        <td className="px-2 sm:px-3 py-3 text-[11px] sm:text-sm font-semibold text-white/90 truncate" title={r.type}>{r.type}</td>
                        <td className="px-2 sm:px-3 py-3 text-[11px] sm:text-sm text-white/80 truncate" title={r.driver}>{r.driver}</td>
                        <td className="px-2 sm:px-3 py-3 text-[11px] sm:text-sm text-white/70 truncate" title={r.usedFor}>{r.usedFor}</td>
                        <td className="px-2 sm:px-3 py-3 text-[11px] sm:text-sm text-white/70 truncate" title={r.supervisor}>{r.supervisor}</td>
                        <td className="px-2 sm:px-3 py-3 text-[11px] sm:text-sm font-bold text-white" title={`Target: ${r.target || '—'} km`}>
                          {r.mileage !== null ? r.mileage.toFixed(2) : '—'}
                        </td>
                        <td className={`px-2 sm:px-3 py-3 text-[11px] sm:text-sm font-mono font-bold ${r.hoursSec >= 6 * 3600 ? 'text-emerald-300' : 'text-orange-300'}`}>
                          {r.hours}
                        </td>
                        <td className="px-2 sm:px-3 py-3"><StatusBadge s={r.status} /></td>
                        <td className="px-2 sm:px-3 py-3 text-[10px] sm:text-[11px] font-mono text-white/60">{r.lastUpdated}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}