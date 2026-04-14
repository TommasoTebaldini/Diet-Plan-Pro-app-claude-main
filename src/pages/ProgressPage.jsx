import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingDown, TrendingUp, Minus, Target, Plus, Scale, Activity, Flame, Camera, Ruler, X } from 'lucide-react'

const MOOD_OPTIONS = [
  { value: 1, emoji: '😞', label: 'Pessimo' },
  { value: 2, emoji: '😕', label: 'Non bene' },
  { value: 3, emoji: '😐', label: 'Nella norma' },
  { value: 4, emoji: '😊', label: 'Bene' },
  { value: 5, emoji: '😄', label: 'Ottimo' },
]

const SYMPTOM_LIST = ['Stanchezza', 'Gonfiore', 'Mal di testa', 'Insonnia', 'Fame', 'Nausea', 'Energia alta', 'Umore positivo']

const MEAS_FIELDS = [
  { key: 'waist_cm', label: 'Vita', emoji: '📏' },
  { key: 'hips_cm', label: 'Fianchi', emoji: '📐' },
  { key: 'chest_cm', label: 'Torace', emoji: '🫁' },
  { key: 'arm_cm', label: 'Braccio', emoji: '💪' },
  { key: 'thigh_cm', label: 'Coscia', emoji: '🦵' },
]

const PHOTO_TYPES = [
  { value: 'prima', label: '⬅️ Prima' },
  { value: 'dopo', label: '➡️ Dopo' },
  { value: 'progresso', label: '📸 Progresso' },
]

function getBMICategory(bmi) {
  if (!bmi) return null
  if (bmi < 18.5) return { label: 'Sottopeso', color: 'var(--blue)' }
  if (bmi < 25) return { label: 'Normopeso', color: 'var(--green-main)' }
  if (bmi < 30) return { label: 'Sovrappeso', color: 'var(--orange)' }
  return { label: 'Obesità', color: 'var(--red)' }
}

function getAge(birthDate) {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow-md)' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--green-main)' }}>{payload[0].value} kg</p>
    </div>
  )
}

function MeasTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow-md)' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--blue)' }}>{payload[0].value} {unit}</p>
    </div>
  )
}

