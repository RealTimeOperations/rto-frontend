import type { FC } from 'react'

type Props = {
  onDone: () => void
}

const PenaltiesTransition: FC<Props> = ({ onDone }) => {
  return (
    <div
      onAnimationEnd={(e) => {
        if (e.animationName === 'welcome-overlay') onDone()
      }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#071b15] animate-[welcome-overlay_2.6s_ease-in-out_forwards]"
    >
      {/* Penalties Icon (Document with checkmark - filled green gradient) */}
      <div className="flex items-center justify-center animate-[welcome-item_0.8s_cubic-bezier(0.22,1,0.36,1)_both]">
        <svg width="96" height="96" viewBox="0 0 64 64" fill="none" className="drop-shadow-[0_0_16px_rgba(16,185,129,0.4)]">
          <defs>
            <linearGradient id="gradPenT" x1="32" y1="8" x2="32" y2="56" gradientUnits="userSpaceOnUse">
              <stop stopColor="#42f596" />
              <stop offset="1" stopColor="#0ba36a" />
            </linearGradient>
          </defs>
          <path d="M16 10a4 4 0 0 1 4-4h20l10 10v36a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V10Z" fill="url(#gradPenT)" />
          <path d="M40 6v10h10" fill="#03251d" fillOpacity="0.3" />
          <path d="M40 6v10h10" stroke="#03251d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M24 28h16M24 36h16M24 44h10" stroke="#03251d" strokeWidth="3" strokeLinecap="round" />
          <circle cx="48" cy="46" r="11" fill="#021b16" opacity="0.9" />
          <circle cx="48" cy="46" r="9" stroke="url(#gradPenT)" strokeWidth="2.5" />
          <path d="M44 46l3 3 5-6" stroke="url(#gradPenT)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold bg-linear-to-b from-white via-slate-200 to-slate-500 bg-clip-text text-transparent animate-[welcome-item_0.8s_0.12s_cubic-bezier(0.22,1,0.36,1)_both]">
        Welcome to
      </h1>
      <p className="mt-1 text-lg sm:text-xl font-extrabold tracking-widest bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] animate-[welcome-item_0.8s_0.22s_cubic-bezier(0.22,1,0.36,1)_both]">
        PENALTIES DASHBOARD
      </p>
    </div>
  )
}

export default PenaltiesTransition