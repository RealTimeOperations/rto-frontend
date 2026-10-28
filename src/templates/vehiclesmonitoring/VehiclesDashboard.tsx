import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Vehicles, { type Vehicle } from './Vehicles'
import MileageReport, { TARGETS, HOURS_TARGET, parseHours } from './MileageReport'
import { resetMonitoringTabs } from '../../lib/resetTabs'

type Props = {
  onHomeClick?: () => void
}

type View = 'dashboard' | 'list' | 'mileage'

// ✅ Python naive local time ko LOCAL samjho (Supabase timestamptz UTC assume karta hai)
function parseLocal(s: string): Date {
  const clean = String(s).replace('Z', '').replace(/[+-]\d{2}:\d{2}$/, '').replace(' ', 'T')
  const d = new Date(clean)
  return isNaN(d.getTime()) ? new Date(s) : d
}

// ✅ Premium card styles (literal classes — Tailwind JIT safe)
const CARD_STYLES = [
  { wrap: 'border-emerald-400/40 bg-[linear-gradient(135deg,rgba(16,185,129,0.30),rgba(4,35,28,0.95)_65%)]', icon: 'bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.55)]', bar: 'bg-emerald-400', track: 'bg-emerald-400/15', arrow: 'border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/20' },
  { wrap: 'border-sky-400/40 bg-[linear-gradient(135deg,rgba(14,165,233,0.28),rgba(4,25,35,0.95)_65%)]', icon: 'bg-sky-500 shadow-[0_0_18px_rgba(14,165,233,0.55)]', bar: 'bg-sky-400', track: 'bg-sky-400/15', arrow: 'border-sky-400/60 text-sky-200 hover:bg-sky-500/20' },
  { wrap: 'border-amber-400/40 bg-[linear-gradient(135deg,rgba(245,158,11,0.28),rgba(35,25,4,0.95)_65%)]', icon: 'bg-amber-500 shadow-[0_0_18px_rgba(245,158,11,0.55)]', bar: 'bg-amber-400', track: 'bg-amber-400/15', arrow: 'border-amber-400/60 text-amber-200 hover:bg-amber-500/20' },
  { wrap: 'border-purple-400/40 bg-[linear-gradient(135deg,rgba(168,85,247,0.28),rgba(25,4,35,0.95)_65%)]', icon: 'bg-purple-500 shadow-[0_0_18px_rgba(168,85,247,0.55)]', bar: 'bg-purple-400', track: 'bg-purple-400/15', arrow: 'border-purple-400/60 text-purple-200 hover:bg-purple-500/20' },
  { wrap: 'border-red-400/40 bg-[linear-gradient(135deg,rgba(239,68,68,0.26),rgba(35,4,4,0.95)_65%)]', icon: 'bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.55)]', bar: 'bg-red-400', track: 'bg-red-400/15', arrow: 'border-red-400/60 text-red-200 hover:bg-red-500/20' },
  { wrap: 'border-cyan-400/40 bg-[linear-gradient(135deg,rgba(6,182,212,0.28),rgba(4,25,30,0.95)_65%)]', icon: 'bg-cyan-500 shadow-[0_0_18px_rgba(6,182,212,0.55)]', bar: 'bg-cyan-400', track: 'bg-cyan-400/15', arrow: 'border-cyan-400/60 text-cyan-200 hover:bg-cyan-500/20' },
  { wrap: 'border-pink-400/40 bg-[linear-gradient(135deg,rgba(236,72,153,0.26),rgba(35,4,20,0.95)_65%)]', icon: 'bg-pink-500 shadow-[0_0_18px_rgba(236,72,153,0.55)]', bar: 'bg-pink-400', track: 'bg-pink-400/15', arrow: 'border-pink-400/60 text-pink-200 hover:bg-pink-500/20' },
  { wrap: 'border-lime-400/40 bg-[linear-gradient(135deg,rgba(132,204,22,0.26),rgba(20,30,4,0.95)_65%)]', icon: 'bg-lime-500 shadow-[0_0_18px_rgba(132,204,22,0.55)]', bar: 'bg-lime-400', track: 'bg-lime-400/15', arrow: 'border-lime-400/60 text-lime-200 hover:bg-lime-500/20' },
]

