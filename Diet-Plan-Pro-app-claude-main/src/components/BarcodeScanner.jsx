import { useState, useEffect, useRef } from 'react'
import { X, Camera, AlertCircle } from 'lucide-react'

export default function BarcodeScanner({ onFound, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const detectorRef = useRef(null)
  const intervalRef = useRef(null)
  const [stage, setStage] = useState('idle') // idle | starting | scanning | error
  const [error, setError] = useState('')
  const [manualCode, setManualCode] = useState('')
  const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window

  useEffect(() => () => cleanup(), [])

  function cleanup() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
  }

  async function startCamera() {
    setStage('starting')
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStage('scanning')
      if (hasDetector) {
        detectorRef.current = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'],
        })
        intervalRef.current = setInterval(scanFrame, 400)
      }
    } catch (e) {
      setStage('error')
      const msg = e?.message || ''
      setError(
        msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')
          ? 'Accesso alla fotocamera negato. Controlla i permessi del browser.'
          : 'Impossibile avviare la fotocamera. Usa il campo manuale qui sotto.'
      )
    }
  }

  async function scanFrame() {
    if (!videoRef.current || !detectorRef.current || videoRef.current.readyState < 2) return
    try {
      const codes = await detectorRef.current.detect(videoRef.current)
      if (codes.length > 0) {
        clearInterval(intervalRef.current)
        cleanup()
        onFound(codes[0].rawValue)
      }
    } catch { /* ignore */ }
  }

  function handleManual(e) {
    e.preventDefault()
    if (manualCode.trim()) {
      cleanup()
      onFound(manualCode.trim())
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div className="animate-slideUp" style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: 20, paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>📷 Scanner codice a barre</h3>
          <button onClick={() => { cleanup(); onClose() }} style={{ background: 'var(--surface-2)', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* Video feed */}
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000', marginBottom: 14, display: stage === 'scanning' || stage === 'starting' ? 'block' : 'none' }}>
          <video ref={videoRef} style={{ width: '100%', maxHeight: 270, display: 'block', objectFit: 'cover' }} muted playsInline />
          {stage === 'starting' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
              <div style={{ width: 26, height: 26, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            </div>
          )}
          {stage === 'scanning' && hasDetector && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ width: '72%', height: 88, border: '2px solid rgba(255,255,255,0.85)', borderRadius: 10, boxShadow: '0 0 0 9999px rgba(0,0,0,0.42)' }} />
              <p style={{ position: 'absolute', bottom: 12, color: 'white', fontSize: 12, fontWeight: 500, background: 'rgba(0,0,0,0.35)', padding: '3px 10px', borderRadius: 100 }}>Inquadra il codice a barre</p>
            </div>
          )}
          {stage === 'scanning' && !hasDetector && (
            <p style={{ position: 'absolute', bottom: 10, width: '100%', textAlign: 'center', color: 'white', fontSize: 12, background: 'rgba(0,0,0,0.4)', padding: '4px 0' }}>
              Scanner non supportato — inserisci il codice manualmente
            </p>
          )}
        </div>

        {/* Hidden video placeholder when camera not active */}
        {stage !== 'scanning' && stage !== 'starting' && (
          <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
        )}

        {/* Error */}
        {stage === 'error' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#fff0f0', padding: '10px 12px', borderRadius: 10, marginBottom: 14, color: '#dc4a4a', fontSize: 13 }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Start camera button */}
        {stage === 'idle' && (
          <button className="btn btn-primary btn-full" onClick={startCamera} style={{ marginBottom: 14 }}>
            <Camera size={16} /> Avvia fotocamera
          </button>
        )}

        {/* Manual code input */}
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            {stage === 'idle' ? 'Oppure inserisci il codice manualmente:' : 'Inserisci il codice manualmente:'}
          </p>
          <form onSubmit={handleManual} style={{ display: 'flex', gap: 8 }}>
            <input
              className="input-field"
              value={manualCode}
              onChange={e => setManualCode(e.target.value.replace(/\D/g, ''))}
              placeholder="es. 8001234567890"
              style={{ flex: 1 }}
              inputMode="numeric"
              pattern="[0-9]*"
            />
            <button type="submit" className="btn btn-primary" disabled={!manualCode.trim()} style={{ flexShrink: 0 }}>
              Cerca
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
