import { useNavigate } from 'react-router-dom'

type Props = {
  onHomeClick?: () => void
}

export default function AttendanceDashboard({ onHomeClick }: Props) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#021b16] text-white relative">
      {/* Top-left: Home button */}
      <button
        onClick={() => {
          onHomeClick?.()
          navigate('/home')
        }}
        aria-label="Back to Home"
        className="fixed top-5 left-5 sm:top-6 sm:left-6 z-30 flex items-center gap-2 rounded-full border border-emerald-400/30 bg-[#071b15]/80 px-4 py-2.5 text-sm font-semibold text-emerald-200 shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 hover:bg-emerald-500/15 hover:border-emerald-400/60 hover:shadow-[0_0_25px_rgba(0,255,170,0.25)]"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        Home
      </button>

      {/* Main content */}
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
            Welcome to Attendance Dashboard
          </h1>
          <p className="mt-4 text-white/60 text-sm">Real-time attendance monitoring system</p>
        </div>
      </div>
    </div>
  )
}