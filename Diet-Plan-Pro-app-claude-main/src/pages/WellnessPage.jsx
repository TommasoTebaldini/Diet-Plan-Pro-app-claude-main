import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ComposedChart, Bar,
} from 'recharts'
import { Heart, Zap, Moon, Plus, CheckCircle, Clock, BedDouble } from 'lucide-react'

const MOOD_OPTIONS = [
  { value: 1, emoji: '😞', label: 'Pessimo' },
  { value: 2, emoji: '😕', label: 'Non bene' },
  { value: 3, emoji: '😐', label: 'Normale' },
  { value: 4, emoji: '😊', label: 'Bene' },
  { value: 5, emoji: '😄', label: 'Ottimo' },
]

const ENERGY_OPTIONS = [
  { value: 1, emoji: '🪫', label: 'Scarica' },
  { value: 2, emoji: '😴', label: 'Bassa' },
  { value: 3, emoji: '😐', label: 'Normale' },
  { value: 4, emoji: '⚡', label: 'Alta' },
  { value: 5, emoji: '🚀', label: 'Massima' },
]

const SLEEP_OPTIONS = [
  { value: 1, emoji: '😫', label: 'Pessima' },
  { value: 2, emoji: '😔', label: 'Scarsa' },
  { value: 3, emoji: '😐', label: 'Discreta' },
  { value: 4, emoji: '😴', label: 'Buona' },
  { value: 5, emoji: '🌟', label: 'Ottima' },
]

const RESTEDNESS_OPTIONS = [
  { value: 1, emoji: '🥱', label: 'Esausto' },
  { value: 2, emoji: '😩', label: 'Stanco' },
  { value: 3, emoji: '😐', label: 'Così così' },
  { value: 4, emoji: '😌', label: 'Riposato' },
  { value: 5, emoji: '💪', label: 'Carico' },
]

const SYMPTOM_LIST = [
  'Gonfiore', 'Stanchezza', 'Mal di testa', 'Insonnia',
  'Fame', 'Nausea', 'Energia alta', 'Umore positivo',
  'Crampi', 'Digestione difficile', 'Ansia', 'Concentrazione',
]

function ScaleSelector({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(value === o.value ? null : o.value)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, background: 'none', cursor: 'pointer',
            border: `2px solid ${value === o.value ? 'var(--green-main)' : 'var(--border)'}`,
            borderRadius: 14, padding: '8px 6px', transition: 'all 0.15s',
            transform: value === o.value ? 'scale(1.1)' : 'none',
            minWidth: 52,
          }}
        >
          <span style={{ fontSize: 22 }}>{o.emoji}</span>
          <span style={{ fontSize: 9, color: value === o.value ? 'var(--green-main)' : 'var(--text-muted)', fontWeight: value === o.value ? 600 : 400 }}>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

function MoodDot({ value }) {
  const opt = MOOD_OPTIONS.find(o => o.value === value)
  return opt ? <span style={{ fontSize: 16 }}>{opt.emoji}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>–</span>
}

function CustomMoodTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const mood = MOOD_OPTIONS.find(o => o.value === payload[0]?.value)
  const energy = ENERGY_OPTIONS.find(o => o.value === payload[1]?.value)
  const sleep = SLEEP_OPTIONS.find(o => o.value === payload[2]?.value)
  const sleepHoursVal = payload.find(p => p.dataKey === 'sleepHours')?.value
  const restedness = RESTEDNESS_OPTIONS.find(o => o.value === payload.find(p => p.dataKey === 'restedness')?.value)
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow-md)', fontSize: 12 }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>
      {mood && <p style={{ marginBottom: 2 }}>{mood.emoji} Umore: <strong>{mood.label}</strong></p>}
      {energy && <p style={{ marginBottom: 2 }}>{energy.emoji} Energia: <strong>{energy.label}</strong></p>}
      {sleep && <p style={{ marginBottom: 2 }}>{sleep.emoji} Sonno: <strong>{sleep.label}</strong></p>}
      {sleepHoursVal != null && <p style={{ marginBottom: 2 }}>🕐 Ore sonno: <strong>{sleepHoursVal}h</strong></p>}
      {restedness && <p>😴 Riposo: <strong>{restedness.label}</strong></p>}
    </div>
  )
}

function CustomCorrelationTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const mood = payload.find(p => p.dataKey === 'mood')
  const kcal = payload.find(p => p.dataKey === 'kcal')
  const moodOpt = mood ? MOOD_OPTIONS.find(o => o.value === mood.value) : null
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow-md)', fontSize: 12 }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>
      {moodOpt && <p style={{ marginBottom: 2 }}>{moodOpt.emoji} Umore: <strong>{moodOpt.label}</strong></p>}
      {kcal && <p>🔥 Kcal: <strong>{Math.round(kcal.value)}</strong></p>}
    </div>
  )
}

export default function WellnessPage() {
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]

  const [todayLog, setTodayLog] = useState(null)
  const [mood, setMood] = useState(null)
  const [energy, setEnergy] = useState(null)
  const [sleepQuality, setSleepQuality] = useState(null)
  const [sleepHours, setSleepHours] = useState(null)
  const [sleepRestedness, setSleepRestedness] = useState(null)
  const [symptoms, setSymptoms] = useState([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [history, setHistory] = useState([])
  const [macroHistory, setMacroHistory] = useState([])
  const [range, setRange] = useState(30)
  const [chartTab, setChartTab] = useState('trend') // 'trend' | 'correlazione'

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadData()
  }, [range])

  async function loadData() {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - range)
    const from = cutoff.toISOString().split('T')[0]

    const [wellnessRes, macroRes] = await Promise.all([
      supabase.from('daily_wellness').select('*')
        .eq('user_id', user.id)
        .gte('date', from)
        .order('date', { ascending: true }),
      supabase.from('daily_logs').select('date, kcal, proteins, carbs, fats')
        .eq('user_id', user.id)
        .gte('date', from)
        .order('date', { ascending: true }),
    ])

    const wellnessData = wellnessRes.data || []
    setHistory(wellnessData)
    setMacroHistory(macroRes.data || [])

    const log = wellnessData.find(w => w.date === today)
    setTodayLog(log || null)
    if (log) {
      setMood(log.mood || null)
      setEnergy(log.energy || null)
      setSleepQuality(log.sleep_quality || null)
      setSleepHours(log.sleep_hours != null ? log.sleep_hours : null)
      setSleepRestedness(log.sleep_restedness || null)
      setSymptoms(log.symptoms || [])
      setNotes(log.notes || '')
    } else {
      setShowForm(true)
    }
  }

  async function saveEntry() {
    setSaving(true)
    setError('')

    try {
      // Build the full field set so updates properly clear deselected values
      const fields = {
        mood: mood ?? null,
        energy: energy ?? null,
        sleep_quality: sleepQuality ?? null,
        sleep_hours: sleepHours ?? null,
        sleep_restedness: sleepRestedness ?? null,
        symptoms: symptoms.length > 0 ? symptoms : [],
        notes: notes || null,
      }

      // Check if a record already exists for today (avoids upsert + RLS issues)
      const { data: existing, error: selectError } = await supabase
        .from('daily_wellness')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle()

      if (selectError) {
        console.error('Wellness select error:', selectError)
        setSaving(false)
        setError('Errore durante il salvataggio. Riprova.')
        return
      }

      let opError = null
      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('daily_wellness')
          .update(fields)
          .eq('id', existing.id)
        opError = error
      } else {
        // Insert new record
        const { error } = await supabase
          .from('daily_wellness')
          .insert({ user_id: user.id, date: today, ...fields })
        opError = error
      }

      setSaving(false)

      if (opError) {
        console.error('Wellness save error:', opError)
        setError('Errore durante il salvataggio. Riprova.')
        return
      }

      setSaved(true)
      setShowForm(false)
      setTimeout(() => setSaved(false), 3000)
      await loadData()
    } catch (err) {
      console.error('Wellness unexpected error:', err)
      setSaving(false)
      setError('Errore durante il salvataggio. Riprova.')
    }
  }

  function toggleSymptom(s) {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  // Build chart data: merge wellness and macro history by date
  const trendData = history.map(w => ({
    date: new Date(w.date + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
    mood: w.mood,
    energy: w.energy,
    sleep: w.sleep_quality,
    sleepHours: w.sleep_hours,
    restedness: w.sleep_restedness,
  }))

  const macroMap = {}
  macroHistory.forEach(m => { macroMap[m.date] = m })

  const correlationData = history
    .filter(w => w.mood && macroMap[w.date])
    .map(w => {
      const macro = macroMap[w.date]
      return {
        date: new Date(w.date + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
        mood: w.mood,
        kcal: macro?.kcal || 0,
      }
    })

  const moodEntries = history.filter(w => w.mood)
  const moodAvg = moodEntries.length > 0
    ? (moodEntries.reduce((s, w) => s + w.mood, 0) / moodEntries.length).toFixed(1)
    : null

  const energyEntries = history.filter(w => w.energy)
  const energyAvg = energyEntries.length > 0
    ? (energyEntries.reduce((s, w) => s + w.energy, 0) / energyEntries.length).toFixed(1)
    : null

  const sleepEntries = history.filter(w => w.sleep_quality)
  const sleepAvg = sleepEntries.length > 0
    ? (sleepEntries.reduce((s, w) => s + w.sleep_quality, 0) / sleepEntries.length).toFixed(1)
    : null

  const sleepHoursEntries = history.filter(w => w.sleep_hours != null)
  const sleepHoursAvg = sleepHoursEntries.length > 0
    ? (sleepHoursEntries.reduce((s, w) => s + w.sleep_hours, 0) / sleepHoursEntries.length).toFixed(1)
    : null

  const restednessEntries = history.filter(w => w.sleep_restedness)
  const restednessAvg = restednessEntries.length > 0
    ? (restednessEntries.reduce((s, w) => s + w.sleep_restedness, 0) / restednessEntries.length).toFixed(1)
    : null

  const todayMoodOpt = MOOD_OPTIONS.find(o => o.value === (todayLog?.mood))
  const todayEnergyOpt = ENERGY_OPTIONS.find(o => o.value === (todayLog?.energy))
  const todaySleepOpt = SLEEP_OPTIONS.find(o => o.value === (todayLog?.sleep_quality))
  const todayRestednessOpt = RESTEDNESS_OPTIONS.find(o => o.value === (todayLog?.sleep_restedness))

  return (
    <div className="page">
      {/* Header */}
      <div style={{
        background: 'linear-gradient(160deg, #4c1d95, #7c3aed)',
        padding: 'calc(env(safe-area-inset-top) + 20px) 24px 28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 }}>Come stai?</p>
            <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 24, color: 'white', fontWeight: 300 }}>Benessere</h1>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="btn"
            style={{ background: 'white', color: '#7c3aed', borderRadius: 14, padding: '10px 16px', fontSize: 14, fontWeight: 600, gap: 6 }}
          >
            <Plus size={16} />Oggi
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Umore medio', val: moodAvg ? `${moodAvg}/5` : '–', icon: <Heart size={14} />, emoji: MOOD_OPTIONS.find(o => o.value === Math.round(Number(moodAvg)))?.emoji },
            { label: 'Energia media', val: energyAvg ? `${energyAvg}/5` : '–', icon: <Zap size={14} />, emoji: ENERGY_OPTIONS.find(o => o.value === Math.round(Number(energyAvg)))?.emoji },
            { label: 'Sonno medio', val: sleepAvg ? `${sleepAvg}/5` : '–', icon: <Moon size={14} />, emoji: SLEEP_OPTIONS.find(o => o.value === Math.round(Number(sleepAvg)))?.emoji },
            { label: 'Ore sonno medie', val: sleepHoursAvg ? `${sleepHoursAvg}h` : '–', icon: <Clock size={14} /> },
            { label: 'Riposo medio', val: restednessAvg ? `${restednessAvg}/5` : '–', icon: <BedDouble size={14} />, emoji: RESTEDNESS_OPTIONS.find(o => o.value === Math.round(Number(restednessAvg)))?.emoji },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '12px', border: '1px solid rgba(255,255,255,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                {s.icon}<span style={{ fontSize: 10 }}>{s.label}</span>
              </div>
              <p style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>
                {s.emoji ? `${s.emoji} ` : ''}{s.val}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Saved feedback */}
        {saved && (
          <div className="animate-slideUp" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--green-pale)', border: '1.5px solid var(--green-light)', borderRadius: 14, padding: '12px 16px', color: 'var(--green-dark)' }}>
            <CheckCircle size={18} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>Check-in salvato con successo!</span>
          </div>
        )}

        {/* Error feedback */}
        {error && (
          <div className="animate-slideUp" style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff0f0', border: '1.5px solid #ffd4d4', borderRadius: 14, padding: '12px 16px', color: '#dc2626' }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{error}</span>
          </div>
        )}

        {/* Today summary (when not editing) */}
        {!showForm && todayLog && (
          <div className="card animate-slideUp" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Check-in di oggi</h3>
              <button onClick={() => setShowForm(true)} style={{ fontSize: 12, color: '#7c3aed', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>Modifica</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Umore', emoji: todayMoodOpt?.emoji, text: todayMoodOpt?.label },
                { label: 'Energia', emoji: todayEnergyOpt?.emoji, text: todayEnergyOpt?.label },
                { label: 'Sonno', emoji: todaySleepOpt?.emoji, text: todaySleepOpt?.label },
                { label: 'Ore sonno', emoji: '🕐', text: todayLog?.sleep_hours != null ? `${todayLog.sleep_hours}h` : null },
                { label: 'Riposo', emoji: todayRestednessOpt?.emoji, text: todayRestednessOpt?.label },
              ].map(item => (
                <div key={item.label} style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                  <p style={{ fontSize: 24, marginBottom: 4 }}>{item.emoji || '–'}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.label}</p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{item.text || '–'}</p>
                </div>
              ))}
            </div>
            {todayLog.symptoms?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {todayLog.symptoms.map(s => (
                  <span key={s} className="badge badge-purple" style={{ fontSize: 11 }}>{s}</span>
                ))}
              </div>
            )}
            {todayLog.notes && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>"{todayLog.notes}"</p>
            )}
          </div>
        )}

        {/* Check-in form */}
        {showForm && (
          <div className="card animate-slideUp" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>📝 Check-in del giorno</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* Mood */}
              <div>
                <p className="input-label" style={{ marginBottom: 12 }}>😊 Come ti senti oggi?</p>
                <ScaleSelector options={MOOD_OPTIONS} value={mood} onChange={setMood} />
              </div>

              {/* Energy */}
              <div>
                <p className="input-label" style={{ marginBottom: 12 }}>⚡ Livello di energia</p>
                <ScaleSelector options={ENERGY_OPTIONS} value={energy} onChange={setEnergy} />
              </div>

              {/* Sleep */}
              <div>
                <p className="input-label" style={{ marginBottom: 12 }}>🌙 Qualità del sonno (notte scorsa)</p>
                <ScaleSelector options={SLEEP_OPTIONS} value={sleepQuality} onChange={setSleepQuality} />
              </div>

              {/* Sleep hours */}
              <div>
                <p className="input-label" style={{ marginBottom: 10 }}>🕐 Quante ore hai dormito?</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => setSleepHours(h => Math.max(0, (h ?? 7) - 0.5))}
                    style={{
                      width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--border)',
                      background: 'var(--surface-2)', cursor: 'pointer', fontSize: 18, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed',
                    }}
                  >−</button>
                  <span style={{
                    flex: 1, textAlign: 'center', fontSize: 22, fontWeight: 700,
                    color: sleepHours != null ? '#7c3aed' : 'var(--text-muted)',
                    background: '#f5f3ff', borderRadius: 10, padding: '8px 10px',
                  }}>
                    {sleepHours != null ? `${sleepHours}h` : 'Tocca +/−'}
                  </span>
                  <button
                    onClick={() => setSleepHours(h => Math.min(24, (h ?? 7) + 0.5))}
                    style={{
                      width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--border)',
                      background: 'var(--surface-2)', cursor: 'pointer', fontSize: 18, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed',
                    }}
                  >+</button>
                </div>
              </div>

              {/* Restedness */}
              <div>
                <p className="input-label" style={{ marginBottom: 12 }}>😴 Quanto ti senti riposato?</p>
                <ScaleSelector options={RESTEDNESS_OPTIONS} value={sleepRestedness} onChange={setSleepRestedness} />
              </div>

              {/* Symptoms */}
              <div>
                <p className="input-label" style={{ marginBottom: 10 }}>🔍 Sintomi / sensazioni fisiche</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SYMPTOM_LIST.map(s => (
                    <button
                      key={s}
                      onClick={() => toggleSymptom(s)}
                      style={{
                        padding: '6px 14px', borderRadius: 100, font: 'inherit', fontSize: 13, cursor: 'pointer',
                        background: symptoms.includes(s) ? '#f5f3ff' : 'var(--surface-2)',
                        color: symptoms.includes(s) ? '#7c3aed' : 'var(--text-secondary)',
                        border: `1.5px solid ${symptoms.includes(s) ? '#7c3aed' : 'var(--border)'}`,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="input-group">
                <label className="input-label">📓 Note libere</label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="Come è andata oggi? Annotazioni sul benessere, sulla dieta…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                {todayLog && (
                  <button className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ flex: 1 }}>
                    Annulla
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={saveEntry}
                  disabled={saving || (!mood && !energy && !sleepQuality && sleepHours == null && !sleepRestedness && !symptoms.length && !notes)}
                  style={{ flex: 2, background: 'linear-gradient(135deg, #4c1d95, #7c3aed)' }}
                >
                  {saving ? 'Salvataggio…' : '✓ Salva check-in'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No data at all */}
        {!showForm && !todayLog && history.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
            <Heart size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 15, fontWeight: 500 }}>Inizia il tuo diario del benessere</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Registra umore, energia e qualità del sonno ogni giorno.</p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ marginTop: 20, background: 'linear-gradient(135deg, #4c1d95, #7c3aed)' }}>
              <Plus size={16} />Primo check-in
            </button>
          </div>
        )}

        {/* Charts section */}
        {history.length > 1 && (
          <div className="card" style={{ padding: '18px 12px 14px' }}>
            {/* Tab selector */}
            <div style={{ display: 'flex', gap: 8, paddingLeft: 8, marginBottom: 16 }}>
              {[
                { key: 'trend', label: '📈 Andamento' },
                { key: 'correlazione', label: '🔗 Correlazione dieta' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setChartTab(t.key)}
                  style={{
                    padding: '6px 14px', borderRadius: 100, font: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    background: chartTab === t.key ? '#7c3aed' : 'var(--surface-2)',
                    color: chartTab === t.key ? 'white' : 'var(--text-secondary)',
                    border: `1.5px solid ${chartTab === t.key ? 'transparent' : 'var(--border)'}`,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Range selector */}
            <div style={{ display: 'flex', gap: 6, paddingLeft: 8, marginBottom: 14 }}>
              {[7, 30, 90].map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{
                    padding: '3px 10px', borderRadius: 100, font: 'inherit', fontSize: 11, cursor: 'pointer',
                    background: range === r ? 'var(--green-main)' : 'var(--surface-2)',
                    color: range === r ? 'white' : 'var(--text-muted)',
                    border: `1px solid ${range === r ? 'transparent' : 'var(--border)'}`,
                  }}
                >
                  {r}g
                </button>
              ))}
            </div>

            {chartTab === 'trend' ? (
              <>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 8, marginBottom: 8 }}>
                  Scala 1–5 &nbsp;·&nbsp;
                  <span style={{ color: '#7c3aed' }}>● Umore</span>
                  {trendData.some(d => d.energy) && <span style={{ color: '#f59e0b' }}> &nbsp;● Energia</span>}
                  {trendData.some(d => d.sleep) && <span style={{ color: '#06b6d4' }}> &nbsp;● Sonno</span>}
                  {trendData.some(d => d.restedness) && <span style={{ color: '#10b981' }}> &nbsp;● Riposo</span>}
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 5.5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip content={<CustomMoodTooltip />} />
                    <ReferenceLine y={3} stroke="var(--border)" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="mood" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4, fill: '#7c3aed' }} activeDot={{ r: 6 }} connectNulls />
                    <Line type="monotone" dataKey="energy" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} activeDot={{ r: 5 }} connectNulls />
                    <Line type="monotone" dataKey="sleep" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3, fill: '#06b6d4' }} activeDot={{ r: 5 }} connectNulls />
                    <Line type="monotone" dataKey="restedness" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </>
            ) : correlationData.length > 0 ? (
              <>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 8, marginBottom: 8 }}>
                  Umore (linea viola) vs Kcal ingerite (barre arancio)
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={correlationData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval="preserveStartEnd" />
                    <YAxis yAxisId="left" domain={[0, 5.5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip content={<CustomCorrelationTooltip />} />
                    <Bar yAxisId="right" dataKey="kcal" fill="#f59e0b" fillOpacity={0.35} radius={[3, 3, 0, 0]} />
                    <Line yAxisId="left" type="monotone" dataKey="mood" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4, fill: '#7c3aed' }} activeDot={{ r: 6 }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                <p>Aggiungi pasti nel diario alimentare per vedere la correlazione umore/dieta.</p>
              </div>
            )}
          </div>
        )}

        {/* History list */}
        {history.length > 0 && (
          <div className="card" style={{ padding: '18px 20px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Storico benessere</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...history].reverse().slice(0, 14).map(entry => {
                const moodOpt = MOOD_OPTIONS.find(o => o.value === entry.mood)
                const energyOpt = ENERGY_OPTIONS.find(o => o.value === entry.energy)
                const sleepOpt = SLEEP_OPTIONS.find(o => o.value === entry.sleep_quality)
                const restednessOpt = RESTEDNESS_OPTIONS.find(o => o.value === entry.sleep_restedness)
                const isToday = entry.date === today
                return (
                  <div key={entry.id} style={{ display: 'flex', gap: 12, padding: '10px 12px', background: isToday ? '#f5f3ff' : 'var(--surface-2)', borderRadius: 12, border: isToday ? '1.5px solid #c4b5fd' : '1px solid transparent' }}>
                    <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 44 }}>
                      <p style={{ fontSize: 22 }}>{moodOpt?.emoji || '–'}</p>
                      <p style={{ fontSize: 10, color: isToday ? '#7c3aed' : 'var(--text-muted)', fontWeight: isToday ? 600 : 400 }}>
                        {isToday ? 'Oggi' : new Date(entry.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        {moodOpt && <span style={{ fontSize: 11, background: '#f5f3ff', color: '#7c3aed', borderRadius: 100, padding: '2px 8px', fontWeight: 500 }}>😊 {moodOpt.label}</span>}
                        {energyOpt && <span style={{ fontSize: 11, background: '#fffbeb', color: '#b45309', borderRadius: 100, padding: '2px 8px', fontWeight: 500 }}>⚡ {energyOpt.label}</span>}
                        {sleepOpt && <span style={{ fontSize: 11, background: '#ecfeff', color: '#0e7490', borderRadius: 100, padding: '2px 8px', fontWeight: 500 }}>🌙 {sleepOpt.label}</span>}
                        {entry.sleep_hours != null && <span style={{ fontSize: 11, background: '#f0f0ff', color: '#4338ca', borderRadius: 100, padding: '2px 8px', fontWeight: 500 }}>🕐 {entry.sleep_hours}h</span>}
                        {restednessOpt && <span style={{ fontSize: 11, background: '#f0fdf4', color: '#166534', borderRadius: 100, padding: '2px 8px', fontWeight: 500 }}>😴 {restednessOpt.label}</span>}
                      </div>
                      {entry.symptoms?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                          {entry.symptoms.slice(0, 4).map(s => (
                            <span key={s} style={{ fontSize: 10, background: 'var(--surface)', color: 'var(--text-muted)', borderRadius: 100, padding: '1px 6px', border: '1px solid var(--border-light)' }}>{s}</span>
                          ))}
                          {entry.symptoms.length > 4 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{entry.symptoms.length - 4}</span>}
                        </div>
                      )}
                      {entry.notes && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.notes}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ height: 'var(--nav)' }} />
      </div>
    </div>
  )
}
