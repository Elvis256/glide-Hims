// Offline detection event hub.
// Wraps the browser's online/offline events plus a periodic backend health
// probe so we can detect "captive portal" / "DNS resolves but API is down"
// situations that the bare `navigator.onLine` flag misses.

type Listener = (online: boolean) => void;

let online = typeof navigator !== 'undefined' ? navigator.onLine : true;
let probing = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => {
    try { l(online); } catch { /* ignore listener errors */ }
  });
}

function setOnline(next: boolean) {
  if (next === online) return;
  online = next;
  emit();
}

async function probe() {
  if (probing) return;
  probing = true;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch('/api/v1/health', {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl.signal,
      credentials: 'omit',
    });
    clearTimeout(t);
    setOnline(r.ok);
  } catch {
    setOnline(false);
  } finally {
    probing = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online',  () => { setOnline(true); void probe(); });
  window.addEventListener('offline', () => setOnline(false));
  // Probe every 30 s; cheap and catches API-down scenarios
  setInterval(() => { void probe(); }, 30_000);
  // First probe shortly after mount so the badge stabilises
  setTimeout(() => { void probe(); }, 2_000);
}

export const offline = {
  isOnline: () => online,
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  forceProbe: probe,
};
