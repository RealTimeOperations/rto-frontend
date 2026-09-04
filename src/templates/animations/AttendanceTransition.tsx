type Props = {
  onDone: () => void
}

export default function AttendanceTransition({ onDone }: Props) {
  return (
    <div
      onAnimationEnd={e => {
        if (e.animationName === 'welcome-overlay') onDone()
      }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#071b15] animate-[welcome-overlay_2.6s_ease-in-out_forwards]"
    >
      {/* Attendance icon (filled green gradient) */}
      <div className="flex items-center justify-center animate-[welcome-item_0.8s_cubic-bezier(0.22,1,0.36,1)_both]">
        <svg width="96" height="96" viewBox="0 0 64 64" fill="none" className="drop-shadow-[0_0_16px_rgba(16,185,129,0.4)]">
          <defs>
            <linearGradient id="gradPersonT" x1="32" y1="8" x2="32" y2="54" gradientUnits="userSpaceOnUse">
              <stop stopColor="#42f596" />
              <stop offset="1" stopColor="#0ba36a" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="30" r="26" stroke="#34d399" strokeOpacity="0.22" strokeWidth="1.5" />
          <circle cx="32" cy="4" r="1.8" fill="#34d399" opacity="0.55" />
          <circle cx="6" cy="30" r="1.8" fill="#34d399" opacity="0.55" />
          <circle cx="58" cy="30" r="1.8" fill="#34d399" opacity="0.55" />
          <circle cx="30" cy="20" r="9" fill="url(#gradPersonT)" />
          <path d="M30 32c-10 0-16 7-16 15v1h32v-1c0-8-6-15-16-15Z" fill="url(#gradPersonT)" />
          <circle cx="46" cy="44" r="10" fill="url(#gradPersonT)" />
          <path d="m41.5 44 3.2 3.2 6-6.5" stroke="#03251d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold bg-linear-to-b from-white via-slate-200 to-slate-500 bg-clip-text text-transparent animate-[welcome-item_0.8s_0.12s_cubic-bezier(0.22,1,0.36,1)_both]">
        Welcome to
      </h1>
      <p className="mt-1 text-lg sm:text-xl font-extrabold tracking-widest bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] animate-[welcome-item_0.8s_0.22s_cubic-bezier(0.22,1,0.36,1)_both]">
        ATTENDANCE DASHBOARD
      </p>
    </div>
  )
}