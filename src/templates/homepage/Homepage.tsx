import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type HomepageProps = {
  role: string | null
}

export default function Homepage({ role }: HomepageProps) {
  const navigate = useNavigate()

  // Sign out (App will redirect to /login automatically)
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-[#06231c] to-[#0b352a]">
      {/* Top-left: Zakwan Builders logo (transparent, responsive, embossed) */}
      <img
        src="/logos/zakwan-logo.png"
        alt="Zakwan Builders & Developers"
        className="absolute top-4 left-4 sm:top-6 sm:left-6 h-16 sm:h-20 md:h-24 lg:h-28 xl:h-32 w-auto object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,0.45)]"
      />

      {/* Top-right: Suthra Punjab Authority logo (aligned, embossed) */}
      <img
        src="/logos/suthra-logo.png"
        alt="Suthra Punjab Authority"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 h-20 sm:h-24 md:h-32 lg:h-36 xl:h-40 w-auto object-contain -translate-y-2 sm:-translate-y-3 drop-shadow-[0_5px_12px_rgba(0,0,0,0.45)]"
      />

      {/* Hero section */}
      <div className="flex flex-col items-center justify-center min-h-screen px-5 text-center">
        {/* Real Time Operations logo */}
        <img
          src="/logos/loginform-logo.png"
          alt="Real Time Operations"
          className="h-24 w-24 sm:h-32 sm:w-32 mx-auto mb-6 object-contain rounded-3xl shadow-2xl"
        />
        <h1 className="running-text text-3xl sm:text-5xl font-bold mb-3">Real Time Operations</h1>
        <p className="text-white/60 text-sm sm:text-base mb-2">Suthra Punjab Authority — Zakwan Builders & Developers</p>
        <p className="text-white/40 text-xs sm:text-sm">Unified monitoring platform for containers, vehicles & attendance</p>
      </div>
      {/* Bottom-right: Admin portal button (visible to admin role only) */}
      {role === 'admin' && (
        <button
          onClick={() => navigate('/admin')}
          aria-label="Open admin portal"
          className="running-button fixed bottom-6 right-6 flex items-center gap-2 px-7 py-3 rounded-full text-white text-sm font-bold shadow-[0_10px_25px_rgba(0,0,0,0.45)] hover:opacity-90 transition"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 L20 5 V11 C20 16.5 16.5 20.5 12 22 C7.5 20.5 4 16.5 4 11 V5 Z" />
          </svg>
          Admin
        </button>
      )}

      {/* Bottom-left: Logout button */}
      <button
        onClick={handleLogout}
        aria-label="Logout"
        className="fixed bottom-6 left-6 flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/15 text-white/70 text-sm font-semibold hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-300 transition"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Logout
      </button>
    </div>
  )
}