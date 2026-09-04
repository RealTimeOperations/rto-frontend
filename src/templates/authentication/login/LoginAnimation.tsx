import { useEffect, useState } from 'react'

/* ============================================================
   RTO Login Animation — sequence:
   1) Welcome  2) Attendance  3) Compactor collecting bin  4) Vehicles parade
   ============================================================ */

const STAGES = [
  { id: 'welcome', duration: 2600 },
  { id: 'attendance', duration: 6500 },
  { id: 'container', duration: 10000 },
  { id: 'vehicles', duration: 10000 },
]

const css = `
@keyframes la-scene-in { from { opacity: 0; transform: scale(.985); } to { opacity: 1; transform: scale(1); } }
@keyframes la-scene-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes la-welcome { 0% { opacity: 0; transform: translateY(10px) scale(.94); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
.la-welcome { animation: la-welcome .9s ease both; }
@keyframes la-pop { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
.la-person { opacity: 0; animation: la-pop .5s ease both; }
@keyframes la-flash { 0% { opacity: 0; transform: scale(.5); } 35% { opacity: .95; transform: scale(1); } 100% { opacity: 0; transform: scale(1.3); } }
.la-flash { opacity: 0; animation: la-flash .7s ease both; transform-box: fill-box; transform-origin: center; }
@keyframes la-check { from { opacity: 0; transform: translateY(6px) scale(.6); } to { opacity: 1; transform: translateY(0) scale(1); } }
.la-check { opacity: 0; animation: la-check .45s ease both; transform-box: fill-box; transform-origin: center; }
/* Compactor truck: right se aaye, rukay, right se jaye */
@keyframes la-truck {
  0% { transform: translateX(360px); opacity: 0; }
  6% { opacity: 1; }
  20% { transform: translateX(0); }
  68% { transform: translateX(0); opacity: 1; }
  86% { transform: translateX(430px); opacity: 0; }
  100% { transform: translateX(430px); opacity: 0; }
}
.la-truck { animation: la-truck 10s cubic-bezier(.45,.05,.35,.95) both; }
/* Bin: ground par, phir lift + tilt over hopper, wapas ground, fade out */
@keyframes la-bin {
  0% { opacity: 0; transform: translateY(-16px); }
  8% { opacity: 1; transform: translateY(0); }
  25% { transform: translate(0,0) rotate(0deg); }
  35% { transform: translate(46px,-51px) rotate(115deg); }
  55% { transform: translate(46px,-51px) rotate(115deg); }
  65% { transform: translate(0,0) rotate(0deg); }
  86% { opacity: 1; }
  96%, 100% { opacity: 0; }
}
.la-bin { opacity: 0; animation: la-bin 10s ease-in-out both; transform-box: fill-box; transform-origin: center; }
/* Kachra hopper mein girta hua */
@keyframes la-bit {
  0%, 38% { opacity: 0; transform: translate(0,0); }
  42% { opacity: 1; }
  56% { opacity: 0; transform: translate(-6px,30px); }
  100% { opacity: 0; transform: translate(-6px,30px); }
}
.la-bit { opacity: 0; animation: la-bit 10s linear both; }
/* Vehicles parade */
@keyframes la-drive { 0% { transform: translateX(-220px); opacity: 0; } 5% { opacity: 1; } 92% { opacity: 1; } 100% { transform: translateX(680px); opacity: 0; } }
.la-drive { animation: la-drive 6.5s linear both; }
@keyframes la-spin { to { transform: rotate(360deg); } }
.la-wheel { transform-box: fill-box; transform-origin: center; animation: la-spin 1s linear infinite; }
`

/* ---------- helpers ---------- */

function SceneWrap({ duration, children }: { duration: number; children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        animation: 'la-scene-in .5s ease both, la-scene-out .5s ease both',
        animationDelay: `0s, ${duration - 500}ms`,
      }}
    >
      {children}
    </div>
  )
}

function Wheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g className="la-wheel">
      <circle cx={cx} cy={cy} r={r} fill="#101010" stroke="#888" strokeWidth="2.5" />
      <line x1={cx} y1={cy - r + 3} x2={cx} y2={cy + r - 3} stroke="#888" strokeWidth="2" />
      <line x1={cx - r + 3} y1={cy} x2={cx + r - 3} y2={cy} stroke="#888" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r / 3} fill="#cfcfcf" />
    </g>
  )
}

