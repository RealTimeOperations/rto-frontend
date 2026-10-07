// ✅ TMO Score — alag module file (PED Dashboard ke "TMO Score" tab se render hoti hai)
//    Future mein TMO Score ka poora logic isi file mein add hoga

export default function TMOscore() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] mt-6">
      <div className="relative mb-6">
        <div aria-hidden="true" className="absolute inset-0 scale-125 rounded-full bg-emerald-400/20 blur-2xl" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
          <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
      </div>
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
        <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">TMO </span>
        <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Score</span>
      </h2>
      <p className="mt-3 sm:mt-4 text-sm sm:text-base text-white/50 max-w-md text-center">
        TMO Score monitoring feature coming soon.
        <br />
        <span className="text-emerald-300/70 font-semibold">Stay tuned…</span>
      </p>
    </div>
  )
}