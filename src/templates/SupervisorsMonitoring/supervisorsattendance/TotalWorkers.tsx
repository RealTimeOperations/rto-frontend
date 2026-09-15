import { useState } from 'react'
import SplitTable from '../../attandancemonitoring/SplitTable'

type SupervisorWorker = {
  id: string
  name: string
  cnic: string
  designation: string
  uc_ward: string
  attendance_point: string
  work_type?: string
}

type Props = {
  workers: SupervisorWorker[]
  supervisorId: string
}

// ✅ Strip parenthesized tags like "(Fixed)" from designation text
const cleanDesig = (s: any) => String(s ?? '').replace(/\([^)]*\)/g, '').trim()

export default function TotalWorkers({ workers, supervisorId }: Props) {
  const [search, setSearch] = useState('')
  const [pointFilter, setPointFilter] = useState('')

  // Unique Attendance Point list
  const pointList = Array.from(new Set(workers.map(w => w.attendance_point).filter(Boolean))).sort()

  const filtered = workers.filter(w => {
    const s = search.toLowerCase()
    const matchSearch =
      String(w.name ?? '').toLowerCase().includes(s) ||
      String(w.cnic ?? '').includes(s) ||
      String(cleanDesig(w.designation)).toLowerCase().includes(s) ||
      String(w.attendance_point ?? '').toLowerCase().includes(s)

    const matchPoint = !pointFilter || w.attendance_point === pointFilter

    return matchSearch && matchPoint
  })

  return (
    <div className="xl:max-w-[1250px] xl:mx-auto">
      {/* ✅ Header: heading + total (top-left), point filter + search (top-right) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-nowrap">
          <h2 className="running-text text-base sm:text-xl font-bold whitespace-nowrap">Total Workers</h2>
          <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[9px] sm:text-xs font-bold whitespace-nowrap">
            Total: {filtered.length}
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={pointFilter}
            onChange={e => setPointFilter(e.target.value)}
            className="flex-1 sm:flex-none min-w-0 sm:w-44 h-9 sm:h-10 px-3 sm:px-4 bg-white/5 border border-white/15 rounded-full text-white text-xs outline-none focus:border-emerald-500"
          >
            <option value="">All Attendance Points</option>
            {pointList.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <div className="relative flex-1 sm:flex-none min-w-0 sm:w-64">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name / CNIC / designation…"
              className="h-9 sm:h-10 px-3 sm:px-4 pr-8 w-full bg-white/5 border border-white/15 rounded-full text-white text-xs outline-none focus:border-emerald-500 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-red-300"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ✅ SplitTable — same design as Attendance Monitoring; scroll table ke ANDAR */}   
      <SplitTable
        center={[0]}
        widths={[5, 18, 16, 15, 23, 23]}
        headers={['Sr#', 'Name', 'CNIC', 'Designation', 'UC/Ward', 'Attendance Point']}
      >
        {filtered.length === 0 ? (
          <tr><td colSpan={6} className="px-4 py-10 text-center text-white/50">No workers found</td></tr>
        ) : (
          filtered.map((w, i) => (
            <tr key={w.id} className="border-t border-white/5 transition-colors hover:bg-white/5">
              <td className="px-2 sm:px-3 py-2 sm:py-3 text-center text-white/50 font-mono text-[10px] sm:text-xs whitespace-nowrap">{i + 1}</td>
              <td className="px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-white/90 whitespace-nowrap">{w.name}</td>
              <td className="px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-mono text-emerald-200 whitespace-nowrap">{w.cnic}</td>
              <td className="px-2 sm:px-4 py-2 sm:py-3">
                <span className="rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[8px] sm:text-[10px] font-semibold border whitespace-nowrap bg-sky-500/15 border-sky-400/40 text-sky-300">
                  {cleanDesig(w.designation)}
                </span>
              </td>
              <td className="px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs text-white/70 whitespace-nowrap">{w.uc_ward}</td>
              <td className="px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs text-white/70 whitespace-nowrap">{w.attendance_point}</td>
            </tr>
          ))
        )}
      </SplitTable>
    </div>
  )
}