/* ---------- Scene 1: Welcome ---------- */

function WelcomeScene() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
      <div className="la-welcome text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)]">
        WELCOME
      </div>
      <div className="la-welcome text-[10px] sm:text-xs tracking-[0.3em] text-emerald-300/80 font-semibold" style={{ animationDelay: '.25s' }}>
        REAL TIME OPERATIONS
      </div>
    </div>
  )
}

/* ---------- Scene 2: Attendance ---------- */

function Person({ x, body, delay }: { x: number; body: string; delay: string }) {
  return (
    <g className="la-person" style={{ animationDelay: delay }}>
      <circle cx={x} cy={108} r={9} fill="#7acba4" />
      <rect x={x - 11} y={119} width={22} height={34} rx={8} fill={body} />
      <rect x={x - 8} y={152} width={7} height={17} rx={3} fill="#065f46" />
      <rect x={x + 1} y={152} width={7} height={17} rx={3} fill="#065f46" />
    </g>
  )
}

function AttendanceScene() {
  return (
    <SceneWrap duration={6500}>
      <svg viewBox="0 0 480 200" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <line x1="20" y1="170" x2="460" y2="170" stroke="#10b981" strokeOpacity=".25" strokeWidth="2" />
        {/* Supervisor with mobile */}
        <g className="la-person" style={{ animationDelay: '.1s' }}>
          <circle cx="80" cy="108" r="9" fill="#7acba4" />
          <rect x="69" y="119" width="22" height="34" rx="8" fill="#047857" />
          <rect x="72" y="152" width="7" height="17" rx="3" fill="#065f46" />
          <rect x="81" y="152" width="7" height="17" rx="3" fill="#065f46" />
          <rect x="89" y="124" width="14" height="6" rx="3" fill="#047857" />
          <rect x="101" y="114" width="11" height="18" rx="2.5" fill="#071b15" stroke="#34d399" strokeWidth="1.5" />
          <rect x="103.5" y="117" width="6" height="10" rx="1" fill="#a7f3d0" />
        </g>
        {/* 3 workers */}
        <Person x={250} body="#10b981" delay=".2s" />
        <Person x={330} body="#059669" delay=".3s" />
        <Person x={410} body="#10b981" delay=".4s" />
        {/* Camera flashes */}
        <circle className="la-flash" style={{ animationDelay: '1.2s' }} cx="250" cy="125" r="18" fill="#ffffff" />
        <circle className="la-flash" style={{ animationDelay: '2.5s' }} cx="330" cy="125" r="18" fill="#ffffff" />
        <circle className="la-flash" style={{ animationDelay: '3.8s' }} cx="410" cy="125" r="18" fill="#ffffff" />
        {/* Green checks */}
        <g className="la-check" style={{ animationDelay: '1.7s' }}>
          <circle cx="250" cy="88" r="9" fill="#10b981" />
          <path d="M246 88 l3 3 l6 -6" stroke="#071b15" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g className="la-check" style={{ animationDelay: '3s' }}>
          <circle cx="330" cy="88" r="9" fill="#10b981" />
          <path d="M326 88 l3 3 l6 -6" stroke="#071b15" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g className="la-check" style={{ animationDelay: '4.3s' }}>
          <circle cx="410" cy="88" r="9" fill="#10b981" />
          <path d="M406 88 l3 3 l6 -6" stroke="#071b15" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </SceneWrap>
  )
}

/* ---------- Scene 3: Compactor collecting dustbin container ---------- */

function Dustbin() {
  return (
    <g className="la-bin">
      <rect x="93" y="110" width="56" height="10" rx="3" fill="#2f8c3a" />
      <rect x="97" y="118" width="48" height="50" rx="5" fill="#3fae49" />
      <line x1="109" y1="124" x2="109" y2="162" stroke="#2f8c3a" strokeWidth="3" />
      <line x1="121" y1="124" x2="121" y2="162" stroke="#2f8c3a" strokeWidth="3" />
      <line x1="133" y1="124" x2="133" y2="162" stroke="#2f8c3a" strokeWidth="3" />
      <circle cx="107" cy="168" r="6" fill="#111" stroke="#7acba4" strokeWidth="2" />
      <circle cx="135" cy="168" r="6" fill="#111" stroke="#7acba4" strokeWidth="2" />
    </g>
  )
}

