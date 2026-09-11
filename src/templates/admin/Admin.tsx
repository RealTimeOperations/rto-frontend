import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AdminDashboard from './AdminDashboard'
import Employees from './Employees'
import Supervisors from './Supervisors'

type Tab = 'dashboard' | 'employees' | 'supervisors'

export default function Admin() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('dashboard')
  const navRef = useRef<HTMLDivElement>(null)
  const [slider, setSlider] = useState({ left: 0, width: 0 })

  // ✅ Sliding pill animation — AttendanceDashboard jaisi
  useEffect(() => {
    if (!navRef.current) return
    const activeBtn = navRef.current.querySelector('[data-active="true"]') as HTMLElement
    if (activeBtn) {
      setSlider({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth })
    }
  }, [tab])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'employees', label: 'Employees' },
    { key: 'supervisors', label: 'Supervisors' },
  ]

  return (
    <div className="min-h-screen bg-[#021b16] text-white">
      {/* ===== Top Navbar (Attendance Dashboard jaisa floating + embossed) ===== */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex items-center px-3 sm:px-6 py-3">

          {/* ✅ LEFT: Home button + "Admin Dashboard" title */}
          <div className="flex-1 flex justify-start items-center gap-3 pointer-events-auto">
            <button
              onClick={() => navigate('/home')}
              aria-label="Back to Home"
              className="rto-run-border relative flex items-center gap-2 rounded-full border border-transparent bg-[#071b15]/80 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-emerald-200 transition-all duration-300 hover:bg-emerald-500/15 hover:shadow-[0_0_25px_rgba(0,255,170,0.25)]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Home
            </button>
            <span className="hidden sm:inline-block text-sm sm:text-base font-bold text-white/80 tracking-wide">
              Admin Dashboard
            </span>
          </div>

          {/* ✅ CENTER: 3 tabs with sliding green pill */}
          <nav
            ref={navRef}
            className="relative pointer-events-auto flex items-center gap-1.5 sm:gap-2 rounded-full border border-transparent bg-[#071b15]/90 backdrop-blur-md px-2 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_12px_35px_rgba(0,0,0,0.6)]"
          >
            {/* ✅ Sliding green pill */}
            <div
              className="absolute top-1.5 bottom-1.5 rounded-full bg-linear-to-r from-[#00764c] to-[#058962] shadow-[0_0_15px_rgba(0,255,170,0.15)] transition-all duration-300 ease-out pointer-events-none"
              style={{ left: slider.left, width: slider.width }}
            />

            {tabs.map(t => (
              <button
                key={t.key}
                data-active={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`relative z-10 px-2.5 sm:px-5 py-2 rounded-full text-[11px] sm:text-sm font-bold tracking-wide transition-colors duration-300 whitespace-nowrap ${
                  tab === t.key ? 'text-white' : 'text-white/60 hover:text-emerald-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* ✅ RIGHT: Logout icon only */}
          <div className="flex-1 flex justify-end pointer-events-auto">
            <button
              onClick={handleLogout}
              aria-label="Logout"
              title="Logout"
              className="rto-run-border relative flex items-center justify-center rounded-full border border-transparent bg-[#071b15]/80 p-2.5 sm:p-3 text-red-300 transition-all duration-300 hover:bg-red-500/15 hover:shadow-[0_0_25px_rgba(239,68,68,0.25)]"
            >
              <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>

        </div>
      </header>

      {/* ===== Content (pt-24 header ke neeche space) ===== */}
      <main className="pt-24 pb-4 px-4 sm:px-6 max-w-[1750px] mx-auto flex flex-col min-h-screen">
        {tab === 'dashboard' && <AdminDashboard />}
        {tab === 'employees' && <Employees />}
        {tab === 'supervisors' && <Supervisors />}
      </main>
    </div>
  )
}