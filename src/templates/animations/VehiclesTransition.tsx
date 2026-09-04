type Props = {
  onDone: () => void
}

export default function VehiclesTransition({ onDone }: Props) {
  return (
    <div
      onAnimationEnd={e => {
        if (e.animationName === 'welcome-overlay') onDone()
      }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#071b15] animate-[welcome-overlay_2.6s_ease-in-out_forwards]"
    >
      {/* Vehicle icon (filled green gradient) */}
      <div className="flex items-center justify-center animate-[welcome-item_0.8s_cubic-bezier(0.22,1,0.36,1)_both]">
        <svg width="96" height="96" viewBox="0 0 64 64" fill="none" className="drop-shadow-[0_0_16px_rgba(16,185,129,0.4)]">
          <defs>
            <linearGradient id="gradTruckT" x1="32" y1="10" x2="32" y2="52" gradientUnits="userSpaceOnUse">
              <stop stopColor="#42f596" />
              <stop offset="1" stopColor="#0ba36a" />
            </linearGradient>
          </defs>
          <rect x="2" y="34" width="6" height="5" rx="2" fill="url(#gradTruckT)" />
          <rect x="7" y="12" width="31" height="28" rx="3" fill="url(#gradTruckT)" />
          <path d="M40 20h9l9 10v10H40Z" fill="url(#gradTruckT)" />
          <path d="M43 24h5.5l5 6H43Z" fill="#03251d" />
          <circle cx="16" cy="44" r="5.5" fill="#03251d" />
          <circle cx="16" cy="44" r="2.2" fill="url(#gradTruckT)" />
          <circle cx="42" cy="44" r="5.5" fill="#03251d" />
          <circle cx="42" cy="44" r="2.2" fill="url(#gradTruckT)" />
          <circle cx="50" cy="46" r="11" fill="#021b16" opacity="0.9" />
          <circle cx="50" cy="46" r="9" stroke="url(#gradTruckT)" strokeWidth="2.5" />
          <path d="M50 33.5v5.5M50 53v5.5M37.5 46H43M57 46h5.5" stroke="url(#gradTruckT)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="50" cy="46" r="5.5" stroke="url(#gradTruckT)" strokeWidth="1.5" />
          <circle cx="50" cy="46" r="3" fill="url(#gradTruckT)" />
        </svg>
      </div>

      <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold bg-linear-to-b from-white via-slate-200 to-slate-500 bg-clip-text text-transparent animate-[welcome-item_0.8s_0.12s_cubic-bezier(0.22,1,0.36,1)_both]">
        Welcome to
      </h1>
      <p className="mt-1 text-lg sm:text-xl font-extrabold tracking-widest bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] animate-[welcome-item_0.8s_0.22s_cubic-bezier(0.22,1,0.36,1)_both]">
        VEHICLES DASHBOARD
      </p>
    </div>
  )
}