function CompactorTruck() {
  return (
    <g className="la-truck">
      {/* rear loading hopper (back side) */}
      <path d="M152 100 L180 100 L180 150 L158 150 Z" fill="#1f7a33" />
      {/* green body */}
      <rect x="178" y="92" width="142" height="58" rx="6" fill="#3fae49" />
      {/* white panel + branding strips */}
      <rect x="190" y="100" width="86" height="42" rx="4" fill="#f5f5f5" />
      <rect x="196" y="106" width="42" height="8" rx="2" fill="#2f8c3a" />
      <rect x="196" y="120" width="58" height="13" rx="3" fill="#d32f2f" />
      <circle cx="264" cy="112" r="7" fill="#2f8c3a" />
      {/* white cab */}
      <path d="M320 108 L352 108 L368 126 L368 150 L320 150 Z" fill="#e8e8e8" />
      <path d="M326 114 L348 114 L358 126 L326 126 Z" fill="#90a4ae" />
      <rect x="320" y="140" width="48" height="10" rx="3" fill="#bdbdbd" />
      <Wheel cx={200} cy={158} r={12} />
      <Wheel cx={248} cy={158} r={12} />
      <Wheel cx={344} cy={158} r={12} />
    </g>
  )
}

function ContainerScene() {
  return (
    <SceneWrap duration={10000}>
      <svg viewBox="0 0 480 200" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <line x1="20" y1="170" x2="460" y2="170" stroke="#10b981" strokeOpacity=".25" strokeWidth="2" />
        <CompactorTruck />
        <Dustbin />
        {/* waste falling into the hopper while bin is tilted */}
        <circle className="la-bit" cx="170" cy="96" r="3.5" fill="#8d6e63" />
        <circle className="la-bit" style={{ animationDelay: '.5s' }} cx="176" cy="92" r="3" fill="#a1887f" />
        <circle className="la-bit" style={{ animationDelay: '1s' }} cx="166" cy="90" r="2.5" fill="#6d4c41" />
      </svg>
    </SceneWrap>
  )
}

/* ---------- Scene 4: Vehicles parade (loader rickshaw, arm roller, dumper) ---------- */

function LoaderRickshaw() {
  return (
    <g>
      {/* canopy roof + supports + windshield */}
      <rect x="56" y="58" width="72" height="7" rx="3.5" fill="#2f8c3a" />
      <line x1="64" y1="65" x2="70" y2="110" stroke="#151515" strokeWidth="3" />
      <line x1="120" y1="65" x2="106" y2="110" stroke="#151515" strokeWidth="3" />
      <path d="M100 70 L114 70 L108 102 L98 102 Z" fill="#cfd8dc" opacity=".65" />
      {/* cargo bed with railings */}
      <rect x="0" y="110" width="74" height="36" rx="4" fill="#3fae49" />
      <rect x="0" y="102" width="74" height="8" rx="3" fill="#2f8c3a" />
      <line x1="12" y1="102" x2="12" y2="110" stroke="#2f8c3a" strokeWidth="3" />
      <line x1="37" y1="102" x2="37" y2="110" stroke="#2f8c3a" strokeWidth="3" />
      <line x1="62" y1="102" x2="62" y2="110" stroke="#2f8c3a" strokeWidth="3" />
      {/* seat + handlebar */}
      <rect x="76" y="110" width="24" height="9" rx="3" fill="#1c1c1c" />
      <line x1="102" y1="110" x2="114" y2="104" stroke="#151515" strokeWidth="3" />
      {/* front body + headlight + fork */}
      <path d="M98 116 L112 116 L120 136 L100 146 Z" fill="#3fae49" />
      <circle cx="117" cy="130" r="5" fill="#fff8e1" stroke="#c9c9c9" strokeWidth="1.5" />
      <line x1="117" y1="136" x2="122" y2="156" stroke="#666" strokeWidth="4" />
      <Wheel cx={24} cy={158} r={12} />
      <Wheel cx={122} cy={158} r={12} />
    </g>
  )
}

