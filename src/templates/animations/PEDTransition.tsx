import { useEffect, useState } from 'react'

type Props = {
  onDone: () => void
}

export default function PEDTransition({ onDone }: Props) {
  const [phase, setPhase] = useState<'in' | 'out'>('in')

  useEffect(() => {
    const t = setTimeout(() => setPhase('out'), 1600)
    const t2 = setTimeout(onDone, 2100)
    return () => { clearTimeout(t); clearTimeout(t2) }
  }, [onDone])

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a2018] transition-opacity duration-500 ${
        phase === 'out' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* ✅ Document icon + check badge + glow (Penalties transition jaisa style) */}
      <div className="relative mb-5 sm:mb-6">
        <div aria-hidden="true" className="absolute inset-0 scale-150 rounded-full bg-emerald-400/25 blur-2xl animate-pulse" />
        <svg
          className="relative h-20 w-20 sm:h-24 sm:w-24 drop-shadow-[0_0_28px_rgba(16,185,129,0.55)] animate-[ped-icon-pop_0.7s_ease-out]"
          viewBox="0 0 64 64"
          fill="none"
        >
          <defs>
            <linearGradient id="pedDocGrad" x1="32" y1="6" x2="32" y2="58" gradientUnits="userSpaceOnUse">
              <stop stopColor="#42f596" />
              <stop offset="1" stopColor="#0ba36a" />
            </linearGradient>
          </defs>
          {/* Document body */}
          <path d="M16 8a4 4 0 0 1 4-4h16l12 12v36a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V8Z" fill="url(#pedDocGrad)" />
          <path d="M36 4v12h12" fill="#03251d" fillOpacity="0.3" />
          {/* Document lines */}
          <path d="M24 26h16M24 34h16M24 42h10" stroke="#03251d" strokeWidth="3" strokeLinecap="round" />
          {/* Check badge */}
          <circle cx="46" cy="46" r="11" fill="#0a2018" />
          <circle cx="46" cy="46" r="9" fill="url(#pedDocGrad)" />
          <path d="M42 46l3 3 5-6" stroke="#03251d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* ✅ "Welcome to" — silver running gradient */}
      <div className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
        Welcome to
      </div>

      {/* ✅ "PED DASHBOARD" — emerald running gradient */}
      <div className="mt-2 sm:mt-3 text-xl sm:text-2xl font-extrabold tracking-[0.18em] bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
        PED DASHBOARD
      </div>

      <style>{`
        @keyframes ped-icon-pop {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}