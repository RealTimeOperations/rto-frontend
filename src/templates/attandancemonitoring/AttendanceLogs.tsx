import { useMemo, useState } from 'react'
import SplitTable from './SplitTable'

type Row = Record<string, any>

type Props = {
  rows: Row[]
  loading: boolean
}

const PAGE_SIZE = 50

const norm = (s: any) => String(s ?? '').replace(/-/g, '').trim().toLowerCase()

const cleanDesig = (s: any) => String(s ?? '').replace(/\([^)]*\)/g, '').trim()

/* ✅ Multi-field search: CNIC, Name, UC/Ward, Designation, Attendance Point, Work Type */
const matchRow = (r: Row, q: string) =>
  [r.cnic, r.user_name ?? r.name, r.uc_ward, r.designation, r.attendance_point ?? r.point, r.work_type ?? r.workType].some(f => {
    const s = String(f ?? '').toLowerCase()
    return s.includes(q) || s.replace(/-/g, '').includes(q)
  })

export default function AttendanceLogs({ rows, loading }: Props) {
  const [filter, setFilter] = useState<'all' | 'checkin' | 'checkout'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    let list = rows
    if (filter !== 'all') {
      list = list.filter(r => String(r.check_type ?? '').toLowerCase() === filter)
    }
    const q = norm(search)
    if (q) {
          list = list.filter(r => matchRow(r, q))
    }
    return [...list].sort((a, b) => String(b.date_time ?? '').localeCompare(String(a.date_time ?? '')))
  }, [rows, filter, search])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const cur = Math.min(page, pages)
  const slice = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Heading + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-extrabold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
          Attendance Logs
        </h1>
        <span className="w-fit text-[11px] font-bold text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-3 py-1">
          Total: {filtered.length}
        </span>

        <div className="sm:ml-auto flex flex-col sm:flex-row gap-2 sm:gap-3">
          {/* Filter */}
          <select
            value={filter}
            onChange={e => { setFilter(e.target.value as any); setPage(1) }}
            className="rounded-full border border-white/15 bg-[#071b15] px-4 py-2 text-xs sm:text-sm font-semibold text-white/80 outline-none focus:border-emerald-400/60"
          >
            <option value="all">All Attendance</option>
            <option value="checkin">Check-In</option>
            <option value="checkout">Check-Out</option>
          </select>

          {/* CNIC search */}
          <div className="relative">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search CNIC, Name, UC/Ward…"
            className="w-full sm:w-64 rounded-full border border-white/15 bg-[#071b15] pl-9 pr-8 py-2 text-xs sm:text-sm text-white/80 placeholder-white/35 outline-none focus:border-emerald-400/60"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <button
            onClick={() => { setSearch(''); setPage(1) }}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-red-300"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <SplitTable
        minW={1180}
        widths={[4, 8, 13, 11, 14, 14, 14, 9, 13]}
        headers={['Sr#', 'Date', 'Users', 'CNIC', 'Designation', 'UC/Ward', 'Attendance Point', 'Type', 'Date&Time']}
      >
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-white/50">Loading attendance…</td></tr>
            ) : slice.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-white/50">Koi record nahi mila</td></tr>
            ) : (
              slice.map((r, i) => (
                <tr key={r.id ?? i} className="border-t border-white/5 transition-colors hover:bg-white/5">
                  <td className="px-4 py-3 text-white/50 font-mono">{(cur - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-white/80">{r.date}</td>
                  <td className="px-4 py-3 font-semibold text-white/90">{r.user_name}</td>
                  <td className="px-4 py-3 font-mono text-emerald-200 whitespace-nowrap">{r.cnic}</td>
                  <td className="px-4 py-3 text-white/70">{cleanDesig(r.designation)}</td>
                  <td className="px-4 py-3 text-white/70">{r.uc_ward}</td>
                  <td className="px-4 py-3 text-white/70">{r.attendance_point}</td>
                  <td className="px-4 py-3">
                    {String(r.check_type ?? '').toLowerCase() === 'checkin' ? (
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 px-2.5 py-1 text-[10px] font-bold whitespace-nowrap">CHECK-IN</span>
                    ) : (
                      <span className="rounded-full bg-sky-500/15 border border-sky-400/40 text-sky-300 px-2.5 py-1 text-[10px] font-bold whitespace-nowrap">CHECK-OUT</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-white/70">{r.date_time}</td>
                </tr>
              ))
            )}
      </SplitTable>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-xs sm:text-sm text-white/60">
        <span>Page {cur} / {pages}</span>
        <div className="flex gap-2">
          <button
            disabled={cur <= 1}
            onClick={() => setPage(cur - 1)}
            className="rounded-full border border-white/15 px-4 py-1.5 font-semibold transition-all hover:border-emerald-400/50 hover:text-emerald-200 disabled:opacity-30 disabled:pointer-events-none"
          >
            ← Prev
          </button>
          <button
            disabled={cur >= pages}
            onClick={() => setPage(cur + 1)}
            className="rounded-full border border-white/15 px-4 py-1.5 font-semibold transition-all hover:border-emerald-400/50 hover:text-emerald-200 disabled:opacity-30 disabled:pointer-events-none"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}