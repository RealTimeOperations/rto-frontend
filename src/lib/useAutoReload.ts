import { useEffect } from 'react'

// ✅ Module-level baseline: pehli fetch ka hash yaad rakho
let baselineHash: string | null = null

function djb2(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0
  }
  return String(h)
}

async function fetchIndexHtml(): Promise<string> {
  const url = `${window.location.origin}${import.meta.env.BASE_URL}index.html`
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/**
 * ✅ Auto-reload on new deploy: har 30s index.html ka hash check karo.
 * Naya build deploy hote hi Vite hashed filenames badal deta hai → hash change → auto reload.
 */
export default function useAutoReload(intervalMs = 30_000) {
  useEffect(() => {
    let alive = true
    let timer: number | undefined

    const check = async () => {
      try {
        const html = await fetchIndexHtml()
        const h = djb2(html)
        if (baselineHash === null) {
          baselineHash = h
        } else if (h !== baselineHash) {
          // Naya version deploy ho gaya — foran reload
          window.location.reload()
          return
        }
      } catch {
        // network error — ignore, agla cycle try karega
      }
      if (alive) timer = window.setTimeout(check, intervalMs)
    }

    check()
    return () => {
      alive = false
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [intervalMs])
}