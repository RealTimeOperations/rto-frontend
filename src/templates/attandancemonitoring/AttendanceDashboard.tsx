import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AttendanceLogs from './AttendanceLogs'
import TotalHR from './TotalHR'
import AttendanceReport from './AttendanceReport'

type Props = {
  onHomeClick?: () => void
}

type Row = Record<string, any>
type View = 'dashboard' | 'attendance' | 'hr' | 'report'

export default function AttendanceDashboard({ onHomeClick }: Props) {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('dashboard')
  const [attendance, setAttendance] = useState<Row[]>([])
  const [employees, setEmployees] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    // ✅ Paginated fetch — Supabase ek request mein max 1000 rows deta hai
    async function fetchAll(table: string) {
      let all: Row[] = []
      let from = 0
      const PAGE = 1000
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error) throw error
        const rows = data ?? []
        all = all.concat(rows)
        if (rows.length < PAGE) break
        from += PAGE
      }
      return all
    }

    // ✅ Sirf FMO / staff exclude (khali CNIC ya FMO/Weighbridge/Manager designation)
    const isStaff = (r: Row) => {
      const cnic = String(r.cnic ?? '').replace(/-/g, '').trim()
      const desig = String(r.designation ?? '').toLowerCase()
      return (
        cnic === '' ||
        desig.includes('field monitoring') ||
        desig.includes('weighbridge') ||
        desig.includes('manager')
      )
    }

    async function load() {
      setLoading(true)
      try {
        const [att, emp] = await Promise.all([
          fetchAll('attendance_logs'),
          fetchAll('assigned_employees'),
        ])
        if (!alive) return
        setAttendance(att.filter(r => !isStaff(r)))  // ✅ FMO nikal kar baqi SAB
        setEmployees(emp)
      } catch (e) {
        console.error('Load error:', e)
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [])

  const tabs: { key: View; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'hr', label: 'Total HR' },
    { key: 'report', label: 'Report' },
  ]

  return (
    <div className="min-h-screen bg-[#021b16] text-white">
      {/* ===== Top Navbar (solid + visible) ===== */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex items-center px-3 sm:px-6 py-3">
          {/* Left: Home button */}
          <div className="flex-1 flex justify-start pointer-events-auto">
            <button
              onClick={() => { onHomeClick?.(); navigate('/home') }}
              aria-label="Back to Home"
              className="rto-run-border relative flex items-center gap-2 rounded-full border border-transparent bg-[#071b15]/80 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-emerald-200 transition-all duration-300 hover:bg-emerald-500/15 hover:shadow-[0_0_25px_rgba(0,255,170,0.25)]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Home
            </button>
          </div>

          {/* Center: 3 tabs */}
          <nav className="rto-run-border relative pointer-events-auto flex items-center gap-1.5 sm:gap-2 rounded-full border border-transparent bg-[#071b15]/90 backdrop-blur-md px-2 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={`rto-run-border relative px-2.5 sm:px-5 py-2 rounded-full text-[11px] sm:text-sm font-bold tracking-wide border border-transparent transition-all duration-300 whitespace-nowrap ${
                  view === t.key
                    ? 'bg-linear-to-r from-[#00764c] to-[#058962] text-white/95 shadow-[0_0_15px_rgba(0,255,170,0.15)]'
                    : 'bg-[#071b15]/80 text-white/60 hover:text-emerald-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Right: spacer (tabs ko perfect center rakhne ke liye) */}
          <div className="flex-1" />
        </div>
      </header>

      {/* ===== Content ===== */}
      <main className="pt-24 pb-4 px-4 sm:px-6 max-w-[1600px] mx-auto flex flex-col min-h-screen">
        {view === 'dashboard' && <StatsView attendance={attendance} employees={employees} loading={loading} />}
        {view === 'attendance' && <AttendanceLogs rows={attendance} loading={loading} />}
        {view === 'hr' && <TotalHR rows={employees} loading={loading} />}
        {view === 'report' && <AttendanceReport rows={attendance} employees={employees} loading={loading} />}
      </main>
    </div>
  )
}

