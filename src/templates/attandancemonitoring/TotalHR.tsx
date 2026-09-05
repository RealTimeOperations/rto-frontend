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

export default function TotalHR({ rows, loading }: Props) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    let list = [...rows].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))
    const q = norm(search)
    if (q) {
      list = list.filter(r => matchRow(r, q))
    }
    return list
  }, [rows, search])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const cur = Math.min(page, pages)
  const slice = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Heading + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-extrabold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
          Total HR
        </h1>
        <span className="w-fit text-[11px] font-bold text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-3 py-1">
          Total: {filtered.length}
        </span>

        <div className="sm:ml-auto relative">
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

      {/* Table */}
      <SplitTable
        minW={1330}
        widths={[4, 13, 12, 11, 14, 14, 14, 10, 8]}
        headers={['Sr#', 'Name', 'Father/Husband', 'CNIC', 'Designation', 'UC/Ward', 'Attendance Point', 'Type', 'Sanitation Beat']}
      >
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-white/50">Loading HR data…</td></tr>
            ) : slice.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-white/50">Koi record nahi mila</td></tr>
            ) : (
              slice.map((r, i) => (
                <tr key={r.id ?? i} className="border-t border-white/5 transition-colors hover:bg-white/5">
                  <td className="px-4 py-3 text-white/50 font-mono">{(cur - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-white/90">{r.name}</td>
                  <td className="px-4 py-3 text-white/70">{r.father_name}</td>
                  <td className="px-4 py-3 font-mono text-emerald-200 whitespace-nowrap">{r.cnic}</td>
                  <td className="px-4 py-3 text-white/70">{cleanDesig(r.designation)}</td>
                  <td className="px-4 py-3 text-white/70">{r.uc_ward}</td>
                  <td className="px-4 py-3 text-white/70">{r.attendance_point}</td>
                  <td className="px-4 py-3 text-white/70">{r.work_type}</td>
                  <td className="px-4 py-3 text-white/70">{r.sanitation_beat}</td>
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