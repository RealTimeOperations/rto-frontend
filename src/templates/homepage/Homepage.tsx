import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Permissions } from '../admin/types'

type HomepageProps = {
  role: string | null
  permissions: Permissions
  permissionsLoaded?: boolean
  // ✅ 'penalties' ko bhi add kar diya gaya hai
  onCardClick?: (target: 'attendance' | 'containers' | 'vehicles' | 'penalties') => void
  onAdminClick?: () => void
}

export default function Homepage({ role, permissions, permissionsLoaded = true, onCardClick, onAdminClick }: HomepageProps) {
  const navigate = useNavigate()

  // Sign out (App redirects to /login automatically)
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  // ✅ Penalties button access: admin hamesha, supervisor/employee sirf permission se
  const canPenalties = role === 'admin' || permissions.penalties

  // Base monitoring cards
  const baseCards = [
    {
      key: 'containers',
      title: 'CONTAINERS',
      highlight: 'MONITORING',
      icon: <DustbinIcon />,
      permissionKey: 'containers' as keyof Permissions,
    },
    {
      key: 'attendance',
      title: 'ATTENDANCE',
      highlight: 'MONITORING',
      icon: <AttendanceIcon />,
      primary: true,
      permissionKey: 'attendance' as keyof Permissions,
    },
    {
      key: 'vehicles',
      title: 'VEHICLES',
      highlight: 'MONITORING',
      icon: <VehicleIcon />,
      permissionKey: 'vehicles' as keyof Permissions,
    },
  ]

  // Filter cards based on permissions (admin/supervisor see all, employee sees only allowed)
  const visibleBaseCards = baseCards.filter(c => {
    if (role === 'admin' || role === 'supervisor') return true
    return permissions[c.permissionKey]
  })

  // ✅ Check if user ONLY has penalties access (and no other monitoring access)
  const hasOnlyPenalties = visibleBaseCards.length === 0 && canPenalties

  // Final cards to render in the grid
  const finalVisibleCards = hasOnlyPenalties
    ? [{ key: 'penalties', title: 'PENALTIES', highlight: 'MONITORING', icon: <PenaltiesIcon /> }]
    : visibleBaseCards

  // Show welcome screen only if NO cards are visible AND no penalties access
  const showWelcome = role === 'employee' && finalVisibleCards.length === 0 && !canPenalties

  // Show bottom button ONLY if they have penalties access AND other access too
  const showBottomPenaltiesButton = canPenalties && !hasOnlyPenalties

  return (
    <div className="home-page relative h-[100dvh] overflow-hidden bg-[#021b16] text-white">
      {/* Background image — mobile par hide */}
      <div
        aria-hidden="true"
        className="hidden sm:block absolute inset-0 bg-no-repeat pointer-events-none"
        style={{ backgroundImage: "url('/homebackground.png')", backgroundSize: '100% 100%' }}
      />

      {/* Dark overlay */}
      <div aria-hidden="true" className="absolute inset-0 bg-[#021b16]/35" />

      {/* Extra green glow — mobile par hide (GPU heavy) */}
      <div aria-hidden="true" className="hidden sm:block pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(0,255,170,0.10),transparent_38%)]" />

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
      <main className="home-main relative z-10 flex h-full flex-col items-center justify-between px-5 pt-14 sm:pt-16 pb-20 sm:pb-28 overflow-hidden"> 
        {/* ✅ Show loading until permissions are confirmed */}
        {role === 'employee' && !permissionsLoaded && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-white/60 text-sm">Loading your access…</div>
          </div>
        )}

        {/* ✅ Render content only when permissions are loaded (or not employee) */}
        {(role !== 'employee' || permissionsLoaded) && (
          <>
            <div className="home-top flex flex-col items-center flex-shrink-0">
              {/* Hero icon */}
              <div className="relative mb-3 sm:mb-5">
                <div aria-hidden="true" className="hidden sm:block absolute inset-0 scale-125 rounded-full bg-emerald-400/20 blur-2xl" />
                <img
                  src="/logos/loginform-logo.png"
                  alt="Real Time Operations"
                  className="home-logo relative h-14 w-14 sm:h-20 sm:w-20 object-contain sm:drop-shadow-[0_0_25px_rgba(0,255,170,0.45)] animate-[logo-pulse_4s_ease-in-out_infinite]"
                />
              </div>

              {/* Heading */}
              <h1 className="text-center text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-none whitespace-nowrap">
                <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Real Time </span>
                <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Operations</span>
              </h1>

              <p className="hidden sm:block mt-4 mb-6 text-xs sm:text-sm text-white/45">
                Unified monitoring platform for containers, vehicles, attendance & penalties
              </p>
            </div>

            {/* ✅ Employee Welcome Screen (no permissions at all) */}
            {showWelcome && (
              <div className="mt-12 sm:mt-14 flex flex-col items-center gap-4 rounded-2xl border border-emerald-400/20 bg-[#073b2d]/40 backdrop-blur-md px-8 py-10 shadow-[0_20px_60px_rgba(0,0,0,0.3)] max-w-md text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300">
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-emerald-200">Welcome!</h2>
                <p className="text-sm text-white/60">
                  You are logged in, but no dashboard access has been assigned yet. Please contact your administrator.
                </p>
              </div>
            )}

            {/* ✅ Monitoring cards (filtered by permissions, or shows ONLY Penalties if that's the only access) */}
            {!showWelcome && finalVisibleCards.length > 0 && (
              <div
                className={`home-cards mt-8 sm:mt-14 mx-auto grid w-full items-stretch gap-4 sm:gap-5 lg:gap-7 min-h-0 flex-1 ${
                  finalVisibleCards.length === 1
                    ? 'grid-cols-1 max-w-[400px]'
                    : finalVisibleCards.length === 2
                      ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl'
                      : 'grid-cols-1 md:grid-cols-3 max-w-6xl'
                }`}
              >
                {finalVisibleCards.map(card => (
                  <div
                    key={card.key}
                    className={
                      card.key === 'attendance'
                        ? 'order-1 sm:order-2'
                        : card.key === 'containers'
                          ? 'order-2 sm:order-1'
                          : 'order-3 sm:order-3'
                    }
                  >
                    <MonitoringCard
                      title={card.title}
                      highlight={card.highlight}
                      icon={card.icon}
                      primary={card.key === 'attendance'}
                      onClick={() => {
                        // ✅ Ab penalties ke liye bhi transition trigger hoga
                        onCardClick?.(card.key as 'attendance' | 'containers' | 'vehicles' | 'penalties')
                        navigate(`/${card.key}`)
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* ✅ Mobile: Penalties Monitoring button — sirf tab jab doosri access bhi ho */}
            <div className={showBottomPenaltiesButton ? 'mt-5 sm:hidden flex justify-center w-full flex-shrink-0' : 'hidden'}>
              <button
                type="button"
                onClick={() => {
                  onCardClick?.('penalties') // ✅ Transition trigger
                  navigate('/penalties')
                }}
                aria-label="Open penalties monitoring"
                className="relative flex items-center rounded-full p-[1.5px] overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
              >
                <span
                  aria-hidden="true"
                  className="absolute left-[calc(50%-300px)] top-[calc(50%-300px)] h-[600px] w-[600px] bg-[conic-gradient(from_0deg,#059669,#34d399,#7acba4,#34d399,#059669)] opacity-70"
                />
                <span className="relative flex items-center gap-2 overflow-hidden rounded-full bg-[#021b16]/85 backdrop-blur-md px-6 py-3 text-sm font-semibold text-white/80">
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 scale-x-0 rounded-full bg-[linear-gradient(90deg,#00764c,#058962)] transition-transform duration-300 ease-out active:scale-x-100"
                  />
                  <span className="relative flex items-center gap-2">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Penalties Monitoring
                  </span>
                </span>
              </button>
            </div>
          </>
        )}
      </main>

      {/* ✅ Penalties Monitoring button (center bottom) — sirf tab jab doosri access bhi ho */}
      <button
        type="button"
        onClick={() => {
          onCardClick?.('penalties') // ✅ Transition trigger
          navigate('/penalties')
        }}
        aria-label="Open penalties monitoring"
        className={`group fixed bottom-6 left-1/2 -translate-x-1/2 z-30 hidden ${showBottomPenaltiesButton ? 'sm:flex' : ''} items-center rounded-full p-[1.5px] overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,255,170,0.25)]`}
      >
        <span
          aria-hidden="true"
          className="absolute left-[calc(50%-300px)] top-[calc(50%-300px)] h-[600px] w-[600px] sm:animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#059669,#34d399,#7acba4,#34d399,#059669)] opacity-70"
        />
        <span className="relative flex items-center gap-2 overflow-hidden rounded-full bg-[#021b16]/85 backdrop-blur-md px-6 py-3 text-sm font-semibold text-white/80 transition-colors duration-300 group-hover:text-white">
          <span
            aria-hidden="true"
            className="absolute inset-0 scale-x-0 rounded-full bg-[linear-gradient(90deg,#00764c,#058962)] transition-transform duration-300 ease-out group-hover:scale-x-100"
          />
          <span className="relative flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Penalties Monitoring
          </span>
        </span>
      </button>

      {/* Logout button */}
      <button
        type="button"
        onClick={handleLogout}
        aria-label="Logout"
        className="group fixed bottom-6 right-5 sm:right-8 z-30 hidden sm:flex items-center gap-2 overflow-hidden rounded-full border border-white/15 bg-white/4 px-6 py-3 text-sm font-semibold text-white/75 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-emerald-400/70 hover:text-white hover:shadow-[0_0_30px_rgba(0,255,170,0.4)]"
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 translate-y-full rounded-full bg-[linear-gradient(180deg,#00764c,#058962)] transition-transform duration-300 ease-out group-hover:translate-y-0"
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
          onClick={() => {
            onAdminClick?.()
            navigate('/admin')
          }}
          aria-label="Open admin portal"
          className="group fixed bottom-6 left-5 sm:left-8 z-30 hidden sm:flex items-center gap-2 overflow-hidden rounded-full border border-white/15 bg-white/4 px-7 py-3 text-sm font-semibold text-white/75 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-emerald-400/70 hover:text-white hover:shadow-[0_0_30px_rgba(0,255,170,0.4)]"
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 -translate-y-full rounded-full bg-[linear-gradient(180deg,#00764c,#058962)] transition-transform duration-300 ease-out group-hover:translate-y-0"
          />
          <span className="relative flex items-center gap-2">
            <ShieldIcon />
            Admin
          </span>
        </button>
      )}

      {/* ✅ Mobile bottom bar — Admin + Penalties + Logout */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center gap-2 px-3 py-3 bg-[#021b16]/90 backdrop-blur-md border-t border-white/10 sm:hidden">
        {role === 'admin' && (
          <button
            type="button"
            onClick={() => {
              onAdminClick?.()
              navigate('/admin')
            }}
            className="flex-1 flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/75"
          >
            <ShieldIcon />
            Admin
          </button>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-2.5 text-[11px] font-semibold text-white/75"
        >
          <LogoutIcon />
          Logout
        </button>
      </div>

      {/* ✅ Homepage responsive rules */}
      <style>{`
        @media (max-width: 640px) {
          .home-page { height: auto !important; min-height: 100dvh; overflow: visible !important; }
          .home-main { height: auto !important; min-height: 100dvh; overflow: visible !important; justify-content: flex-start !important; padding-bottom: 96px !important; }
          .home-cards { flex: 0 0 auto !important; min-height: 0 !important; grid-template-rows: auto !important; }
        }
        @media (min-width: 640px) and (max-height: 850px) {
          .home-page { height: 100dvh !important; overflow: hidden !important; }
          .home-main { padding-top: clamp(10px, 2vh, 20px) !important; padding-bottom: clamp(56px, 9vh, 90px) !important; justify-content: center !important; gap: clamp(10px, 2vh, 26px) !important; }
          .home-logo { width: clamp(64px, 10vh, 96px) !important; height: clamp(64px, 10vh, 96px) !important; }
          .home-top { flex-shrink: 0 !important; }
          .home-top > h1 { font-size: clamp(1.5rem, 3.5vh, 2rem) !important; }
          .home-top > p { margin-top: clamp(4px, 0.8vh, 10px) !important; margin-bottom: clamp(6px, 1.2vh, 14px) !important; }
          .home-cards { margin-top: 0 !important; gap: clamp(10px, 1.8vh, 20px) !important; align-items: stretch !important; grid-template-rows: 1fr !important; flex: 0 0 auto !important; }
          .home-cards > div { display: flex !important; flex-direction: column !important; }
          .home-card-inner { padding: clamp(14px, 2vh, 22px) clamp(12px, 1.5vw, 20px) !important; min-height: 0 !important; height: clamp(250px, 42vh, 460px) !important; flex: 1 1 auto !important; justify-content: center !important; gap: clamp(10px, 2.2vh, 24px) !important; }
          .home-card-inner > div:first-of-type { margin-bottom: 0 !important; }
          .home-card-inner > div:first-of-type svg { width: clamp(48px, 7vh, 72px) !important; height: clamp(48px, 7vh, 72px) !important; }
          .home-card-inner .text-center { margin: 0 !important; }
          .home-card-inner .text-center > div:first-child { font-size: clamp(1rem, 2.2vh, 1.35rem) !important; }
          .home-card-inner .text-center > div:last-child { font-size: clamp(1.35rem, 3.2vh, 2rem) !important; margin-top: clamp(2px, 0.4vh, 6px) !important; }
          .home-page > img[alt*="Zakwan"] { height: clamp(84px, 12.5vh, 128px) !important; top: clamp(10px, 1.6vh, 20px) !important; }
          .home-page > img[alt*="Suthra"] { height: clamp(96px, 14vh, 144px) !important; top: clamp(10px, 1.6vh, 20px) !important; }
          .home-card-inner { justify-content: center !important; gap: clamp(12px, 2.4vh, 24px) !important; }
          .home-card-inner > div { margin: 0 !important; }
        }
        @media (min-width: 640px) and (max-height: 700px) {
          .home-main { padding-top: 6px !important; padding-bottom: 44px !important; }
          .home-logo { width: clamp(40px, 6vh, 52px) !important; height: clamp(40px, 6vh, 52px) !important; }
          .home-card-inner > div:first-of-type svg { width: clamp(40px, 6vh, 56px) !important; height: clamp(40px, 6vh, 56px) !important; }
          .home-card-inner { height: clamp(220px, 44vh, 380px) !important; }
          .home-card-inner .text-center > div:last-child { font-size: clamp(1rem, 2.4vh, 1.4rem) !important; }
        }
        @media (min-width: 640px) and (min-height: 851px) {
          .home-main { justify-content: flex-start !important; }
          .home-cards { flex: 0 0 auto !important; margin-top: clamp(14px, 2.2vh, 30px) !important; }
          .home-card-inner { min-height: 350px !important; }
          .home-card-inner.home-card-regular { min-height: 320px !important; }
        }
      `}</style>
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
      <div className="relative overflow-hidden rounded-[28px] shadow-[0_6px_20px_rgba(0,0,0,0.35)] sm:shadow-[0_20px_60px_rgba(0,0,0,0.30)] transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_20px_70px_rgba(0,255,170,0.16)]">
        <div className="absolute left-[calc(50%-600px)] top-[calc(50%-600px)] h-[1200px] w-[1200px] sm:animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#059669,#34d399,#7acba4,#34d399,#059669)] opacity-60" />

        <div
          className={`home-card-inner relative m-0.5 rounded-[26px] bg-linear-to-b from-[#073b2d] to-[#021d17] flex flex-col items-center justify-center px-5 py-6 sm:py-7 h-full ${
            primary ? 'min-h-[210px]' : 'min-h-[190px]'
          }`}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-[26px] opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(circle_at_50%_35%,rgba(0,255,170,0.14),transparent_45%)]"
          />

          {primary && (
            <div
              aria-hidden="true"
              className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-40 bg-emerald-300 shadow-[0_0_25px_8px_rgba(0,255,170,0.35)]"
            />
          )}

          <div
            className={`mb-4 sm:mb-7 transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_18px_rgba(0,255,170,0.45)] [&>svg]:h-14 [&>svg]:w-14 sm:[&>svg]:h-auto sm:[&>svg]:w-auto ${primary ? 'scale-110' : ''}`}
          >
            {icon}
          </div>

          <div className="text-center">
            <div className="text-base sm:text-xl md:text-[21px] font-bold tracking-wide bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">{title}</div>
            <div className="mt-1 text-xl sm:text-3xl font-extrabold tracking-wide bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(16,185,129,0.18)] animate-[text-run-vertical_2.5s_linear_infinite]">
              {highlight}
            </div>
          </div>

          <div className="relative mt-4 sm:mt-7 h-9 w-9 sm:h-11 sm:w-11 overflow-hidden rounded-full transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_25px_rgba(0,255,170,0.4)]">
            <div className="absolute left-[calc(50%-250px)] top-[calc(50%-250px)] h-125 w-125 sm:animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#059669,#34d399,#7acba4,#34d399,#059669)] opacity-70" />
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

function PenaltiesIcon() {
  return (
    <svg width="92" height="92" viewBox="0 0 64 64" fill="none" className="drop-shadow-[0_0_16px_rgba(16,185,129,0.4)]">
      <defs>
        <linearGradient id="gradPen" x1="32" y1="8" x2="32" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#42f596" />
          <stop offset="1" stopColor="#0ba36a" />
        </linearGradient>
      </defs>
      <path d="M16 10a4 4 0 0 1 4-4h20l10 10v36a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V10Z" fill="url(#gradPen)" />
      <path d="M40 6v10h10" fill="#03251d" fillOpacity="0.3" />
      <path d="M40 6v10h10" stroke="#03251d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 28h16M24 36h16M24 44h10" stroke="#03251d" strokeWidth="3" strokeLinecap="round" />
      <circle cx="48" cy="46" r="11" fill="#021b16" opacity="0.9" />
      <circle cx="48" cy="46" r="9" stroke="url(#gradPen)" strokeWidth="2.5" />
      <path d="M44 46l3 3 5-6" stroke="url(#gradPen)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DustbinIcon() {
  return (
    <svg width="88" height="88" viewBox="0 0 64 64" fill="none" className="sm:drop-shadow-[0_0_16px_rgba(16,185,129,0.4)]">
      <defs>
        <linearGradient id="gradBin" x1="32" y1="4" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#42f596" />
          <stop offset="1" stopColor="#0ba36a" />
        </linearGradient>
      </defs>
      <path d="M25 5h14a3 3 0 0 1 3 3v5H22V8a3 3 0 0 1 3-3Z" fill="url(#gradBin)" />
      <rect x="10" y="13" width="44" height="7" rx="2.5" fill="url(#gradBin)" />
      <path d="M14 24h36l-3 30a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4Z" fill="url(#gradBin)" />
      <rect x="23.5" y="30" width="4.5" height="20" rx="2.2" fill="#03251d" />
      <rect x="30" y="30" width="4.5" height="20" rx="2.2" fill="#03251d" />
      <rect x="36.5" y="30" width="4.5" height="20" rx="2.2" fill="#03251d" />
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
      <circle cx="32" cy="30" r="26" stroke="#34d399" strokeOpacity="0.22" strokeWidth="1.5" />
      <circle cx="32" cy="4" r="1.8" fill="#34d399" opacity="0.55" />
      <circle cx="6" cy="30" r="1.8" fill="#34d399" opacity="0.55" />
      <circle cx="58" cy="30" r="1.8" fill="#34d399" opacity="0.55" />
      <circle cx="30" cy="20" r="9" fill="url(#gradPerson)" />
      <path d="M30 32c-10 0-16 7-16 15v1h32v-1c0-8-6-15-16-15Z" fill="url(#gradPerson)" />
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
      <rect x="2" y="34" width="6" height="5" rx="2" fill="url(#gradTruck)" />
      <rect x="7" y="12" width="31" height="28" rx="3" fill="url(#gradTruck)" />
      <path d="M40 20h9l9 10v10H40Z" fill="url(#gradTruck)" />
      <path d="M43 24h5.5l5 6H43Z" fill="#03251d" />
      <circle cx="16" cy="44" r="5.5" fill="#03251d" />
      <circle cx="16" cy="44" r="2.2" fill="url(#gradTruck)" />
      <circle cx="42" cy="44" r="5.5" fill="#03251d" />
      <circle cx="42" cy="44" r="2.2" fill="url(#gradTruck)" />
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