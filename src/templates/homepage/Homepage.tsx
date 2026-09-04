import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type HomepageProps = {
  role: string | null
  onCardClick?: (target: 'attendance' | 'containers' | 'vehicles') => void
}

export default function Homepage({ role, onCardClick }: HomepageProps) {
  const navigate = useNavigate()

  // Sign out (App redirects to /login automatically)
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#021b16] text-white">
      {/* Background image — poori image har screen par full stretch */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-no-repeat pointer-events-none"
        style={{ backgroundImage: "url('/homebackground.png')", backgroundSize: '100% 100%' }}
      />

      {/* Dark overlay for better readability */}
      <div aria-hidden="true" className="absolute inset-0 bg-[#021b16]/35" />

      {/* Extra green glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(0,255,170,0.10),transparent_38%)]" />

      {/* Top-left: Zakwan logo */}
      <img
        src="/logos/zakwan-logo.png"
        alt="Zakwan Builders & Developers"
        className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 h-16 sm:h-20 md:h-24 lg:h-28 xl:h-32 w-auto object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,0.45)] animate-[logo-zoom_4s_ease-in-out_infinite]"
      />

      {/* Top-right: Suthra logo */}
      <img
        src="/logos/suthra-logo.png"
        alt="Suthra Punjab Authority"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 h-20 sm:h-24 md:h-32 lg:h-36 xl:h-40 w-auto object-contain -translate-y-2 sm:-translate-y-3 drop-shadow-[0_5px_12px_rgba(0,0,0,0.45)] animate-[logo-zoom_4s_ease-in-out_infinite]"
      />

      {/* Main content */}
      <main className="relative z-10 flex min-h-screen flex-col items-center px-5 pt-14 sm:pt-16 pb-28">
        {/* Hero icon (smaller) */}
        <div className="relative mb-4 sm:mb-5">
          <div aria-hidden="true" className="absolute inset-0 scale-125 rounded-full bg-emerald-400/20 blur-2xl" />
          <img
            src="/logos/loginform-logo.png"
            alt="Real Time Operations"
            className="relative h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-[0_0_25px_rgba(0,255,170,0.45)] animate-[logo-pulse_4s_ease-in-out_infinite]"
          />
        </div>

        {/* Heading — single line, smaller, metallic */}
        <h1 className="text-center text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-none whitespace-nowrap">
          <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Real Time </span>
          <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Operations</span>
        </h1>

        <p className="mt-4 mb-6 text-xs sm:text-sm text-white/45">
          Unified monitoring platform for containers, vehicles & attendance
        </p>

        {/* Monitoring cards */}
        <div className="mt-12 sm:mt-14 grid w-full max-w-6xl grid-cols-1 items-center gap-5 lg:gap-7 md:grid-cols-3">
          <MonitoringCard
            title="CONTAINERS"
            highlight="MONITORING"
            icon={<DustbinIcon />}
            onClick={() => {
              onCardClick?.('containers')
              navigate('/containers')
            }}
          />
          <MonitoringCard
            title="ATTENDANCE"
            highlight="MONITORING"
            icon={<AttendanceIcon />}
            primary
            onClick={() => {
              onCardClick?.('attendance')
              navigate('/attendance')
            }}
          />
          <MonitoringCard
            title="VEHICLES"
            highlight="MONITORING"
            icon={<VehicleIcon />}
            onClick={() => {
              onCardClick?.('vehicles')
              navigate('/vehicles')
            }}
          />
        </div>
      </main>

      {/* Logout button */}
      <button
        type="button"
        onClick={handleLogout}
        aria-label="Logout"
        className="group fixed bottom-6 right-5 sm:right-8 z-30 flex items-center gap-2 overflow-hidden rounded-full border border-white/15 bg-white/4 px-6 py-3 text-sm font-semibold text-white/75 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-emerald-400/70 hover:text-white hover:shadow-[0_0_30px_rgba(0,255,170,0.4)]"
      >
        {/* Green fill — bottom se slide hota hua */}
        <span
          aria-hidden="true"
          className="absolute inset-0 translate-y-full rounded-full bg-emerald-500 transition-transform duration-300 ease-out group-hover:translate-y-0"
        />
        <span className="relative flex items-center gap-2">
          <LogoutIcon />
          Logout
        </span>
      </button>

      {/* Admin button (admin only) */}
      {role === 'admin' && (
        <button
          type="button"
          onClick={() => navigate('/admin')}
          aria-label="Open admin portal"
          className="fixed bottom-6 left-5 sm:left-8 z-30 flex items-center gap-2 rounded-full border border-emerald-300/20 bg-linear-to-r from-[#00945f] to-[#06ab7b] px-7 py-3 text-sm font-bold text-white shadow-[0_10px_35px_rgba(0,220,150,0.12)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(0,255,170,0.2)]"
        >
          <ShieldIcon />
          Admin
        </button>
      )}
    </div>
  )
}

