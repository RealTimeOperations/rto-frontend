import { useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import SplitTable from '../../attandancemonitoring/SplitTable'

export type WorkerBrief = {
  id: string
  name: string
  cnic: string
  designation: string
  uc_ward: string
  attendance_point: string
  work_type?: string
  father_name?: string
  employee_code?: string
}

export type AttendanceLog = Record<string, any>

const norm = (v: any) => String(v ?? '').replace(/-/g, '').trim().toLowerCase()

// ✅ Strip parenthesized tags like "(Fixed)" from designation text
const cleanDesig = (s: any) => String(s ?? '').replace(/\([^)]*\)/g, '').trim()

// ✅ Duty duration = checkout - checkin
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

// ✅ Employee type from employee code
function empType(code?: string): string {
  return String(code ?? '').toUpperCase().includes('MC') ? 'MC' : 'Contractor'
}

/* ✅ All attendance logs (check-in / check-out) for given CNICs — portal se fetched data */
export async function fetchWorkerAttendance(cnics: string[]): Promise<AttendanceLog[]> {
  if (cnics.length === 0) return []
  const keys = new Set(cnics.map(c => norm(c)))

  // ✅ Paginated fetch — Supabase ek request mein max 1000 rows deta hai
  let all: AttendanceLog[] = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('Attendance fetch error:', error)
      return []
    }
    const rows = (data as AttendanceLog[]) ?? []
    all = all.concat(rows)
    if (rows.length < PAGE) break
    from += PAGE
  }

  // ✅ Client-side match by normalized CNIC — dash/space format differences ignore hoti hain
  const matched = all.filter(l => keys.has(norm(l.cnic)))
  matched.sort((a, b) => String(b.date_time ?? '').localeCompare(String(a.date_time ?? '')))
  console.log('[supervisor-attendance] workers:', cnics.length, '| total logs:', all.length, '| matched:', matched.length)
  return matched
}

/* =========================================================
   ATTENDANCE VIEW — report-style table (per-worker status)
========================================================= */
export function AttendanceView({ logs, workers, loading }: { logs: AttendanceLog[]; workers: WorkerBrief[]; loading: boolean }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'present' | 'absent' | 'on-duty'>('all')
  const [pointFilter, setPointFilter] = useState('')

  // ✅ Unique Attendance Point list
  const pointList = useMemo(
    () => Array.from(new Set(workers.map(w => w.attendance_point).filter(Boolean))).sort(),
    [workers]
  )

  // ✅ Check-in / check-out map — earliest checkin, latest checkout per CNIC
  const attMap = useMemo(() => {
    const map: Record<string, { checkin?: string; checkout?: string }> = {}
    for (const l of logs) {
      const key = norm(l.cnic)
      if (!key) continue
      const t = String(l.date_time ?? '')
      if (!map[key]) map[key] = {}
      const type = String(l.check_type ?? '').toLowerCase()
      if (type === 'checkin') {
        if (!map[key].checkin || t < map[key].checkin!) map[key].checkin = t
      } else if (type === 'checkout') {
        if (!map[key].checkout || t > map[key].checkout!) map[key].checkout = t
      }
    }
    return map
  }, [logs])

  // ✅ Build report rows (same logic as employee report)
  const report = useMemo(() => {
    const list = workers.map(w => {
      const att = attMap[norm(w.cnic)] || {}
      return {
        sr: 0,
        checkin: att.checkin ? 'P' : 'A',
        checkout: att.checkout ? 'P' : '--',
        name: String(w.name ?? ''),
        father: String(w.father_name ?? ''),
        cnic: String(w.cnic ?? ''),
        designation: String(w.designation ?? ''),
        uc_ward: String(w.uc_ward ?? ''),
        point: String(w.attendance_point ?? ''),
        workType: String(w.work_type ?? ''),
        checkinTime: att.checkin ?? '—',
        checkoutTime: att.checkout ?? '—',
        duty: dutyDuration(att.checkin, att.checkout),
        empType: empType(w.employee_code),
      }
    })
    list.sort((a, b) => a.name.localeCompare(b.name))
    list.forEach((r, i) => (r.sr = i + 1))
    return list
  }, [workers, attMap])

  const filtered = useMemo(() => {
    let list = [...report]

    // 1. Attendance Point filter
    if (pointFilter) list = list.filter(r => r.point === pointFilter)

    // 2. Status filter
    if (filter === 'present') list = list.filter(r => r.checkin === 'P' && r.checkout === 'P')
    else if (filter === 'absent') list = list.filter(r => r.checkin === 'A')
    else if (filter === 'on-duty') list = list.filter(r => r.checkin === 'P' && r.checkout === '--')

    // 3. Search
    const q = norm(search)
    if (q) {
      list = list.filter(r =>
        [r.cnic, r.name, r.designation, r.point, r.workType].some(f => {
          const s = String(f ?? '').toLowerCase()
          return s.includes(q) || s.replace(/-/g, '').includes(q)
        })
      )
    }

    // 4. Smart sort: Attendance Point → Designation
    list.sort((a, b) => {
      if (a.point !== b.point) return a.point.localeCompare(b.point)
      return cleanDesig(a.designation).localeCompare(cleanDesig(b.designation))
    })
    list.forEach((r, i) => (r.sr = i + 1))
    return list
  }, [report, pointFilter, filter, search])

  return (
    <div className="space-y-4">
      {/* ✅ Header: heading + total (left); filters + search (right) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-nowrap">
          <h2 className="running-text text-base sm:text-xl font-bold whitespace-nowrap">Attendance Report</h2>
          <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[9px] sm:text-xs font-bold whitespace-nowrap">
            Total: {filtered.length}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:items-center">
          <div className="flex gap-2 w-full sm:w-auto">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value as 'all' | 'present' | 'absent' | 'on-duty')}
              className="flex-1 sm:flex-none min-w-0 sm:w-36 h-9 sm:h-10 px-3 sm:px-4 bg-white/5 border border-white/15 rounded-full text-white text-xs outline-none focus:border-emerald-500"
            >
              <option value="all">All Attendance</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="on-duty">On Duty</option>
            </select>
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
          </div>
          <div className="relative w-full sm:w-64">
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-red-300"
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

      {/* ✅ Report-style table — same 14 columns as employee report */}
      <SplitTable
        small
        center={[0, 1, 2]}
        widths={[4, 5, 6, 12, 10, 10, 10, 15, 10, 10, 8]}
        headers={['Sr#', 'Check-In', 'Check-Out', 'Name', 'Father/Husband', 'CNIC', 'Designation', 'Attendance Point', 'CheckinTime', 'CheckoutTime', 'DutyStatus']}
      >
        {loading ? (
          <tr><td colSpan={11} className="px-2 py-10 text-center text-white/50">Loading attendance…</td></tr>
        ) : filtered.length === 0 ? (
          <tr><td colSpan={11} className="px-2 py-10 text-center text-white/50">No records found</td></tr>
        ) : (
          filtered.map(r => (
            <tr key={r.cnic || r.sr} className="border-t border-white/5 transition-colors hover:bg-white/5">
              <td className="px-2 py-3 text-center text-white/50 font-mono">{r.sr}</td>
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
              <td className="px-2 py-3 text-white/70">{r.point}</td>
              <td className="px-2 py-3 text-white/70">{r.checkinTime}</td>
              <td className="px-2 py-3 text-white/70">{r.checkoutTime}</td>
              <td className="px-2 py-3 font-bold text-emerald-300">{r.duty}</td>
            </tr>
          ))
        )}
      </SplitTable>
    </div>
  )
}