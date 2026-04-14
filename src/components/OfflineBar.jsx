import { useState, useEffect, useCallback } from 'react'
import { WifiOff, Wifi, RefreshCw } from 'lucide-react'

/**
 * Shows a banner when the device is offline.
 * When connectivity is restored, fires onReconnect so callers can refresh data.
 */
export default function OfflineBar({ onReconnect }) {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [justReconnected, setJustReconnected] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const handleOnline = useCallback(async () => {
    setOnline(true)
    setJustReconnected(true)
    setSyncing(true)
    try {
      if (typeof onReconnect === 'function') await onReconnect()
    } finally {
      setSyncing(false)
      setTimeout(() => setJustReconnected(false), 3000)
    }
  }, [onReconnect])

  const handleOffline = useCallback(() => {
    setOnline(false)
    setJustReconnected(false)
  }, [])

  useEffect(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  if (online && !justReconnected) return null

  const isOffline = !online

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300,
      background: isOffline ? '#2d2d2d' : 'var(--green-main)',
      color: 'white',
      padding: 'calc(env(safe-area-inset-top) + 10px) 16px 10px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontSize: 13, fontWeight: 500,
      transition: 'background 0.3s',
      animation: 'slideDown 0.3s ease',
    }}>
      {isOffline
        ? <><WifiOff size={15} /> Nessuna connessione – modalità offline</>
        : syncing
          ? <><RefreshCw size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> Sincronizzazione in corso…</>
          : <><Wifi size={15} /> Connessione ripristinata!</>
      }
    </div>
  )
}
