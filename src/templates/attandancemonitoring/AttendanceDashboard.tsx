import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AttendanceLogs from './AttendanceLogs'
import TotalHR from './TotalHR'
import AttendanceReport from './AttendanceReport'

type Props = {
  onHomeClick?: () => void
}

type Row = Record<string, any>
type View = 'dashboard' | 'attendance' | 'hr' | 'report'

export default function AttendanceDashboard({ onHomeClick }: Props) {
  const navigate = useNavigate()
  // ✅ Tab persistence: refresh ke baad wahi tab khule jo pehle open tha
  const [view, setView] = useState<View>(() => {
    const saved = localStorage.getItem('rto_attendance_tab') as View | null
    if (saved && ['dashboard', 'attendance', 'hr', 'report'].includes(saved)) return saved
    return 'dashboard'
  })
  
  // ✅ Save tab to localStorage on every change
  useEffect(() => {
    localStorage.setItem('rto_attendance_tab', view)
  }, [view])
  const [attendance, setAttendance] = useState<Row[]>([])
  const [employees, setEmployees] = useState<Row[]>([])
  const [baseValues, setBaseValues] = useState<{ label: string; value: number; sort_order: number; type: string }[]>([])
  const [loading, setLoading] = useState(true)
  const navRef = useRef<HTMLDivElement>(null)
  const [slider, setSlider] = useState({ left: 0, width: 0 })

  // ✅ Last sync time + notifications system
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [notifications, setNotifications] = useState<{ id: number; type: 'success' | 'error'; message: string; time: string }[]>([])
  const [unread, setUnread] = useState(0)
  const [popup, setPopup] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const popupTimer = useRef<number | null>(null)
  const notifId = useRef(0)

  function pushNotification(type: 'success' | 'error', message: string) {
    notifId.current += 1
    const item = {
      id: notifId.current,
      type,
      message,
      time: new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
    }
    // ✅ Sirf latest notification rakho — purani foran remove
    setNotifications([item])
    setUnread(u => u + 1)
    // Popup sirf 1 second ke liye
    setPopup({ type, message })
    if (popupTimer.current) window.clearTimeout(popupTimer.current)
    popupTimer.current = window.setTimeout(() => setPopup(null), 1000)
  }

  useEffect(() => {
    if (!navRef.current) return
    const activeBtn = navRef.current.querySelector('[data-active="true"]') as HTMLElement
    if (activeBtn) {
      setSlider({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth })
    }
  }, [view])
  // ✅ Server status: live = fetching process OK, error = portal/internet issue
  const [serverStatus, setServerStatus] = useState<'live' | 'error'>('live')
  const statusRef = useRef<'live' | 'error'>('live')
  function setStatus(s: 'live' | 'error') {
    statusRef.current = s
    setServerStatus(s)
  }
  const lastLogIdRef = useRef<string | null>(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  // ✅ Paginated fetch — Supabase ek request mein max 1000 rows deta hai
  async function fetchAll(table: string) {
    let all: Row[] = []
    let from = 0
    const PAGE = 1000
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw error
      const rows = data ?? []
      all = all.concat(rows)
      if (rows.length < PAGE) break
      from += PAGE
    }
    return all
  }

  // ✅ Sirf FMO / staff exclude (khali CNIC ya FMO/Weighbridge/Manager designation)
  const isStaff = (r: Row) => {
    const cnic = String(r.cnic ?? '').replace(/-/g, '').trim()
    const desig = String(r.designation ?? '').toLowerCase()
    return (
      cnic === '' ||
      desig.includes('field monitoring') ||
      desig.includes('weighbridge') ||
      desig.includes('manager')
    )
  }

  const load = useCallback(async (notify = false) => {
    setLoading(true)
    try {
      const [att, emp, bv] = await Promise.all([
        fetchAll('attendance_logs'),
        fetchAll('assigned_employees'),
        supabase.from('base_values').select('label, value, sort_order, type').order('sort_order', { ascending: true }),
      ])
      if (!aliveRef.current) return
      setAttendance(att.filter(r => !isStaff(r)))
      setEmployees(emp)
      setBaseValues((bv.data ?? []) as { label: string; value: number; sort_order: number; type: string }[])
      setLastSync(new Date())
      setStatus('live')
      // ✅ Notification sirf jab naya data aaya ho — refresh/mount par nahi
      if (notify) pushNotification('success', 'Data successfully fetched and updated')
    } catch (e) {
      console.error('Load error:', e)
      if (statusRef.current !== 'error') {
        pushNotification('error', 'Error in data fetch')
      }
      setStatus('error')
    } finally {
      if (aliveRef.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ✅ Auto-poll: har 30 second mein check — fetch fail = RED, fetch OK = GREEN
  useEffect(() => {
    const POLL_MS = 30_000
    const timer = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('attendance_logs')
          .select('id')
          .order('id', { ascending: false })
          .limit(1)
        if (error) throw error
        // ✅ Fetch OK → dot green (process dobara chal para)
        if (statusRef.current === 'error') setStatus('live')
        const latestId = (data?.[0]?.id as string | undefined) ?? null
        if (lastLogIdRef.current === null) {
          lastLogIdRef.current = latestId
        } else if (latestId !== lastLogIdRef.current) {
          // Naya data aaya → full refresh + success notification
          lastLogIdRef.current = latestId
          await load(true)
        }
      } catch (e) {
        // ❌ Data fetch stop (kisi bhi wajah se) → dot red + notification
        if (statusRef.current !== 'error') {
          pushNotification('error', 'Error in data fetch')
        }
        setStatus('error')
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  const tabs: { key: View; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'hr', label: 'Assigned HR' }, // ✅ Naam badal kar 2nd position par
    { key: 'attendance', label: 'Attendance' },
    { key: 'report', label: 'Report' },
  ]

  return (
    <div className="min-h-screen bg-[#021b16] text-white">
      {/* ===== Top Navbar (solid + visible) ===== */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex items-center px-3 sm:px-6 py-3">
          {/* Left: Home button */}
          <div className="flex-1 flex justify-start pointer-events-auto">
            <button
              onClick={() => { onHomeClick?.(); navigate('/home') }}
              aria-label="Back to Home"
              className="rto-run-border relative flex items-center gap-2 rounded-full border border-transparent bg-[#071b15]/80 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-emerald-200 transition-all duration-300 hover:bg-emerald-500/15 hover:shadow-[0_0_25px_rgba(0,255,170,0.25)]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Home
            </button>
          </div>

          {/* Center: 3 tabs */}
          <nav
            ref={navRef}
              className="relative pointer-events-auto flex items-center gap-1.5 sm:gap-2 rounded-full border border-transparent bg-[#071b15]/90 backdrop-blur-md px-2 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_12px_35px_rgba(0,0,0,0.6)]">
            {/* ✅ Sliding green pill */}
            <div
              className="absolute top-1.5 bottom-1.5 rounded-full bg-linear-to-r from-[#00764c] to-[#058962] shadow-[0_0_15px_rgba(0,255,170,0.15)] transition-all duration-300 ease-out pointer-events-none"
              style={{ left: slider.left, width: slider.width }}
            />

            {tabs.map(t => (
              <button
                key={t.key}
                data-active={view === t.key}
                onClick={() => setView(t.key)}
                className={`relative z-10 px-2.5 sm:px-5 py-2 rounded-full text-[11px] sm:text-sm font-bold tracking-wide transition-colors duration-300 whitespace-nowrap ${
                  view === t.key ? 'text-white' : 'text-white/60 hover:text-emerald-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Right: Last Sync pill + Notification bell (top par) */}
          <div className="flex-1 flex justify-end items-center gap-2.5 pr-1 sm:pr-3 pointer-events-auto">
                {lastSync && (
                  <div className="rto-run-border relative hidden sm:flex items-center gap-2 rounded-full border border-transparent bg-[#071b15]/80 px-4 py-2">
                    {serverStatus === 'live' ? (
                      <span className="relative flex h-2.5 w-2.5" title="Server live — data fetching OK">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                      </span>
                    ) : (
                      <span className="relative flex h-2.5 w-2.5" title="Server error — data fetching band hai">
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse" />
                      </span>
                    )}
                    <span className={`text-[9px] font-bold tracking-[0.18em] ${serverStatus === 'live' ? 'text-emerald-300' : 'text-red-300'}`}>
                      {serverStatus === 'live' ? 'LIVE' : 'ERROR'}
                    </span>
                    <div className="h-3 w-px bg-white/15" />
                    <span className="text-[9px] font-bold tracking-[0.18em] text-white/45">LAST UPDATED</span>
                    <span className="text-[11px] font-bold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap">
                      {lastSync.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} — {lastSync.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                    </span>
                  </div>
                )}

                {/* Notification bell */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setNotifOpen(v => !v)
                      setUnread(0)
                    }}
                    aria-label="Notifications"
                    className="rto-run-border relative flex items-center justify-center rounded-full border border-transparent bg-[#071b15]/80 p-2.5 text-white/70 hover:text-white transition"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    {unread > 0 && (
                      <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
                    )}
                  </button>

                  {/* 1-second popup */}
                  {popup && (
                    <div className={`absolute right-0 top-full mt-2 z-50 px-3 py-2 rounded-xl border text-[11px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.4)] whitespace-nowrap ${
                      popup.type === 'success'
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                        : 'bg-red-500/15 border-red-400/40 text-red-300'
                    }`}>
                      {popup.type === 'success' ? '✓ ' : '⚠ '}{popup.message}
                    </div>
                  )}

                  {/* Notifications dropdown — sirf latest */}
                  {notifOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-white/10 bg-[#071b15] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-white/10 text-xs font-bold tracking-widest text-white/70">NOTIFICATIONS</div>
                        <div className="max-h-64 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="px-4 py-6 text-center text-xs text-white/40">No notifications yet</div>
                          ) : (
                            notifications.map(n => (
                              <div key={n.id} className="px-4 py-2.5 flex items-start gap-2.5">
                                <span className={`mt-0.5 text-xs font-bold ${n.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
                                  {n.type === 'success' ? '✓' : '⚠'}
                                </span>
                                <div>
                                  <div className="text-[11px] text-white/85">{n.message}</div>
                                  <div className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                                    n.type === 'success'
                                      ? 'border-emerald-400/30 bg-emerald-500/10'
                                      : 'border-red-400/30 bg-red-500/10'
                                  }`}>
                                    <svg className={`h-3 w-3 ${n.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="10" />
                                      <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <span className={`text-[10px] font-bold bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] ${
                                      n.type === 'success'
                                        ? 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]'
                                        : 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]'
                                    }`}>
                                      {n.time}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
          </div>
        </div>
      </header>

      {/* ===== Content ===== */}
      <main className="pt-24 pb-4 px-4 sm:px-6 max-w-[1750px] mx-auto flex flex-col min-h-screen">
        {view === 'dashboard' && <StatsView attendance={attendance} employees={employees} baseValues={baseValues} loading={loading} />}
        {view === 'attendance' && <AttendanceLogs rows={attendance} loading={loading} />}
        {view === 'hr' && <TotalHR rows={employees} loading={loading} />}
        {view === 'report' && <AttendanceReport rows={attendance} employees={employees} loading={loading} />}
      </main>
    </div>
  )
}

/* =========================================================
   DASHBOARD STATS VIEW (FIXED)
========================================================= */
function StatsView({ attendance, employees, baseValues, loading }: { attendance: Row[]; employees: Row[]; baseValues: { label: string; value: number; sort_order: number; type: string }[]; loading: boolean }) {
  const normCnic = (v: any) => String(v ?? '').replace(/-/g, '').trim().toLowerCase()

  // ✅ FIX 2: Employees ko bhi filter karein taake FMOs/Managers TOTAL HR mein count na hon
  const validEmployees = employees.filter(e => {
    const desig = String(e.designation ?? '').toLowerCase()
    return !desig.includes('field monitoring') &&
           !desig.includes('weighbridge') &&
           !desig.includes('manager')
  })

  const latestDate = attendance.length > 0
    ? attendance.reduce((max, curr) => {
        const currDate = String(curr.date ?? curr.date_time ?? '').split(' ')[0]
        return currDate > max ? currDate : max
      }, '')
    : ''

  const valid = attendance.filter(r => {
    const cnic = String(r.cnic ?? '').replace(/-/g, '').trim()
    const desig = String(r.designation ?? '').toLowerCase()
    return cnic !== '' &&
      !desig.includes('field monitoring') &&
      !desig.includes('weighbridge') &&
      !desig.includes('manager')
  })

  const checkins = valid.filter(r => String(r.check_type ?? '').toLowerCase() === 'checkin').length
  const checkouts = valid.filter(r => String(r.check_type ?? '').toLowerCase() === 'checkout').length

  const checkinCnics = new Set(
    valid.filter(r => String(r.check_type ?? '').toLowerCase() === 'checkin').map(r => normCnic(r.cnic))
  )
  
  // ✅ FIX 3: PRESENT Logic Bug Fix!
  // Pehle aap checkin AUR checkout dono check kar rahe thay. CSV data mein abhi sirf 'checkin' hai.
  // Is wajah se har wo shakhs ABSENT count ho raha tha jis ne sirf check-in kiya tha.
  // Ab sirf check-in ko PRESENT count karenge.
  // ✅ Present = check-in AND check-out both; Absent = never checked in
  const checkoutCnics = new Set(
    valid.filter(r => String(r.check_type ?? '').toLowerCase() === 'checkout').map(r => normCnic(r.cnic))
  )
  const present = validEmployees.filter(e => {
    const k = normCnic(e.cnic)
    return checkinCnics.has(k) && checkoutCnics.has(k)
  }).length
  const absent = validEmployees.filter(e => !checkinCnics.has(normCnic(e.cnic))).length

  // ✅ Designation-wise breakdown: sirf 4 fixed rows, Total fixed, baqi real-time
  // ✅ Dashboard table: base_values se aayega (TOTAL HR bhi yahan hoga lekin usay skip karenge)
  // ✅ Map every employee CNIC to their designation, so attendance logs match
  // even if the log row's own designation text is different
  // ✅ Strip "(Fixed)" from designation for matching + display
  const stripFixed = (s: string) => s.replace(/\(fixed\)/gi, '').trim().toLowerCase()

  const empDesigByCnic = new Map<string, string>()
  for (const e of validEmployees) {
    empDesigByCnic.set(normCnic(e.cnic), stripFixed(String(e.designation ?? '')))
  }

  const designationBVs = baseValues.filter((b: { label: string; type?: string }) => b.label !== 'TOTAL HR' && (b.type ?? 'designation') === 'designation')
  const categoryBVs = baseValues
    .filter((b: { type?: string }) => (b.type ?? 'designation') === 'category')
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
  const desigList = designationBVs.map((row: { label: string; value: number }) => {
    const key = stripFixed(row.label)
    const hired = validEmployees.filter((e: Row) => stripFixed(String(e.designation ?? '')) === key).length
    const checkinSet = new Set<string>()
    const checkoutSet = new Set<string>()
    for (const r of valid) {
      const d = empDesigByCnic.get(normCnic(r.cnic))
      if (d !== key) continue
      const k = normCnic(r.cnic)
      const t = String(r.check_type ?? '').toLowerCase()
      if (t === 'checkin') checkinSet.add(k)
      else if (t === 'checkout') checkoutSet.add(k)
    }
    // Present = check-in AND check-out both (same logic as Report)
    const present = [...checkinSet].filter(k => checkoutSet.has(k)).length
    // Absent = employees who never checked in
    const absent = hired - checkinSet.size
    return {
      desig: row.label,
      total: row.value,
      hired,
      checkin: checkinSet.size,
      checkout: checkoutSet.size,
      present,
      absent,
    }
  })
  const totals = desigList.reduce(
    (acc: { total: number; hired: number; checkin: number; checkout: number; present: number; absent: number }, g: any) => ({
      total: acc.total + g.total,
      hired: acc.hired + g.hired,
      checkin: acc.checkin + g.checkin,
      checkout: acc.checkout + g.checkout,
      present: acc.present + g.present,
      absent: acc.absent + g.absent,
    }),
    { total: 0, hired: 0, checkin: 0, checkout: 0, present: 0, absent: 0 }
  )

  // ✅ Category-wise breakdown (work_type field): Total fixed, baqi real-time
  const empCatByCnic = new Map<string, string>()
  for (const e of validEmployees) {
    empCatByCnic.set(normCnic(e.cnic), String(e.work_type ?? '').trim().toLowerCase())
  }
  const catList = categoryBVs.map((row: { label: string; value: number }) => {
    const key = row.label.toLowerCase()
    const hired = validEmployees.filter((e: Row) => String(e.work_type ?? '').trim().toLowerCase() === key).length
    const checkinSet = new Set<string>()
    const checkoutSet = new Set<string>()
    for (const r of valid) {
      // Match via employee CNIC → category (log row ke work_type par depend nahi)
      const c = empCatByCnic.get(normCnic(r.cnic))
      if (c !== key) continue
      const k = normCnic(r.cnic)
      const t = String(r.check_type ?? '').toLowerCase()
      if (t === 'checkin') checkinSet.add(k)
      else if (t === 'checkout') checkoutSet.add(k)
    }
    // Present = check-in AND check-out both; Absent = never checked in
    const present = [...checkinSet].filter(k => checkoutSet.has(k)).length
    const absent = hired - checkinSet.size
    return { cat: row.label, total: row.value, hired, checkin: checkinSet.size, checkout: checkoutSet.size, present, absent }
  })
  const catTotals = catList.reduce(
    (acc: { total: number; hired: number; checkin: number; checkout: number; present: number; absent: number }, g: any) => ({
      total: acc.total + g.total,
      hired: acc.hired + g.hired,
      checkin: acc.checkin + g.checkin,
      checkout: acc.checkout + g.checkout,
      present: acc.present + g.present,
      absent: acc.absent + g.absent,
    }),
    { total: 0, hired: 0, checkin: 0, checkout: 0, present: 0, absent: 0 }
  )

  const showDate = latestDate
    ? new Date(latestDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const GREEN_NUM = 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'
  const RED_NUM = 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]'

  const cards = [
    { label: 'TOTAL HR', value: 818, icon: <PeopleIcon />, num: GREEN_NUM, ring: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' },
    { label: 'ASSIGNED HR', value: validEmployees.length, icon: <PeopleIcon />, num: GREEN_NUM, ring: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' },
    { label: 'TOTAL CHECK-IN', value: checkins, icon: <CheckInIcon />, num: GREEN_NUM, ring: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' },
    { label: 'TOTAL CHECK-OUT', value: checkouts, icon: <CheckOutIcon />, num: GREEN_NUM, ring: 'border-sky-400/40 bg-sky-500/15 text-sky-300' },
    { label: 'PRESENT', value: present, icon: <PresentIcon />, num: GREEN_NUM, ring: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' },
    { label: 'ABSENT', value: absent, icon: <AbsentIcon />, num: RED_NUM, ring: 'border-red-400/40 bg-red-500/15 text-red-300' },
  ]

  return (
    <div>
      <h1 className="text-center text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-none">
        <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Attendance </span>
        <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Dashboard</span>
      </h1>
      <p className="mt-3 text-center text-xs sm:text-sm text-white/45">Live monitoring — {showDate}</p>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-5">
        {cards.map(c => (
          <div key={c.label} className="relative overflow-hidden rounded-[24px] border border-emerald-400/25 bg-linear-to-b from-[#073b2d] to-[#021d17] px-4 py-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border ${c.ring}`}>
              {c.icon}
            </div>
            <div className={`text-3xl sm:text-4xl font-extrabold ${c.num}`}>
              {loading ? '—' : c.value.toLocaleString()}
            </div>
            <div className="mt-2 text-[11px] sm:text-sm font-bold tracking-widest text-white/60">{c.label}</div>
          </div>
        ))}
      </div>

      {/* ===== Designation Wise Statistics Table ===== */}
      <div className="mt-10 mb-6">
        <h2 className="text-left text-lg sm:text-xl font-extrabold tracking-wide bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
          Designation Wise Statistics
        </h2>

        <div className="mt-4 overflow-x-auto rounded-[24px] border border-emerald-400/25 bg-linear-to-b from-[#073b2d] to-[#021d17] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <table className="w-full min-w-[860px] text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 font-bold tracking-widest text-white/70">DESIGNATION</th>
                <th className="px-4 py-3 font-bold tracking-widest text-white/70">TOTAL</th>
                <th className="px-4 py-3 font-bold tracking-widest text-white/70">HIRED</th>
                <th className="px-4 py-3 font-bold tracking-widest text-white/70">CHECKIN</th>
                <th className="px-4 py-3 font-bold tracking-widest text-white/70">CHECKOUT</th>
                <th className="px-4 py-3 font-bold tracking-widest text-white/70">PRESENT</th>
                <th className="px-4 py-3 font-bold tracking-widest text-white/70">ABSENT</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-white/50">Loading statistics…</td>
                </tr>
              ) : (
                <>
                  {/* Total row (Excel ki tarah sab se upar) */}
                  <tr className="border-b border-white/10 bg-emerald-500/10">
                    <td className="px-4 py-3 font-extrabold text-white">DashBoard Total HR</td>
                    <td className="px-4 py-3 font-extrabold text-emerald-300">{totals.total.toLocaleString()}</td>
                    <td className="px-4 py-3 font-extrabold text-emerald-300">{totals.hired.toLocaleString()}</td>
                    <td className="px-4 py-3 font-extrabold text-emerald-300">{totals.checkin.toLocaleString()}</td>
                    <td className="px-4 py-3 font-extrabold text-sky-300">{totals.checkout.toLocaleString()}</td>
                    <td className="px-4 py-3 font-extrabold text-emerald-300">{totals.present.toLocaleString()}</td>
                    <td className="px-4 py-3 font-extrabold text-red-300">{totals.absent.toLocaleString()}</td>
                  </tr>
                  {desigList.map(g => (
                    <tr key={g.desig} className="border-b border-white/5 last:border-0 transition-colors hover:bg-white/5">
                      <td className="px-4 py-3 font-semibold text-white/90">{g.desig}</td>
                      <td className="px-4 py-3 text-white/70">{g.total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-white/70">{g.hired.toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-300">{g.checkin.toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-sky-300">{g.checkout.toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-300">{g.present.toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-red-300">{g.absent.toLocaleString()}</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Category Wise Statistics Table ===== */}
      <div className="mt-10 mb-6">
        <h2 className="text-left text-lg sm:text-xl font-extrabold tracking-wide bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
          Category Wise Statistics
        </h2>

        <div className="mt-4 overflow-x-auto rounded-[24px] border border-emerald-400/25 bg-linear-to-b from-[#073b2d] to-[#021d17] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <table className="w-full min-w-[860px] text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 font-bold tracking-widest text-white/70">CATEGORY</th>
                <th className="px-4 py-3 font-bold tracking-widest text-white/70">TOTAL</th>
                <th className="px-4 py-3 font-bold tracking-widest text-white/70">HIRED</th>
                <th className="px-4 py-3 font-bold tracking-widest text-white/70">CHECKIN</th>
                <th className="px-4 py-3 font-bold tracking-widest text-white/70">CHECKOUT</th>
                <th className="px-4 py-3 font-bold tracking-widest text-white/70">PRESENT</th>
                <th className="px-4 py-3 font-bold tracking-widest text-white/70">ABSENT</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-white/50">Loading statistics…</td>
                </tr>
              ) : (
                <>
                  {/* Total row */}
                  <tr className="border-b border-white/10 bg-emerald-500/10">
                    <td className="px-4 py-3 font-extrabold text-white">Category Wise Total HR</td>
                    <td className="px-4 py-3 font-extrabold text-emerald-300">{catTotals.total.toLocaleString()}</td>
                    <td className="px-4 py-3 font-extrabold text-emerald-300">{catTotals.hired.toLocaleString()}</td>
                    <td className="px-4 py-3 font-extrabold text-emerald-300">{catTotals.checkin.toLocaleString()}</td>
                    <td className="px-4 py-3 font-extrabold text-sky-300">{catTotals.checkout.toLocaleString()}</td>
                    <td className="px-4 py-3 font-extrabold text-emerald-300">{catTotals.present.toLocaleString()}</td>
                    <td className="px-4 py-3 font-extrabold text-red-300">{catTotals.absent.toLocaleString()}</td>
                  </tr>
                  {catList.map(g => (
                    <tr key={g.cat} className="border-b border-white/5 last:border-0 transition-colors hover:bg-white/5">
                      <td className="px-4 py-3 font-semibold text-white/90">{g.cat}</td>
                      <td className="px-4 py-3 text-white/70">{g.total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-white/70">{g.hired.toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-300">{g.checkin.toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-sky-300">{g.checkout.toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-300">{g.present.toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-red-300">{g.absent.toLocaleString()}</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PeopleIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function CheckInIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="5.5" r="2.5" />
      <path d="M4 20v-1a4 4 0 0 1 4-4h.5" />
      <path d="M8.5 12.5 12 14" />
      <rect x="14" y="3" width="7" height="18" rx="2" />
      <path d="m16 12.5 1.5 1.5 2.5-2.5" />
    </svg>
  )
}

function CheckOutIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="4.5" r="2" />
      <path d="M6.5 7.5v5l-2 7" />
      <path d="M6.5 12.5l3 7" />
      <path d="M6.5 8.5 10 10" />
      <path d="M14 3.5h6v17h-6" />
      <path d="M13.5 12H20" />
      <path d="m17.5 9.5 2.5 2.5-2.5 2.5" />
    </svg>
  )
}

function TotalIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </svg>
  )
}

function PresentIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9.5" cy="6.5" r="3.5" />
      <path d="M3 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 1.8.33" />
      <circle cx="17" cy="17" r="4.5" />
      <path d="m15.2 17 1.3 1.3 2.3-2.3" />
    </svg>
  )
}

function AbsentIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9.5" cy="6.5" r="3.5" />
      <path d="M3 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 1.8.33" />
      <circle cx="17" cy="17" r="4.5" />
      <path d="m15.5 15.5 3 3" />
      <path d="m18.5 15.5-3 3" />
    </svg>
  )
}