/* =========================================================
   DASHBOARD STATS VIEW (FIXED)
========================================================= */
function StatsView({ attendance, employees, loading }: { attendance: Row[]; employees: Row[]; loading: boolean }) {
  const normCnic = (v: any) => String(v ?? '').replace(/-/g, '').trim().toLowerCase()

  // ✅ FIX 2: Employees ko bhi filter karein taake FMOs/Managers TOTAL HR mein count na hon
  const validEmployees = employees.filter(e => {
    const desig = String(e.designation ?? '').toLowerCase()
    return !desig.includes('field monitoring') &&
           !desig.includes('weighbridge') &&
           !desig.includes('manager')
  })

  const latestDate = attendance.length > 0
    ? attendance.reduce((max, curr) => {
        const currDate = String(curr.date ?? curr.date_time ?? '').split(' ')[0]
        return currDate > max ? currDate : max
      }, '')
    : ''

  const valid = attendance.filter(r => {
    const cnic = String(r.cnic ?? '').replace(/-/g, '').trim()
    const desig = String(r.designation ?? '').toLowerCase()
    return cnic !== '' &&
      !desig.includes('field monitoring') &&
      !desig.includes('weighbridge') &&
      !desig.includes('manager')
  })

  const checkins = valid.filter(r => String(r.check_type ?? '').toLowerCase() === 'checkin').length
  const checkouts = valid.filter(r => String(r.check_type ?? '').toLowerCase() === 'checkout').length

  const checkinCnics = new Set(
    valid.filter(r => String(r.check_type ?? '').toLowerCase() === 'checkin').map(r => normCnic(r.cnic))
  )
  
  // ✅ FIX 3: PRESENT Logic Bug Fix!
  // Pehle aap checkin AUR checkout dono check kar rahe thay. CSV data mein abhi sirf 'checkin' hai.
  // Is wajah se har wo shakhs ABSENT count ho raha tha jis ne sirf check-in kiya tha.
  // Ab sirf check-in ko PRESENT count karenge.
  const present = validEmployees.filter(e => checkinCnics.has(normCnic(e.cnic))).length
  const absent = validEmployees.length - present

  const showDate = latestDate
    ? new Date(latestDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const GREEN_NUM = 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'
  const RED_NUM = 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'

  const cards = [
    // ✅ FIX 4: TOTAL HR ke liye validEmployees.length use karein
    { label: 'TOTAL HR', value: validEmployees.length, icon: <PeopleIcon />, num: GREEN_NUM, ring: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' },
    { label: 'TOTAL CHECK-IN', value: checkins, icon: <CheckInIcon />, num: GREEN_NUM, ring: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' },
    { label: 'TOTAL CHECK-OUT', value: checkouts, icon: <CheckOutIcon />, num: GREEN_NUM, ring: 'border-sky-400/40 bg-sky-500/15 text-sky-300' },
    { label: 'TOTAL IN + OUT', value: checkins + checkouts, icon: <TotalIcon />, num: GREEN_NUM, ring: 'border-teal-400/40 bg-teal-500/15 text-teal-300' },
    { label: 'PRESENT', value: present, icon: <PresentIcon />, num: GREEN_NUM, ring: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' },
    { label: 'ABSENT', value: absent, icon: <AbsentIcon />, num: RED_NUM, ring: 'border-red-400/40 bg-red-500/15 text-red-300' },
  ]

  return (
    <div>
      <h1 className="text-center text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-none">
        <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Attendance </span>
        <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Dashboard</span>
      </h1>
      <p className="mt-3 text-center text-xs sm:text-sm text-white/45">Live monitoring — {showDate}</p>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-5">
        {cards.map(c => (
          <div key={c.label} className="relative overflow-hidden rounded-[24px] border border-emerald-400/25 bg-linear-to-b from-[#073b2d] to-[#021d17] px-4 py-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border ${c.ring}`}>
              {c.icon}
            </div>
            <div className={`text-3xl sm:text-4xl font-extrabold ${c.num}`}>
              {loading ? '—' : c.value.toLocaleString()}
            </div>
            <div className="mt-2 text-[11px] sm:text-sm font-bold tracking-widest text-white/60">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PeopleIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function CheckInIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="5.5" r="2.5" />
      <path d="M4 20v-1a4 4 0 0 1 4-4h.5" />
      <path d="M8.5 12.5 12 14" />
      <rect x="14" y="3" width="7" height="18" rx="2" />
      <path d="m16 12.5 1.5 1.5 2.5-2.5" />
    </svg>
  )
}

function CheckOutIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="4.5" r="2" />
      <path d="M6.5 7.5v5l-2 7" />
      <path d="M6.5 12.5l3 7" />
      <path d="M6.5 8.5 10 10" />
      <path d="M14 3.5h6v17h-6" />
      <path d="M13.5 12H20" />
      <path d="m17.5 9.5 2.5 2.5-2.5 2.5" />
    </svg>
  )
}

function TotalIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </svg>
  )
}

function PresentIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9.5" cy="6.5" r="3.5" />
      <path d="M3 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 1.8.33" />
      <circle cx="17" cy="17" r="4.5" />
      <path d="m15.2 17 1.3 1.3 2.3-2.3" />
    </svg>
  )
}

function AbsentIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9.5" cy="6.5" r="3.5" />
      <path d="M3 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 1.8.33" />
      <circle cx="17" cy="17" r="4.5" />
      <path d="m15.5 15.5 3 3" />
      <path d="m18.5 15.5-3 3" />
    </svg>
  )
}