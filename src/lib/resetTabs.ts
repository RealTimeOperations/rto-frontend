// ✅ Home / Logout par sab monitoring dashboards + admin panel apne default tab par reset
export function resetMonitoringTabs() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      // ✅ Sab tab-persistence keys: rto_penalties_tab, rto_containers_tab, rto_attendance_tab, admin tab key
      if (k && (k.endsWith('_tab') || k.startsWith('rto_admin'))) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
  } catch {}
}