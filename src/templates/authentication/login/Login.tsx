import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabase'
import LoginAnimation from './LoginAnimation'

type LoginProps = {
  kickReason?: 'inactive' | 'password' | null
  onKicked?: (reason: 'inactive' | 'password') => void
  onLoginStart: () => void
  onLoginSuccess: () => void
  onLoginFail: () => void
}

// ✅ Device fingerprint — sirf hardware/OS level traits (sab browsers mein SAME rehta hai)
function deviceFingerprint(): string {
  const s = window.screen
  const traits = [
    s.width, s.height, s.availWidth, s.availHeight, s.colorDepth, s.pixelDepth,
    window.devicePixelRatio || 1,
    navigator.platform || 'na',
    navigator.hardwareConcurrency || 0,
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'na',
  ]
  const raw = traits.join('|')
  let h = 5381
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0
  return 'dev-' + h.toString(16)
}

// ✅ Device label for display (browser + OS)
function deviceLabel(): string {
  const ua = navigator.userAgent
  let browser = 'Unknown Browser'
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/OPR\//.test(ua)) browser = 'Opera'
  else if (/Chrome\//.test(ua)) browser = 'Chrome'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Safari\//.test(ua)) browser = 'Safari'
  let os = 'Unknown OS'
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11'
  else if (/Windows/.test(ua)) os = 'Windows'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS'
  else if (/Mac OS X/.test(ua)) os = 'macOS'
  else if (/Linux/.test(ua)) os = 'Linux'
  return `${browser} on ${os}`
}

// ✅ Best-effort private/incognito detection
async function detectPrivateMode(): Promise<boolean> {
  try {
    try {
      localStorage.setItem('__rto_test', '1')
      localStorage.removeItem('__rto_test')
    } catch {
      return true
    }
    if (navigator.storage && typeof navigator.storage.estimate === 'function') {
      const est = await navigator.storage.estimate()
      const quota = est.quota ?? 0
      if (quota > 0 && quota < 150 * 1024 * 1024) return true
    }
    return false
  } catch {
    return false
  }
}

// ✅ Location from IP (best effort)
async function fetchLocation(): Promise<string> {
  try {
    const res = await fetch('https://ipapi.co/json/')
    if (!res.ok) return 'Unknown'
    const j = await res.json()
    return [j.city, j.region, j.country_name].filter(Boolean).join(', ') || 'Unknown'
  } catch {
    return 'Unknown'
  }
}

// ✅ GPS location — supervisor ke liye MANDATORY (deny = no login)
function getGpsLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('unsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )
  })
}

