import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (localStorage.getItem('pwa-dismissed')) return

    // Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIOS(ios)

    // Listen for install prompt (Android/Chrome)
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault()
      setDeferredPrompt(e)
      setTimeout(() => setShow(true), 3000) // Show after 3s
    })

    // Show iOS hint after 3s
    if (ios) setTimeout(() => setShow(true), 3000)
  }, [])

  function dismiss() {
    setShow(false)
    setDismissed(true)
    localStorage.setItem('pwa-dismissed', '1')
  }

  async function install() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setShow(false)
    }
  }

  if (!show || dismissed) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      zIndex: 200,
      background: 'var(--green-dark)',
      color: 'white',
      padding: 'calc(env(safe-area-inset-top) + 12px) 16px 12px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      animation: 'slideDown 0.3s ease',
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Download size={18} color="white" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 1 }}>Installa NutriPlan</p>
        {isIOS
          ? <p style={{ fontSize: 12, opacity: 0.8 }}>Tocca <strong>Condividi</strong> poi <strong>"Aggiungi a schermata Home"</strong></p>
          : <p style={{ fontSize: 12, opacity: 0.8 }}>Aggiungi l'app al tuo dispositivo</p>
        }
      </div>
      {!isIOS && (
        <button onClick={install} style={{ background: 'white', color: 'var(--green-dark)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          Installa
        </button>
      )}
      <button onClick={dismiss} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
        <X size={18} />
      </button>

      <style>{`@keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }`}</style>
    </div>
  )
}
