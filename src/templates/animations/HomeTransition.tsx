type Props = {
  onDone: () => void
}

export default function HomeTransition({ onDone }: Props) {
  return (
    <div
      onAnimationEnd={e => {
        if (e.animationName === 'welcome-overlay') onDone()
      }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#071b15] animate-[welcome-overlay_2.6s_ease-in-out_forwards]"
    >
      {/* Home icon (filled green gradient) */}
      <div className="flex items-center justify-center animate-[welcome-item_0.8s_cubic-bezier(0.22,1,0.36,1)_both]">
        <svg width="96" height="96" viewBox="0 0 64 64" fill="none" className="drop-shadow-[0_0_16px_rgba(16,185,129,0.4)]">
          <defs>
            <linearGradient id="gradHomeT" x1="32" y1="6" x2="32" y2="58" gradientUnits="userSpaceOnUse">
              <stop stopColor="#42f596" />
              <stop offset="1" stopColor="#0ba36a" />
            </linearGradient>
          </defs>
          {/* roof */}
          <path d="M8 30 32 8l24 22" stroke="url(#gradHomeT)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          {/* body */}
          <path d="M14 28v26a4 4 0 0 0 4 4h28a4 4 0 0 0 4-4V28" fill="url(#gradHomeT)" />
          {/* door */}
          <path d="M26 58V40a6 6 0 0 1 12 0v18Z" fill="#03251d" />
        </svg>
      </div>

      <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold bg-linear-to-b from-white via-slate-200 to-s slate-500 bg-clip-text text-transparent animate-[welcome-item_0.8s_0.12s_cubic-bezier(0.22,1,0.36,1)_both]">
        Returning to
      </h1>
      <p className="mt-1 text-lg sm:text-xl font-extrabold tracking-widest bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[welcome-item_0.8s_0.22s_cubic-bezier(0.22,1,0.36,1)_both]">
        HOME PAGE
      </p>
    </div>
  )
}