// ✅ GPS coordinates ko human-readable address mein badlo
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`)
    if (!res.ok) return 'Unknown area'
    const j = await res.json()
    const parts = [j.city || j.locality, j.principalSubdivision, j.countryName].filter(Boolean)
    return parts.length ? parts.join(', ') : 'Unknown area'
  } catch {
    return 'Unknown area'
  }
}

export default function Login({ kickReason, onKicked, onLoginStart, onLoginSuccess, onLoginFail }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // ✅ Mobile par scroll position top par force karein (page load par)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // ✅ Detect CNIC format (13 digits or 5-7-1 format)
  function isCnicFormat(s: string): boolean {
    const clean = s.replace(/-/g, '')
    if (/^\d{13}$/.test(clean)) return true
    if (/^\d{5}-\d{7}-\d{1}$/.test(s)) return true
    return false
  }

  // Handle login: Email+Password (admin/employee) OR CNIC+Password (supervisor)
  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    onLoginStart()

    const identifier = email.trim()
    // Normalize CNIC to 5-7-1 format if 13 digits typed
    let input = identifier
    if (isCnicFormat(identifier)) {
      const cleanCnic = identifier.replace(/-/g, '')
      input = `${cleanCnic.slice(0,5)}-${cleanCnic.slice(5,12)}-${cleanCnic.slice(12)}`
    }
    // ✅ Supervisor device binding check (session banne se PEHLE)
    const deviceId = deviceFingerprint()
    const isPrivate = await detectPrivateMode()
    const { data: devCheck } = await supabase.rpc('check_supervisor_device', {
      p_identifier: input,
      p_device_id: deviceId,
      p_is_private: isPrivate,
    })
    if (devCheck === 'blocked_private') {
      onLoginFail()
      setError('Private/Incognito mode is not allowed. Please use a normal browser window.')
      setLoading(false)
      return
    }
    if (devCheck === 'blocked_device') {
      onLoginFail()
      setError('This account is bound to another device. Please contact administrator.')
      setLoading(false)
      return
    }

    // ✅ Supervisor ke liye GPS location MANDATORY — deny = login blocked
    let gps: { lat: number; lon: number } | null = null
    if (devCheck === 'ok_bind' || devCheck === 'ok_supervisor') {
      try {
        gps = await getGpsLocation()
      } catch {
        onLoginFail()
        setError('Location is required for supervisor login. Please enable location permission in your browser/device and try again.')
        setLoading(false)
        return
      }
    }

    // Resolve identifier (email or CNIC) to auth email — username login disabled
    const { data: resolved, error: resolveErr } = await supabase.rpc('resolve_login_email', { p_input: input })
    if (resolveErr || !resolved) {
      onLoginFail()
      setError('No active account found for this email or CNIC')
      setLoading(false)
      return
    }
    const loginEmail = resolved as string

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (error) {
      onLoginFail()
      setError('Invalid username or password')
      setLoading(false)
      return
    }

    const { data: roleData } = await supabase.rpc('get_my_role')
    const role = (roleData as string | null) ?? null

    if (!role) {
      await supabase.auth.signOut()
      onLoginFail()
      setError('You do not have access')
      setLoading(false)
      return
    }

    // Block inactive users at login (admin excepted)
    const { data: prof } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', data.user.id)
      .maybeSingle()
    if (prof?.status === 'inactive' && role !== 'admin') {
      await supabase.auth.signOut()
      onLoginFail()
      // Single banner: App kick state use karo, duplicate error banner nahi
      onKicked?.('inactive')
      setLoading(false)
      return
    } 
    // ✅ Supervisor: device bind + session start + GPS location record
    if (role === 'supervisor') {
      let location = 'Unknown'
      if (gps) {
        const addr = await reverseGeocode(gps.lat, gps.lon)
        location = `${addr} (GPS: ${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)})`
      } else {
        location = await fetchLocation()
      }
      await supabase.rpc('bind_supervisor_device', {
        p_device_id: deviceId,
        p_device_name: deviceLabel(),
        p_location: location,
        p_coordinates: gps ? `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}` : null,
      })
    }

    localStorage.setItem('rto_role_' + data.user.id, role)
    onLoginSuccess()

    setLoading(false)
    }

  const features = [
    {
      title1: 'ATTENDANCE',
      desc: 'Track and manage real-time attendance with accuracy.',
      icon: <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z" />,
      line: 'bg-emerald-400/70 shadow-[0_0_12px_2px_rgba(16,185,129,0.7)]',
      run: 'bg-[linear-gradient(90deg,transparent,#d1fae5,transparent)]',
    },
    {
      title1: 'VEHICLES',
      desc: 'Monitor vehicle locations and status in real-time.',
      icon: (
        <>
          <path d="M1 5h13v11H1z" />
          <path d="M14 8h4.6L22 11.6V16h-8z" />
          {/* Rear wheel: tread + rim + hub */}
          <circle cx="6" cy="17.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.3 0.9" />
          <circle cx="6" cy="17.5" r="1.5" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="6" cy="17.5" r="0.7" />
          {/* Front wheel: tread + rim + hub */}
          <circle cx="17.5" cy="17.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.3 0.9" />
          <circle cx="17.5" cy="17.5" r="1.5" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="17.5" cy="17.5" r="0.7" />
        </>
      ),
      line: 'bg-emerald-400/70 shadow-[0_0_12px_2px_rgba(16,185,129,0.7)]',
      run: 'bg-[linear-gradient(90deg,transparent,#d1fae5,transparent)]',
    },
    {
      title1: 'CONTAINERS',
      desc: 'Track dustbin container status and collections efficiently.',
      icon: (
        <>
          <path d="M9 2h6l1 2h5v2H3V4h5z" />
          <path d="M5 7h14l-1.2 15H6.2z" />
        </>
      ),
      line: 'bg-lime-400/70 shadow-[0_0_12px_2px_rgba(163,230,53,0.7)]',
      run: 'bg-[linear-gradient(90deg,transparent,#fef9c3,transparent)]',
    },
  ]

  return (
    <div className="login-page relative h-[100dvh] lg:h-screen overflow-x-hidden overflow-y-auto lg:overflow-hidden bg-[#071b15]">
      {/* Background image — mobile par hide */}
      <div
        className="hidden sm:block absolute inset-0 bg-no-repeat pointer-events-none"
        style={{ backgroundImage: 'url(/loginpagebackground.png)', backgroundSize: '100% 100%' }}
      />

      {/* Content */}
      <div className="login-content relative z-10 flex min-h-[100dvh] lg:h-full lg:min-h-0 flex-col px-4 sm:px-6 pt-2 pb-3 lg:px-10 lg:pt-3 lg:pb-3">
        {/* Header — mobile: 2 logos | desktop: full header */}
        <header className="login-header flex md:grid grid-cols-[1fr_auto_1fr] items-center justify-between gap-4 pt-2 md:pt-3 lg:pt-4">
          {/* Left: Zakwan logo */}
          <div className="flex items-center">
            <img
              src="/logos/zakwan-logo.png"
              alt="Zakwan Builders & Developers"
              className="h-16 sm:h-20 md:h-24 lg:h-36 xl:h-40 2xl:h-44 w-auto object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,0.45)] animate-[logo-zoom_4s_ease-in-out_infinite]"
            />
          </div>

          {/* Center — desktop only: the two green separator lines stay beside the center heading */}
          <div className="hidden md:flex items-center justify-center gap-4 lg:gap-5 mt-1 lg:mt-2">
            <div className="hidden md:block h-12 lg:h-14 w-px bg-[linear-gradient(180deg,#059669,#7acba4,#059669)] bg-[length:100%_200%] animate-[text-run-vertical_2.5s_linear_infinite]" />
            <div className="flex items-center gap-3">
              <img src="/logos/loginform-logo.png" alt="Real Time Operations" className="h-12 md:h-14 xl:h-16 2xl:h-[72px] w-auto object-contain animate-[logo-pulse_4s_ease-in-out_infinite]" />
              <div>
                <div className="text-lg xl:text-xl font-extrabold tracking-wider leading-tight bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">REAL TIME</div>
                <div className="inline-block">
                  <div className="text-lg xl:text-xl font-extrabold tracking-[0.15em] leading-tight bg-[linear-gradient(180deg,#059669,#10b981,#34d399,#10b981,#059669)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">OPERATIONS</div>
                  <div className="flex justify-between w-full text-[9px] xl:text-[10px] tracking-widest text-slate-300 mt-1">
                    <span>MONITOR</span>
                    <span>•</span>
                    <span>TRACK</span>
                    <span>•</span>
                    <span>OPTIMIZE</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden md:block h-12 lg:h-14 w-px bg-[linear-gradient(180deg,#059669,#7acba4,#059669)] bg-[length:100%_200%] animate-[text-run-vertical_2.5s_linear_infinite]" />
          </div>

          {/* Right: Suthra logo */}
          <div className="flex items-center justify-end">
            <img
              src="/logos/suthra-logo.png"
              alt="Suthra Punjab Authority"
              className="h-20 sm:h-24 md:h-32 lg:h-44 xl:h-48 2xl:h-52 w-auto object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,0.45)] animate-[logo-zoom_4s_ease-in-out_infinite]"
            />
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 lg:min-h-0 flex flex-col lg:flex-row items-center lg:items-stretch justify-start lg:justify-start gap-3 lg:gap-4 xl:gap-8 pt-2 lg:pt-4 pb-2 lg:pb-0 overflow-visible lg:overflow-hidden login-main">
          {/* Left hero — mobile par hide */}
          <section className="hidden lg:flex flex-1 min-w-0 min-h-0 flex-col lg:pl-2 xl:pl-10 login-left">
            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold leading-tight">
              <span className="bg-[linear-gradient(180deg,#64748b,#94a3b8,#cbd5e1,#94a3b8,#64748b)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">REAL TIME</span>
              <br />
              <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">OPERATIONS</span>
            </h1>
            <p className="text-slate-300 text-sm xl:text-base mt-3 max-w-md">
              Smart Monitoring System for Attendance, Vehicles
              <br />
              <span className="text-emerald-400 font-semibold inline-block pb-3 border-b-4 border-emerald-400">
                & Containers for Tehsil Haroonabad
              </span>
            </p>
            {/* Feature cards — design match */}
            <div className="grid grid-cols-3 gap-2 xl:gap-4 mt-6 xl:mt-8 w-full max-w-4xl login-features">
              {features.map(f => (
                <div
                  key={f.title1}
                  className="relative overflow-hidden rounded-2xl border border-emerald-400/15 bg-linear-to-br from-[#0c2b23] to-[#081f19] p-2.5 xl:p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                >
                  {/* Dot grid top-right — running colors */}
                  <div className="absolute top-2 right-2 h-6 w-6 xl:top-4 xl:right-4 xl:h-[34px] xl:w-[34px] opacity-60 bg-[linear-gradient(135deg,#059669_0%,#059669_40%,#ffffff_50%,#059669_60%,#059669_100%)] bg-[length:300%_300%] animate-[text-run-diagonal_2.5s_linear_infinite] [mask-image:radial-gradient(circle,#000_2px,transparent_2px)] [mask-size:10px_10px]" />
                  {/* Faint arc */}
                  <div className="absolute -right-10 top-10 h-40 w-40 rounded-full border border-emerald-400/10" />
                  {/* Hexagon + title side by side */}
                  <div className="flex items-center">
                    <div className="relative h-10 w-10 xl:h-14 xl:w-14 shrink-0">
                      <svg className="absolute inset-0 h-full w-full text-emerald-400/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.6">
                        <path d="M12 1.5l9 5.25v10.5L12 22.5l-9-5.25V6.75z" />
                      </svg>
                      <svg className="absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]" viewBox="0 0 24 24" fill="rgba(0,0,0,0.45)" stroke="currentColor" strokeWidth="0.8">
                        <path d="M12 1.5l9 5.25v10.5L12 22.5l-9-5.25V6.75z" />
                      </svg>
                      <svg className="absolute inset-0 m-auto h-4 w-4 xl:h-5 xl:w-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                        {f.icon}
                      </svg>
                    </div>
                    <div className="ml-0.5 h-px w-3 xl:w-6 bg-emerald-400/60" />
                    <span className="mr-1.5 xl:mr-2 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
                    <div className="min-w-0">
                      <div className="text-[10px] xl:text-sm font-extrabold tracking-wide leading-snug bg-linear-to-b from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">{f.title1}</div>
                      <div className="text-[10px] xl:text-sm font-extrabold tracking-wide leading-snug bg-linear-to-b from-emerald-200 via-emerald-400 to-emerald-700 bg-clip-text text-transparent">MONITORING</div>
                    </div>
                  </div>

                  {/* Bottom line: static glow (inner shadow) + running highlight */}
                  <div className={`absolute bottom-0 left-0 right-0 h-px ${f.line}`} />
                  <div className="absolute bottom-0 left-0 right-0 h-px overflow-hidden">
                    <div className={`absolute inset-0 ${f.run} bg-[length:40%_100%] bg-no-repeat animate-[line-run_2.5s_linear_infinite]`} />
                  </div>
                </div>
              ))}
            </div>

            {/* Animation container — running border, bottom form ke sath aligned */}
            <div className="relative w-full max-w-4xl mt-3 xl:mt-4 flex-1 min-h-0 max-h-[140px] xl:max-h-[200px] rounded-[26px] overflow-hidden shadow-[0_0_18px_rgba(16,185,129,0.18)] login-animation">
              <div className="absolute left-[calc(50%-600px)] top-[calc(50%-600px)] h-[1200px] w-[1200px] animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#059669,#34d399,#7acba4,#34d399,#059669)] opacity-60" />  
              <div className="absolute inset-0.5 rounded-3xl bg-[#071b15]" />
              <div className="absolute inset-0.5 rounded-3xl overflow-hidden">
                <LoginAnimation />
              </div>
            </div>
          </section>

          {/* Mobile: heading + form | Desktop: sirf form */}
          <section className="login-form-section w-full max-w-sm shrink-0 lg:max-w-[340px] xl:max-w-sm lg:flex lg:flex-col lg:justify-start">
            {/* Mobile heading — desktop par hide */}
            <div className="lg:hidden flex flex-col items-center justify-center mb-3">
              {/* ✅ Circle icon with running border (login form ke top wala icon) */}
              <div className="relative h-12 w-12 sm:h-16 sm:w-16 mb-2 rounded-full overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <div className="absolute -inset-full animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#059669,#34d399,#7acba4,#34d399,#059669)] opacity-60" />
                <div className="absolute inset-0.5 rounded-full bg-[#071b15] flex items-center justify-center">
                  <img src="/logos/loginform-logo.png" alt="Real Time Operations" className="h-7 w-7 sm:h-9 sm:w-9 object-contain animate-[logo-pulse_4s_ease-in-out_infinite]" />
                </div>
              </div>
              <h1 className="whitespace-nowrap tracking-tight text-[clamp(0.95rem,5.8vw,2.25rem)] font-extrabold leading-tight text-center">
                <span className="bg-[linear-gradient(180deg,#64748b,#94a3b8,#cbd5e1,#94a3b8,#64748b)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">REAL TIME</span>
                <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]"> OPERATIONS</span>
              </h1>
              <p className="text-emerald-400 font-semibold text-xs sm:text-sm mt-1.5 pb-1.5 border-b-2 border-emerald-400">
                Tehsil Haroonabad
              </p>
            </div>
            <div className="relative w-full rounded-[26px] overflow-hidden shadow-[0_0_18px_rgba(16,185,129,0.18)] mt-2 mb-1 lg:mt-0 lg:mb-0">
              <div className="absolute -inset-full animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#059669,#34d399,#7acba4,#34d399,#059669)] opacity-60" />

              <form
                onSubmit={handleLogin}
                autoComplete="off"
                className="relative m-0.5 rounded-3xl bg-[#071b15] p-6 sm:p-7 lg:p-8 shadow-[inset_0_4px_8px_rgba(255,255,255,0.12),inset_0_-6px_12px_rgba(0,0,0,0.65),inset_4px_0_8px_rgba(255,255,255,0.05),inset_-4px_0_8px_rgba(0,0,0,0.4)]"
              >
                {/* Circle with running border — mobile par hide (heading wala icon kaafi hai) */}
                <div className="hidden lg:block relative h-24 w-24 mx-auto mb-4 rounded-full overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                  <div className="absolute -inset-full animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#059669,#34d399,#7acba4,#34d399,#059669)] opacity-60" />
                  <div className="absolute inset-0.5 rounded-full bg-[#071b15] flex items-center justify-center">
                    <img src="/logos/loginform-logo.png" alt="Real Time Operations" className="h-16 w-16 object-contain animate-[logo-pulse_4s_ease-in-out_infinite]" />
                  </div>
                </div>

                <h2 className="text-center text-xl lg:text-2xl font-bold mb-1 bg-linear-to-b from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">Welcome Back!</h2>
                <p className="text-center text-[11px] lg:text-xs text-white/55 mb-5 lg:mb-7">Login to continue to Real Time Operations</p>

            {kickReason === 'inactive' && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded-xl mb-4 text-center">
                You are inactive. Please contact administrator.
              </div>
            )}
            {kickReason === 'password' && (
              <div className="bg-amber-500/10 border border-amber-500/40 text-amber-300 text-sm p-3 rounded-xl mb-4 text-center">
                Your session ended because your password was changed by administrator. Please login again.
              </div>
            )}
            {error && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded-xl mb-4 text-center">
                {error}
              </div>
            )}

                <div className="mb-3 lg:mb-4">
                  <label className="block text-xs font-semibold mb-1.5 bg-linear-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Email / CNIC</label>
                  <div className="relative rounded-xl overflow-hidden">
                    <div className="absolute left-[calc(50%-600px)] top-[calc(50%-600px)] h-[1200px] w-[1200px] animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#10b981,#34d399,#7acba4,#34d399,#10b981)] opacity-60" />
                    <div className="relative m-[1.5px] rounded-[11px] bg-[#071b15]">
                      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <input
                        type="text"
                        required
                        autoComplete="off"
                        placeholder="admin@email.com or 31104-1234567-8"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full h-12 pl-10 pr-4 bg-transparent rounded-[11px] text-white text-sm outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-white/40 text-[10px] mt-1">Admin/Employee: Email  •  Supervisor: CNIC</p>
                </div>

                <div className="mb-4 lg:mb-5">
                  <label className="block text-xs font-semibold mb-1.5 bg-linear-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Password</label>
                  <div className="relative rounded-xl overflow-hidden">
                    <div className="absolute left-[calc(50%-600px)] top-[calc(50%-600px)] h-[1200px] w-[1200px] animate-[border-spin_8s_linear_infinite] bg-[conic-gradient(from_0deg,#10b981,#34d399,#7acba4,#34d399,#10b981)] opacity-60" />
                    <div className="relative m-[1.5px] rounded-[11px] bg-[#071b15]">
                      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full h-12 pl-10 pr-11 bg-transparent rounded-[11px] text-white text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition animate-[eye-run_3s_linear_infinite]"
                      >
                        {showPassword ? (
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="running-button w-full h-12 mt-2 rounded-full text-white text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                >
                  {loading ? 'Logging in…' : 'Login'}
                  {!loading && (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  )}
                </button>
              </form>
            </div>
          </section>
        </main>
      </div>


        {/* Desktop-only responsive layout. Mobile/tablet styles above remain unchanged. */}
        <style>{`
          /* =========================================================
             BASE DESKTOP / LCD RESPONSIVE LAYOUT
             ========================================================= */
          @media (min-width: 1024px) {
            .login-page {
              overflow: hidden !important;
            }

            .login-content {
              box-sizing: border-box;
              height: 100%;
              min-height: 0 !important;
              padding-left: clamp(28px, 3.5vw, 78px) !important;
              padding-right: clamp(28px, 3.5vw, 78px) !important;
              padding-top: clamp(8px, 1.2vh, 16px) !important;
              padding-bottom: clamp(8px, 1vh, 14px) !important;
            }

            /* TOP HEADER
               Logos grow with the display instead of staying tiny. */
            .login-header {
              flex: 0 0 clamp(92px, 13vh, 150px);
              min-height: clamp(92px, 13vh, 150px);
              padding-top: clamp(10px, 1.8vh, 22px) !important;
              width: 100%;
              gap: clamp(14px, 2vw, 42px) !important;
            }

            .login-header > div:first-child img {
              height: clamp(72px, 11.5vh, 150px) !important;
              width: auto;
              max-width: clamp(150px, 13vw, 235px);
            }

            .login-header > div:nth-child(2) {
              margin-top: clamp(2px, 0.5vh, 8px) !important;
            }

            .login-header > div:nth-child(2) img {
              height: clamp(52px, 6.8vh, 78px) !important;
            }

            .login-header > div:last-child img {
              height: clamp(82px, 12.8vh, 165px) !important;
              width: auto;
              max-width: clamp(82px, 8.5vw, 155px);
            }

            /* Center heading + its two green separator lines stay together. */
            .login-header > div:nth-child(2) > div:first-child {
              height: clamp(52px, 6.8vh, 78px) !important;
            }

            .login-header > div:nth-child(2) > div:nth-child(2) {
              min-width: max-content;
            }

            /* MAIN AREA
               Both columns share the same bottom edge. */
            .login-main {
              flex: 1 1 auto !important;
              min-height: 0 !important;
              width: 100% !important;
              display: grid !important;
              grid-template-columns: minmax(0, 1fr) clamp(340px, 22vw, 430px) !important;
              align-items: stretch !important;
              column-gap: clamp(28px, 5vw, 100px) !important;
              row-gap: 0 !important;
              padding-top: clamp(4px, 0.8vh, 10px) !important;
              padding-bottom: clamp(16px, 3vh, 40px) !important;
              align-content: end !important;
              overflow: hidden !important;
            }

            /* LEFT COLUMN */
            .login-left {
              min-width: 0 !important;
              min-height: 0 !important;
              width: 100% !important;
              max-width: none !important;
              padding-left: 0 !important;
              padding-right: 0 !important;
              justify-content: space-between !important;
              align-self: stretch !important;
            }

            .login-left > h1 {
              font-size: clamp(2rem, 3.15vw, 3.7rem) !important;
              line-height: 1.05 !important;
              flex-shrink: 0;
            }

            .login-left > p {
              font-size: clamp(12px, 0.82vw, 16px) !important;
              line-height: 1.45 !important;
              margin-top: clamp(10px, 1.8vh, 22px) !important;
              max-width: clamp(360px, 31vw, 530px) !important;
              flex-shrink: 0;
            }

            .login-features {
              width: 88% !important;
              max-width: none !important;
              grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
              gap: clamp(7px, 0.9vw, 17px) !important;
              margin-top: clamp(24px, 3.4vh, 46px) !important;
              flex-shrink: 0;
            }

            .login-features > div {
              min-width: 0 !important;
              padding: clamp(10px, 1.1vw, 18px) !important;
              border-radius: clamp(16px, 1.4vw, 24px) !important;
            }

            .login-features > div > .flex > div:first-child {
              width: clamp(38px, 3.2vw, 58px) !important;
              height: clamp(38px, 3.2vw, 58px) !important;
            }

            .login-features > div > .flex > div:nth-child(2) {
              width: clamp(8px, 1vw, 22px) !important;
            }

            .login-features > div > .flex > span {
              width: clamp(5px, 0.45vw, 7px) !important;
              height: clamp(5px, 0.45vw, 7px) !important;
              margin-left: 0 !important;
              margin-right: clamp(4px, 0.35vw, 8px) !important;
            }

            .login-features > div .text-\[10px\] {
              font-size: clamp(9px, 0.72vw, 14px) !important;
            }

            /* Animation sits at the bottom of the left column. */
            .login-animation {
              width: 88% !important;
              max-width: none !important;
              flex: 1 1 0% !important;
              min-height: clamp(135px, 17vh, 205px) !important;
              height: auto !important;
              max-height: none !important;
              margin-top: clamp(18px, 2.8vh, 36px) !important;
              margin-bottom: 0 !important;
              border-radius: clamp(20px, 1.6vw, 28px) !important;
            }

            /* FORM COLUMN
               Default desktop size is moderate; LCD rules below enlarge it. */
            .login-form-section {
              width: 100% !important;
              max-width: none !important;
              min-width: 0 !important;
              min-height: 0 !important;
              transform: none !important;
              justify-content: flex-end !important;
              align-items: stretch !important;
              align-self: stretch !important;
            }

            /* ✅ Sirf form wrapper (last child) — mobile heading div untouched */
            .login-form-section > div:last-child {
              width: 100% !important;
              max-width: none !important;
              margin-top: 0 !important;
              margin-bottom: 0 !important;
            }

            .login-form-section form {
              padding: clamp(20px, 1.7vw, 30px) !important;
            }

            .login-form-section form h2 {
              font-size: clamp(19px, 1.45vw, 27px) !important;
            }

            .login-form-section form > p {
              margin-bottom: clamp(14px, 1.8vh, 24px) !important;
            }

            .login-form-section form input,
            .login-form-section form > button[type="submit"] {
              height: clamp(44px, 4.8vh, 54px) !important;
            }

            .login-form-section .hidden.lg\:block {
              width: clamp(66px, 7vh, 94px) !important;
              height: clamp(66px, 7vh, 94px) !important;
              margin-bottom: clamp(8px, 1vh, 16px) !important;
            }
          }

          /* =========================================================
             SHORT LAPTOPS
             Keeps form narrower and removes the large bottom gap.
             ========================================================= */
          @media (min-width: 1024px) and (max-height: 779px) {
            .login-content {
              padding-top: 5px !important;
              padding-bottom: 5px !important;
            }

            /* ✅ Poori block vertical center — top ki free space khatam */
            .login-main {
              align-content: center !important;
            }

            .login-header {
              flex-basis: clamp(76px, 10vh, 96px);
              min-height: clamp(76px, 10vh, 96px);
              padding-top: 7px !important;
            }

            .login-header > div:first-child img {
              height: clamp(60px, 9.5vh, 96px) !important;
            }

            .login-header > div:last-child img {
              height: clamp(68px, 10.5vh, 108px) !important;
            }

            .login-header > div:nth-child(2) img {
              height: clamp(48px, 6.2vh, 64px) !important;
            }

            /* ✅ Top center heading ko top se thora margin */
            .login-header > div:nth-child(2) {
              margin-top: clamp(6px, 1.4vh, 16px) !important;
            }

            .login-main {
              grid-template-columns: minmax(0, 1fr) clamp(320px, 24vw, 380px) !important;
              column-gap: clamp(18px, 3.5vw, 60px) !important;
              padding-right: clamp(16px, 2.5vw, 55px) !important;
            }

            .login-left {
              justify-content: flex-end !important;
              padding-top: 0 !important;
            }

            .login-left > h1 {
              font-size: clamp(1.8rem, 3vw, 3rem) !important;
            }

            .login-left > p {
              margin-top: 6px !important;
              font-size: clamp(11px, 0.8vw, 14px) !important;
            }

            .login-features {
              margin-top: clamp(16px, 2.4vh, 26px) !important;
            }

            .login-features > div {
              padding: clamp(6px, 0.9vh, 10px) !important;
            }

            .login-features > div > .flex > div:first-child {
              width: clamp(30px, 2.6vw, 44px) !important;
              height: clamp(30px, 2.6vw, 44px) !important;
            }

            .login-features > div > .flex > div:nth-child(2) {
              width: clamp(6px, 0.7vw, 14px) !important;
            }

            .login-features > div > .flex > span {
              width: 4px !important;
              height: 4px !important;
              margin-right: clamp(3px, 0.3vw, 6px) !important;
            }

            .login-features > div .text-\[10px\] {
              font-size: clamp(8px, 0.65vw, 12px) !important;
            }

            .login-animation {
              flex: 1 1 0% !important;
              min-height: clamp(100px, 14vh, 140px) !important;
              height: auto !important;
              max-height: clamp(150px, 19vh, 200px) !important;
              margin-top: clamp(14px, 2vh, 20px) !important;
            }

            .login-form-section {
              width: clamp(320px, 24vw, 380px) !important;
              max-width: clamp(320px, 24vw, 380px) !important;
              justify-content: flex-end !important;
            }

            .login-form-section form {
              padding: clamp(17px, 1.5vw, 24px) !important;
            }

            .login-form-section .hidden.lg\:block {
              width: clamp(56px, 7vh, 70px) !important;
              height: clamp(56px, 7vh, 70px) !important;
              margin-bottom: 6px !important;
            }

            .login-form-section form > p {
              margin-bottom: clamp(10px, 1.5vh, 16px) !important;
            }

            .login-form-section form .mb-3 {
              margin-bottom: 8px !important;
            }

            .login-form-section form .mb-4 {
              margin-bottom: 10px !important;
            }

            .login-form-section form input,
            .login-form-section form > button[type="submit"] {
              height: clamp(42px, 5vh, 48px) !important;
            }
          }

          /* =========================================================
             LCD / LARGE DISPLAYS
             Form becomes significantly larger according to screen size.
             Left animation and form bottom edges remain aligned.
             ========================================================= */
          @media (min-width: 1400px) and (min-height: 780px) {
            .login-main {
              grid-template-columns: minmax(0, 1fr) clamp(380px, 22vw, 480px) !important;
              column-gap: clamp(35px, 4.5vw, 100px) !important;
              padding-bottom: clamp(80px, 11vh, 160px) !important;
              padding-right: clamp(60px, 7vw, 220px) !important;
            }

            .login-left {
              justify-content: flex-end !important;
            }

            .login-form-section {
              width: clamp(380px, 22vw, 480px) !important;
              max-width: clamp(380px, 22vw, 480px) !important;
              justify-content: flex-end !important;
            }

            .login-form-section form {
              padding: clamp(28px, 2.2vw, 44px) !important;
            }

            .login-form-section form h2 {
              font-size: clamp(24px, 1.7vw, 34px) !important;
            }

            .login-form-section form > p {
              font-size: clamp(11px, 0.75vw, 14px) !important;
              margin-bottom: clamp(20px, 2.6vh, 36px) !important;
            }

            .login-form-section form .mb-3 {
              margin-bottom: clamp(14px, 1.8vh, 24px) !important;
            }

            .login-form-section form .mb-4 {
              margin-bottom: clamp(16px, 2.1vh, 28px) !important;
            }

            .login-form-section form input,
            .login-form-section form > button[type="submit"] {
              height: clamp(52px, 6vh, 70px) !important;
            }

            .login-form-section .hidden.lg\:block {
              width: clamp(84px, 9vh, 124px) !important;
              height: clamp(84px, 9vh, 124px) !important;
              margin-bottom: clamp(12px, 1.6vh, 24px) !important;
            }

            .login-animation {
              flex: 1 1 0% !important;
              min-height: clamp(140px, 16vh, 200px) !important;
              height: auto !important;
              max-height: clamp(170px, 20vh, 240px) !important;
            }

            /* Larger LCD top logos */
            .login-header > div:first-child img {
              height: clamp(88px, 12.5vh, 165px) !important;
              max-width: clamp(175px, 14vw, 255px);
            }

            .login-header > div:last-child img {
              height: clamp(98px, 14vh, 180px) !important;
              max-width: clamp(95px, 9vw, 170px);
            }

            .login-header > div:nth-child(2) img {
              height: clamp(56px, 7vh, 82px) !important;
            }
          }

          /* EXTRA LARGE LCD */
          @media (min-width: 2000px) and (min-height: 780px) {
            .login-main {
              grid-template-columns: minmax(0, 1fr) clamp(420px, 21vw, 520px) !important;
              column-gap: clamp(55px, 4.5vw, 125px) !important;
            }

            .login-form-section {
              width: clamp(420px, 21vw, 520px) !important;
              max-width: clamp(420px, 21vw, 520px) !important;
            }

            .login-form-section form {
              padding: clamp(32px, 2vw, 48px) !important;
            }

            .login-form-section form input,
            .login-form-section form > button[type="submit"] {
              height: clamp(56px, 6vh, 72px) !important;
            }

            .login-animation {
              flex: 1 1 0% !important;
              height: auto !important;
              max-height: clamp(180px, 21vh, 260px) !important;
            }
          }

          /* VERY WIDE + SHORT LED/LCD
             Short-height displays stay compact even when very wide. */
          @media (min-width: 1700px) and (max-height: 779px) {
            .login-main {
              grid-template-columns: minmax(0, 1fr) clamp(330px, 22vw, 400px) !important;
              column-gap: clamp(25px, 4vw, 75px) !important;
            }

            .login-left {
              justify-content: flex-end !important;
            }

            .login-form-section {
              width: clamp(330px, 22vw, 400px) !important;
              max-width: clamp(330px, 22vw, 400px) !important;
            }

            .login-animation {
              flex: 1 1 0% !important;
              height: auto !important;
              max-height: none !important;
            }
          }
        `}</style>

    </div>
  )
}