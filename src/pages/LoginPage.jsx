import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Leaf, Eye, EyeOff, AlertCircle, Fingerprint } from 'lucide-react'
import {
  isBiometricSupported,
  isBiometricAvailable,
  getBiometricCredentialId,
  getBiometricUserId,
  authenticateBiometric,
} from '../lib/biometric'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasBiometric, setHasBiometric] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Show biometric button only if the device supports it AND a credential is stored
    async function check() {
      const credId = getBiometricCredentialId()
      if (!credId) return
      const available = await isBiometricAvailable()
      setHasBiometric(available)
    }
    if (isBiometricSupported()) check()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Email o password non corretti'
        : error.message)
    } else {
      navigate('/')
    }
    setLoading(false)
  }

  async function handleBiometricLogin() {
    setError('')
    setBiometricLoading(true)
    try {
      const ok = await authenticateBiometric()
      if (!ok) { setError('Autenticazione biometrica annullata.'); return }

      // Re-use the existing Supabase session (user already authenticated before,
      // the biometric gesture just confirms physical presence).
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        navigate('/')
      } else {
        setError('Sessione scaduta. Accedi con email e password.')
      }
    } catch (e) {
      setError(e?.message || 'Autenticazione biometrica non riuscita.')
    } finally {
      setBiometricLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', width: '100%', display: 'flex',
      flexDirection: 'row', position: 'relative', overflow: 'hidden',
    }}>
      {/* Left branding panel — visible on larger screens */}
      <div className="login-brand-panel" style={{
        flex: 1, display: 'none', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, var(--green-dark) 0%, var(--green-main) 40%, var(--green-mid) 100%)',
        position: 'relative', overflow: 'hidden', padding: '60px 40px',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.07) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.09) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 40%)',
        }} />
        <div style={{
          position: 'absolute', top: -80, right: -80, width: 300, height: 300,
          borderRadius: '50%', background: 'rgba(255,255,255,0.04)',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -60, width: 220, height: 220,
          borderRadius: '50%', background: 'rgba(255,255,255,0.03)',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 380 }}>
          <div style={{
            width: 88, height: 88, borderRadius: 26,
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 28px',
            border: '1px solid rgba(255,255,255,0.25)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
          }}>
            <Leaf size={44} color="white" />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-d)', fontSize: 38, color: 'white',
            fontWeight: 300, letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: 14,
          }}>
            Diet Plan Pro
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 17, lineHeight: 1.6 }}>
            Il tuo piano nutrizionale personalizzato, sempre a portata di mano
          </p>
          <div style={{
            display: 'flex', gap: 20, justifyContent: 'center', marginTop: 40,
          }}>
            {[
              { icon: '🥗', label: 'Dieta su misura' },
              { icon: '📊', label: 'Traccia i macro' },
              { icon: '💧', label: 'Obiettivi idrici' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16,
                  background: 'rgba(255,255,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, border: '1px solid rgba(255,255,255,0.15)',
                }}>
                  {item.icon}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 500 }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel — always fills remaining space */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg, var(--green-mist) 0%, var(--surface-2) 100%)',
        padding: '40px 20px', position: 'relative', minHeight: '100dvh',
        overflow: 'auto',
      }}>
        {/* Mobile-only header with gradient */}
        <div className="login-mobile-header" style={{
          textAlign: 'center', marginBottom: 32,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: 'linear-gradient(135deg, var(--green-main), var(--green-mid))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px',
            boxShadow: '0 8px 28px rgba(21,122,74,0.3)',
          }}>
            <Leaf size={32} color="white" />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-d)', fontSize: 28, color: 'var(--text-primary)',
            fontWeight: 400, letterSpacing: '-0.3px', lineHeight: 1.2,
          }}>
            Bentornato
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>
            Il tuo piano nutrizionale ti aspetta
          </p>
        </div>

        {/* Form card */}
        <div className="card animate-slideUp" style={{
          borderRadius: 'var(--r-xl)', padding: '36px 32px',
          width: '100%', maxWidth: 440,
          boxShadow: '0 20px 60px rgba(10,74,46,0.08), 0 1px 3px rgba(10,74,46,0.06)',
          border: '1px solid var(--border-light)',
        }}>
          <h2 style={{
            fontSize: 22, fontWeight: 600, marginBottom: 6,
            color: 'var(--text-primary)', letterSpacing: '-0.2px',
          }}>
            Accedi
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
            Inserisci le tue credenziali per continuare
          </p>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff0f0', border: '1px solid #ffd4d4',
              borderRadius: 'var(--r-sm)', padding: '12px 14px',
              marginBottom: 20, color: 'var(--red)', fontSize: 14,
            }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input
                type="email" className="input-field"
                placeholder="nome@email.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field"
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password"
                  style={{ paddingRight: 48 }}
                />
                <button type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center',
                  }}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}
              style={{ marginTop: 6, padding: '14px 22px', fontSize: 15 }}>
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Accesso in corso…
                  </span>
                : 'Accedi'}
            </button>
          </form>

          {hasBiometric && (
            <>
              <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>oppure</span>
                <span style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
              </div>
              <button
                onClick={handleBiometricLogin}
                disabled={biometricLoading}
                className="btn btn-secondary btn-full"
                style={{ gap: 10 }}
              >
                {biometricLoading
                  ? <span style={{ width: 16, height: 16, border: '2px solid var(--green-main)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  : <Fingerprint size={20} />
                }
                {biometricLoading ? 'Verifica in corso…' : 'Accedi con Face ID / Touch ID'}
              </button>
            </>
          )}

          <div className="divider" />

          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
            Non hai un account?{' '}
            <Link to="/register" style={{ color: 'var(--green-main)', fontWeight: 600, textDecoration: 'none' }}>
              Registrati
            </Link>
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 28 }}>
          Sei un dietista?{' '}
          <a href="https://nutri-plan-pro-cxee.vercel.app" style={{ color: 'var(--green-main)', fontWeight: 500, textDecoration: 'none' }}>
            Accedi alla piattaforma professionale →
          </a>
        </p>
      </div>

      {/* Responsive styles injected once */}
      <style>{`
        @media (min-width: 768px) {
          .login-brand-panel { display: flex !important; }
          .login-mobile-header { display: none !important; }
        }
      `}</style>
    </div>
  )
}
