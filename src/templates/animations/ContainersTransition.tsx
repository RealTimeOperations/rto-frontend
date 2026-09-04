type Props = {
  onDone: () => void
}

export default function ContainersTransition({ onDone }: Props) {
  return (
    <div
      onAnimationEnd={e => {
        if (e.animationName === 'welcome-overlay') onDone()
      }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#071b15] animate-[welcome-overlay_2.6s_ease-in-out_forwards]"
    >
      {/* Container/Dustbin icon (filled green gradient) */}
      <div className="flex items-center justify-center animate-[welcome-item_0.8s_cubic-bezier(0.22,1,0.36,1)_both]">
        <svg width="96" height="96" viewBox="0 0 64 64" fill="none" className="drop-shadow-[0_0_16px_rgba(16,185,129,0.4)]">
          <defs>
            <linearGradient id="gradBinT" x1="32" y1="4" x2="32" y2="58" gradientUnits="userSpaceOnUse">
              <stop stopColor="#42f596" />
              <stop offset="1" stopColor="#0ba36a" />
            </linearGradient>
          </defs>
          <path d="M25 5h14a3 3 0 0 1 3 3v5H22V8a3 3 0 0 1 3-3Z" fill="url(#gradBinT)" />
          <rect x="10" y="13" width="44" height="7" rx="2.5" fill="url(#gradBinT)" />
          <path d="M14 24h36l-3 30a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4Z" fill="url(#gradBinT)" />
          <rect x="23.5" y="30" width="4.5" height="20" rx="2.2" fill="#03251d" />
          <rect x="30" y="30" width="4.5" height="20" rx="2.2" fill="#03251d" />
          <rect x="36.5" y="30" width="4.5" height="20" rx="2.2" fill="#03251d" />
          <circle cx="48" cy="47" r="12" fill="#021b16" opacity="0.9" />
          <circle cx="48" cy="47" r="10" stroke="url(#gradBinT)" strokeWidth="2.5" />
          <path d="M48 33v6M48 55v6M34 47h6M56 47h6" stroke="url(#gradBinT)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="48" cy="47" r="6.5" stroke="url(#gradBinT)" strokeWidth="1.5" />
          <circle cx="48" cy="47" r="3.5" fill="url(#gradBinT)" />
        </svg>
      </div>

      <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold bg-linear-to-b from-white via-slate-200 to-slate-500 bg-clip-text text-transparent animate-[welcome-item_0.8s_0.12s_cubic-bezier(0.22,1,0.36,1)_both]">
        Welcome to
      </h1>
      <p className="mt-1 text-lg sm:text-xl font-extrabold tracking-widest bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] animate-[welcome-item_0.8s_0.22s_cubic-bezier(0.22,1,0.36,1)_both]">
        CONTAINERS DASHBOARD
      </p>
    </div>
  )
}