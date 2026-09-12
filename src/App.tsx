import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

import Login from './templates/authentication/login/Login'
import Admin from './templates/admin/Admin'
import Homepage from './templates/homepage/Homepage'
import AttendanceDashboard from './templates/attandancemonitoring/AttendanceDashboard'
import SupervisorsHomepage from './templates/SupervisorsMonitoring/SupervisorsHomepage'
import SupervisorModule from './templates/SupervisorsMonitoring/SupervisorModule'
import ContainersDashboard from './templates/containersmonitoring/ContainersDashboard'
import VehiclesDashboard from './templates/vehiclesmonitoring/VehiclesDashboard'
import WelcomeTransition from './templates/authentication/login/WelcomeTransition'
import GoodbyeTransition from './templates/authentication/login/GoodbyeTransition'
import type { Permissions } from './templates/admin/types'
import AttendanceTransition from './templates/animations/AttendanceTransition'
import ContainersTransition from './templates/animations/ContainersTransition'
import VehiclesTransition from './templates/animations/VehiclesTransition'
import HomeTransition from './templates/animations/HomeTransition'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Permissions | null>(null)
  const [kickReason, setKickReason] = useState<'inactive' | 'password' | null>(null)
  // Tracks whether a login attempt is in progress (taake inactive kick par goodbye na chale)
  const loginInProgress = useRef(false)
  const [loading, setLoading] = useState(true)
  const [welcome, setWelcome] = useState(false)
  const [loginTransition, setLoginTransition] = useState(false)
  const [goodbye, setGoodbye] = useState(false)
  const [dashboardTransition, setDashboardTransition] = useState<'attendance' | 'containers' | 'vehicles' | 'home' | null>(null)

  async function loadRole(userId: string) {
    // Role load (with cache)
    const cached = localStorage.getItem('rto_role_' + userId)
    let fresh: string | null = null
    if (cached) {
      setRole(cached)
      setLoading(false)
      const { data } = await supabase.rpc('get_my_role')
      fresh = (data as string | null) ?? null
      localStorage.setItem('rto_role_' + userId, fresh ?? '')
      setRole(fresh)
    } else {
      const { data } = await supabase.rpc('get_my_role')
      fresh = (data as string | null) ?? null
      localStorage.setItem('rto_role_' + userId, fresh ?? '')
      setRole(fresh)
      setLoading(false)
    }
    // ✅ Admin bypass: full access to all dashboards by default
    if (fresh === 'admin') {
      setPermissions({
        attendance: true,
        vehicles:   true,
        containers: true,
      })
      return
    }
    // Other users: permissions from profiles table
    const { data: prof } = await supabase
      .from('profiles')
      .select('can_attendance, can_vehicles, can_containers')
      .eq('id', userId)
      .maybeSingle()
    setPermissions({
      attendance: Boolean(prof?.can_attendance),
      vehicles:   Boolean(prof?.can_vehicles),
      containers: Boolean(prof?.can_containers),
    })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadRole(data.session.user.id)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, sess) => {
      // Logout → goodbye animation dikhao (sirf genuine logout par, login kick par nahi)
      if (event === 'SIGNED_OUT') {
        if (!loginInProgress.current) setGoodbye(true)
      }
      setSession(sess)
      if (sess) loadRole(sess.user.id)
      else {
        setRole(null)
        setLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // ✅ Live watch: inactive ya password change ho to foran logout (no refresh)
  useEffect(() => {
    const userId = session?.user.id
    if (!userId || role === 'admin') return
    let alive = true
    let initialPwdAt: string | null = null

    // Snapshot of current profile state
    supabase
      .from('profiles')
      .select('status, password_changed_at')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        initialPwdAt = data?.password_changed_at ?? null
        if (data?.status === 'inactive') {
          setKickReason('inactive')
          supabase.auth.signOut()
        }
      })

    const channel = supabase
      .channel('profile-watch-' + userId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          const rec = payload.new as any
          if (rec?.status === 'inactive') {
            setKickReason('inactive')
            supabase.auth.signOut()
          } else if (rec?.password_changed_at && rec.password_changed_at !== initialPwdAt) {
            initialPwdAt = rec.password_changed_at
            setKickReason('password')
            supabase.auth.signOut()
          }
        }
      )
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [session?.user.id, role])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-[#021b16]">
        {/* Pulsing logo with glow */}
        <div className="relative h-20 w-20">
          <div aria-hidden="true" className="absolute inset-0 scale-125 rounded-full bg-emerald-400/20 blur-2xl" />
          <img
            src="/logos/loginform-logo.png"
            alt="Real Time Operations"
            className="relative h-20 w-20 object-contain drop-shadow-[0_0_25px_rgba(0,255,170,0.45)] animate-[logo-pulse_4s_ease-in-out_infinite]"
          />
        </div>
        {/* Spinner ring */}
        <div className="h-10 w-10 rounded-full border-2 border-emerald-400/20 border-t-emerald-300 animate-spin" />
        {/* Running gradient text */}
        <div className="text-sm font-bold tracking-widest bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
          LOADING…
        </div>
      </div>
    )
  }

  const isLoggedIn = Boolean(session)
  const isAdmin = isLoggedIn && role === 'admin'

  return (
    <BrowserRouter>
      <div className="relative min-h-screen">
        <Routes>
          <Route
            path="/login"
            element={
              isLoggedIn && (!loginTransition || welcome) ? (
                <Navigate to={role === 'supervisor' ? '/supervisors' : '/home'} replace />
              ) : (
              <Login
                kickReason={kickReason}
                onKicked={reason => setKickReason(reason)}
                onLoginStart={() => {
                  setLoginTransition(true)
                  setKickReason(null)
                  loginInProgress.current = true
                }}
                onLoginSuccess={() => {
                  setWelcome(true)
                  loginInProgress.current = false
                }}
                onLoginFail={() => {
                  setLoginTransition(false)
                  setWelcome(false)
                  loginInProgress.current = false
                }}
              />
              )
            }
          />
        <Route
          path="/home"
          element={
            !isLoggedIn ? (
              <Navigate to="/login" replace />
            ) : role === 'supervisor' ? (
              <Navigate to="/supervisors" replace />
            ) : (
              <Homepage
                role={role}
                permissions={permissions ?? { attendance: false, vehicles: false, containers: false }}
                permissionsLoaded={permissions !== null}
                onCardClick={(target) => setDashboardTransition(target)}
              />
            )
          }
        />
        <Route
          path="/attendance"
          element={
            !isLoggedIn ? (
              <Navigate to="/login" replace />
            ) : permissions === null ? (
              <div className="min-h-screen flex items-center justify-center text-white/60">Loading…</div>
            ) : role === 'employee' && !permissions?.attendance ? (
              <Navigate to="/home" replace />
            ) : (
              <AttendanceDashboard onHomeClick={() => setDashboardTransition('home')} />
            )
          }
        />
        <Route
          path="/containers"
          element={
            !isLoggedIn ? (
              <Navigate to="/login" replace />
            ) : permissions === null ? (
              <div className="min-h-screen flex items-center justify-center text-white/60">Loading…</div>
            ) : role === 'employee' && !permissions?.containers ? (
              <Navigate to="/home" replace />
            ) : (
              <ContainersDashboard onHomeClick={() => setDashboardTransition('home')} />
            )
          }
        />
        <Route
          path="/vehicles"
          element={
            !isLoggedIn ? (
              <Navigate to="/login" replace />
            ) : permissions === null ? (
              <div className="min-h-screen flex items-center justify-center text-white/60">Loading…</div>
            ) : role === 'employee' && !permissions?.vehicles ? (
              <Navigate to="/home" replace />
            ) : (
              <VehiclesDashboard onHomeClick={() => setDashboardTransition('home')} />
            )
          }
        />
          <Route
          path="/supervisors"
          element={
            isLoggedIn && role === 'supervisor' ? (
              <SupervisorsHomepage />
            ) : (
              <Navigate to={isLoggedIn ? '/home' : '/login'} replace />
            )
          }
        />
        <Route path="/supervisors/attendance" element={isLoggedIn && role === 'supervisor' ? <SupervisorModule module="attendance" /> : <Navigate to={isLoggedIn ? '/home' : '/login'} replace />} />
        <Route path="/supervisors/vehicles" element={isLoggedIn && role === 'supervisor' ? <SupervisorModule module="vehicles" /> : <Navigate to={isLoggedIn ? '/home' : '/login'} replace />} />
        <Route path="/supervisors/containers" element={isLoggedIn && role === 'supervisor' ? <SupervisorModule module="containers" /> : <Navigate to={isLoggedIn ? '/home' : '/login'} replace />} />
        <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to={isLoggedIn ? '/home' : '/login'} replace />} />
        </Routes>

        {welcome && (
          <WelcomeTransition
            onDone={() => {
              setWelcome(false)
              setLoginTransition(false)
            }}
          />
        )}

        {goodbye && <GoodbyeTransition onDone={() => setGoodbye(false)} />}

        {dashboardTransition === 'attendance' && (
          <AttendanceTransition onDone={() => setDashboardTransition(null)} />
        )}
        {dashboardTransition === 'containers' && (
          <ContainersTransition onDone={() => setDashboardTransition(null)} />
        )}
        {dashboardTransition === 'vehicles' && (
          <VehiclesTransition onDone={() => setDashboardTransition(null)} />
        )}
        {dashboardTransition === 'home' && (
          <HomeTransition onDone={() => setDashboardTransition(null)} />
        )}
      </div>
    </BrowserRouter>
  )
}