/* =========================================================
   MONITORING CARD COMPONENT
========================================================= */

type MonitoringCardProps = {
  title: string
  highlight: string
  icon: ReactNode
  primary?: boolean
  onClick: () => void
}

function MonitoringCard({ title, highlight, icon, primary = false, onClick }: MonitoringCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full cursor-pointer select-none touch-manipulation outline-none"
    >
      {/* Moving wrapper — button khud nahi hilta, click hamesha register hota hai */}
      <div className="relative overflow-hidden rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.30)] transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_20px_70px_rgba(0,255,170,0.16)]">
      {/* Running border (same style as login form border) */}
      <div className="absolute left-[calc(50%-600px)] top-[calc(50%-600px)] h-[1200px] w-[1200px] animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#059669,#34d399,#7acba4,#34d399,#059669)] opacity-60" />

      {/* Inner card */}
      <div
        className={`relative m-0.5 rounded-[26px] bg-linear-to-b from-[#073b2d] to-[#021d17] flex flex-col items-center justify-center px-5 ${
          primary ? 'min-h-[350px] md:min-h-[380px]' : 'min-h-[320px] md:min-h-[330px]'
        }`}
      >
        {/* Card hover glow */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[26px] opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(circle_at_50%_35%,rgba(0,255,170,0.14),transparent_45%)]"
        />

        {/* Top glow line (center card only) */}
        {primary && (
          <div
            aria-hidden="true"
            className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-40 bg-emerald-300 shadow-[0_0_25px_8px_rgba(0,255,170,0.35)]"
          />
        )}

        {/* Icon */}
        <div
          className={`mb-7 transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_18px_rgba(0,255,170,0.45)] ${primary ? 'scale-110' : ''}`}
        >
          {icon}
        </div>

        {/* Title */}
        <div className="text-center">
          <div className="text-lg sm:text-xl md:text-[21px] font-bold tracking-wide bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">{title}</div>
          <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-wide bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(0,255,170,0.18)] animate-[text-run-vertical_2.5s_linear_infinite]">
            {highlight}
          </div>
        </div>

        {/* Arrow circle: running border + running arrow */}
        <div className="relative mt-7 h-11 w-11 overflow-hidden rounded-full transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_25px_rgba(0,255,170,0.4)]">
          <div className="absolute left-[calc(50%-250px)] top-[calc(50%-250px)] h-125 w-125 animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#059669,#34d399,#7acba4,#34d399,#059669)] opacity-70" />
          <div className="absolute inset-[1.5px] rounded-full bg-[#021d17] flex items-center justify-center">
            <ArrowIcon />
          </div>
        </div>
      </div>
      </div>
    </button>
  )
}

/* =========================================================
   ICONS
========================================================= */

