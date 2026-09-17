import { useEffect } from 'react'

type Props = { onDone: () => void }

export default function AdminTransition({ onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 1400)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[#021b16] pointer-events-none animate-[admin-overlay_1.4s_ease-in-out_forwards]">
      <style>{`
        @keyframes admin-overlay {
          0% { opacity: 0; }
          12% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes admin-shield {
          0% { transform: scale(0.4); opacity: 0; }
          30% { transform: scale(1.15); opacity: 1; }
          55% { transform: scale(1); }
          100% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes admin-ring {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Shield icon with spinning conic ring */}
      <div className="relative h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-full animate-[admin-shield_1.1s_ease-out_forwards]">
        <div className="absolute left-[calc(50%-300px)] top-[calc(50%-300px)] h-[600px] w-[600px] animate-[admin-ring_2.2s_linear_infinite] bg-[conic-gradient(from_0deg,#059669,#34d399,#7acba4,#34d399,#059669)] opacity-70" />
        <div className="absolute inset-[3px] rounded-full bg-[#021d17] flex items-center justify-center">
          <svg
            className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-300 drop-shadow-[0_0_18px_rgba(0,255,170,0.5)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2 20 5v6c0 5.5-3.5 9.5-8 11-4.5-1.5-8-5.5-8-11V5l8-3Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
      </div>

      {/* Running gradient title */}
      <div className="text-lg sm:text-2xl font-extrabold tracking-[0.2em] bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
        ADMIN PORTAL
      </div>
    </div>
  )
}