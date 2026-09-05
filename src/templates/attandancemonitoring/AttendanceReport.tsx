import { useMemo, useState } from 'react'
import SplitTable from './SplitTable'

type Row = Record<string, any>

type Props = {
  rows: Row[]        // attendance_logs
  employees: Row[]   // assigned_employees (Total HR)
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

function dutyDuration(checkin?: string, checkout?: string): string {
  if (!checkin || !checkout) return '—'
  const a = new Date(String(checkin).replace(' ', 'T'))
  const b = new Date(String(checkout).replace(' ', 'T'))
  const mins = Math.round((b.getTime() - a.getTime()) / 60000)
  if (isNaN(mins) || mins < 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function empType(code?: string): string {
  return String(code ?? '').toUpperCase().includes('MC') ? 'MC' : 'Contractor'
}

export default function AttendanceReport({ rows, employees, loading }: Props) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const attMap = useMemo(() => {
    const map: Record<string, { checkin?: string; checkout?: string }> = {}
    for (const r of rows) {
      const key = norm(r.cnic)
      if (!key) continue
      const t = String(r.date_time ?? '')
      if (!map[key]) map[key] = {}
      const type = String(r.check_type ?? '').toLowerCase()
      if (type === 'checkin') {
        if (!map[key].checkin || t < map[key].checkin!) map[key].checkin = t
      } else if (type === 'checkout') {
        if (!map[key].checkout || t > map[key].checkout!) map[key].checkout = t
      }
    }
    return map
  }, [rows])

  const report = useMemo(() => {
    const list = employees.map(e => {
      const att = attMap[norm(e.cnic)] || {}
      return {
        sr: 0,
        checkin: att.checkin ? 'P' : 'A',
        checkout: att.checkout ? 'P' : '--',
        name: String(e.name ?? ''),
        father: String(e.father_name ?? ''),
        cnic: String(e.cnic ?? ''),
        designation: String(e.designation ?? ''),
        uc_ward: String(e.uc_ward ?? ''),
        point: String(e.attendance_point ?? ''),
        workType: String(e.work_type ?? ''),
        checkinTime: att.checkin ?? '—',
        checkoutTime: att.checkout ?? '—',
        duty: dutyDuration(att.checkin, att.checkout),
        empType: empType(e.employee_code),
      }
    })
    list.sort((a, b) => a.name.localeCompare(b.name))
    list.forEach((r, i) => (r.sr = i + 1))
    return list
  }, [employees, attMap])

  const filtered = useMemo(() => {
    const q = norm(search)
    if (!q) return report
    return report.filter(r => matchRow(r, q))
  }, [report, search])

  const present = report.filter(r => r.checkin === 'P').length
  const absent = report.length - present
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const cur = Math.min(page, pages)
  const slice = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Heading + stats + search */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-extrabold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
          Attendance Report
        </h1>
        <span className="w-fit text-[11px] font-bold text-white/60 bg-white/5 border border-white/15 rounded-full px-3 py-1">{today}</span>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-3 py-1">Total HR: {report.length}</span>
          <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-400/40 rounded-full px-3 py-1">Present: {present}</span>
          <span className="text-[11px] font-bold text-red-300 bg-red-500/15 border border-red-400/40 rounded-full px-3 py-1">Absent: {absent}</span>
        </div>

        <div className="lg:ml-auto relative">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search CNIC, Name, UC/Ward…"
            className="w-full lg:w-64 rounded-full border border-white/15 bg-[#071b15] pl-9 pr-8 py-2 text-xs sm:text-sm text-white/80 placeholder-white/35 outline-none focus:border-emerald-400/60"
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

      {/* ✅ SplitTable: header bahir (poora), scroll sirf rows par */}
      <SplitTable
        small
        center={[1, 2]}
        widths={[4, 5, 6, 10, 9, 8, 9, 7, 9, 6, 7, 7, 6, 7]}
        headers={['Sr#', 'Check-In', 'Check-Out', 'Name', 'Father/Husband', 'CNIC', 'Designation', 'UC/Ward', 'Attendance Point', 'Work Type', 'CheckinTime', 'CheckoutTime', 'DutyStatus', 'Employee Type']}
      >
        {loading ? (
          <tr><td colSpan={14} className="px-2 py-10 text-center text-white/50">Loading report…</td></tr>
        ) : slice.length === 0 ? (
          <tr><td colSpan={14} className="px-2 py-10 text-center text-white/50">Koi record nahi mila</td></tr>
        ) : (
          slice.map(r => (
            <tr key={r.cnic || r.sr} className="border-t border-white/5 transition-colors hover:bg-white/5">
              <td className="pl-4 pr-2 py-3 text-white/50 font-mono">{r.sr}</td>
              <td className="px-2 py-3 text-center">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold border ${r.checkin === 'P' ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300' : 'bg-red-500/15 border-red-400/40 text-red-300'}`}>{r.checkin}</span>
              </td>
              <td className="px-2 py-3 text-center">
                {r.checkout === 'P' ? (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold border bg-emerald-500/20 border-emerald-400/50 text-emerald-300">P</span>
                ) : (
                  <span className="text-white/35 font-bold">--</span>
                )}
              </td>
              <td className="px-2 py-3 font-semibold text-white/90">{r.name}</td>
              <td className="px-2 py-3 text-white/70">{r.father}</td>
              <td className="px-2 py-3 font-mono text-emerald-200">{r.cnic}</td>
              <td className="px-2 py-3 text-white/70">{cleanDesig(r.designation)}</td>
              <td className="px-2 py-3 text-white/70">{r.uc_ward}</td>
              <td className="px-2 py-3 text-white/70">{r.point}</td>
              <td className="px-2 py-3 text-white/70">{r.workType}</td>
              <td className="px-2 py-3 text-white/70">{r.checkinTime}</td>
              <td className="px-2 py-3 text-white/70">{r.checkoutTime}</td>
              <td className="px-2 py-3 font-bold text-emerald-300">{r.duty}</td>
              <td className="px-2 py-3">
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold border ${r.empType === 'MC' ? 'bg-sky-500/15 border-sky-400/40 text-sky-300' : 'bg-amber-500/15 border-amber-400/40 text-amber-300'}`}>{r.empType}</span>
              </td>
            </tr>
          ))
        )}
      </SplitTable>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-xs sm:text-sm text-white/60">
        <span>Page {cur} / {pages}</span>
        <div className="flex gap-2">
          <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="rounded-full border border-white/15 px-4 py-1.5 font-semibold transition-all hover:border-emerald-400/50 hover:text-emerald-200 disabled:opacity-30 disabled:pointer-events-none">← Prev</button>
          <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="rounded-full border border-white/15 px-4 py-1.5 font-semibold transition-all hover:border-emerald-400/50 hover:text-emerald-200 disabled:opacity-30 disabled:pointer-events-none">Next →</button>
        </div>
      </div>
    </div>
  )
}