import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Droplets, Plus, Trash2, Bell, BellOff, BarChart2, List } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { subDays, format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

// Quick-add presets: label, icon, ml
const QUICK_PRESETS = [
  { label: 'Bicchiere', icon: '🥛', ml: 250 },
  { label: 'Tazza', icon: '☕', ml: 150 },
  { label: 'Lattina', icon: '🥤', ml: 330 },
  { label: 'Bottiglia', icon: '🧴', ml: 500 },
  { label: 'Borraccia', icon: '💧', ml: 750 },
]

const ACTIVITY_MULTIPLIERS = {
  sedentario: 1.0,
  leggero: 1.1,
  moderato: 1.2,
  attivo: 1.3,
  molto_attivo: 1.5,
}

function calcTarget(profile) {
  if (!profile?.weight_kg && !profile?.target_weight) return 2500
  const weight = profile?.weight_kg || profile?.target_weight || 70
  const mult = ACTIVITY_MULTIPLIERS[profile?.activity_level] || 1.0
  return Math.round((weight * 35 * mult) / 50) * 50
}

const NOTIF_PREFS_KEY = 'nutriplan_notif_prefs'

function getNotifPref() {
  try { return JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY) || '{}').waterReminder === true }
  catch { return false }
}

function setNotifPref(val) {
  try {
    const prefs = JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY) || '{}')
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify({ ...prefs, waterReminder: val }))
  } catch { /* ignore */ }
}

async function requestAndScheduleNotifications(intervalRef) {
  if (!('Notification' in window)) return false
  let permission = Notification.permission
  if (permission === 'default') permission = await Notification.requestPermission()
  if (permission !== 'granted') return false
  scheduleNotifications(intervalRef)
  return true
}

function scheduleNotifications(intervalRef) {
  if (intervalRef.current) clearInterval(intervalRef.current)
  intervalRef.current = setInterval(() => {
    const h = new Date().getHours()
    if (h >= 8 && h < 21 && Notification.permission === 'granted') {
      new Notification('💧 Ricorda di bere!', {
        body: 'È ora di fare una pausa e bere un bicchiere d\'acqua.',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'water-reminder',
      })
    }
  }, 60 * 60 * 1000) // every hour
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', boxShadow: 'var(--shadow-sm)' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6' }}>{payload[0].value} ml</p>
      </div>
    )
  }
  return null
}

