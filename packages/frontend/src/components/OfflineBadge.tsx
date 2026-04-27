import { useEffect, useState } from 'react';
import { offline } from '../lib/offline';

/**
 * Small floating badge that appears whenever the backend is unreachable.
 * Hidden when online so it doesn't clutter the UI in normal operation.
 */
export default function OfflineBadge() {
  const [online, setOnline] = useState(offline.isOnline());

  useEffect(() => offline.subscribe(setOnline), []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      title="Backend unreachable. Reads from cached data; writes are paused."
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        background: '#b91c1c',
        color: '#fff',
        padding: '6px 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span
        style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#fca5a5', animation: 'pulse 1.4s infinite',
        }}
      />
      Offline mode
    </div>
  );
}
