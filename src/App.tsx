import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

import Login from './templates/authentication/login/Login'
import Admin from './templates/admin/Admin'
import Homepage from './templates/homepage/Homepage'
import AttendanceDashboard from './templates/attandancemonitoring/AttendanceDashboard'
import ContainersDashboard from './templates/containersmonitoring/ContainersDashboard'
import VehiclesDashboard from './templates/vehiclesmonitoring/VehiclesDashboard'
import WelcomeTransition from './templates/authentication/login/WelcomeTransition'
import GoodbyeTransition from './templates/authentication/login/GoodbyeTransition'
import AttendanceTransition from './templates/animations/AttendanceTransition'
import ContainersTransition from './templates/animations/ContainersTransition'
import VehiclesTransition from './templates/animations/VehiclesTransition'
import HomeTransition from './templates/animations/HomeTransition'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [welcome, setWelcome] = useState(false)
  const [loginTransition, setLoginTransition] = useState(false)
  const [goodbye, setGoodbye] = useState(false)
  const [dashboardTransition, setDashboardTransition] = useState<'attendance' | 'containers' | 'vehicles' | 'home' | null>(null)

  async function loadRole(userId: string) {
    const cached = localStorage.getItem('rto_role_' + userId)
    if (cached) {
      setRole(cached)
      setLoading(false)
      const { data } = await supabase.rpc('get_my_role')
      const fresh = (data as string | null) ?? null
      localStorage.setItem('rto_role_' + userId, fresh ?? '')
      setRole(fresh)
      return
    }
    const { data } = await supabase.rpc('get_my_role')
    const fresh = (data as string | null) ?? null
    localStorage.setItem('rto_role_' + userId, fresh ?? '')
    setRole(fresh)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadRole(data.session.user.id)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, sess) => {
      // Logout → goodbye animation dikhao
      if (event === 'SIGNED_OUT') {
        setGoodbye(true)
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/70 text-sm bg-linear-to-br from-[#06231c] to-[#0b352a]">
        Loading…
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
                <Navigate to="/home" replace />
              ) : (
                <Login
                  onLoginStart={() => setLoginTransition(true)}
                  onLoginSuccess={() => setWelcome(true)}
                  onLoginFail={() => {
                    setLoginTransition(false)
                    setWelcome(false)
                  }}
                />
              )
            }
          />
          <Route
            path="/home"
            element={
              isLoggedIn ? (
                <Homepage
                  role={role}
                  onCardClick={(target) => setDashboardTransition(target)}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/attendance"
            element={
              isLoggedIn ? (
                <AttendanceDashboard onHomeClick={() => setDashboardTransition('home')} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/containers"
            element={
              isLoggedIn ? (
                <ContainersDashboard onHomeClick={() => setDashboardTransition('home')} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/vehicles"
            element={
              isLoggedIn ? (
                <VehiclesDashboard onHomeClick={() => setDashboardTransition('home')} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
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