// ✅ White glyph icons (circle badge ke andar)
const TYPE_ICONS = {
  worker: (<svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1z" /><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" /><path d="M4 15v-3a6 6 0 0 1 6-6" /><path d="M14 6a6 6 0 0 1 6 6v3" /></svg>),
  tractor: (<svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="17" r="4" /><circle cx="17.5" cy="17.5" r="2.5" /><path d="M7 13V6h5l2 7" /><path d="M12 9h5" /></svg>),
  loader: (<svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15V8h8v7" /><path d="M12 10h4l4 7h-5" /><circle cx="7" cy="18" r="2.5" /><circle cx="15" cy="18" r="2.5" /></svg>),
  fuel: (<svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" x2="15" y1="22" y2="22" /><line x1="4" x2="14" y1="9" y2="9" /><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" /><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" /></svg>),
  trash: (<svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>),
  truck: (<svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></svg>),
  droplets: (<svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" /><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" /></svg>),
  wrench: (<svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>),
  car: (<svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg>),
}

// ✅ Type ke hisaab se description + icon + vehicle IMAGE path
function typeMeta(type: string): { desc: string; icon: keyof typeof TYPE_ICONS; img: string } {
  const t = type.toLowerCase()
  if (t.includes('rickshaw')) return { desc: 'Small vehicle for efficient waste collection', icon: 'worker', img: '/vehicles/loader-rickshaw.png' }
  if (t.includes('tractor')) return { desc: 'Heavy duty for large volume transport', icon: 'tractor', img: '/vehicles/tractor-trolley.png' }
  if (t.includes('front end') || t.includes('loader')) return { desc: 'Powerful and efficient for heavy operations', icon: 'loader', img: '/vehicles/front-end-loader.png' }
  if (t.includes('tipper')) return { desc: 'Compact and versatile for urban areas', icon: 'fuel', img: '/vehicles/mini-tipper.png' }
  if (t.includes('compactor')) return { desc: 'Efficient compaction for maximum load', icon: 'trash', img: '/vehicles/compactor.png' }
  if (t.includes('arm roll') || t.includes('armroll')) return { desc: 'Flexible loading for various waste types', icon: 'truck', img: '/vehicles/arm-roll.png' }
  if (t.includes('dumper')) return { desc: 'High capacity for waste transport', icon: 'truck', img: '/vehicles/dumper.png' }
  if (t.includes('drain')) return { desc: 'Specialized for drain cleaning operations', icon: 'droplets', img: '/vehicles/default.png' }
  if (t.includes('repair')) return { desc: 'On-site container repair and maintenance', icon: 'wrench', img: '/vehicles/default.png' }
  return { desc: 'Operational fleet vehicle', icon: 'car', img: '/vehicles/default.png' }
}

export default function VehiclesDashboard({ onHomeClick }: Props) {
  const navigate = useNavigate()

  // ✅ Tab persistence
  const [view, setView] = useState<View>(() => {
    try {
      const saved = localStorage.getItem('rto_vehicles_tab') as View | null
      if (saved && ['dashboard', 'list', 'mileage'].includes(saved)) return saved
    } catch {}
    return 'dashboard'
  })
  useEffect(() => {
    try { localStorage.setItem('rto_vehicles_tab', view) } catch {}
  }, [view])

  // ✅ LIVE DATA — Supabase vehiclesdata table (mock data remove)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  // ✅ Mileage Statistics (dashboard card) — drivers + distance join se live
  const [mileageStats, setMileageStats] = useState({ total: 0, ok: 0, low: 0, zero: 0 })
  // ✅ Vehicle Status counts (tracking table se live — Total/Reporting/Moving/Parked/Idling)
  const [trackingStats, setTrackingStats] = useState({ total: 0, reporting: 0, notReporting: 0, moving: 0, parked: 0, idling: 0 })

  // ✅ LIVE pill + notifications (containers pattern — tracking heartbeats id 4 & 5)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [serverStatus, setServerStatus] = useState<'live' | 'error'>(() => {
    try { return localStorage.getItem('rto_veh_server_status') === 'error' ? 'error' : 'live' } catch { return 'live' }
  })
  const statusRef = useRef<'live' | 'error'>(serverStatus)
  const lastErrMsgRef = useRef<string>((() => {
    try {
      const saved = localStorage.getItem('rto_veh_latest_notification')
      const n = saved ? JSON.parse(saved) : null
      return n?.type === 'error' ? String(n.message || '') : ''
    } catch { return '' }
  })())
  const [notifications, setNotifications] = useState<{ id: number; type: 'success' | 'error'; message: string; time: string; unread?: boolean }[]>(() => {
    try {
      const saved = localStorage.getItem('rto_veh_latest_notification')
      if (saved) {
        const item = JSON.parse(saved)
        if (item && item.message) return [item]
      }
    } catch {}
    return []
  })
  const [unread, setUnread] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('rto_veh_latest_notification')
      if (saved) return JSON.parse(saved)?.unread ? 1 : 0
    } catch {}
    return 0
  })
  const [popup, setPopup] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const popupTimer = useRef<number | null>(null)
  const notifId = useRef(0)
  const lastNotifiedMsRef = useRef<number>((() => { try { return Number(localStorage.getItem('rto_veh_last_notified_ms')) || 0 } catch { return 0 } })())
  // ✅ Consolidated servers state (both_live / both_down / mixed_* / portal_issue)
  const serversStateRef = useRef<string>((() => { try { return localStorage.getItem('rto_veh_servers_state') || '' } catch { return '' } })())

  function setStatus(s: 'live' | 'error') {
    if (statusRef.current === s) return
    statusRef.current = s
    setServerStatus(s)
    try { localStorage.setItem('rto_veh_server_status', s) } catch {}
  }

  function pushNotification(type: 'success' | 'error', message: string, at?: Date) {
    notifId.current += 1
    const d = at ?? new Date()
    const item = {
      id: notifId.current,
      type,
      message,
      time: d.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
    }
    const savedItem = { ...item, unread: true }
    setNotifications([savedItem])
    setUnread(1)
    try { localStorage.setItem('rto_veh_latest_notification', JSON.stringify(savedItem)) } catch {}
    setPopup({ type, message })
    if (popupTimer.current) window.clearTimeout(popupTimer.current)
    popupTimer.current = window.setTimeout(() => setPopup(null), 1000)
  }

  function notifyError(msg: string) {
    if (statusRef.current !== 'error' || lastErrMsgRef.current !== msg) {
      pushNotification('error', msg)
    }
    lastErrMsgRef.current = msg
  }

  function notifyDataUpdated(at?: Date) {
    pushNotification('success', 'Data successfully updated', at)
  }

  // ✅ Per-server state evaluation (4 = Vehicle Status, 5 = Distance Report)
  type ServerState = 'live' | 'down' | 'error'
  function evalServer(h: any): { state: ServerState; evTime: Date } {
    if (!h) return { state: 'down', evTime: new Date() }
    const keyRaw = h.updated_at ? String(h.updated_at) : ''
    const hbTime = keyRaw ? parseLocal(keyRaw).getTime() : 0
    const ageMs = hbTime ? Date.now() - hbTime : Infinity
    const evTime = hbTime ? new Date(hbTime) : new Date()
    const status = String(h.status ?? '').toLowerCase()
    if (status.includes('error')) return { state: 'error', evTime }
    if (status.includes('stopped')) return { state: 'down', evTime }
    if (ageMs > 90_000) return { state: 'down', evTime }
    return { state: 'live', evTime }
  }

  // ✅ CONSOLIDATED notification — dono servers ka haal EK message mein
  function notifyServersState(s4: { state: ServerState; evTime: Date }, s5: { state: ServerState; evTime: Date }) {
    const live4 = s4.state === 'live'
    const live5 = s5.state === 'live'
    const anyError = s4.state === 'error' || s5.state === 'error'

    let key = ''
    let type: 'success' | 'error' = 'success'
    let at = new Date()
    if (anyError) {
      key = 'portal_issue'; type = 'error'
      at = (s4.state === 'error' ? s4 : s5).evTime
    } else if (live4 && live5) {
      key = 'both_live'; type = 'success'
      at = s4.evTime > s5.evTime ? s4.evTime : s5.evTime
    } else if (!live4 && !live5) {
      key = 'both_down'; type = 'error'
      at = s4.evTime > s5.evTime ? s4.evTime : s5.evTime
    } else {
      key = live4 ? 'mixed_status_live' : 'mixed_distance_live'; type = 'error'
      at = live4 ? s5.evTime : s4.evTime
    }

    const prev = serversStateRef.current
    if (prev === key) return
    serversStateRef.current = key
    try { localStorage.setItem('rto_veh_servers_state', key) } catch {}
    if (!prev) return   // ✅ Pehli dafa sirf state save hoti hai (koi spam nahi)

    let msg = ''
    if (key === 'portal_issue') msg = 'Error: Portal Issue'
    else if (key === 'both_live') {
      if (prev === 'mixed_status_live') msg = 'Distance Report Server Started'
      else if (prev === 'mixed_distance_live') msg = 'Vehicle Status Server Started'
      else msg = 'Server Started'
    }
    else if (key === 'both_down') msg = 'Server Stopped'
    else {
      const downName = key === 'mixed_status_live' ? 'Distance Report' : 'Vehicle Status'
      const liveName = key === 'mixed_status_live' ? 'Vehicle Status' : 'Distance Report'
      msg = `${downName} Server Stopped • ${liveName} Server Running`
    }
    pushNotification(type, msg, at)
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [vRes, tRes, dRes, hbRes, drRes] = await Promise.all([
        supabase.from('vehiclesdata').select('*'),
        supabase.from('vehicle_tracking_status').select('fetched_at, reporting_status, status_text'),
        supabase.from('vehicle_distance_reports').select('*'),
        supabase.from('system_heartbeat').select('id, status, message, updated_at').in('id', [4, 5]),
        supabase.from('vehicledriversdata').select('*'),
      ])
      const rows = (vRes.data || []) as any[]
      setVehicles(rows.map(r => ({
        id: String(r.id ?? ''),
        type: String(r.type_of_vehicle ?? ''),
        registration: String(r.registration_number ?? ''),
        usedFor: String(r.used_for ?? ''),
        ucCircle: String(r.uc_circle ?? ''),
        status: r.category === 'unassigned' ? 'unassigned' : r.category === 'inactive' ? 'inactive' : 'assigned',
      })))

      // ✅ Mileage Statistics — latest distance report per vehicle + targets compare
      const distRows = (dRes.data || []) as any[]
      const latest = new Map<string, any>()
      for (const r of distRows) {
        const key = String(r.vehicle_reg_number || '').toUpperCase()
        const cur = latest.get(key)
        if (!cur || String(r.report_date || '') > String(cur.report_date || '')) latest.set(key, r)
      }
      const driversRows = (drRes.data || []) as any[]
      let mTotal = 0, mOk = 0, mLow = 0, mZero = 0
      const evalRow = (code: string, vType: string | null, usedFor: string | null) => {
        mTotal++
        const dist = latest.get(code)
        if (!dist) return
        const dispType = usedFor === 'Container-Repair Vehicle' || usedFor === 'Drain Cleaner'
          ? usedFor
          : (vType || dist?.veh_type || 'Other')
        const target = TARGETS[dispType] ?? 0
        const mileage = Number(dist.mileage ?? 0)
        const hoursSec = parseHours(dist.ig_on_time || '')
        if (mileage === 0) mZero++
        const mileageOk = target ? mileage >= target : true
        if (mileageOk && hoursSec >= HOURS_TARGET) mOk++
        else mLow++
      }
      if (driversRows.length) {
        for (const d of driversRows) {
          evalRow(String(d.vehicle_code || '').toUpperCase(), d.vehicle_type ?? null, d.used_for ?? null)
        }
      } else {
        for (const [code, r] of latest.entries()) evalRow(code, r.veh_type ?? null, null)
      }
      setMileageStats({ total: mTotal, ok: mOk, low: mLow, zero: mZero })

      // ✅ Vehicle Status counts — tracking table se live (har 15s silent update)
      const tRows = (tRes.data || []) as any[]
      const tReporting = tRows.filter(r => String(r.reporting_status || '').toLowerCase() === 'reporting').length
      const stTxt = (r: any) => String(r.status_text || '').toLowerCase()
      setTrackingStats({
        total: tRows.length,
        reporting: tReporting,
        notReporting: tRows.length - tReporting,
        moving: tRows.filter(r => stTxt(r).includes('mov')).length,
        parked: tRows.filter(r => stTxt(r).includes('park')).length,
        idling: tRows.filter(r => stTxt(r).includes('idl')).length,
      })

      // ✅ PILL TIME = max(fetched_at) of both tracking tables (sacha last-data-update)
      let maxT = 0
      for (const r of [...(tRes.data || []), ...(dRes.data || [])]) {
        const t = r.fetched_at ? parseLocal(r.fetched_at).getTime() : 0
        if (t > maxT) maxT = t
      }
      if (maxT > 0) {
        const newSyncTime = new Date(maxT)
        setLastUpdated(newSyncTime)
        try { localStorage.setItem('rto_veh_last_sync_ms', String(maxT)) } catch {}
        if (maxT !== lastNotifiedMsRef.current) {
          const hadPrev = lastNotifiedMsRef.current > 0
          lastNotifiedMsRef.current = maxT
          try { localStorage.setItem('rto_veh_last_notified_ms', String(maxT)) } catch {}
          if (hadPrev) notifyDataUpdated(newSyncTime)
          else {
            const saved = localStorage.getItem('rto_veh_latest_notification')
            if (saved) {
              try {
                const item = JSON.parse(saved)
                if (item && item.message === 'Data successfully updated') {
                  item.time = newSyncTime.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
                  localStorage.setItem('rto_veh_latest_notification', JSON.stringify(item))
                  setNotifications([item])
                }
              } catch {}
            }
          }
        }
      }

      // ✅ Heartbeats (4 = Vehicle Status, 5 = Distance Report) → consolidated state
      const hbRows = (hbRes.data || []) as any[]
      const s4 = evalServer(hbRows.find(r => Number(r.id) === 4))
      const s5 = evalServer(hbRows.find(r => Number(r.id) === 5))
      notifyServersState(s4, s5)
      setStatus(s4.state === 'live' && s5.state === 'live' ? 'live' : 'error')
    } catch (e) {
      console.error('Vehicles load error:', e)
      notifyError('Error: Data Load Issue')
    } finally {
      if (!silent) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load(false)
    const t = setInterval(() => load(true), 15_000)
    return () => clearInterval(t)
  }, [load])

  // ✅ Cross-tab sync (bell + pill doosre tabs mein bhi live)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rto_veh_latest_notification' && e.newValue) {
        try {
          const item = JSON.parse(e.newValue)
          if (item && item.message) {
            setNotifications([item])
            setUnread(item.unread ? 1 : 0)
          }
        } catch {}
      }
      if (e.key === 'rto_veh_last_notified_ms' && e.newValue) {
        lastNotifiedMsRef.current = Number(e.newValue) || lastNotifiedMsRef.current
      }
      if (e.key === 'rto_veh_last_sync_ms' && e.newValue) {
        const t = Number(e.newValue) || 0
        if (t > 0) setLastUpdated(new Date(t))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // ---- Stats
  const stats = useMemo(() => {
    const total = vehicles.length
    const assigned = vehicles.filter(v => v.status === 'assigned').length
    const unassigned = vehicles.filter(v => v.status === 'unassigned').length
    const inactive = vehicles.filter(v => v.status === 'inactive').length
    return { total, assigned, unassigned, inactive, active: assigned + unassigned }
  }, [vehicles])

  // ✅ Dynamic type breakdown (portal ke asal vehicle types)
  const typeBreakdown = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of vehicles) {
      const t = (v.type || 'Other').trim()
      m.set(t, (m.get(t) || 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [vehicles])

  // ---- Sliding pill (header tabs)
  const navRef = useRef<HTMLDivElement>(null)
  const [slider, setSlider] = useState({ left: 0, width: 0 })
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const update = () => {
      if (!navRef.current) return
      const activeBtn = navRef.current.querySelector('[data-active="true"]') as HTMLElement
      if (activeBtn) setSlider({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth })
    }
    update()
    const t = setTimeout(update, 100)
    window.addEventListener('resize', update)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', update)
    }
  }, [view])

  const tabs: { key: View; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'list', label: 'Vehicles List' },
    { key: 'mileage', label: 'Mileage Report' },
  ]

  const cardCls = 'rounded-[24px] border border-emerald-400/25 bg-linear-to-b from-[#073b2d] to-[#021d17] shadow-[0_20px_60px_rgba(0,0,0,0.3)]'

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#021b16] text-white">
      {/* ===== Top Navbar ===== */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="pointer-events-none bg-[#021b16] border-b border-white/10 md:border-b-0 shadow-[0_6px_24px_rgba(0,0,0,0.45)] md:shadow-none">
          <div className="relative flex items-center px-3 sm:px-6 py-2 sm:py-3 pointer-events-auto md:pointer-events-none">
            {/* Left: Home */}
            <div className="flex-1 flex justify-start pointer-events-auto">
              <button
                onClick={() => {
                  resetMonitoringTabs()
                  onHomeClick?.()
                  navigate('/home')
                }}
                aria-label="Back to Home"
                className="relative flex items-center gap-2 rounded-full border border-emerald-400/40 bg-[#021b16]/60 px-4 py-2.5 text-xs sm:text-sm font-bold text-emerald-200 transition-all duration-300 hover:bg-emerald-500/15 hover:shadow-[0_0_25px_rgba(0,255,170,0.25)]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span className="hidden sm:inline">Home</span>
              </button>
            </div>

            {/* Center: tabs */}
            <div className="relative pointer-events-auto">
              {/* ✅ Mobile LIVE pill — dynamic (dot + LAST UPDATED time) */}
              {lastUpdated && (
                <div className="md:hidden flex items-center gap-1 rounded-full border border-emerald-400/40 bg-[#021b16] px-1.5 py-[2px] pointer-events-none">
                  {serverStatus === 'live' ? (
                    <span className="relative flex h-1 w-1">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                      <span className="relative inline-flex h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.9)]" />
                    </span>
                  ) : (
                    <span className="relative flex h-1 w-1">
                      <span className="relative inline-flex h-1 w-1 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.9)] animate-pulse" />
                    </span>
                  )}
                  <span className={`text-[5px] font-bold tracking-[0.06em] ${serverStatus === 'live' ? 'text-emerald-300' : 'text-red-300'}`}>
                    {serverStatus === 'live' ? 'LIVE' : 'ERROR'}
                  </span>
                  <div className="h-1.5 w-px bg-white/15" />
                  <span className="text-[5px] font-bold tracking-[0.04em] text-white/45 whitespace-nowrap">LAST UPDATED</span>
                  <span className={`text-[6px] font-bold bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap ${
                    serverStatus === 'live'
                      ? 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]'
                      : 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]'
                  }`}>
                    {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                  </span>
                </div>
              )}

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="fixed right-3 top-16 z-40 w-56 rounded-2xl border border-white/10 bg-[#071b15] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-white/10 text-xs font-bold tracking-widest text-white/70">NAVIGATION</div>
                    {tabs.map(t => (
                      <button
                        key={t.key}
                        onClick={() => { setView(t.key); setMenuOpen(false) }}
                        className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors ${
                          view === t.key ? 'bg-emerald-500/15 text-emerald-300' : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <nav
                ref={navRef}
                className="hidden md:flex relative items-center gap-1.5 sm:gap-2 rounded-full border border-transparent bg-[#071b15]/90 backdrop-blur-md px-2 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_12px_35px_rgba(0,0,0,0.6)]"
              >
                <div
                  className="absolute top-1.5 bottom-1.5 rounded-full bg-linear-to-r from-[#00764c] to-[#058962] shadow-[0_0_15px_rgba(0,255,170,0.15)] transition-all duration-300 ease-out pointer-events-none"
                  style={{ left: slider.left, width: slider.width }}
                />
                {tabs.map(t => (
                  <button
                    key={t.key}
                    data-active={view === t.key}
                    onClick={() => setView(t.key)}
                    className={`relative z-10 px-2.5 sm:px-5 py-2 rounded-full text-[11px] sm:text-sm font-bold tracking-wide transition-all duration-300 whitespace-nowrap ${
                      view === t.key
                        ? 'text-white drop-shadow-[0_0_6px_rgba(167,243,208,0.4)]'
                        : 'text-white/60 hover:text-emerald-200 hover:drop-shadow-[0_0_4px_rgba(167,243,208,0.2)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Right: LIVE pill + bell + hamburger */}
            <div className="flex-1 flex justify-end items-center gap-2.5 pr-1 sm:pr-3 pointer-events-auto">
              {lastUpdated && (
                <div className="relative hidden lg:flex items-center gap-1 xl:gap-1.5 2xl:gap-2 rounded-full border border-emerald-400/40 bg-[#021b16]/60 px-2.5 py-1 xl:px-3 xl:py-1.5 2xl:px-4 2xl:py-2">
                  {serverStatus === 'live' ? (
                    <span className="relative flex h-1.5 w-1.5 xl:h-2 xl:w-2 2xl:h-2.5 2xl:w-2.5" title="Vehicle tracking live">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                      <span className="relative inline-flex h-1.5 w-1.5 xl:h-2 xl:w-2 2xl:h-2.5 2xl:w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                    </span>
                  ) : (
                    <span className="relative flex h-1.5 w-1.5 xl:h-2 xl:w-2 2xl:h-2.5 2xl:w-2.5" title="Tracking server stopped">
                      <span className="relative inline-flex h-1.5 w-1.5 xl:h-2 xl:w-2 2xl:h-2.5 2xl:w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse" />
                    </span>
                  )}
                  <span className={`text-[7px] xl:text-[8px] 2xl:text-[9px] font-bold tracking-[0.12em] xl:tracking-[0.14em] 2xl:tracking-[0.18em] ${serverStatus === 'live' ? 'text-emerald-300' : 'text-red-300'}`}>
                    {serverStatus === 'live' ? 'LIVE' : 'ERROR'}
                  </span>
                  <div className="h-2 xl:h-2.5 2xl:h-3 w-px bg-white/15" />
                  <span className="hidden xl:inline text-[8px] 2xl:text-[9px] font-bold tracking-[0.14em] 2xl:tracking-[0.18em] text-white/45">LAST UPDATED</span>
                  <span className={`xl:hidden text-[9px] font-bold bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap ${
                    serverStatus === 'live'
                      ? 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]'
                      : 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]'
                  }`}>
                    {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                  </span>
                  <span className={`hidden xl:inline 2xl:hidden text-[9px] font-bold bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap ${
                    serverStatus === 'live'
                      ? 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]'
                      : 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]'
                  }`}>
                    {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                  </span>
                  <span className={`hidden 2xl:inline text-[11px] font-bold bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap ${
                    serverStatus === 'live'
                      ? 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]'
                      : 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]'
                  }`}>
                    {`${String(lastUpdated.getDate()).padStart(2, '0')}-${String(lastUpdated.getMonth() + 1).padStart(2, '0')}-${lastUpdated.getFullYear()}`} — {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                  </span>
                </div>
              )}
              {/* ✅ Bell (notifications) */}
              <div className="relative">
                <button
                  onClick={() => {
                    setNotifOpen(v => !v)
                    setUnread(0)
                    try {
                      const saved = localStorage.getItem('rto_veh_latest_notification')
                      if (saved) {
                        const item = JSON.parse(saved)
                        item.unread = false
                        localStorage.setItem('rto_veh_latest_notification', JSON.stringify(item))
                      }
                    } catch {}
                  }}
                  aria-label="Notifications"
                  className="relative flex items-center justify-center rounded-full border-[1.5px] border-emerald-400/70 bg-[#021b16]/70 p-2.5 text-white/80 shadow-[0_0_12px_rgba(16,185,129,0.20)] hover:text-white hover:border-emerald-300 hover:shadow-[0_0_18px_rgba(52,211,153,0.40)] transition"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unread > 0 && <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]" />}
                </button>
                {popup && (
                  <div className={`absolute right-0 top-full mt-2 z-50 px-3 py-2 rounded-xl border text-[11px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.4)] whitespace-nowrap ${
                    popup.type === 'success' ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300' : 'bg-red-500/15 border-red-400/40 text-red-300'
                  }`}>
                    {popup.type === 'success' ? '✓ ' : '⚠ '}{popup.message}
                  </div>
                )}
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
                                  n.type === 'success' ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-red-400/30 bg-red-500/10'
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
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Menu"
                className="md:hidden relative flex items-center justify-center rounded-full border border-transparent bg-[#071b15]/80 p-2.5 text-white/70 hover:text-white transition"
              >
                {menuOpen ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {/* ✅ Tablet (md–lg): LIVE pill — alag row */}
          {lastUpdated && (
            <div className="hidden md:flex lg:hidden justify-center pb-1.5 pointer-events-none">
              <div className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-[#021b16] px-2 py-[3px]">
                {serverStatus === 'live' ? (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                  </span>
                ) : (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)] animate-pulse" />
                  </span>
                )}
                <span className={`text-[7px] font-bold tracking-[0.1em] ${serverStatus === 'live' ? 'text-emerald-300' : 'text-red-300'}`}>
                  {serverStatus === 'live' ? 'LIVE' : 'ERROR'}
                </span>
                <div className="h-2 w-px bg-white/15" />
                <span className="text-[7px] font-bold tracking-[0.08em] text-white/45">LAST UPDATED</span>
                <span className={`text-[8px] font-bold bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap ${
                  serverStatus === 'live'
                    ? 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]'
                    : 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]'
                }`}>
                  {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ===== Content ===== */}
      <main className={`px-4 sm:px-6 max-w-[1750px] mx-auto flex flex-col gap-6 ${view === 'list' || view === 'mileage' ? 'pt-24 md:pt-32 lg:pt-24 pb-4 h-dvh overflow-hidden' : 'pt-24 md:pt-32 lg:pt-24 pb-6'}`}>
        {view === 'dashboard' && (
          <div className="flex flex-col gap-6">
            {/* Center heading */}
            <div className="flex flex-col items-center -mb-1">
              <h1 className="text-center text-lg sm:text-xl md:text-2xl font-extrabold tracking-tight leading-none whitespace-nowrap">
                <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Vehicles </span>
                <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Dashboard</span>
              </h1>
              <p className="mt-1.5 sm:mt-2 text-center text-[10px] sm:text-xs font-semibold tracking-[0.08em] text-white/40 whitespace-nowrap">
                Live Monitoring — {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>

            {/* ROW 1: Stats + Graphs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
              {/* Stats Card */}
              <div className={`${cardCls} p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col gap-2 sm:gap-3 md:gap-4`}>
                <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold flex items-center gap-2 sm:gap-3">
                  <span className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-lg sm:rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-300">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 17h4V5H2v12h3" />
                      <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" />
                      <circle cx="7.5" cy="17.5" r="2.5" />
                      <circle cx="17.5" cy="17.5" r="2.5" />
                    </svg>
                  </span>
                  <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Vehicles </span>
                  <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Statistics</span>
                </h2>
                {/* ✅ 4 cards EK line mein — label upar (bold), value neeche */}
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  {[
                    { label: 'Total Vehicles', value: loading ? '—' : stats.total, border: 'border-amber-400/25', bg: 'bg-amber-500/10', grad: 'bg-[linear-gradient(180deg,#f59e0b,#fbbf24,#fde68a,#fbbf24,#f59e0b)]' },
                    { label: 'Assigned Vehicles', value: loading ? '—' : stats.assigned, border: 'border-emerald-400/25', bg: 'bg-emerald-500/10', grad: 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]' },
                    { label: 'Un-Assigned Vehicles', value: loading ? '—' : stats.unassigned, border: 'border-sky-400/25', bg: 'bg-sky-500/10', grad: 'bg-[linear-gradient(180deg,#0ea5e9,#38bdf8,#7dd3fc,#38bdf8,#0ea5e9)]' },
                    { label: 'In-Active Vehicles', value: loading ? '—' : stats.inactive, border: 'border-red-400/25', bg: 'bg-red-500/10', grad: 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]' },
                  ].map(row => (
                    <div
                      key={row.label}
                      className={`rounded-xl border ${row.border} ${row.bg} flex flex-col items-center justify-center gap-1.5 sm:gap-2 px-1 py-3 sm:py-5 transition-transform duration-300 hover:scale-[1.04]`}
                    >
                      <span className="text-[8px] sm:text-[11px] font-extrabold uppercase tracking-wider text-white/80 text-center leading-tight">
                        {row.label}
                      </span>
                      <span className={`text-xl sm:text-3xl font-extrabold ${row.grad} bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]`}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>  
              </div>

              {/* ✅ Mileage Statistics card (right side — same design) */}
              <div className={`${cardCls} p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col gap-2 sm:gap-3 md:gap-4`}>
                <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold flex items-center gap-2 sm:gap-3">
                  <span className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-lg sm:rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m12 14 4-4" />
                      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
                    </svg>
                  </span>
                  <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Mileage </span>
                  <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Statistics</span>
                </h2>
                {/* ✅ 4 cards EK line mein — label upar (bold), value neeche */}
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  {[
                    { label: 'Total Vehicles', value: loading ? '—' : mileageStats.total, border: 'border-amber-400/25', bg: 'bg-amber-500/10', grad: 'bg-[linear-gradient(180deg,#f59e0b,#fbbf24,#fde68a,#fbbf24,#f59e0b)]' },
                    { label: 'Mileage OK', value: loading ? '—' : mileageStats.ok, border: 'border-emerald-400/25', bg: 'bg-emerald-500/10', grad: 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]' },
                    { label: 'Mileage Low', value: loading ? '—' : mileageStats.low, border: 'border-orange-400/25', bg: 'bg-orange-500/10', grad: 'bg-[linear-gradient(180deg,#f97316,#fb923c,#fdba74,#fb923c,#f97316)]' },
                    { label: '0 Mileage', value: loading ? '—' : mileageStats.zero, border: 'border-red-400/25', bg: 'bg-red-500/10', grad: 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]' },
                  ].map(row => (
                    <div
                      key={row.label}
                      className={`rounded-xl border ${row.border} ${row.bg} flex flex-col items-center justify-center gap-1.5 sm:gap-2 px-1 py-3 sm:py-5 transition-transform duration-300 hover:scale-[1.04]`}
                    >
                      <span className="text-[8px] sm:text-[11px] font-extrabold uppercase tracking-wider text-white/80 text-center leading-tight">
                        {row.label}
                      </span>
                      <span className={`text-xl sm:text-3xl font-extrabold ${row.grad} bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]`}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ROW 1.5: Vehicle Status card — tracking live counts (6 mini cards) */}
            <div className={`${cardCls} p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col gap-2 sm:gap-3 md:gap-4`}>
              <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold flex items-center gap-2 sm:gap-3">
                <span className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-lg sm:rounded-xl border border-sky-400/30 bg-sky-500/10 text-sky-300">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </span>
                <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Vehicle </span>
                <span className="bg-[linear-gradient(180deg,#94a3b8,#cbd5e1,#e2e8f0,#cbd5e1,#94a3b8)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Status </span>
                <span className="bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">Statistics</span>
              </h2>
              {/* ✅ 6 cards — image jaisa layout (Total highlighted, baqi colored) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
                {[
                  { label: 'Total', value: loading ? '—' : trackingStats.total, border: 'border-emerald-400/40', bg: 'bg-emerald-500/20', grad: 'bg-[linear-gradient(180deg,#d1fae5,#ecfdf5,#ffffff,#ecfdf5,#d1fae5)]' },
                  { label: 'Reporting', value: loading ? '—' : trackingStats.reporting, border: 'border-emerald-400/25', bg: 'bg-emerald-500/10', grad: 'bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)]' },
                  { label: 'Not Reporting', value: loading ? '—' : trackingStats.notReporting, border: 'border-red-400/25', bg: 'bg-red-500/10', grad: 'bg-[linear-gradient(180deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444)]' },
                  { label: 'Moving', value: loading ? '—' : trackingStats.moving, border: 'border-sky-400/25', bg: 'bg-sky-500/10', grad: 'bg-[linear-gradient(180deg,#0ea5e9,#38bdf8,#7dd3fc,#38bdf8,#0ea5e9)]' },
                  { label: 'Parked', value: loading ? '—' : trackingStats.parked, border: 'border-amber-400/25', bg: 'bg-amber-500/10', grad: 'bg-[linear-gradient(180deg,#f59e0b,#fbbf24,#fde68a,#fbbf24,#f59e0b)]' },
                  { label: 'Idling', value: loading ? '—' : trackingStats.idling, border: 'border-purple-400/25', bg: 'bg-purple-500/10', grad: 'bg-[linear-gradient(180deg,#a855f7,#c084fc,#d8b4fe,#c084fc,#a855f7)]' },
                ].map(row => (
                  <div
                    key={row.label}
                    className={`rounded-xl border ${row.border} ${row.bg} flex flex-col items-center justify-center gap-1.5 sm:gap-2 px-1 py-3 sm:py-5 transition-transform duration-300 hover:scale-[1.04]`}
                  >
                    <span className="text-[8px] sm:text-[11px] font-extrabold uppercase tracking-wider text-white/80 text-center leading-tight">
                      {row.label}
                    </span>
                    <span className={`text-xl sm:text-3xl font-extrabold ${row.grad} bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ROW 2: Vehicle Type Breakdown — COMPACT premium cards */}
            <div className={`${cardCls} p-3 sm:p-5 flex flex-col gap-3 sm:gap-5`}>
              {/* Header: icon + title + line + slashes + subtitle */}
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-400/40 bg-[linear-gradient(135deg,rgba(16,185,129,0.35),rgba(4,35,28,0.9))] text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                    <path d="M15 18H9" />
                    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                    <circle cx="17" cy="18" r="2" />
                    <circle cx="7" cy="18" r="2" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h2 className="text-base sm:text-xl font-extrabold text-white whitespace-nowrap">Vehicle Type</h2>
                    <span className="text-base sm:text-xl font-extrabold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite] whitespace-nowrap">Breakdown</span>
                    <span className="hidden md:block h-px flex-1 bg-[linear-gradient(90deg,rgba(52,211,153,0.5),rgba(52,211,153,0.03))]" />
                    <span className="hidden md:flex items-center gap-1">
                      <span className="h-3 w-1 -skew-x-[20deg] bg-emerald-400" />
                      <span className="h-3 w-1 -skew-x-[20deg] bg-emerald-400" />
                    </span>
                  </div>
                  <p className="mt-0 text-[9px] sm:text-[10px] font-medium text-white/50">Total vehicles by type across the fleet</p>
                </div>
              </div>

              {/* Cards grid — COMPACT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
                {loading && typeBreakdown.length === 0 ? (
                  <div className="col-span-full text-center text-white/40 text-xs py-4">Loading vehicle types…</div>
                ) : typeBreakdown.length === 0 ? (
                  <div className="col-span-full text-center text-white/40 text-xs py-4">No vehicle data available</div>
                ) : (
                  typeBreakdown.map(([type, count], i) => {
                    const s = CARD_STYLES[i % CARD_STYLES.length]
                    const meta = typeMeta(type)
                    return (
                      <div key={type} className={`relative overflow-hidden rounded-2xl border p-2 sm:p-2.5 ${s.wrap} h-[140px] sm:h-[150px] flex flex-col`}>
                        {/* Diagonal light streaks (top-right) */}
                        <div className="pointer-events-none absolute -top-4 right-4 h-16 w-2.5 rotate-[24deg] bg-white/10" />
                        <div className="pointer-events-none absolute -top-4 right-8 h-16 w-0.5 rotate-[24deg] bg-white/10" />
                        
                        {/* Top row: icon badge + count | BARI vehicle image */}
                        <div className="flex items-start justify-between gap-1 flex-shrink-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`flex h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-full text-white ${s.icon}`}>
                              {TYPE_ICONS[meta.icon]}
                            </span>
                            <span className="text-lg sm:text-xl font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
                              {loading ? '—' : count}
                            </span>
                          </div>
                          {/* ✅ BARI Vehicle Image */}
                          <img 
                            src={meta.img} 
                            alt={type} 
                                                       
                              className="w-[100px] h-[100px] sm:w-[112px] sm:h-[112px] object-contain flex-shrink-0 drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)] pointer-events-none select-none mt-2"

                            draggable={false}
                          />
                        </div>
                        
                      {/* Name + description — image ke sath left side par */}
                      <div className="absolute left-2 sm:left-2.5 right-[105px] sm:right-[118px] top-[54px] sm:top-[75px] z-10 min-w-0">
                          <div className="text-[12px] sm:text-[14px] font-extrabold text-white leading-tight"title={type}>{type}</div>
                          <div className="mt-1 text-[10px] sm:text-[11px] font-medium leading-tight text-white/60">{meta.desc}</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== VIEW: Vehicles List ===== */}
        {view === 'list' && (
          loading ? (
            <div className={`${cardCls} p-10 text-center text-white/50 text-sm`}>Loading vehicles…</div>
          ) : (
            <Vehicles vehicles={vehicles} onRefresh={load} />
          )
        )}

        {/* ===== VIEW: Mileage Report ===== */}
        {view === 'mileage' && <MileageReport />}
      </main>
    </div>
  )
}