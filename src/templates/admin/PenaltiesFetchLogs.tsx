import { useCallback, useEffect, useRef, useState } from 'react'

const API = 'http://localhost:8000'

export default function PenaltiesFetchLogs() {
  const [lines, setLines] = useState<string[]>([])
  const [running, setRunning] = useState<boolean>(false)
  const [pid, setPid] = useState<number | null>(null)
  const [busy, setBusy] = useState<'start' | 'stop' | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastLoaded, setLastLoaded] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const runningRef = useRef(false)
  const msgTimer = useRef<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/penalties/logs`)
      if (res.ok) {
        setBackendOk(true)
        const d = await res.json()
        setLines(d.lines ?? [])
        const r = !!d.running
        if (r !== runningRef.current) {
          runningRef.current = r
          setMsg(null)
        }
        setRunning(r)
        setPid(d.pid ?? null)
        setLastLoaded(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
      } else {
        setBackendOk(false)
      }
    } catch {
      setBackendOk(false)
      setRunning(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(load, 2000)
    return () => clearInterval(t)
  }, [autoRefresh, load])

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [lines])

  function flash(type: 'success' | 'error', text: string) {
    setMsg({ type, text })
    if (msgTimer.current) window.clearTimeout(msgTimer.current)
    msgTimer.current = window.setTimeout(() => setMsg(null), 6000)
  }

  async function start() {
    setBusy('start')
    setMsg(null)
    try {
      const res = await fetch(`${API}/penalties/start`, { method: 'POST' })
      const d = await res.json()
      flash(d.ok ? 'success' : 'error', d.message || (d.ok ? 'Server started' : 'Start failed - check backend'))
      load()
      setTimeout(load, 1000)
      setTimeout(load, 2500)
    } catch {
      flash('error', 'Backend not responding (port 8000)')
    } finally {
      setBusy(null)
    }
  }

  async function stop() {
    setBusy('stop')
    setMsg(null)
    try {
      const res = await fetch(`${API}/penalties/stop`, { method: 'POST' })
      const d = await res.json()
      flash(d.ok ? 'success' : 'error', d.message || (d.ok ? 'Server stopped' : 'Stop failed - check backend'))
      load()
      setTimeout(load, 800)
    } catch {
      flash('error', 'Backend not responding (port 8000)')
    } finally {
      setBusy(null)
    }
  }

  function lineColor(ln: string) {
    if (/error|failed|stopped/i.test(ln)) return 'text-red-300'
    if (/started|updated|fetched/i.test(ln)) return 'text-emerald-300'
    if (/paused|no data/i.test(ln)) return 'text-white/50'
    return 'text-white/80'
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Title + subtitle */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-300">Penalties Fetch Logs</h1>
        <p className="text-xs sm:text-sm text-white/50 mt-1">
          Live output of the penalties fetching process (checks the portal every 30 seconds)
        </p>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={start}
          disabled={busy !== null || running}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-[#00764c] to-[#058962] text-white text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {busy === 'start' ? '⏳' : '▶'} Start Process
        </button>
        <button
          onClick={stop}
          disabled={busy !== null || !running}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/15 border border-red-400/40 text-red-300 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-500/25"
        >
          {busy === 'stop' ? '⏳' : '⏹'} Stop Process
        </button>
        <button
          onClick={load}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white/80 text-sm font-bold transition hover:bg-white/10"
        >
          ⟳ Refresh
        </button>

        <div className="ml-auto flex flex-col items-end gap-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
            <span className="text-sm font-bold text-white/85">Auto refresh (2s)</span>
          </label>
          <span className="text-[10px] text-white/40">Last loaded: {lastLoaded || '—'}</span>
        </div>
      </div>

      {/* Backend missing banner */}
      {backendOk === false && (
        <div className="px-4 py-3 rounded-xl border bg-red-500/15 border-red-400/40 text-red-300 text-xs sm:text-sm font-semibold">
          ⚠ Backend endpoint /penalties/logs not responding — restart backend (python main.py) and make sure penalties_router is registered.
        </div>
      )}

      {/* Status + message */}
      {msg && msg.text && (
        <div className={`px-4 py-3 rounded-xl border text-xs sm:text-sm font-semibold ${
          msg.type === 'success' ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300' : 'bg-red-500/15 border-red-400/40 text-red-300'
        }`}>
          {msg.type === 'success' ? '✓ ' : '⚠ '}{msg.text}
        </div>
      )}

      {/* Log card */}
      <div className="rounded-2xl border border-emerald-400/20 bg-[#04231c] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-emerald-400/15">
          <span className="text-emerald-300 font-extrabold tracking-[0.2em] text-xs sm:text-sm uppercase">
            Penalties Fetching Logs
          </span>
          <span className="text-[10px] text-white/40">
            penalties_auto.log • {running ? `RUNNING${pid ? ` (PID ${pid})` : ''}` : 'STOPPED'}
          </span>
        </div>
        <div
          ref={boxRef}
          className="px-5 py-4 h-[55vh] overflow-auto font-mono text-[11px] sm:text-xs leading-relaxed whitespace-pre-wrap [scrollbar-width:thin] [scrollbar-color:rgba(16,185,129,0.4)_transparent]"
        >
          {lines.length === 0 ? (
            <span className="text-white/40">
              {running ? 'Loading logs…' : 'Server stopped - press Start Process.'}
            </span>
          ) : (
            lines.map((ln, i) => (
              <div key={i} className={lineColor(ln)}>{ln}</div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}