export default function ProgressPage() {
  const { user, profile } = useAuth()
  const fileInputRef = useRef(null)
  const today = new Date().toISOString().split('T')[0]

  // ── Peso tab state ──
  const [weights, setWeights] = useState([])
  const [todayLog, setTodayLog] = useState(null)
  const [newWeight, setNewWeight] = useState('')
  const [mood, setMood] = useState(null)
  const [symptoms, setSymptoms] = useState([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [range, setRange] = useState(30)
  const [macroHistory, setMacroHistory] = useState([])
  const [macroRange, setMacroRange] = useState(30)
  const [dietTarget, setDietTarget] = useState(null)
  const [macroTab, setMacroTab] = useState('kcal')

  // ── Misurazioni tab state ──
  const [measurements, setMeasurements] = useState([])
  const [showMeasForm, setShowMeasForm] = useState(false)
  const [measForm, setMeasForm] = useState({ waist_cm: '', hips_cm: '', chest_cm: '', arm_cm: '', thigh_cm: '', date: today, notes: '' })
  const [savingMeas, setSavingMeas] = useState(false)
  const [measMetric, setMeasMetric] = useState('waist_cm')

  // ── Foto tab state ──
  const [photos, setPhotos] = useState([])
  const [photoUrls, setPhotoUrls] = useState({})
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoType, setPhotoType] = useState('progresso')
  const [photoNotes, setPhotoNotes] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState(null)
  const [expandedPhoto, setExpandedPhoto] = useState(null)

  // ── Active tab ──
  const [activeTab, setActiveTab] = useState('peso')

  useEffect(() => { loadData() }, [])
  useEffect(() => { loadMacroHistory() }, [macroRange])
  useEffect(() => { if (activeTab === 'misurazioni') loadMeasurements() }, [activeTab])
  useEffect(() => { if (activeTab === 'foto') loadPhotos() }, [activeTab])

  async function loadData() {
    const [wRes, logRes, dietRes] = await Promise.all([
      supabase.from('weight_logs').select('*').eq('user_id', user.id).order('date', { ascending: true }),
      supabase.from('daily_wellness').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
      supabase.from('patient_diets').select('kcal_target,protein_target,carbs_target,fats_target').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    ])
    setWeights(wRes.data || [])
    setDietTarget(dietRes.data || null)
    const log = logRes.data
    setTodayLog(log)
    if (log) {
      setMood(log.mood)
      setSymptoms(log.symptoms || [])
      setNotes(log.notes || '')
    }
  }

  async function loadMacroHistory() {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - macroRange)
    const from = cutoffDate.toISOString().split('T')[0]
    const { data } = await supabase
      .from('daily_logs')
      .select('date, kcal, proteins, carbs, fats')
      .eq('user_id', user.id)
      .gte('date', from)
      .order('date', { ascending: true })
    setMacroHistory(data || [])
  }

  async function loadMeasurements() {
    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
    setMeasurements(data || [])
  }

  async function loadPhotos() {
    const { data } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    if (!data?.length) { setPhotos([]); return }
    setPhotos(data)
    const urls = {}
    await Promise.all(data.map(async photo => {
      const { data: urlData } = await supabase.storage
        .from('progress-photos')
        .createSignedUrl(photo.storage_path, 3600)
      if (urlData?.signedUrl) urls[photo.id] = urlData.signedUrl
    }))
    setPhotoUrls(urls)
  }

  async function saveEntry() {
    setSaving(true)
    if (newWeight) {
      const w = parseFloat(newWeight)
      if (!isNaN(w)) {
        const { data } = await supabase.from('weight_logs')
          .upsert({ user_id: user.id, date: today, weight_kg: w }, { onConflict: 'user_id,date' })
          .select().single()
        if (data) setWeights(prev => {
          const filtered = prev.filter(x => x.date !== today)
          return [...filtered, data].sort((a, b) => a.date.localeCompare(b.date))
        })
      }
    }
    if (mood || symptoms.length || notes) {
      await supabase.from('daily_wellness')
        .upsert({ user_id: user.id, date: today, mood, symptoms, notes }, { onConflict: 'user_id,date' })
    }
    setShowAdd(false)
    setSaving(false)
    loadData()
  }

  async function saveMeasurements() {
    setSavingMeas(true)
    const payload = { user_id: user.id, date: measForm.date || today }
    MEAS_FIELDS.forEach(f => {
      payload[f.key] = measForm[f.key] ? parseFloat(measForm[f.key]) : null
    })
    if (measForm.notes) payload.notes = measForm.notes
    await supabase.from('body_measurements')
      .upsert(payload, { onConflict: 'user_id,date' })
    setSavingMeas(false)
    setShowMeasForm(false)
    setMeasForm({ waist_cm: '', hips_cm: '', chest_cm: '', arm_cm: '', thigh_cm: '', date: today, notes: '' })
    loadMeasurements()
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Seleziona un file immagine valido.')
      return
    }
    setPhotoFile(file)
    const objectUrl = URL.createObjectURL(file)
    // createObjectURL always returns a blob: URL — safe to use as img src
    setPhotoPreview(objectUrl)
    setPhotoError(null)
  }

  async function uploadPhoto() {
    if (!photoFile) return
    setUploadingPhoto(true)
    setPhotoError(null)
    const ext = photoFile.name.split('.').pop()
    const path = `${user.id}/${today}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('progress-photos')
      .upload(path, photoFile, { upsert: false })
    if (upErr) {
      setPhotoError('Errore upload: ' + upErr.message)
      setUploadingPhoto(false)
      return
    }
    const { error: dbErr } = await supabase.from('progress_photos').insert({
      user_id: user.id,
      date: today,
      photo_type: photoType,
      storage_path: path,
      notes: photoNotes || null,
    })
    if (dbErr) setPhotoError('Errore salvataggio: ' + dbErr.message)
    setUploadingPhoto(false)
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoNotes('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    loadPhotos()
  }

  async function deletePhoto(photo) {
    await supabase.storage.from('progress-photos').remove([photo.storage_path])
    await supabase.from('progress_photos').delete().eq('id', photo.id)
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
    setPhotoUrls(prev => { const n = { ...prev }; delete n[photo.id]; return n })
  }

  // ── Computed values ──
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - range)
  const chartData = weights
    .filter(w => new Date(w.date) >= cutoff)
    .map(w => ({
      date: new Date(w.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
      peso: w.weight_kg
    }))

  const latest = weights[weights.length - 1]?.weight_kg
  const previous = weights[weights.length - 2]?.weight_kg
  const diff = latest && previous ? (latest - previous).toFixed(1) : null
  const target = profile?.target_weight
  const initial = weights[0]?.weight_kg
  const totalChange = latest && initial ? (latest - initial).toFixed(1) : null

  const bmi = profile?.height_cm && latest
    ? parseFloat((latest / Math.pow(profile.height_cm / 100, 2)).toFixed(1))
    : null
  const bmiCat = getBMICategory(bmi)
  const age = getAge(profile?.birth_date)
  const bodyFat = bmi && age
    ? parseFloat(((1.20 * bmi) + (0.23 * age) - (profile?.gender === 'M' ? 16.2 : 5.4)).toFixed(1))
    : null

  const weightGoalPct = (() => {
    if (!initial || !target || !latest) return null
    const totalToMove = initial - target
    if (Math.abs(totalToMove) < 0.01) return 100
    const done = initial - latest
    return Math.min(100, Math.max(0, Math.round((done / totalToMove) * 100)))
  })()

  const measChartData = measurements.map(m => ({
    date: new Date(m.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
    val: m[measMetric],
  })).filter(d => d.val != null)

  const beforePhoto = photos.find(p => p.photo_type === 'prima')
  const afterPhoto = photos.find(p => p.photo_type === 'dopo')

  return (
    <div className="page">
      {/* ── Header ── */}
      <div style={{ background: 'linear-gradient(160deg, var(--green-dark), var(--green-main))', padding: 'calc(env(safe-area-inset-top) + 20px) 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 }}>Il mio percorso</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'white', fontWeight: 300 }}>Progressi</h1>
          </div>
          {activeTab === 'peso' && (
            <button onClick={() => setShowAdd(v => !v)} className="btn" style={{ background: 'white', color: 'var(--green-main)', borderRadius: 14, padding: '10px 16px', fontSize: 14, fontWeight: 600, gap: 6 }}>
              <Plus size={16} />Oggi
            </button>
          )}
          {activeTab === 'misurazioni' && (
            <button onClick={() => setShowMeasForm(v => !v)} className="btn" style={{ background: 'white', color: 'var(--green-main)', borderRadius: 14, padding: '10px 16px', fontSize: 14, fontWeight: 600, gap: 6 }}>
              <Plus size={16} />Aggiungi
            </button>
          )}
          {activeTab === 'foto' && (
            <button onClick={() => fileInputRef.current?.click()} className="btn" style={{ background: 'white', color: 'var(--green-main)', borderRadius: 14, padding: '10px 16px', fontSize: 14, fontWeight: 600, gap: 6 }}>
              <Camera size={16} />Foto
            </button>
          )}
        </div>

        {/* Header stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Peso', val: latest ? `${latest}` : '–', unit: 'kg', icon: <Scale size={12} /> },
            { label: 'BMI', val: bmi ? `${bmi}` : '–', unit: bmiCat?.label || '', icon: <Activity size={12} />, color: bmiCat?.color },
            { label: 'Grasso', val: bodyFat && bodyFat > 0 ? `${bodyFat}` : '–', unit: bodyFat && bodyFat > 0 ? '%' : '', icon: <Flame size={12} /> },
            { label: 'Obiettivo', val: target ? `${target}` : '–', unit: target ? 'kg' : '', icon: <Target size={12} /> },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 8px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, color: 'rgba(255,255,255,0.7)', marginBottom: 3 }}>
                {s.icon}<span style={{ fontSize: 9 }}>{s.label}</span>
              </div>
              <p style={{ color: s.color || 'white', fontSize: 15, fontWeight: 700, lineHeight: 1 }}>{s.val}</p>
              {s.unit && <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, marginTop: 2 }}>{s.unit}</p>}
            </div>
          ))}
        </div>

        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: 0, background: 'rgba(0,0,0,0.15)', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
          {[
            { key: 'peso', label: '⚖️ Peso' },
            { key: 'misurazioni', label: '📏 Misure' },
            { key: 'foto', label: '📸 Foto' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              flex: 1, padding: '11px 6px', border: 'none', font: 'inherit', fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
              background: activeTab === tab.key ? 'rgba(255,255,255,0.18)' : 'transparent',
              color: activeTab === tab.key ? 'white' : 'rgba(255,255,255,0.6)',
              cursor: 'pointer', transition: 'all 0.15s',
              borderBottom: activeTab === tab.key ? '2px solid white' : '2px solid transparent',
            }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ══════════════════════════════════════════════════════
            TAB: PESO
           ══════════════════════════════════════════════════════ */}
        {activeTab === 'peso' && (
          <>
            {/* Add today entry */}
            {showAdd && (
              <div className="card animate-slideUp" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📝 Aggiorna di oggi</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="input-group">
                    <label className="input-label">⚖️ Peso (kg)</label>
                    <input type="number" step="0.1" className="input-field" placeholder="es. 72.5" value={newWeight} onChange={e => setNewWeight(e.target.value)} inputMode="decimal" />
                  </div>
                  <div>
                    <p className="input-label" style={{ marginBottom: 10 }}>😊 Come ti senti oggi?</p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                      {MOOD_OPTIONS.map(m => (
                        <button key={m.value} onClick={() => setMood(m.value)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: `2px solid ${mood === m.value ? 'var(--green-main)' : 'var(--border)'}`, borderRadius: 14, padding: '10px 8px', cursor: 'pointer', transition: 'all 0.15s', transform: mood === m.value ? 'scale(1.1)' : 'none' }}>
                          <span style={{ fontSize: 24 }}>{m.emoji}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="input-label" style={{ marginBottom: 10 }}>🔍 Sintomi / Note fisiche</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {SYMPTOM_LIST.map(s => (
                        <button key={s} onClick={() => setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} style={{ padding: '6px 14px', borderRadius: 100, background: symptoms.includes(s) ? 'var(--green-pale)' : 'var(--surface-2)', color: symptoms.includes(s) ? 'var(--green-main)' : 'var(--text-secondary)', border: `1.5px solid ${symptoms.includes(s) ? 'var(--green-main)' : 'var(--border)'}`, font: 'inherit', fontSize: 13, cursor: 'pointer' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">📓 Note libere</label>
                    <textarea className="input-field" rows={3} placeholder="Come è andata oggi? Annotazioni sulla dieta…" value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                  <button className="btn btn-primary" onClick={saveEntry} disabled={saving}>
                    {saving ? 'Salvataggio…' : 'Salva'}
                  </button>
                </div>
              </div>
            )}

            {/* Weight goal progress bar */}
            {target && latest && (
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Target size={16} color="var(--green-main)" />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Obiettivo peso</span>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{latest} → {target} kg</span>
                </div>
                <div style={{ height: 10, background: 'var(--surface-3)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${weightGoalPct ?? 0}%`, background: 'linear-gradient(90deg, var(--green-main), var(--green-mid))', borderRadius: 5, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{weightGoalPct ?? 0}% completato</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {latest && target ? `${Math.abs(latest - target).toFixed(1)} kg al traguardo` : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Weight chart */}
            {chartData.length > 1 && (
              <div className="card" style={{ padding: '18px 12px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600 }}>Andamento peso</h3>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[7, 30, 90].map(r => (
                      <button key={r} onClick={() => setRange(r)} style={{ padding: '4px 10px', borderRadius: 100, background: range === r ? 'var(--green-main)' : 'var(--surface-2)', color: range === r ? 'white' : 'var(--text-muted)', border: `1px solid ${range === r ? 'transparent' : 'var(--border)'}`, font: 'inherit', fontSize: 12, cursor: 'pointer' }}>
                        {r}g
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip content={<CustomTooltip />} />
                    {target && <ReferenceLine y={target} stroke="var(--orange)" strokeDasharray="4 4" label={{ value: 'Obiettivo', fontSize: 10, fill: 'var(--orange)', position: 'insideTopRight' }} />}
                    <Line type="monotone" dataKey="peso" stroke="var(--green-main)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--green-main)' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Weight history */}
            {weights.length > 0 && (
              <div className="card" style={{ padding: '18px 20px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Storico peso</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...weights].reverse().slice(0, 10).map((w, i) => {
                    const prev = [...weights].reverse()[i + 1]
                    const d = prev ? (w.weight_kg - prev.weight_kg).toFixed(1) : null
                    return (
                      <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Scale size={18} color="var(--green-main)" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 15, fontWeight: 600 }}>{w.weight_kg} kg</p>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(w.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                        </div>
                        {d !== null && (
                          <span style={{ fontSize: 13, fontWeight: 600, color: parseFloat(d) < 0 ? 'var(--green-main)' : parseFloat(d) > 0 ? 'var(--red)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 2 }}>
                            {parseFloat(d) < 0 ? <TrendingDown size={14} /> : parseFloat(d) > 0 ? <TrendingUp size={14} /> : <Minus size={14} />}
                            {d > 0 ? '+' : ''}{d}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {weights.length === 0 && !showAdd && (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                <Scale size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p style={{ fontSize: 15, fontWeight: 500 }}>Inizia a tracciare i tuoi progressi</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Registra il tuo peso e come ti senti ogni giorno.</p>
                <button className="btn btn-primary" onClick={() => setShowAdd(true)} style={{ marginTop: 20 }}>
                  <Plus size={16} />Aggiungi prima misurazione
                </button>
              </div>
            )}

            {/* Macro history chart */}
            <div className="card" style={{ padding: '18px 12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Flame size={16} color="var(--green-main)" />
                  <h3 style={{ fontSize: 15, fontWeight: 600 }}>Storico macronutrienti</h3>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[30, 90].map(r => (
                    <button key={r} onClick={() => setMacroRange(r)} style={{ padding: '4px 10px', borderRadius: 100, background: macroRange === r ? 'var(--green-main)' : 'var(--surface-2)', color: macroRange === r ? 'white' : 'var(--text-muted)', border: `1px solid ${macroRange === r ? 'transparent' : 'var(--border)'}`, font: 'inherit', fontSize: 12, cursor: 'pointer' }}>
                      {r}g
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingLeft: 8, paddingBottom: 12 }}>
                {[
                  { key: 'kcal', label: '🔥 Kcal' },
                  { key: 'proteins', label: '💪 Prot.' },
                  { key: 'carbs', label: '🌾 Carbo' },
                  { key: 'fats', label: '🥑 Grassi' },
                ].map(t => (
                  <button key={t.key} onClick={() => setMacroTab(t.key)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 100, background: macroTab === t.key ? 'var(--green-main)' : 'var(--surface-2)', color: macroTab === t.key ? 'white' : 'var(--text-secondary)', border: `1.5px solid ${macroTab === t.key ? 'transparent' : 'var(--border)'}`, font: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    {t.label}
                  </button>
                ))}
              </div>
              {macroHistory.length > 0 ? (() => {
                const tabs = {
                  kcal: { color: '#f0922b', targetKey: 'kcal_target', unit: 'kcal' },
                  proteins: { color: '#3b82f6', targetKey: 'protein_target', unit: 'g' },
                  carbs: { color: '#f0922b', targetKey: 'carbs_target', unit: 'g' },
                  fats: { color: '#e05a5a', targetKey: 'fats_target', unit: 'g' },
                }
                const { color, targetKey, unit } = tabs[macroTab]
                const targetVal = dietTarget?.[targetKey] || null
                const mChartData = macroHistory.map(d => ({
                  date: new Date(d.date + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
                  val: Math.round((d[macroTab] || 0) * 10) / 10,
                  target: targetVal,
                }))
                return (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={mChartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <Tooltip
                        formatter={(v, n) => [`${v} ${unit}`, n === 'val' ? (macroTab === 'kcal' ? 'Kcal' : macroTab) : 'Obiettivo']}
                        labelStyle={{ fontSize: 11 }}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
                      />
                      {targetVal && <ReferenceLine y={targetVal} stroke={color} strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Obiettivo', fontSize: 9, fill: color, position: 'insideTopRight' }} />}
                      <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                        {mChartData.map((entry, i) => (
                          <Cell key={i} fill={targetVal && entry.val > targetVal ? '#e05a5a' : color} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
              })() : (
                <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  <Flame size={28} style={{ marginBottom: 8, opacity: 0.2 }} />
                  <p>Nessun dato disponibile.<br />Inizia a registrare i tuoi pasti nel diario.</p>
                </div>
              )}
              {macroHistory.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-light)' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, paddingLeft: 8 }}>Ultimi {macroRange} giorni</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[...macroHistory].reverse().slice(0, 15).map(d => {
                      const pct = dietTarget?.kcal_target ? Math.min(100, Math.round(d.kcal / dietTarget.kcal_target * 100)) : null
                      return (
                        <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <p style={{ fontSize: 12, fontWeight: 600 }}>{new Date(d.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                              <p style={{ fontSize: 12, fontWeight: 700, color: pct !== null && pct > 105 ? 'var(--red)' : 'var(--green-main)' }}>
                                {d.kcal} kcal{pct !== null ? ` (${pct}%)` : ''}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              {[`P:${Math.round(d.proteins || 0)}g`, `C:${Math.round(d.carbs || 0)}g`, `G:${Math.round(d.fats || 0)}g`].map(v => (
                                <span key={v} style={{ fontSize: 10, background: 'var(--surface)', padding: '1px 6px', borderRadius: 100, color: 'var(--text-muted)' }}>{v}</span>
                              ))}
                            </div>
                            {dietTarget?.kcal_target && (
                              <div style={{ height: 3, background: 'var(--border-light)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: pct > 105 ? 'var(--red)' : 'var(--green-main)', borderRadius: 2, transition: 'width 0.5s ease' }} />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: MISURAZIONI
           ══════════════════════════════════════════════════════ */}
        {activeTab === 'misurazioni' && (
          <>
            {/* BMI + Body fat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="card" style={{ padding: '16px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>BMI</p>
                {bmi ? (
                  <>
                    <p style={{ fontSize: 28, fontWeight: 700, color: bmiCat?.color || 'var(--text-primary)', lineHeight: 1 }}>{bmi}</p>
                    <p style={{ fontSize: 12, color: bmiCat?.color || 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>{bmiCat?.label}</p>
                    <div style={{ marginTop: 10 }}>
                      {[
                        { label: 'Sotto', max: 18.5, color: 'var(--blue)' },
                        { label: 'Normale', max: 25, color: 'var(--green-main)' },
                        { label: 'Sovrappeso', max: 30, color: 'var(--orange)' },
                        { label: 'Obesità', max: 40, color: 'var(--red)' },
                      ].map((range, i, arr) => {
                        const min = i === 0 ? 15 : arr[i - 1].max
                        const pct = Math.min(100, Math.max(0, ((bmi - 15) / (40 - 15)) * 100))
                        return null
                      })}
                      <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, var(--blue) 0%, var(--green-main) 28%, var(--orange) 60%, var(--red) 100%)', borderRadius: 3 }} />
                        <div style={{ position: 'absolute', top: -2, left: `${Math.min(96, Math.max(2, ((bmi - 15) / 25) * 100))}%`, transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: 'white', border: `2px solid ${bmiCat?.color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>15</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>25</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>40</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Inserisci altezza e peso nel profilo</p>
                )}
              </div>

              <div className="card" style={{ padding: '16px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>% Grasso stimato</p>
                {bodyFat && bodyFat > 0 ? (
                  <>
                    <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{bodyFat}<span style={{ fontSize: 14, fontWeight: 400 }}>%</span></p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {profile?.gender === 'M'
                        ? bodyFat < 10 ? 'Atleta' : bodyFat < 20 ? 'Fitness' : bodyFat < 25 ? 'Medio' : 'Sopra media'
                        : bodyFat < 20 ? 'Atleta' : bodyFat < 28 ? 'Fitness' : bodyFat < 32 ? 'Medio' : 'Sopra media'}
                    </p>
                    <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden', marginTop: 10, position: 'relative' }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, var(--green-main) 30%, var(--orange) 70%, var(--red) 100%)', borderRadius: 3 }} />
                      <div style={{ position: 'absolute', top: -2, left: `${Math.min(96, Math.max(2, ((bodyFat - 5) / 35) * 100))}%`, transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: 'white', border: '2px solid var(--text-secondary)', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                    </div>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>Formula Deurenberg (stima)</p>
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Aggiungi data di nascita e sesso nel profilo</p>
                )}
              </div>
            </div>

            {/* Add measurements form */}
            {showMeasForm && (
              <div className="card animate-slideUp" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📏 Misurazioni corporee</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="input-group">
                    <label className="input-label">📅 Data</label>
                    <input type="date" className="input-field" value={measForm.date} onChange={e => setMeasForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {MEAS_FIELDS.map(f => (
                      <div key={f.key} className="input-group">
                        <label className="input-label">{f.emoji} {f.label} (cm)</label>
                        <input type="number" step="0.1" className="input-field" placeholder="–" value={measForm[f.key]} onChange={e => setMeasForm(p => ({ ...p, [f.key]: e.target.value }))} inputMode="decimal" />
                      </div>
                    ))}
                  </div>
                  <div className="input-group">
                    <label className="input-label">📓 Note</label>
                    <textarea className="input-field" rows={2} placeholder="Note opzionali…" value={measForm.notes} onChange={e => setMeasForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveMeasurements} disabled={savingMeas}>
                      {savingMeas ? 'Salvataggio…' : 'Salva misurazioni'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowMeasForm(false)}>Annulla</button>
                  </div>
                </div>
              </div>
            )}

            {/* Measurements chart */}
            {measChartData.length > 1 && (
              <div className="card" style={{ padding: '18px 12px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600 }}>Andamento misure</h3>
                </div>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingLeft: 8, paddingBottom: 10 }}>
                  {MEAS_FIELDS.map(f => (
                    <button key={f.key} onClick={() => setMeasMetric(f.key)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 100, background: measMetric === f.key ? 'var(--blue)' : 'var(--surface-2)', color: measMetric === f.key ? 'white' : 'var(--text-secondary)', border: `1.5px solid ${measMetric === f.key ? 'transparent' : 'var(--border)'}`, font: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                      {f.emoji} {f.label}
                    </button>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={measChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip content={<MeasTooltip unit="cm" />} />
                    <Line type="monotone" dataKey="val" stroke="var(--blue)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--blue)' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Measurements history */}
            {measurements.length > 0 ? (
              <div className="card" style={{ padding: '18px 20px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Storico misurazioni</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[...measurements].reverse().slice(0, 10).map((m, i) => {
                    const prev = [...measurements].reverse()[i + 1]
                    return (
                      <div key={m.id} style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Ruler size={16} color="var(--blue)" />
                            </div>
                            <p style={{ fontSize: 13, fontWeight: 600 }}>{new Date(m.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                          {MEAS_FIELDS.map(f => {
                            const val = m[f.key]
                            const prevVal = prev?.[f.key]
                            const delta = val && prevVal ? (val - prevVal).toFixed(1) : null
                            return (
                              <div key={f.key} style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>{f.emoji}</p>
                                <p style={{ fontSize: 13, fontWeight: 600, color: val ? 'var(--text-primary)' : 'var(--text-muted)' }}>{val ? `${val}` : '–'}</p>
                                <p style={{ fontSize: 9, color: 'var(--text-muted)' }}>cm</p>
                                {delta !== null && (
                                  <p style={{ fontSize: 9, color: parseFloat(delta) < 0 ? 'var(--green-main)' : parseFloat(delta) > 0 ? 'var(--red)' : 'var(--text-muted)', fontWeight: 600 }}>
                                    {parseFloat(delta) > 0 ? '+' : ''}{delta}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        {m.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>{m.notes}</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : !showMeasForm && (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                <Ruler size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p style={{ fontSize: 15, fontWeight: 500 }}>Nessuna misurazione</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Registra le tue misurazioni corporee per tracciare i progressi.</p>
                <button className="btn btn-primary" onClick={() => setShowMeasForm(true)} style={{ marginTop: 20 }}>
                  <Plus size={16} />Prima misurazione
                </button>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: FOTO
           ══════════════════════════════════════════════════════ */}
        {activeTab === 'foto' && (
          <>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoSelect}
            />

            {/* Before / After comparison */}
            {beforePhoto && afterPhoto && (photoUrls[beforePhoto.id] || photoUrls[afterPhoto.id]) && (
              <div className="card" style={{ padding: '16px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Prima & Dopo</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { photo: beforePhoto, label: 'Prima' },
                    { photo: afterPhoto, label: 'Dopo' },
                  ].map(({ photo, label }) => (
                    <div key={photo.id} style={{ position: 'relative' }}>
                      {photoUrls[photo.id] ? (
                        <img src={photoUrls[photo.id]} alt={label} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 12 }} onClick={() => setExpandedPhoto(photo.id)} />
                      ) : (
                        <div style={{ width: '100%', aspectRatio: '3/4', background: 'var(--surface-3)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Camera size={24} color="var(--text-muted)" />
                        </div>
                      )}
                      <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: '3px 8px' }}>
                        <span style={{ fontSize: 11, color: 'white', fontWeight: 600 }}>{label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload photo panel (shown after file selection) */}
            {photoPreview && (
              <div className="card animate-slideUp" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>📸 Nuova foto</h3>
                {/* lgtm[js/xss-through-dom] -- img src cannot execute scripts; URL is a validated blob: URL from URL.createObjectURL */}
                <img src={photoPreview.startsWith('blob:') ? photoPreview : ''} alt="Anteprima" style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 12, marginBottom: 14, background: 'var(--surface-2)' }} />
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {PHOTO_TYPES.map(t => (
                    <button key={t.value} onClick={() => setPhotoType(t.value)} style={{ flex: 1, padding: '9px 6px', borderRadius: 12, background: photoType === t.value ? 'var(--green-pale)' : 'var(--surface-2)', color: photoType === t.value ? 'var(--green-main)' : 'var(--text-secondary)', border: `1.5px solid ${photoType === t.value ? 'var(--green-main)' : 'var(--border)'}`, font: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="input-group" style={{ marginBottom: 14 }}>
                  <label className="input-label">📓 Note (opzionale)</label>
                  <input className="input-field" value={photoNotes} onChange={e => setPhotoNotes(e.target.value)} placeholder="es. -5kg raggiunto!" />
                </div>
                {photoError && (
                  <div style={{ padding: '10px 14px', background: '#fff0f0', color: 'var(--red)', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{photoError}</div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={uploadPhoto} disabled={uploadingPhoto}>
                    {uploadingPhoto ? 'Caricamento…' : 'Salva foto'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setPhotoPreview(null); setPhotoFile(null); setPhotoError(null) }}>
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Expanded photo modal */}
            {expandedPhoto && photoUrls[expandedPhoto] && (
              <div onClick={() => setExpandedPhoto(null)} style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <button onClick={() => setExpandedPhoto(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                  <X size={18} />
                </button>
                <img src={photoUrls[expandedPhoto]} alt="" style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 12 }} />
              </div>
            )}

            {/* Photo gallery */}
            {photos.length > 0 ? (
              <div className="card" style={{ padding: '18px 16px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Galleria progressi</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {photos.map(photo => (
                    <div key={photo.id} style={{ position: 'relative' }}>
                      {photoUrls[photo.id] ? (
                        <img
                          src={photoUrls[photo.id]}
                          alt={photo.photo_type}
                          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10, cursor: 'pointer' }}
                          onClick={() => setExpandedPhoto(photo.id)}
                        />
                      ) : (
                        <div style={{ width: '100%', aspectRatio: '1', background: 'var(--surface-3)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Camera size={20} color="var(--text-muted)" />
                        </div>
                      )}
                      <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '2px 6px' }}>
                        <span style={{ fontSize: 9, color: 'white', fontWeight: 600 }}>{photo.photo_type}</span>
                      </div>
                      <button
                        onClick={() => deletePhoto(photo)}
                        style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(220,74,74,0.85)', border: 'none', borderRadius: 6, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}
                      >
                        <X size={12} />
                      </button>
                      <p style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', marginTop: 3 }}>
                        {new Date(photo.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : !photoPreview && (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                <Camera size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p style={{ fontSize: 15, fontWeight: 500 }}>Nessuna foto ancora</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Scatta foto prima/dopo per visualizzare i tuoi progressi.</p>
                <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} style={{ marginTop: 20 }}>
                  <Camera size={16} />Aggiungi prima foto
                </button>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
                  ℹ️ Richiede la configurazione del bucket "progress-photos" in Supabase Storage.
                </p>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
