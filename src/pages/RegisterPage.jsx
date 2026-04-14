import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Leaf, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', surname: '', email: '', password: '', confirm: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) return setError('Le password non coincidono')
    if (form.password.length < 6) return setError('La password deve avere almeno 6 caratteri')
    setLoading(true)
    const { error } = await signUp(form.email, form.password, {
      full_name: `${form.name} ${form.surname}`,
      first_name: form.name,
      last_name: form.surname
    })
    if (error) {
      setError(error.message === 'User already registered'
        ? 'Email già registrata. Prova ad accedere.'
        : error.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  if (success) return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--green-mist)', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <CheckCircle size={36} color="var(--green-main)" />
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 300, marginBottom: 12 }}>Registrazione completata!</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Controlla la tua email per confermare l'account.</p>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 32 }}>Il tuo dietista dovrà collegare il tuo profilo per mostrarti la dieta.</p>
      <button className="btn btn-primary" onClick={() => navigate('/login')}>Vai al login</button>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--green-mist)' }}>
      <div style={{
        background: 'linear-gradient(160deg, var(--green-dark) 0%, var(--green-main) 100%)',
        padding: '50px 32px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.07) 0%, transparent 50%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Leaf size={28} color="white" />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'white', fontWeight: 300 }}>Crea il tuo profilo</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 6 }}>Inizia il tuo percorso nutrizionale</p>
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 20px 40px', marginTop: -20 }}>
        <div className="card animate-slideUp" style={{ borderRadius: 'var(--radius-xl)', padding: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Registrazione</h2>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff0f0', border: '1px solid #ffd4d4', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16, color: 'var(--red)', fontSize: 14 }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Nome</label>
                <input type="text" className="input-field" placeholder="Mario" value={form.name} onChange={set('name')} required />
              </div>
              <div className="input-group">
                <label className="input-label">Cognome</label>
                <input type="text" className="input-field" placeholder="Rossi" value={form.surname} onChange={set('surname')} required />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Email</label>
              <input type="email" className="input-field" placeholder="mario@email.com" value={form.email} onChange={set('email')} required autoComplete="email" />
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} className="input-field" placeholder="Min. 6 caratteri" value={form.password} onChange={set('password')} required style={{ paddingRight: 48 }} />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Conferma password</label>
              <input type="password" className="input-field" placeholder="Ripeti la password" value={form.confirm} onChange={set('confirm')} required />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: 4 }}>
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Registrazione…
                  </span>
                : 'Crea account'}
            </button>
          </form>

          <div className="divider" />
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
            Hai già un account?{' '}
            <Link to="/login" style={{ color: 'var(--green-main)', fontWeight: 500, textDecoration: 'none' }}>Accedi</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