function DustbinIcon() {
  return (
    <svg width="88" height="88" viewBox="0 0 64 64" fill="none" className="drop-shadow-[0_0_16px_rgba(16,185,129,0.4)]">
      <defs>
        <linearGradient id="gradBin" x1="32" y1="4" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#42f596" />
          <stop offset="1" stopColor="#0ba36a" />
        </linearGradient>
      </defs>
      {/* handle */}
      <path d="M25 5h14a3 3 0 0 1 3 3v5H22V8a3 3 0 0 1 3-3Z" fill="url(#gradBin)" />
      {/* lid */}
      <rect x="10" y="13" width="44" height="7" rx="2.5" fill="url(#gradBin)" />
      {/* body */}
      <path d="M14 24h36l-3 30a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4Z" fill="url(#gradBin)" />
      {/* slats */}
      <rect x="23.5" y="30" width="4.5" height="20" rx="2.2" fill="#03251d" />
      <rect x="30" y="30" width="4.5" height="20" rx="2.2" fill="#03251d" />
      <rect x="36.5" y="30" width="4.5" height="20" rx="2.2" fill="#03251d" />
      {/* target badge */}
      <circle cx="48" cy="47" r="12" fill="#021b16" opacity="0.9" />
      <circle cx="48" cy="47" r="10" stroke="url(#gradBin)" strokeWidth="2.5" />
      <path d="M48 33v6M48 55v6M34 47h6M56 47h6" stroke="url(#gradBin)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="48" cy="47" r="6.5" stroke="url(#gradBin)" strokeWidth="1.5" />
      <circle cx="48" cy="47" r="3.5" fill="url(#gradBin)" />
    </svg>
  )
}

function AttendanceIcon() {
  return (
    <svg width="100" height="100" viewBox="0 0 64 64" fill="none" className="drop-shadow-[0_0_16px_rgba(16,185,129,0.4)]">
      <defs>
        <linearGradient id="gradPerson" x1="32" y1="8" x2="32" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#42f596" />
          <stop offset="1" stopColor="#0ba36a" />
        </linearGradient>
      </defs>
      {/* faint orbit ring + dots */}
      <circle cx="32" cy="30" r="26" stroke="#34d399" strokeOpacity="0.22" strokeWidth="1.5" />
      <circle cx="32" cy="4" r="1.8" fill="#34d399" opacity="0.55" />
      <circle cx="6" cy="30" r="1.8" fill="#34d399" opacity="0.55" />
      <circle cx="58" cy="30" r="1.8" fill="#34d399" opacity="0.55" />
      {/* head */}
      <circle cx="30" cy="20" r="9" fill="url(#gradPerson)" />
      {/* body */}
      <path d="M30 32c-10 0-16 7-16 15v1h32v-1c0-8-6-15-16-15Z" fill="url(#gradPerson)" />
      {/* check badge */}
      <circle cx="46" cy="44" r="10" fill="url(#gradPerson)" />
      <path d="m41.5 44 3.2 3.2 6-6.5" stroke="#03251d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function VehicleIcon() {
  return (
    <svg width="92" height="92" viewBox="0 0 64 64" fill="none" className="drop-shadow-[0_0_16px_rgba(16,185,129,0.4)]">
      <defs>
        <linearGradient id="gradTruck" x1="32" y1="10" x2="32" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#42f596" />
          <stop offset="1" stopColor="#0ba36a" />
        </linearGradient>
      </defs>
      {/* left bumper nub */}
      <rect x="2" y="34" width="6" height="5" rx="2" fill="url(#gradTruck)" />
      {/* cargo box */}
      <rect x="7" y="12" width="31" height="28" rx="3" fill="url(#gradTruck)" />
      {/* cab */}
      <path d="M40 20h9l9 10v10H40Z" fill="url(#gradTruck)" />
      {/* window */}
      <path d="M43 24h5.5l5 6H43Z" fill="#03251d" />
      {/* rear wheel */}
      <circle cx="16" cy="44" r="5.5" fill="#03251d" />
      <circle cx="16" cy="44" r="2.2" fill="url(#gradTruck)" />
      {/* front wheel */}
      <circle cx="42" cy="44" r="5.5" fill="#03251d" />
      <circle cx="42" cy="44" r="2.2" fill="url(#gradTruck)" />
      {/* target badge */}
      <circle cx="50" cy="46" r="11" fill="#021b16" opacity="0.9" />
      <circle cx="50" cy="46" r="9" stroke="url(#gradTruck)" strokeWidth="2.5" />
      <path d="M50 33.5v5.5M50 53v5.5M37.5 46H43M57 46h5.5" stroke="url(#gradTruck)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="50" cy="46" r="5.5" stroke="url(#gradTruck)" strokeWidth="1.5" />
      <circle cx="50" cy="46" r="3" fill="url(#gradTruck)" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-emerald-300 animate-[stroke-run_2.5s_linear_infinite]"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 20 5v6c0 5.5-3.5 9.5-8 11-4.5-1.5-8-5.5-8-11V5l8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}