import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AdminDashboard from './AdminDashboard'
import Employees from './Employees'
import Supervisors from './Supervisors'
import EmployeesStaff from './EmployeesStaff'
import SupervisorsData from './SupervisorsData'
import AttendanceSetup from './AttendanceSetup'

type Tab = 'dashboard' | 'employees' | 'supervisors' | 'employees-staff' | 'supervisors-staff' | 'base-values'

export default function Admin() {
  const navigate = useNavigate()
  // ✅ Tab persistence: refresh ke baad wahi page khule jo pehle tha
  const [tab, setTab] = useState<Tab>(() => {
    const saved = localStorage.getItem('rto_admin_tab') as Tab | null
    if (saved && ['dashboard', 'employees', 'supervisors', 'employees-staff', 'supervisors-staff', 'base-values'].includes(saved)) return saved
    return 'dashboard'
  })
  const [openUsers, setOpenUsers] = useState(false)
  const [openHr, setOpenHr] = useState(false)
  const [openBase, setOpenBase] = useState(false)

  // ✅ Active child ke group ko auto-expand karo
  useEffect(() => {
    if (tab === 'employees' || tab === 'supervisors') setOpenUsers(true)
    if (tab === 'employees-staff' || tab === 'supervisors-staff') setOpenHr(true)
    if (tab === 'base-values') setOpenBase(true)
  }, [tab])

  // ✅ Save tab to localStorage on every change
  useEffect(() => {
    localStorage.setItem('rto_admin_tab', tab)
  }, [tab])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const itemClass = (active: boolean) =>
    `w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
      active
        ? 'bg-linear-to-r from-[#00764c] to-[#058962] text-white shadow-[0_0_15px_rgba(170,255,200,0.15)]'
        : 'text-white/60 hover:text-emerald-200 hover:bg-white/5'
    }`

  const subClass = (active: boolean) =>
    `w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 ${
      active
        ? 'bg-linear-to-r from-[#00764c] to-[#058962] text-white'
        : 'text-white/55 hover:text-emerald-200 hover:bg-white/5'
    }`

  return (
    <div className="min-h-screen bg-[#021b16] text-white">
      {/* ===== Sidebar ===== */}
      <aside className="fixed top-0 left-0 bottom-0 z-40 w-60 flex flex-col bg-[#071b15]/95 border-r border-emerald-400/15 backdrop-blur-md">
        {/* Brand */}
        <div className="px-4 pt-5 pb-4 flex items-center gap-2.5 border-b border-white/5">
          <img src="/logos/loginform-logo.png" alt="Real Time Operations" className="h-9 w-9 object-contain" />
          <div>
            <div className="text-sm font-extrabold tracking-wide">Admin Panel</div>
            <div className="text-[9px] text-white/45 font-bold tracking-[0.18em]">REAL TIME OPERATIONS</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {/* 1) Home — top par */}
          <button
            onClick={() => navigate('/home')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-200 bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 hover:shadow-[0_0_18px_rgba(0,255,170,0.15)] transition"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Home
          </button>

          {/* 2) Dashboard */}
          <button onClick={() => setTab('dashboard')} className={itemClass(tab === 'dashboard')}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
            Dashboard
          </button>

          {/* 3) Users group */}
          <button
            onClick={() => setOpenUsers(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-emerald-200 hover:bg-white/5 transition"
          >
            <span className="flex items-center gap-3">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Users
            </span>
            <svg className={`h-3.5 w-3.5 transition-transform ${openUsers ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {openUsers && (
            <div className="ml-5 pl-3 border-l border-white/10 space-y-1">
              <button onClick={() => setTab('employees')} className={subClass(tab === 'employees')}>Employees</button>
              <button onClick={() => setTab('supervisors')} className={subClass(tab === 'supervisors')}>Supervisors</button>
            </div>
          )}

          {/* 4) HR group */}
          <button
            onClick={() => setOpenHr(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-emerald-200 hover:bg-white/5 transition"
          >
            <span className="flex items-center gap-3">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <path d="M2 13h20" />
              </svg>
              HR
            </span>
            <svg className={`h-3.5 w-3.5 transition-transform ${openHr ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {openHr && (
            <div className="ml-5 pl-3 border-l border-white/10 space-y-1">
              <button onClick={() => setTab('employees-staff')} className={subClass(tab === 'employees-staff')}>Employees Staff</button>
              <button onClick={() => setTab('supervisors-staff')} className={subClass(tab === 'supervisors-staff')}>Supervisors Staff</button>
            </div>
          )}

          {/* 5) Base Values group */}
          <button
            onClick={() => setOpenBase(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-emerald-200 hover:bg-white/5 transition"
          >
            <span className="flex items-center gap-3">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              Base Values
            </span>
            <svg className={`h-3.5 w-3.5 transition-transform ${openBase ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {openBase && (
            <div className="ml-5 pl-3 border-l border-white/10 space-y-1">
              <button onClick={() => setTab('base-values')} className={subClass(tab === 'base-values')}>Attendance Setup</button>
            </div>
          )}
        </nav>

        {/* Logout — bottom */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-300 hover:bg-red-500/15 transition"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* ===== Content ===== */}
      <main className="ml-60 px-6 sm:px-8 pt-6 pb-6">
        <div className="max-w-[1750px]">
          {tab === 'dashboard' && <AdminDashboard />}
          {tab === 'employees' && <Employees />}
          {tab === 'supervisors' && <Supervisors />}
          {tab === 'employees-staff' && <EmployeesStaff />}
          {tab === 'supervisors-staff' && <SupervisorsData />}
          {tab === 'base-values' && <AttendanceSetup />}
        </div>
      </main>
    </div>
  )
}