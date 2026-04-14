import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Send, CheckCheck, Check, MessageCircle, LogOut, Users, ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Apple, Clock, UserPlus, Search, X, FolderOpen } from 'lucide-react'

const MEALS = [
  { key: 'colazione', label: 'Colazione', emoji: '☀️' },
  { key: 'spuntino_mattina', label: 'Spuntino', emoji: '🍎' },
  { key: 'pranzo', label: 'Pranzo', emoji: '🍽️' },
  { key: 'spuntino_pomeriggio', label: 'Merenda', emoji: '🥤' },
  { key: 'cena', label: 'Cena', emoji: '🌙' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function patientDisplayName(profile) {
  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
  return name || profile.email || 'Paziente'
}

function avatarInitials(profile) {
  const name = patientDisplayName(profile)
  const parts = name.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatTime(ts) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

function dayLabel(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return 'Oggi'
  if (d.toDateString() === y.toDateString()) return 'Ieri'
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}

function groupByDate(msgs) {
  const groups = {}
  msgs.forEach(m => {
    const day = new Date(m.created_at).toDateString()
    if (!groups[day]) groups[day] = []
    groups[day].push(m)
  })
  return groups
}

// ─── Link Patient Modal (2-step flow) ─────────────────────────────────────────

function LinkPatientModal({ dietitianId, onClose, onLinked }) {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [searching, setSearching] = useState(false)
  const [foundPatient, setFoundPatient] = useState(null)
  const [error, setError] = useState('')
  const [linking, setLinking] = useState(false)
  // Step 2 state
  const [newLinkId, setNewLinkId] = useState(null)
  const [cartelle, setCartelle] = useState([])
  const [cartelleLoading, setCartelleLoading] = useState(false)
  const [selectedCartella, setSelectedCartella] = useState('')
  const [cartellaSearch, setCartellaSearch] = useState('')
  const [saving, setSaving] = useState(false)

  async function searchPatient() {
    const trimmed = email.trim()
    if (!trimmed) return
    setSearching(true)
    setError('')
    setFoundPatient(null)

    const { data, error: err } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('email', trimmed)
      .eq('role', 'patient')
      .maybeSingle()

    if (err) {
      setError('Errore nella ricerca.')
      setSearching(false)
      return
    }
    if (!data) {
      setError('Nessun paziente trovato con questa email.')
      setSearching(false)
      return
    }

    // Check if already linked
    const { data: existing } = await supabase
      .from('patient_dietitian')
      .select('id, cartella_id')
      .eq('patient_id', data.id)
      .eq('dietitian_id', dietitianId)
      .maybeSingle()

    if (existing) {
      if (existing.cartella_id) {
        setError('Questo paziente è già collegato e ha una cartella associata.')
      } else {
        // Already linked but no cartella – go to step 2
        setFoundPatient(data)
        setNewLinkId(existing.id)
        setStep(2)
        loadCartelle()
      }
      setSearching(false)
      return
    }

    setFoundPatient(data)
    setSearching(false)
  }

  async function linkPatient() {
    if (!foundPatient) return
    setLinking(true)
    setError('')

    const { data, error: err } = await supabase
      .from('patient_dietitian')
      .insert({ patient_id: foundPatient.id, dietitian_id: dietitianId })
      .select('id')
      .single()

    if (err) {
      setError(err.message.includes('duplicate')
        ? 'Questo paziente è già collegato.'
        : 'Errore nel collegamento: ' + err.message)
      setLinking(false)
      return
    }

    setNewLinkId(data.id)
    setLinking(false)
    setStep(2)
    loadCartelle()
  }

  async function loadCartelle() {
    setCartelleLoading(true)
    const { data, error: err } = await supabase
      .from('cartelle')
      .select('id, nome, cognome, codice_fiscale')
      .order('cognome', { ascending: true })
    if (err) {
      setError('Errore nel caricamento delle cartelle.')
      setCartelleLoading(false)
      return
    }
    setCartelle(data || [])
    setCartelleLoading(false)
  }

  async function saveCartella() {
    if (!selectedCartella || !newLinkId) return
    setSaving(true)
    setError('')

    const { error: err } = await supabase
      .from('patient_dietitian')
      .update({ cartella_id: selectedCartella })
      .eq('id', newLinkId)
      .eq('dietitian_id', dietitianId)

    if (err) {
      setError('Errore nel salvataggio della cartella: ' + err.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onLinked()
    onClose()
  }

  function skipCartella() {
    onLinked()
    onClose()
  }

  const filteredCartelle = cartelle.filter(c => {
    if (!cartellaSearch.trim()) return true
    const q = cartellaSearch.toLowerCase()
    return (
      (c.nome || '').toLowerCase().includes(q) ||
      (c.cognome || '').toLowerCase().includes(q) ||
      (c.codice_fiscale || '').toLowerCase().includes(q)
    )
  })

  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: 16,
  }
  const modalStyle = {
    background: 'white', borderRadius: 16, width: '100%', maxWidth: 420,
    maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  }
  const headerStyle = {
    background: 'linear-gradient(160deg, var(--green-dark), var(--green-main))',
    padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  }
  const bodyStyle = { padding: '20px', overflowY: 'auto', flex: 1 }
  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--border)',
    fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--surface-2)',
    boxSizing: 'border-box',
  }
  const btnPrimary = {
    width: '100%', padding: '12px', borderRadius: 10, border: 'none',
    background: 'var(--green-main)', color: 'white', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  }
  const btnSecondary = {
    width: '100%', padding: '10px', borderRadius: 10, border: '1.5px solid var(--border)',
    background: 'white', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', marginTop: 8,
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step === 1
              ? <UserPlus size={18} color="white" />
              : <FolderOpen size={18} color="white" />
            }
            <span style={{ color: 'white', fontSize: 16, fontWeight: 600 }}>
              {step === 1 ? 'Collega paziente' : 'Seleziona cartella'}
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <X size={16} color="white" />
          </button>
        </div>

        <div style={bodyStyle}>
          {step === 1 ? (
            <>
              {/* Step 1: Search and link */}
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                Cerca il paziente tramite email per collegarlo al tuo profilo.
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); setFoundPatient(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') searchPatient() }}
                    placeholder="Email del paziente…"
                    style={inputStyle}
                  />
                </div>
                <button onClick={searchPatient} disabled={searching || !email.trim()} style={{
                  padding: '10px 14px', borderRadius: 10, border: 'none',
                  background: email.trim() ? 'var(--green-main)' : 'var(--border)',
                  color: 'white', cursor: email.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500,
                  flexShrink: 0,
                }}>
                  <Search size={14} />
                  {searching ? 'Cerco…' : 'Cerca'}
                </button>
              </div>

              {error && (
                <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 12px', borderRadius: 8, marginBottom: 12 }}>
                  {error}
                </p>
              )}

              {foundPatient && (
                <div style={{ background: 'var(--green-pale)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Paziente trovato
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>
                    {foundPatient.first_name || ''} {foundPatient.last_name || ''}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {foundPatient.email}
                  </p>
                </div>
              )}

              {foundPatient && (
                <button onClick={linkPatient} disabled={linking} style={{
                  ...btnPrimary,
                  opacity: linking ? 0.7 : 1,
                }}>
                  <UserPlus size={15} />
                  {linking ? 'Collegamento…' : 'Collega paziente'}
                </button>
              )}
            </>
          ) : (
            <>
              {/* Step 2: Select cartella */}
              <div style={{ background: 'var(--green-pale)', borderRadius: 12, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green-main)', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>✓ Paziente collegato</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {foundPatient?.first_name || ''} {foundPatient?.last_name || ''} — {foundPatient?.email}
                  </p>
                </div>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                Seleziona la cartella del paziente dalla tabella cartelle.
              </p>

              {/* Search field for cartelle */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={cartellaSearch}
                  onChange={e => setCartellaSearch(e.target.value)}
                  placeholder="Cerca per nome, cognome o codice fiscale…"
                  style={{ ...inputStyle, paddingLeft: 34 }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 12px', borderRadius: 8, marginBottom: 10 }}>
                  {error}
                </p>
              )}

              {cartelleLoading ? (
                <div style={{ textAlign: 'center', padding: 30 }}>
                  <div style={{ width: 22, height: 22, border: '3px solid var(--border)', borderTopColor: 'var(--green-main)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Caricamento cartelle…</p>
                </div>
              ) : filteredCartelle.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  <FolderOpen size={28} style={{ marginBottom: 6, opacity: 0.3 }} />
                  <p style={{ fontSize: 13 }}>
                    {cartellaSearch ? 'Nessuna cartella trovata' : 'Nessuna cartella disponibile'}
                  </p>
                </div>
              ) : (
                <div style={{ maxHeight: 220, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 14 }}>
                  {filteredCartelle.map(c => {
                    const isSelected = selectedCartella === c.id
                    return (
                      <button key={c.id} onClick={() => setSelectedCartella(c.id)} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '11px 14px', background: isSelected ? 'var(--green-pale)' : 'white',
                        border: 'none', borderBottom: '1px solid var(--border-light)',
                        cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s',
                      }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                          border: isSelected ? 'none' : '2px solid var(--border)',
                          background: isSelected ? 'var(--green-main)' : 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isSelected && <Check size={11} color="white" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.cognome || ''} {c.nome || ''}
                          </p>
                          {c.codice_fiscale && (
                            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              CF: {c.codice_fiscale}
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              <button onClick={saveCartella} disabled={!selectedCartella || saving} style={{
                ...btnPrimary,
                opacity: !selectedCartella || saving ? 0.5 : 1,
                cursor: !selectedCartella || saving ? 'default' : 'pointer',
              }}>
                <FolderOpen size={15} />
                {saving ? 'Salvataggio…' : 'Salva cartella'}
              </button>

              <button onClick={skipCartella} style={btnSecondary}>
                Salta per ora
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── PatientList sidebar ──────────────────────────────────────────────────────

function PatientList({ patients, loading, selected, onSelect, onSignOut, onLinkPatient }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'white' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(160deg, var(--green-dark), var(--green-main))',
        padding: 'calc(env(safe-area-inset-top) + 16px) 16px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Users size={20} color="white" />
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'white', fontWeight: 400 }}>
              Chat Pazienti
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>Vista dietista</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={onLinkPatient} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10,
            padding: '7px 10px', cursor: 'pointer', color: 'white',
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
          }}>
            <UserPlus size={14} /> Collega
          </button>
          <button onClick={onSignOut} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10,
            padding: '7px 10px', cursor: 'pointer', color: 'white',
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
          }}>
            <LogOut size={14} /> Esci
          </button>
        </div>
      </div>

      {/* Patient list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--green-main)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Caricamento…</p>
          </div>
        ) : patients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 24px' }}>
            <MessageCircle size={40} color="var(--border)" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, fontWeight: 500 }}>Nessun paziente collegato</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6, maxWidth: 280 }}>
              Collega i pazienti dal tuo pannello di gestione per avviare le chat.
            </p>
          </div>
        ) : patients.map(p => {
          const name = patientDisplayName(p.profile)
          const isActive = p.id === selected
          return (
            <button key={p.id} onClick={() => onSelect(p.id)} style={{
              width: '100%', background: isActive ? 'var(--green-pale)' : 'white',
              border: 'none', borderBottom: '1px solid var(--border-light)',
              padding: '13px 16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
              transition: 'background 0.12s',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: isActive ? 'var(--green-main)' : 'var(--green-pale)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700,
                color: isActive ? 'white' : 'var(--green-main)',
              }}>
                {avatarInitials(p.profile)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                  <p style={{
                    fontSize: 14, fontWeight: p.unread > 0 ? 700 : 500,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {name}
                  </p>
                  {p.lastMsg && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {formatTime(p.lastMsg.created_at)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {p.lastMsg
                      ? (p.lastMsg.sender_role === 'dietitian' ? 'Tu: ' : '') + p.lastMsg.content
                      : 'Nessun messaggio'}
                  </p>
                  {p.unread > 0 && (
                    <span style={{
                      background: 'var(--green-main)', color: 'white',
                      fontSize: 10, fontWeight: 700,
                      minWidth: 18, height: 18, borderRadius: 9, padding: '0 3px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {p.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Patient Diary view ───────────────────────────────────────────────────────

function PatientDiary({ patientId }) {
  const todayStr = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(todayStr)
  const [foodLog, setFoodLog] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!patientId) return
    loadDiary()
  }, [patientId, date])

  async function loadDiary() {
    setLoading(true)
    const { data } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', patientId)
      .eq('date', date)
      .order('created_at')
    setFoodLog(data || [])
    setLoading(false)
  }

  function changeDate(delta) {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().split('T')[0])
  }

  const totals = foodLog.reduce((a, f) => ({
    kcal: a.kcal + (f.kcal || 0),
    proteins: a.proteins + (f.proteins || 0),
    carbs: a.carbs + (f.carbs || 0),
    fats: a.fats + (f.fats || 0),
  }), { kcal: 0, proteins: 0, carbs: 0, fats: 0 })

  const displayDate = new Date(date + 'T12:00:00')
  const isToday = date === todayStr

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={() => changeDate(-1)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {isToday ? 'Oggi · ' : ''}{displayDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          {foodLog.length > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {totals.kcal} kcal · P:{Math.round(totals.proteins)}g · C:{Math.round(totals.carbs)}g · G:{Math.round(totals.fats)}g
            </p>
          )}
        </div>
        <button onClick={() => changeDate(1)} disabled={isToday} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isToday ? 'default' : 'pointer', color: isToday ? 'var(--border)' : 'var(--text-secondary)' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ width: 22, height: 22, border: '3px solid var(--border)', borderTopColor: 'var(--green-main)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Caricamento…</p>
        </div>
      ) : foodLog.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <Apple size={36} style={{ marginBottom: 10, opacity: 0.2 }} />
          <p style={{ fontSize: 14, fontWeight: 500 }}>Nessun alimento registrato</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Il paziente non ha registrato pasti per questa data.</p>
        </div>
      ) : (
        MEALS.map(m => {
          const mealFoods = foodLog.filter(f => f.meal_type === m.key)
          if (!mealFoods.length) return null
          const mealKcal = mealFoods.reduce((s, f) => s + (f.kcal || 0), 0)
          return (
            <div key={m.key} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--green-pale)', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: 18 }}>{m.emoji}</span>
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{m.label}</span>
                <span style={{ fontSize: 12, color: 'var(--green-dark)', fontWeight: 500 }}>{mealKcal} kcal</span>
              </div>
              <div style={{ padding: '8px 14px 10px' }}>
                {mealFoods.map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Apple size={13} color="var(--green-main)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.food_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {f.grams}g · {f.kcal} kcal · P:{f.proteins}g · C:{f.carbs}g · G:{f.fats}g
                        {f.food_data?.meal_time && <> · <Clock size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> {f.food_data.meal_time}</>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── Chat view ────────────────────────────────────────────────────────────────

function ChatView({ currentPatient, messages, text, setText, sending, bottomRef, inputRef, onSend, onBack }) {
  const groups = groupByDate(messages)
  const [tab, setTab] = useState('chat')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface-2)' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(160deg, var(--green-dark), var(--green-main))',
        padding: 'calc(env(safe-area-inset-top) + 14px) 16px 0',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <button onClick={onBack} className="dietitian-back-btn" style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10,
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'white', flexShrink: 0,
          }} aria-label="Torna alla lista">
            <ArrowLeft size={18} />
          </button>
          {currentPatient ? (
            <>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0, border: '2px solid rgba(255,255,255,0.3)' }}>
                {avatarInitials(currentPatient.profile)}
              </div>
              <div>
                <p style={{ color: 'white', fontSize: 16, fontWeight: 600 }}>
                  {patientDisplayName(currentPatient.profile)}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>Paziente</p>
              </div>
            </>
          ) : (
            <p style={{ color: 'white', fontSize: 15 }}>Seleziona un paziente</p>
          )}
        </div>
        {/* Tabs */}
        {currentPatient && (
          <div style={{ display: 'flex', gap: 0 }}>
            {[
              { key: 'chat', label: 'Chat', icon: <MessageCircle size={13} /> },
              { key: 'diario', label: 'Diario alimentare', icon: <BookOpen size={13} /> },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 10px',
                color: tab === t.key ? 'white' : 'rgba(255,255,255,0.55)',
                borderBottom: `2px solid ${tab === t.key ? 'white' : 'transparent'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                fontSize: 12, fontWeight: tab === t.key ? 600 : 400, transition: 'all 0.15s',
              }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!currentPatient ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
          <MessageCircle size={48} color="var(--border)" style={{ marginBottom: 14 }} />
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-muted)' }}>Seleziona un paziente</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6, maxWidth: 260 }}>
            Clicca su un paziente nella lista per leggere e rispondere ai messaggi.
          </p>
        </div>
      ) : tab === 'diario' ? (
        <PatientDiary patientId={currentPatient.id} />
      ) : (
        <>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 0', WebkitOverflowScrolling: 'touch' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>💬</div>
                <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Nessun messaggio</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Inizia la conversazione con {patientDisplayName(currentPatient.profile)}.
                </p>
              </div>
            ) : (
              Object.entries(groups).map(([day, msgs]) => (
                <div key={day}>
                  <div style={{ textAlign: 'center', margin: '10px 0' }}>
                    <span style={{ background: 'var(--border)', color: 'var(--text-muted)', fontSize: 11, padding: '3px 10px', borderRadius: 100 }}>
                      {dayLabel(day)}
                    </span>
                  </div>
                  {msgs.map((msg, i) => {
                    const isMe = msg.sender_role === 'dietitian'
                    const showAvatar = !isMe && (i === 0 || msgs[i - 1]?.sender_role !== msg.sender_role)
                    return (
                      <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 5, alignItems: 'flex-end', gap: 6 }}>
                        {!isMe && (
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--green-main)', flexShrink: 0, visibility: showAvatar ? 'visible' : 'hidden' }}>
                            {avatarInitials(currentPatient.profile)[0]}
                          </div>
                        )}
                        <div style={{ maxWidth: '75%', background: isMe ? 'linear-gradient(135deg, var(--green-main), var(--green-mid))' : 'white', color: isMe ? 'white' : 'var(--text-primary)', padding: '9px 13px', borderRadius: isMe ? '16px 16px 3px 16px' : '16px 16px 16px 3px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: isMe ? 'none' : '1px solid var(--border-light)' }}>
                          <p style={{ fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.content}</p>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 3 }}>
                            <span style={{ fontSize: 10, opacity: 0.65 }}>{formatTime(msg.created_at)}</span>
                            {isMe && (msg.read_at
                              ? <CheckCheck size={11} style={{ opacity: 0.7 }} />
                              : <Check size={11} style={{ opacity: 0.4 }} />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
            <div ref={bottomRef} style={{ height: 8 }} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--border-light)', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
            <form onSubmit={onSend} style={{ display: 'flex', alignItems: 'flex-end', gap: 9 }}>
              <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 22, border: '1.5px solid var(--border)', padding: '9px 14px', display: 'flex', alignItems: 'center' }}>
                <textarea
                  ref={inputRef} value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(e) } }}
                  placeholder="Scrivi un messaggio…" rows={1}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text-primary)', resize: 'none', maxHeight: 100, lineHeight: 1.5 }}
                />
              </div>
              <button type="submit" disabled={!text.trim() || sending} style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: text.trim() ? 'var(--green-main)' : 'var(--border)', border: 'none', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', boxShadow: text.trim() ? '0 2px 8px rgba(26,127,90,0.3)' : 'none' }}>
                <Send size={17} color="white" style={{ marginLeft: 2 }} />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DietitianChatPage() {
  const { user, signOut } = useAuth()
  const [patients, setPatients] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [sending, setSending] = useState(false)
  const [mobilePanel, setMobilePanel] = useState('list')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // ── Load patient list ────────────────────────────────────────────────────
  useEffect(() => {
    loadPatients()
    const channel = supabase.channel('dietitian-list-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => loadPatients())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user.id])

  async function loadPatients() {
    const { data: links } = await supabase
      .from('patient_dietitian')
      .select('patient_id')
      .eq('dietitian_id', user.id)

    if (!links || links.length === 0) {
      setPatients([])
      setLoadingList(false)
      return
    }

    const ids = links.map(l => l.patient_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', ids)

    const enriched = await Promise.all((profiles ?? []).map(async profile => {
      const { data: last } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('patient_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
      const { count: unread } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', profile.id)
        .eq('sender_role', 'patient')
        .is('read_at', null)
      return { id: profile.id, profile, lastMsg: last?.[0] ?? null, unread: unread ?? 0 }
    }))

    enriched.sort((a, b) => {
      if (b.unread !== a.unread) return b.unread - a.unread
      return (b.lastMsg?.created_at ?? '').localeCompare(a.lastMsg?.created_at ?? '')
    })

    setPatients(enriched)
    setLoadingList(false)
  }

  // ── Load messages for selected patient ───────────────────────────────────
  useEffect(() => {
    if (!selected) return
    loadMessages(selected)
    const channel = supabase.channel(`dietitian-msgs-${selected}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `patient_id=eq.${selected}`,
      }, payload => {
        setMessages(prev =>
          prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new]
        )
        if (payload.new.sender_role === 'patient') markAsRead([payload.new.id])
        loadPatients()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [selected])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadMessages(patientId) {
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true })
    setMessages(msgs ?? [])
    const unread = (msgs ?? []).filter(m => m.sender_role === 'patient' && !m.read_at)
    if (unread.length) markAsRead(unread.map(m => m.id))
  }

  async function markAsRead(ids) {
    if (!ids.length) return
    await supabase.from('chat_messages').update({ read_at: new Date().toISOString() }).in('id', ids)
    setPatients(prev => prev.map(p => p.id === selected ? { ...p, unread: 0 } : p))
  }

  function openChat(patientId) {
    setSelected(patientId)
    setMessages([])
    setMobilePanel('chat')
  }

  async function sendMessage(e) {
    e?.preventDefault()
    const content = text.trim()
    if (!content || sending || !selected) return
    setSending(true)
    setText('')
    const optimistic = {
      id: `opt_${Date.now()}`, patient_id: selected,
      sender_role: 'dietitian', sender_id: user.id,
      content, created_at: new Date().toISOString(), read_at: null,
    }
    setMessages(prev => [...prev, optimistic])
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ patient_id: selected, sender_role: 'dietitian', sender_id: user.id, content })
      .select().single()
    if (data) {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? data : m))
      loadPatients()
    } else if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setText(content)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const currentPatient = patients.find(p => p.id === selected) ?? null

  const listProps = { patients, loading: loadingList, selected, onSelect: openChat, onSignOut: signOut, onLinkPatient: () => setShowLinkModal(true) }
  const chatProps = { currentPatient, messages, text, setText, sending, bottomRef, inputRef, onSend: sendMessage, onBack: () => setMobilePanel('list') }

  return (
    <>
      <style>{`
        .dietitian-page { display: flex; height: 100dvh; overflow: hidden; }
        .dietitian-sidebar { width: 320px; flex-shrink: 0; border-right: 1px solid var(--border-light); }
        .dietitian-chat-area { flex: 1; min-width: 0; }
        .dietitian-mobile { display: none; }
        @media (max-width: 639px) {
          .dietitian-page { display: none; }
          .dietitian-mobile { display: flex; flex-direction: column; height: 100dvh; }
          .dietitian-back-btn { display: flex !important; }
        }
        @media (min-width: 640px) {
          .dietitian-back-btn { display: none !important; }
        }
      `}</style>

      {/* Desktop: side-by-side */}
      <div className="dietitian-page">
        <div className="dietitian-sidebar">
          <PatientList {...listProps} />
        </div>
        <div className="dietitian-chat-area">
          <ChatView {...chatProps} />
        </div>
      </div>

      {/* Mobile: one panel at a time */}
      <div className="dietitian-mobile">
        {mobilePanel === 'list'
          ? <PatientList {...listProps} />
          : <ChatView {...chatProps} />
        }
      </div>

      {/* Link Patient Modal */}
      {showLinkModal && (
        <LinkPatientModal
          dietitianId={user.id}
          onClose={() => setShowLinkModal(false)}
          onLinked={loadPatients}
        />
      )}
    </>
  )
}