function ArmRoller() {
  return (
    <g>
      {/* yellow arm-roll container */}
      <path d="M0 96 L92 96 L88 140 L4 140 Z" fill="#f2b21b" />
      <line x1="18" y1="100" x2="16" y2="136" stroke="#d19612" strokeWidth="4" />
      <line x1="40" y1="100" x2="39" y2="136" stroke="#d19612" strokeWidth="4" />
      <line x1="62" y1="100" x2="61" y2="136" stroke="#d19612" strokeWidth="4" />
      <rect x="20" y="108" width="44" height="14" rx="2" fill="#111" opacity=".85" />
      {/* arm hook + chassis */}
      <path d="M92 132 L104 132 L104 146 L92 146" fill="none" stroke="#151515" strokeWidth="5" />
      <rect x="0" y="140" width="150" height="10" rx="3" fill="#1c1c1c" />
      {/* white cab */}
      <path d="M104 104 L136 104 L148 122 L148 150 L104 150 Z" fill="#e8e8e8" />
      <path d="M110 110 L132 110 L140 122 L110 122 Z" fill="#90a4ae" />
      <Wheel cx={26} cy={158} r={12} />
      <Wheel cx={64} cy={158} r={12} />
      <Wheel cx={128} cy={158} r={12} />
    </g>
  )
}

function Dumper() {
  return (
    <g>
      {/* grey dump bed */}
      <path d="M0 92 L98 88 L98 140 L6 140 Z" fill="#cfd4d8" />
      <line x1="20" y1="94" x2="20" y2="138" stroke="#b4bac0" strokeWidth="4" />
      <line x1="44" y1="93" x2="44" y2="138" stroke="#b4bac0" strokeWidth="4" />
      <line x1="68" y1="92" x2="68" y2="138" stroke="#b4bac0" strokeWidth="4" />
      <path d="M0 84 L20 84 L14 92 L0 92 Z" fill="#b4bac0" />
      {/* chassis */}
      <rect x="0" y="140" width="158" height="10" rx="3" fill="#1c1c1c" />
      {/* white cab */}
      <path d="M104 98 L140 98 L154 120 L154 150 L104 150 Z" fill="#e8e8e8" />
      <path d="M110 104 L136 104 L146 120 L110 120 Z" fill="#546e7a" />
      <rect x="146" y="128" width="8" height="12" rx="2" fill="#37474f" />
      <Wheel cx={24} cy={158} r={12} />
      <Wheel cx={58} cy={158} r={12} />
      <Wheel cx={132} cy={158} r={12} />
    </g>
  )
}

function VehiclesScene() {
  return (
    <SceneWrap duration={10000}>
      <svg viewBox="0 0 480 200" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <line x1="0" y1="170" x2="480" y2="170" stroke="#10b981" strokeOpacity=".25" strokeWidth="2" />
        <g className="la-drive" style={{ animationDelay: '0.2s' }}>
          <LoaderRickshaw />
        </g>
        <g className="la-drive" style={{ animationDelay: '1.6s' }}>
          <ArmRoller />
        </g>
        <g className="la-drive" style={{ animationDelay: '3s' }}>
          <Dumper />
        </g>
      </svg>
    </SceneWrap>
  )
}

/* ---------- Main component ---------- */

export default function LoginAnimation() {
  const [stage, setStage] = useState(0)
  const [cycle, setCycle] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => {
      if (stage === STAGES.length - 1) {
        setCycle(c => c + 1)
        setStage(0)
      } else {
        setStage(s => s + 1)
      }
    }, STAGES[stage].duration)
    return () => clearTimeout(t)
  }, [stage, cycle])

  return (
    <div className="relative w-full h-full overflow-hidden">
      <style>{css}</style>
      {stage === 0 && <WelcomeScene key={`w${cycle}`} />}
      {stage === 1 && <AttendanceScene key={`a${cycle}`} />}
      {stage === 2 && <ContainerScene key={`c${cycle}`} />}
      {stage === 3 && <VehiclesScene key={`v${cycle}`} />}
    </div>
  )
}