export default function WaterPage() {
  const { profile, user } = useAuth()
  const today = new Date().toISOString().split('T')[0]
  const [latestWeight, setLatestWeight] = useState(null)
  const target = calcTarget({ ...profile, weight_kg: latestWeight })

  const [logs, setLogs] = useState([])
  const [weekData, setWeekData] = useState([])
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('oggi') // 'oggi' | 'settimana'
  const [notifEnabled, setNotifEnabled] = useState(getNotifPref)
  const intervalRef = useRef(null)

  // Load today's logs + latest weight
  useEffect(() => {
    async function load() {
      const [logsRes, weightRes] = await Promise.all([
        supabase.from('water_logs').select('*').eq('user_id', user.id).eq('date', today).order('created_at'),
        supabase.from('weight_logs').select('weight_kg').eq('user_id', user.id).order('date', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (!logsRes.error) setLogs(logsRes.data || [])
      if (!weightRes.error && weightRes.data?.weight_kg) setLatestWeight(weightRes.data.weight_kg)
    }
    load()
  }, [today, user.id])

  // Load weekly data
  useEffect(() => {
    async function loadWeek() {
      const from = subDays(new Date(), 6).toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('water_logs')
        .select('date, amount_ml')
        .eq('user_id', user.id)
        .gte('date', from)
        .lte('date', today)
      if (error) return
      const map = {}
      for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i).toISOString().split('T')[0]
        map[d] = 0
      }
      ;(data || []).forEach(r => { map[r.date] = (map[r.date] || 0) + r.amount_ml })
      setWeekData(
        Object.entries(map).map(([date, total]) => ({
          date,
          total,
          label: format(parseISO(date), 'EEE', { locale: it }),
        }))
      )
    }
    loadWeek()
  }, [today, user.id, logs])

  // Notification scheduling
  useEffect(() => {
    if (notifEnabled && Notification.permission === 'granted') {
      scheduleNotifications(intervalRef)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [notifEnabled])

  const total = logs.reduce((s, l) => s + l.amount_ml, 0)
  const pct = Math.min(100, Math.round((total / target) * 100))
  const remaining = Math.max(0, target - total)
  const statusMsg = pct >= 100 ? '🎉 Obiettivo raggiunto!' : pct >= 60 ? '👍 Stai andando bene!' : pct >= 30 ? '💧 Continua a bere!' : '⚠️ Hai bevuto poco'

  async function addWater(ml) {
    setLoading(true)
    const { data, error } = await supabase.from('water_logs').insert({ user_id: user.id, date: today, amount_ml: ml }).select().single()
    if (error) console.error('Errore salvataggio acqua:', error)
    if (data) setLogs(l => [...l, data])
    setCustom('')
    setLoading(false)
  }

  async function removeLog(id) {
    await supabase.from('water_logs').delete().eq('id', id)
    setLogs(l => l.filter(x => x.id !== id))
  }

  async function toggleNotifications() {
    if (notifEnabled) {
      setNotifEnabled(false)
      setNotifPref(false)
      if (intervalRef.current) clearInterval(intervalRef.current)
    } else {
      const ok = await requestAndScheduleNotifications(intervalRef)
      if (ok) { setNotifEnabled(true); setNotifPref(true) }
      else alert('Abilita le notifiche nelle impostazioni del browser per ricevere i promemoria.')
    }
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, #1e40af 0%, #3b82f6 100%)', padding: 'calc(env(safe-area-inset-top) + 20px) 24px 28px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={toggleNotifications} title={notifEnabled ? 'Disattiva promemoria' : 'Attiva promemoria'} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '7px 10px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            {notifEnabled ? <Bell size={15} /> : <BellOff size={15} />}
            {notifEnabled ? 'Promemoria ON' : 'Promemoria OFF'}
          </button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 }}>Idratazione di oggi</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'white', fontWeight: 300, marginBottom: 8 }}>
          {total} <span style={{ fontSize: 16, opacity: 0.75 }}>ml</span>
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{statusMsg}</p>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Progress ring + stats */}
        <div className="card" style={{ padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto 16px' }}>
            <svg viewBox="0 0 160 160" style={{ width: 160, height: 160, transform: 'rotate(-90deg)' }}>
              <circle cx={80} cy={80} r={68} fill="none" stroke="#dbeafe" strokeWidth={12} />
              <circle cx={80} cy={80} r={68} fill="none" stroke="#3b82f6"
                strokeWidth={12} strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 68}
                strokeDashoffset={2 * Math.PI * 68 * (1 - pct / 100)}
                style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Droplets size={28} color="#3b82f6" />
              <p style={{ fontSize: 28, fontWeight: 700, color: '#1e40af', lineHeight: 1 }}>{pct}%</p>
              <p style={{ fontSize: 12, color: '#60a5fa' }}>completato</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>{total}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>bevuti (ml)</p>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#94a3b8' }}>{remaining}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>rimanenti (ml)</p>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{target}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>obiettivo (ml)</p>
            </div>
          </div>

          {profile?.activity_level && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
              Obiettivo calcolato su peso e livello attività
            </p>
          )}
        </div>

        {/* Quick add */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Aggiungi veloce</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(58px, 1fr))', gap: 8, marginBottom: 14 }}>
            {QUICK_PRESETS.map(({ label, icon, ml }) => (
              <button key={ml} onClick={() => addWater(ml)} disabled={loading} style={{
                padding: '10px 4px', borderRadius: 12,
                background: 'var(--surface-2)', border: '1.5px solid var(--border)',
                font: 'inherit', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3
              }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#3b82f6' }}>{ml} ml</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              className="input-field"
              placeholder="Quantità personalizzata (ml)"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt(custom, 10); if (v > 0) addWater(v) } }}
              style={{ flex: 1 }}
              inputMode="numeric"
              min="1"
            />
            <button className="btn btn-primary" onClick={() => { const v = parseInt(custom, 10); if (v > 0) addWater(v) }} disabled={!custom || parseInt(custom, 10) <= 0 || loading} style={{ padding: '0 16px' }}>
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Tabs: oggi / settimana */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { key: 'oggi', icon: <List size={14} />, label: 'Registro oggi' },
            { key: 'settimana', icon: <BarChart2 size={14} />, label: 'Grafico settimanale' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '10px 8px', borderRadius: 12, border: 'none', font: 'inherit',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: tab === t.key ? '#3b82f6' : 'var(--surface-2)',
              color: tab === t.key ? 'white' : 'var(--text-secondary)',
            }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'oggi' && (
          <div className="card" style={{ padding: '18px 20px' }}>
            {logs.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '12px 0' }}>Nessun consumo registrato oggi</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...logs].reverse().map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Droplets size={16} color="#3b82f6" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 500 }}>{l.amount_ml} ml</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(l.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <button onClick={() => removeLog(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'settimana' && (
          <div className="card" style={{ padding: '18px 20px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Ultimi 7 giorni</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Media: {weekData.length ? Math.round(weekData.reduce((s, d) => s + d.total, 0) / weekData.length) : 0} ml/giorno
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekData} margin={{ top: 0, right: 4, left: -20, bottom: 0 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#eff6ff' }} />
                <ReferenceLine y={target} stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Obiettivo', position: 'right', fontSize: 10, fill: '#3b82f6' }} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}
                  fill="#60a5fa"
                  label={false}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>

            {/* Daily summary list */}
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...weekData].reverse().map(d => {
                const dpct = Math.min(100, Math.round((d.total / target) * 100))
                return (
                  <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 52, textAlign: 'right' }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: d.date === today ? '#3b82f6' : 'var(--text-primary)' }}>
                        {format(parseISO(d.date), 'd MMM', { locale: it })}
                      </p>
                    </div>
                    <div style={{ flex: 1, height: 8, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${dpct}%`, background: dpct >= 100 ? '#22c55e' : '#60a5fa', borderRadius: 4, transition: 'width 0.8s ease' }} />
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', width: 56, textAlign: 'right' }}>{d.total} ml</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
