// ✅ Central API base — local/LAN par direct backend, live (pages.dev) par ngrok tunnel
function getApiBase(): string {
  const h = window.location.hostname
  if (h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.') || h.startsWith('172.')) {
    return `http://${h}:8000`
  }
  return 'https://provable-pulp-leotard.ngrok-free.dev'
}
export const API_BASE = getApiBase()