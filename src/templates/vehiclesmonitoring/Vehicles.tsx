import { useMemo, useRef, useState } from 'react'
import { API_BASE } from '../../lib/apiBase'

export type Vehicle = {
  id: string
  type: string
  registration: string
  usedFor: string
  ucCircle: string
  status: 'assigned' | 'unassigned' | 'inactive'
}

type FilterKey = 'assigned' | 'unassigned' | 'inactive'

type Props = {
  vehicles: Vehicle[]
  onRefresh?: () => Promise<void> | void
}

export default function Vehicles({ vehicles, onRefresh }: Props) {
  // ✅ Default filter: Assigned Vehicles
  const [filter, setFilter] = useState<FilterKey>('assigned')
  const [search, setSearch] = useState('')
  const [ddOpen, setDdOpen] = useState(false)
  
  // ✅ New filters state
  const [filterType, setFilterType] = useState('All')
  const [filterUsedFor, setFilterUsedFor] = useState('All')
  const [typeOpen, setTypeOpen] = useState(false)
  const [usedForOpen, setUsedForOpen] = useState(false)

  // ✅ Update Vehicles (portal → DB) states
  const [updating, setUpdating] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const msgTimer = useRef<number | null>(null)

  function flash(type: 'success' | 'error', text: string) {
    setMsg({ type, text })
    if (msgTimer.current) window.clearTimeout(msgTimer.current)
    msgTimer.current = window.setTimeout(() => setMsg(null), 5000)
  }

  // ✅ Portal se fetch + Supabase mein save (backend /vehicles/sync)
  async function handleUpdateVehicles() {
    if (updating) return
    setUpdating(true)
    setMsg(null)
    try {
      const res = await fetch(`${API_BASE}/vehicles/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.message || `Server error: ${res.status}`)
      flash('success', json.message || `Updated: ${json.total} vehicles`)
      await onRefresh?.()
    } catch (e: any) {
      flash('error', e?.message || 'Update failed — backend check karein')
    } finally {
      setUpdating(false)
    }
  }

  // ✅ Counts for each filter
  const counts = useMemo(() => ({
    assigned: vehicles.filter(v => v.status === 'assigned').length,
    unassigned: vehicles.filter(v => v.status === 'unassigned').length,
    inactive: vehicles.filter(v => v.status === 'inactive').length,
  }), [vehicles])

  // ✅ Dropdown options — heading bhi isi list se banti hai
  const FILTER_OPTIONS: { key: FilterKey; label: string; count: number }[] = [
    { key: 'assigned', label: 'Assigned Vehicles', count: counts.assigned },
    { key: 'unassigned', label: 'Un-Assigned Vehicles', count: counts.unassigned },
    { key: 'inactive', label: 'In-Active Vehicles', count: counts.inactive },
  ]
  const activeOption = FILTER_OPTIONS.find(o => o.key === filter) ?? FILTER_OPTIONS[0]

  // ✅ Extract unique options for Type and Used For
  const typeOptions = useMemo(() => {
    const set = new Set<string>()
    vehicles.forEach(v => { if (v.type) set.add(v.type) })
    return ['All', ...Array.from(set).sort()]
  }, [vehicles])

  const usedForOptions = useMemo(() => {
    const set = new Set<string>()
    vehicles.forEach(v => { if (v.usedFor && v.usedFor !== '—') set.add(v.usedFor) })
    return ['All', ...Array.from(set).sort()]
  }, [vehicles])

  // ✅ Filtered + searched data
  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim()
    return vehicles.filter(v => {
      if (v.status !== filter) return false
      if (filterType !== 'All' && v.type !== filterType) return false
      if (filterUsedFor !== 'All' && v.usedFor !== filterUsedFor) return false
      if (s) {
        return (
          v.registration.toLowerCase().includes(s) ||
          v.type.toLowerCase().includes(s) ||
          v.usedFor.toLowerCase().includes(s) ||
          v.ucCircle.toLowerCase().includes(s)
        )
      }
      return true
    })
  }, [vehicles, filter, filterType, filterUsedFor, search])

  // ✅ Column configs per filter
  const COLUMNS: Record<FilterKey, { key: string; label: string; width: string }[]> = {
    assigned: [
      { key: 'sr', label: 'Sr#', width: '6%' },
      { key: 'type', label: 'Type of Vehicle', width: '20%' },
      { key: 'registration', label: 'Registration Number', width: '22%' },
      { key: 'usedFor', label: 'Used For', width: '25%' },
      { key: 'ucCircle', label: 'UC / Circle', width: '27%' },
    ],
    unassigned: [
      { key: 'sr', label: 'Sr#', width: '6%' },
      { key: 'type', label: 'Type of Vehicle', width: '20%' },
      { key: 'registration', label: 'Registration Number', width: '22%' },
      { key: 'usedFor', label: 'Used For', width: '25%' },
      { key: 'status', label: 'Status', width: '27%' },
    ],
    inactive: [
      { key: 'sr', label: 'Sr#', width: '6%' },
      { key: 'type', label: 'Type of Vehicle', width: '20%' },
      { key: 'registration', label: 'Registration Number', width: '22%' },
      { key: 'usedFor', label: 'Used For', width: '25%' },
      { key: 'status', label: 'Status', width: '27%' },
    ],
  }

  const activeCols = COLUMNS[filter]

  // ✅ Status badge
  function statusBadge(status: string) {
    if (status === 'assigned') return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
    if (status === 'unassigned') return 'bg-sky-500/15 text-sky-300 border-sky-400/40'
    if (status === 'inactive') return 'bg-red-500/15 text-red-300 border-red-400/40'
    return 'bg-white/5 text-white/60 border-white/15'
  }

  function statusLabel(status: string) {
    if (status === 'assigned') return 'Assigned'
    if (status === 'unassigned') return 'Un-Assigned'
    if (status === 'inactive') return 'In-Active'
    return status
  }

  // ✅ Cell renderer
  function renderCell(col: string, v: Vehicle, idx: number) {
    switch (col) {
      case 'sr':
        return <span className="text-white/40 font-mono">{idx + 1}</span>
      case 'type':
        return (
          <span className="font-semibold text-white/90 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[10px]">
              {v.type === 'Compactor' ? '🚛' : v.type === 'Arm Roll' ? '🚚' : v.type === 'Shahzor' ? '🚐' : '🚗'}
            </span>
            {v.type}
          </span>
        )
      case 'registration':
        return <span className="font-mono font-bold text-amber-300">{v.registration}</span>
      case 'usedFor':
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            v.usedFor.includes('0.8') ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40' :
            v.usedFor.includes('5') ? 'bg-purple-500/15 text-purple-300 border-purple-400/40' :
            'bg-white/5 text-white/60 border-white/15'
          }`}>
            {v.usedFor}
          </span>
        )
      case 'ucCircle':
        return <span className="text-white/70">{v.ucCircle || '—'}</span>
      case 'status':
        return (
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusBadge(v.status)}`}>
            {statusLabel(v.status)}
          </span>
        )
      default:
        return '—'
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 sm:gap-4">
      {/* ✅ SINGLE toolbar: heading TOP-LEFT | 4 controls TOP-RIGHT (sequence: Status → Type → Used For → Search) */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 flex-shrink-0">
        {/* Left: heading = current filter ka naam */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h2 className="running-text text-base sm:text-xl font-bold whitespace-nowrap">{activeOption.label}</h2>
          <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[9px] sm:text-xs font-bold whitespace-nowrap">
            Showing: {filtered.length}
          </span>
        </div>

        {/* Right: Update button + 4 controls exact sequence mein */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 ml-auto">
          {/* ✅ Slide-in toast (Update result) */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              msg ? 'max-w-[300px] opacity-100 translate-x-0' : 'max-w-0 opacity-0 -translate-x-6'
            }`}
          >
            {msg && (
              <div className={`mr-1 flex items-center whitespace-nowrap rounded-lg border px-2.5 py-2 text-[10px] sm:text-[11px] font-bold ${
                msg.type === 'success' ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300' : 'bg-red-500/15 border-red-400/40 text-red-300'
              }`}>
                {msg.type === 'success' ? '✓ ' : '⚠ '}{msg.text}
              </div>
            )}
          </div>

          {/* ✅ Update Vehicles button — portal se fetch + DB save */}
          <button
            type="button"
            onClick={handleUpdateVehicles}
            disabled={updating}
            className="flex items-center gap-2 h-9 sm:h-10 px-4 rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 text-[11px] sm:text-xs font-bold hover:bg-emerald-500/25 hover:text-white transition whitespace-nowrap disabled:opacity-50"
          >
            <svg className={`h-4 w-4 ${updating ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
            {updating ? 'Updating…' : 'Update Vehicles'}
          </button>

          {/* 1️⃣ Status filter (Assigned / Un-Assigned / In-Active) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setDdOpen(v => !v); setTypeOpen(false); setUsedForOpen(false) }}
              className="flex items-center gap-2 h-9 sm:h-10 pl-3 sm:pl-4 pr-2.5 sm:pr-3 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 text-[11px] sm:text-xs font-bold hover:bg-emerald-500/20 transition whitespace-nowrap"
            >
              <span className="max-w-[130px] sm:max-w-[180px] truncate">{activeOption.label}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-200 text-[9px] sm:text-[10px] font-extrabold">
                {activeOption.count}
              </span>
              <svg className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 ${ddOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {ddOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDdOpen(false)} />
                <div className="absolute right-0 mt-2 w-full min-w-[200px] rounded-xl border border-white/15 bg-[#071b15] shadow-2xl overflow-hidden z-50">
                  {FILTER_OPTIONS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => { setFilter(o.key); setDdOpen(false) }}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[11px] sm:text-xs font-bold transition-colors ${
                        filter === o.key ? 'text-emerald-300 bg-emerald-500/10' : 'text-white/80 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{o.label}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold ${
                        filter === o.key ? 'bg-emerald-500/25 text-emerald-200' : 'bg-white/10 text-white/60'
                      }`}>
                        {o.count}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 2️⃣ Type of Vehicle filter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setTypeOpen(v => !v); setDdOpen(false); setUsedForOpen(false) }}
              className="flex items-center gap-2 h-9 sm:h-10 pl-3 sm:pl-4 pr-2.5 sm:pr-3 rounded-full border border-emerald-400/25 bg-[#071b15]/80 backdrop-blur-md text-[11px] sm:text-xs font-bold text-white/80 hover:border-emerald-400/40 transition whitespace-nowrap"
            >
              <span className="max-w-[120px] sm:max-w-[150px] truncate">{filterType === 'All' ? 'Type of Vehicle' : filterType}</span>
              <svg className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 ${typeOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {typeOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setTypeOpen(false)} />
                <div className="absolute right-0 mt-2 w-full min-w-[180px] rounded-xl border border-white/15 bg-[#071b15] shadow-2xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                  {typeOptions.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { setFilterType(opt); setTypeOpen(false) }}
                      className={`w-full text-left px-4 py-2.5 text-[11px] sm:text-xs font-bold transition-colors ${
                        filterType === opt ? 'text-emerald-300 bg-emerald-500/10' : 'text-white/80 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {opt === 'All' ? 'All Types' : opt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 3️⃣ Used For filter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setUsedForOpen(v => !v); setDdOpen(false); setTypeOpen(false) }}
              className="flex items-center gap-2 h-9 sm:h-10 pl-3 sm:pl-4 pr-2.5 sm:pr-3 rounded-full border border-emerald-400/25 bg-[#071b15]/80 backdrop-blur-md text-[11px] sm:text-xs font-bold text-white/80 hover:border-emerald-400/40 transition whitespace-nowrap"
            >
              <span className="max-w-[120px] sm:max-w-[150px] truncate">{filterUsedFor === 'All' ? 'Used For' : filterUsedFor}</span>
              <svg className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 ${usedForOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {usedForOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUsedForOpen(false)} />
                <div className="absolute right-0 mt-2 w-full min-w-[180px] rounded-xl border border-white/15 bg-[#071b15] shadow-2xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                  {usedForOptions.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { setFilterUsedFor(opt); setUsedForOpen(false) }}
                      className={`w-full text-left px-4 py-2.5 text-[11px] sm:text-xs font-bold transition-colors ${
                        filterUsedFor === opt ? 'text-emerald-300 bg-emerald-500/10' : 'text-white/80 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {opt === 'All' ? 'All Categories' : opt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 4️⃣ Search bar */}
          <div className="relative w-36 sm:w-52">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vehicle..."
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

      {/* ✅ Table — page scroll NAHI; sirf table body scroll hoti hai */}
      <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-emerald-400/25 bg-[#04231c]/60 overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.35)]">
        {/* Horizontal scroll wrapper */}
        <div className="flex-1 min-h-0 overflow-x-auto max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden">
          <div className="min-w-[800px] lg:min-w-0 h-full flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 bg-[#0a4038] lg:pr-[10px]">
              <table className="w-full table-fixed">
                <colgroup>
                  {activeCols.map((c, i) => <col key={i} style={{ width: c.width }} />)}
                </colgroup>
                <thead>
                  <tr className="text-center text-[10px] sm:text-xs font-bold tracking-wider text-emerald-200/90 uppercase border-b border-emerald-400/20">
                    {activeCols.map(c => (
                      <th key={c.key} className={`px-2 sm:px-3 py-3 ${c.key === 'sr' ? 'text-left' : c.key === 'status' ? 'text-center' : ''}`}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
              </table>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(16,185,129,0.45)_rgba(2,27,22,0.6)] [&::-webkit-scrollbar]:w-[10px] [&::-webkit-scrollbar-track]:bg-[rgba(2,27,22,0.6)] [&::-webkit-scrollbar-thumb]:bg-[rgba(16,185,129,0.45)] [&::-webkit-scrollbar-thumb]:rounded-full">
              <table className="w-full table-fixed">
                <colgroup>
                  {activeCols.map((c, i) => <col key={i} style={{ width: c.width }} />)}
                </colgroup>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={activeCols.length} className="px-4 py-12 text-center text-white/40 text-sm">
                        {search || filterType !== 'All' || filterUsedFor !== 'All' ? 'No matching vehicles found' : `No ${filter} vehicles`}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((v, i) => (
                      <tr key={v.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition text-center">
                        {activeCols.map(c => (
                          <td key={c.key} className={`px-2 sm:px-3 py-3 text-[11px] sm:text-sm ${
                            c.key === 'sr' ? 'text-left text-white/40' :
                            c.key === 'status' ? 'text-center' : ''
                          }`}>
                            {renderCell(c.key, v, i)}
                          </td>
                        ))}
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