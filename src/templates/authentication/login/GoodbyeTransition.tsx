type GoodbyeTransitionProps = {
  onDone: () => void
}

// Full-screen goodbye screen shown right after logout.
// Unmounts itself only when the fade-out animation fully ends (no flash).
export default function GoodbyeTransition({ onDone }: GoodbyeTransitionProps) {
  return (
    <div
      onAnimationEnd={e => {
        if (e.animationName === 'goodbye-overlay') onDone()
      }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#071b15] animate-[goodbye-overlay_2.6s_ease-in-out_forwards] will-change-opacity"
    >
      {/* Logo */}
      <div className="flex items-center justify-center animate-[welcome-item_0.8s_cubic-bezier(0.22,1,0.36,1)_both]">
        <img
          src="/logos/loginform-logo.png"
          alt="Real Time Operations"
          className="h-24 w-24 sm:h-32 sm:w-32 object-contain animate-[logo-pulse_2.6s_ease-in-out_infinite]"
        />
      </div>

      {/* Good Bye text */}
      <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold bg-linear-to-b from-white via-slate-200 to-slate-500 bg-clip-text text-transparent animate-[welcome-item_0.8s_0.12s_cubic-bezier(0.22,1,0.36,1)_both]">
        Good Bye!
      </h1>

      {/* Brand */}
      <p className="mt-1 text-sm sm:text-base font-bold tracking-widest bg-linear-to-b from-emerald-200 via-emerald-400 to-emerald-700 bg-clip-text text-transparent animate-[welcome-item_0.8s_0.22s_cubic-bezier(0.22,1,0.36,1)_both]">
        SEE YOU SOON
      </p>
    </div>
  )
}