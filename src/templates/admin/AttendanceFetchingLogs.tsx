import { useCallback, useEffect, useRef, useState } from 'react'

// Backend runs on the local PC (same machine as the portal fetching processes)
const SYNC_API = 'http://localhost:8000'
// Remembers that the STARTED banner was already shown for the current run,
// so page refreshes do not repeat it until the process is stopped + started again
const STARTED_SHOWN_KEY = 'rto_fetchlog_started_shown'

export default function AttendanceFetchingLogs() {
  const [attLines, setAttLines] = useState<string[]>([])
  const [empLines, setEmpLines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [process, setProcess] = useState<{ running: boolean; pid: number | null } | null>(null)
  const [busy, setBusy] = useState<'start' | 'stop' | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const [showStarted, setShowStarted] = useState(false)
  const [clearArm, setClearArm] = useState(false)
  const [lastLoad, setLastLoad] = useState<Date | null>(null)
  const attRef = useRef<HTMLPreElement>(null)
  const empRef = useRef<HTMLPreElement>(null)
  const prevRunning = useRef<boolean | null>(null)
  const startedTimer = useRef<number | null>(null)
  const clearTimer = useRef<number | null>(null)

  // ---- Load both logs + process status from the backend
  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [att, emp, st] = await Promise.all([
        fetch(`${SYNC_API}/logs/attendance?lines=300`),
        fetch(`${SYNC_API}/logs/employees?lines=300`),
        fetch(`${SYNC_API}/process/status`),
      ])
      if (!att.ok || !emp.ok || !st.ok) throw new Error('Server error')
      const attJson = await att.json()
      const empJson = await emp.json()
      const stJson = await st.json()
      setAttLines(attJson.lines ?? [])
      setEmpLines(empJson.lines ?? [])
      setProcess({ running: !!stJson.running, pid: stJson.pid ?? null })
      setError('')
      setLastLoad(new Date())
    } catch {
      setError('Cannot reach the backend server (localhost:8000). Make sure the PC running the backend is ON and the Sync API process is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // ---- Silent auto refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(() => loadAll(true), 5000)
    return () => clearInterval(t)
  }, [autoRefresh, loadAll])

  // ---- Keep both boxes scrolled to the bottom when new lines arrive
  useEffect(() => {
    if (attRef.current) attRef.current.scrollTop = attRef.current.scrollHeight
    if (empRef.current) empRef.current.scrollTop = empRef.current.scrollHeight
  }, [attLines, empLines])

  // ---- STARTED banner: shows ONCE per run (2 seconds), never repeats on refresh.
  //      Re-arms only after the process stops and starts again.
  //      STOPPED banner: stays visible the whole time the process is stopped.
  useEffect(() => {
    if (!process) return
    const running = process.running
    if (prevRunning.current === running) return
    prevRunning.current = running
    if (running) {
      const alreadyShown = localStorage.getItem(STARTED_SHOWN_KEY)
      if (!alreadyShown) {
        setShowStarted(true)
        localStorage.setItem(STARTED_SHOWN_KEY, '1')
        if (startedTimer.current) window.clearTimeout(startedTimer.current)
        startedTimer.current = window.setTimeout(() => setShowStarted(false), 2000)
      }
    } else {
      setShowStarted(false)
      localStorage.removeItem(STARTED_SHOWN_KEY)   // re-arm for the next start
    }
  }, [process])

  // ---- Clear employee logs (two-step button: arm -> confirm)
  function armClear() {
    if (clearArm) {
      doClear()
      return
    }
    setClearArm(true)
    if (clearTimer.current) window.clearTimeout(clearTimer.current)
    clearTimer.current = window.setTimeout(() => setClearArm(false), 3000)
  }

  async function doClear() {
    setClearArm(false)
    if (clearTimer.current) window.clearTimeout(clearTimer.current)
    try {
      await fetch(`${SYNC_API}/logs/employees/clear`, { method: 'POST' })
      setEmpLines([])
    } catch {
      // backend unreachable — next auto refresh will show the error banner
    }
  }

  // ---- Start the attendance process
  async function startProcess() {
    setBusy('start')
    try {
      const res = await fetch(`${SYNC_API}/process/start`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.detail || 'Server error: ' + res.status)
      setTimeout(() => loadAll(true), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start process')
    } finally {
      setBusy(null)
    }
  }

  // ---- Stop the attendance process
  async function stopProcess() {
    setConfirmStop(false)
    setBusy('stop')
    try {
      const res = await fetch(`${SYNC_API}/process/stop`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.detail || 'Server error: ' + res.status)
      setTimeout(() => loadAll(true), 800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to stop process')
    } finally {
      setBusy(null)
    }
  }

  const btnBase = 'h-9 px-4 rounded-xl text-xs font-bold transition disabled:opacity-50'

  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold bg-[linear-gradient(180deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)] bg-[length:100%_200%] bg-clip-text text-transparent animate-[text-run-vertical_2.5s_linear_infinite]">
          Attendance Fetch Logs
        </h1>
        <p className="text-xs text-white/50 mt-1">
          Live output of the attendance fetching process (checks the portal every 15 seconds) and the employee (HR) sync triggered by the Update HR button
        </p>
      </div>

      {/* STOPPED banner — stays visible while the process is stopped */}
      {process && !process.running && (
        <div className="bg-red-500/10 border border-red-400/40 text-red-300 text-sm p-3 rounded-xl flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          </span>
          PROCESS STOPPED — attendance fetching is not running
        </div>
      )}

      {/* STARTED banner — shows once for 2 seconds per run, then hides */}
      {process && process.running && showStarted && (
        <div className="bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 text-sm p-3 rounded-xl flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          PROCESS STARTED — attendance fetching is running (PID {process.pid})
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center flex-wrap gap-2.5">
        <button
          onClick={startProcess}
          disabled={busy !== null || (process?.running ?? false)}
          className={`${btnBase} running-button text-white`}
        >
          {busy === 'start' ? 'Starting…' : '▶ Start Process'}
        </button>
        <button
          onClick={() => setConfirmStop(true)}
          disabled={busy !== null || !(process?.running ?? false)}
          className={`${btnBase} bg-red-500/15 border border-red-400/40 text-red-300 hover:bg-red-500/25`}
        >
          {busy === 'stop' ? 'Stopping…' : '⏹ Stop Process'}
        </button>
        <button
          onClick={() => loadAll()}
          disabled={busy !== null}
          className={`${btnBase} bg-white/5 border border-white/15 text-white/70 hover:bg-white/10`}
        >
          ⟳ Refresh
        </button>
        <label className="flex items-center gap-2 text-xs font-semibold text-white/60 ml-auto cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={e => setAutoRefresh(e.target.checked)}
            className="h-4 w-4 accent-emerald-500"
          />
          Auto refresh (5s)
        </label>
        <span className="text-[10px] text-white/40 w-full text-right">
          {loading ? 'Loading…' : lastLoad ? `Last loaded: ${lastLoad.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}` : ''}
        </span>
      </div>

      {/* Backend unreachable banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-300 hover:text-red-200 text-lg font-bold leading-none">✕</button>
        </div>
      )}

      {/* ===== Box 1: Attendance fetching logs (top) — height fits the content ===== */}
      <div className="rounded-2xl border border-emerald-500/15 bg-[#04120e] shadow-[0_8px_20px_rgba(0,0,0,0.3)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-400/20 bg-emerald-500/5">
          <span className="text-[13px] sm:text-sm font-extrabold tracking-[0.14em] text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.45)]">
            ATTENDANCE FETCHING LOGS
          </span>
          <span className="text-[10px] text-white/40">auto_attendance.log</span>
        </div>
        <pre
          ref={attRef}
          className="max-h-[40vh] min-h-[64px] overflow-auto px-4 py-3 text-[11px] leading-relaxed text-emerald-100/90 font-mono whitespace-pre-wrap [scrollbar-width:thin]"
        >
          {loading && attLines.length === 0
            ? 'Loading logs…'
            : attLines.length === 0
              ? '(Log file is empty — no entries yet)'
              : attLines.join('\n')}
        </pre>
      </div>

      {/* ===== Box 2: Employee fetching logs (bottom) — with Clear option ===== */}
      <div className="rounded-2xl border border-sky-500/15 bg-[#04120e] shadow-[0_8px_20px_rgba(0,0,0,0.3)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-sky-400/20 bg-sky-500/5">
          <span className="text-[13px] sm:text-sm font-extrabold tracking-[0.14em] text-sky-300 drop-shadow-[0_0_10px_rgba(56,189,248,0.45)]">
            EMPLOYEE FETCHING LOGS
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/40">employees_sync.log</span>
            <button
              onClick={armClear}
              disabled={empLines.length === 0}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition disabled:opacity-40 ${
                clearArm
                  ? 'bg-red-500/20 border border-red-400/40 text-red-300'
                  : 'bg-white/5 border border-white/15 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {clearArm ? 'Confirm Clear?' : '🗑 Clear Logs'}
            </button>
          </div>
        </div>
        <pre
          ref={empRef}
          className="max-h-[35vh] min-h-[64px] overflow-auto px-4 py-3 text-[11px] leading-relaxed text-sky-100/90 font-mono whitespace-pre-wrap [scrollbar-width:thin]"
        >
          {loading && empLines.length === 0
            ? 'Loading logs…'
            : empLines.length === 0
              ? '(No employee sync logs — they will appear after the next Update HR)'
              : empLines.join('\n')}
        </pre>
      </div>

      {/* Stop confirmation modal */}
      {confirmStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-linear-to-br from-[#0d372c] to-[#08261f] border border-red-400/20 rounded-2xl p-7 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
            <h3 className="text-lg font-bold text-red-300 mb-2">Stop Fetching Process</h3>
            <p className="text-white/60 text-sm mb-6">
              The attendance fetching process will stop. Live data will no longer be updated until you start it again. Continue?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmStop(false)}
                className="flex-1 py-2.5 bg-white/5 border border-white/15 rounded-full text-white/70 text-sm font-semibold hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={stopProcess}
                disabled={busy !== null}
                className="flex-1 py-2.5 bg-red-500/20 border border-red-500/40 rounded-full text-red-300 text-sm font-bold hover:bg-red-500/30 transition disabled:opacity-50"
              >
                {busy === 'stop' ? 'Stopping…' : 'Yes, Stop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}