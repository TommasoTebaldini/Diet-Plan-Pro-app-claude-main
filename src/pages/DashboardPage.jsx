import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Utensils, Droplets, TrendingUp, Apple, Flame, Leaf, MessageCircle, FileText, BookOpen, User, ChevronRight, Activity, Scale, Calendar, Zap, Award, Heart, BarChart2 } from 'lucide-react'

// Animated progress ring: starts at 0, transitions to target pct on mount
function Ring({ pct, color, size = 60, strokeWidth = 7 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setDisplay(pct), 80)
    return () => clearTimeout(t)
  }, [pct])
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - Math.min(100, display) / 100 * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }} />
    </svg>
  )
}

// Meal types with time windows (startHour as decimal)
const MEAL_ORDER = ['colazione', 'spuntino_mattina', 'pranzo', 'spuntino_pomeriggio', 'cena']
const MEAL_META = {
  colazione:           { label: 'Colazione',            icon: '☀️', time: '07:00–08:30', startHour: 7 },
  spuntino_mattina:    { label: 'Spuntino mattina',      icon: '🍎', time: '10:00–10:30', startHour: 10 },
  pranzo:              { label: 'Pranzo',                icon: '🍽️', time: '12:30–13:30', startHour: 12.5 },
  spuntino_pomeriggio: { label: 'Spuntino pomeriggio',   icon: '🥤', time: '15:30–16:00', startHour: 15.5 },
  cena:                { label: 'Cena',                  icon: '🌙', time: '19:30–20:30', startHour: 19.5 },
}

function getNextMeal(meals, nowHour) {
  for (const type of MEAL_ORDER) {
    if (MEAL_META[type].startHour > nowHour) {
      const meal = meals.find(m => m.meal_type === type)
      if (meal) return { meal, meta: MEAL_META[type] }
    }
  }
  return null
}

function getMotivationalMessage(kcalPct, waterPct, streak) {
  if (streak >= 14) return `🏆 ${streak} giorni di fila! Sei straordinario!`
  if (streak >= 7)  return `🔥 ${streak} giorni consecutivi! Continua così!`
  if (streak >= 3)  return `⚡ ${streak} giorni di streak! Stai crescendo!`
  if (kcalPct >= 90) return '✅ Ottimo! Stai raggiungendo l\'obiettivo calorico!'
  if (kcalPct >= 50) return '💪 Sei a metà strada. Registra il prossimo pasto!'
  if (waterPct >= 80) return '💧 Ottima idratazione oggi! Continua!'
  if (kcalPct === 0)  return '🌱 Buona giornata! Inizia a registrare i pasti.'
  return '🎯 Ogni piccolo passo conta. Vai avanti!'
}

function StatPill({ label, val, target, color }) {
  const pct = target ? Math.min(100, Math.round(val / target * 100)) : 0
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,.1)', borderRadius: 14, padding: '10px 8px', textAlign: 'center', border: '1px solid rgba(255,255,255,.12)', backdropFilter: 'blur(8px)' }}>
      <div style={{ height: 3, background: 'rgba(255,255,255,.2)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
        {target && <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 1s ease' }} />}
      </div>
      <p style={{ color: 'white', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>{val}{target ? `/${target}` : ''}</p>
      <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 10, marginTop: 3 }}>{label}</p>
    </div>
  )
}

const ACTIONS = [
  { label: 'Dieta', icon: Utensils, to: '/dieta', color: '#157a4a', bg: '#e6f5ee' },
  { label: 'Pasti', icon: Apple, to: '/macro', color: '#e8882a', bg: '#fff4e6' },
  { label: 'Acqua', icon: Droplets, to: '/acqua', color: '#2f7de8', bg: '#eff6ff' },
  { label: 'Attività', icon: Activity, to: '/attivita', color: '#f97316', bg: '#fff7ed' },
  { label: 'Progressi', icon: TrendingUp, to: '/progressi', color: '#7c3aed', bg: '#f5f3ff' },
  { label: 'Benessere', icon: Heart, to: '/benessere', color: '#ec4899', bg: '#fdf2f8' },
  { label: 'Report', icon: BarChart2, to: '/statistiche', color: '#0f766e', bg: '#f0fdfa' },
  { label: 'Chat', icon: MessageCircle, to: '/chat', color: '#dc4a4a', bg: '#fff0f0' },
  { label: 'Documenti', icon: FileText, to: '/documenti', color: '#0891b2', bg: '#ecfeff' },
  { label: 'Alimenti', icon: BookOpen, to: '/alimenti', color: '#157a4a', bg: '#f0fdf4' },
  { label: 'Profilo', icon: User, to: '/profilo', color: '#64748b', bg: '#f8fafc' },
]

export default function DashboardPage() {
  const { profile, user } = useAuth()
  const [todayLog, setTodayLog] = useState(null)
  const [waterLog, setWaterLog] = useState(0)
  const [diet, setDiet] = useState(null)
  const [weight, setWeight] = useState(null)
  const [unreadChat, setUnreadChat] = useState(0)
  const [streak, setStreak] = useState(0)
  const [nextMealInfo, setNextMealInfo] = useState(null)
  const [appointment, setAppointment] = useState(null)

  const hour = new Date().getHours()
  const greet = hour < 6 ? 'Buona notte' : hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buona sera'

  useEffect(() => {
    async function load() {
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const nowDecimalHour = now.getHours() + now.getMinutes() / 60

      // Base data
      const [log, water, activeDiet, w, chat] = await Promise.allSettled([
        supabase.from('daily_logs').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
        supabase.from('water_logs').select('amount_ml').eq('user_id', user.id).eq('date', today),
        supabase.from('patient_diets').select('*').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
        supabase.from('weight_logs').select('weight_kg').eq('user_id', user.id).order('date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('chat_messages').select('id', { count: 'exact' }).eq('patient_id', user.id).eq('sender_role', 'dietitian').is('read_at', null),
      ])
      if (log.value?.data) setTodayLog(log.value.data)
      if (water.value?.data) setWaterLog(water.value.data.reduce((s, w) => s + w.amount_ml, 0))
      if (w.value?.data) setWeight(w.value.data.weight_kg)
      if (chat.value?.count) setUnreadChat(chat.value.count)

      const currentDiet = activeDiet.value?.data ?? null
      setDiet(currentDiet)

      // Streak: count consecutive days with food logs (last 60 days)
      const sixtyAgo = new Date(now)
      sixtyAgo.setDate(sixtyAgo.getDate() - 60)
      const { data: streakRows } = await supabase
        .from('daily_logs')
        .select('date')
        .eq('user_id', user.id)
        .gte('date', sixtyAgo.toISOString().split('T')[0])
        .order('date', { ascending: false })
      if (streakRows) {
        const datesSet = new Set(streakRows.map(r => r.date))
        let s = 0
        // If today has no log yet, start counting from yesterday (offset=1); otherwise from today (offset=0)
        const startOffset = datesSet.has(today) ? 0 : 1
        for (let i = startOffset; i < 60 + startOffset; i++) {
          const d = new Date(now)
          d.setDate(d.getDate() - i)
          if (datesSet.has(d.toISOString().split('T')[0])) s++
          else break
        }
        setStreak(s)
      }

      // Next meal from today's diet meals
      if (currentDiet) {
        // getDay(): 0=Sun, 1=Mon, ..., 6=Sat → convert to 1=Mon...7=Sun
        const jsDay = now.getDay()
        const dayNumber = jsDay === 0 ? 7 : jsDay
        const { data: mealRows } = await supabase
          .from('diet_meals')
          .select('*')
          .eq('diet_id', currentDiet.id)
          .or(`day_number.eq.${dayNumber},day_number.is.null`)
          .order('meal_order')
        if (mealRows?.length) {
          const found = getNextMeal(mealRows, nowDecimalHour)
          setNextMealInfo(found)
        }
      }

      // Next appointment (graceful fail if table doesn't exist yet)
      try {
        const { data: appt, error: apptError } = await supabase
          .from('appointments')
          .select('*')
          .eq('patient_id', user.id)
          .gte('appointment_date', now.toISOString())
          .order('appointment_date')
          .limit(1)
          .maybeSingle()
        if (apptError && !apptError.message?.includes('relation') && !apptError.message?.includes('does not exist')) {
          console.error('appointments query error:', apptError)
        }
        if (appt) setAppointment(appt)
      } catch (err) {
        // appointments table may not exist yet — only log unexpected errors
        if (!err?.message?.includes('relation') && !err?.message?.includes('does not exist')) {
          console.error('appointments error:', err)
        }
      }
    }
    load()
  }, [user.id])

  const firstName = profile?.first_name || profile?.full_name?.split(' ')[0] || 'Ciao'
  const kcal = todayLog?.kcal || 0
  const kcalTarget = diet?.kcal_target || 2000
  const kcalPct = Math.min(100, Math.round(kcal / kcalTarget * 100))
  const waterTarget = 2500
  const waterPct = Math.min(100, Math.round(waterLog / waterTarget * 100))
  const motivationalMsg = getMotivationalMessage(kcalPct, waterPct, streak)

  // Format appointment date
  const apptDate = appointment ? new Date(appointment.appointment_date) : null
  const apptLabel = apptDate
    ? apptDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
    : null
  const apptTime = apptDate
    ? apptDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="page">
      {/* ── Hero header ── */}
      <div style={{
        background: 'linear-gradient(160deg, var(--green-dark) 0%, var(--green-main) 55%, var(--green-mid) 100%)',
        padding: 'calc(env(safe-area-inset-top) + 20px) 20px 28px',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 12, marginBottom: 2 }}>{greet} 👋</p>
              <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 28, color: 'white', fontWeight: 300, lineHeight: 1.1 }}>{firstName}</h1>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {streak > 0 && (
                <div style={{ height: 42, borderRadius: 100, background: 'rgba(255,165,0,.25)', border: '1.5px solid rgba(255,165,0,.45)', display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px' }}>
                  <Zap size={14} color="#fbbf24" fill="#fbbf24" />
                  <span style={{ color: '#fde68a', fontSize: 13, fontWeight: 700 }}>{streak}d</span>
                </div>
              )}
              {unreadChat > 0 && (
                <Link to="/chat" style={{ width: 42, height: 42, borderRadius: '50%', background: '#dc4a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', position: 'relative', boxShadow: '0 4px 12px rgba(220,74,74,.4)' }}>
                  <MessageCircle size={18} color="white" />
                  <span style={{ position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: 'white', color: '#dc4a4a', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadChat}</span>
                </Link>
              )}
              <Link to="/profilo" style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: 'white', fontWeight: 700, fontSize: 16, border: '1.5px solid rgba(255,255,255,.25)' }}>
                {firstName[0]?.toUpperCase()}
              </Link>
            </div>
          </div>

          {/* Calorie ring + stats */}
          <div style={{ background: 'rgba(255,255,255,.1)', backdropFilter: 'blur(12px)', borderRadius: 20, padding: '16px 18px', border: '1px solid rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Ring pct={kcalPct} color="rgba(255,255,255,.9)" size={68} strokeWidth={7} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Flame size={14} color="white" />
                <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>{kcalPct}%</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 11, marginBottom: 2 }}>Calorie oggi</p>
              <p style={{ color: 'white', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{kcal} <span style={{ fontSize: 13, opacity: .7, fontWeight: 400 }}>/ {kcalTarget} kcal</span></p>
              <div style={{ marginTop: 8, height: 5, background: 'rgba(255,255,255,.2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${kcalPct}%`, background: 'white', borderRadius: 3, transition: 'width 1.2s ease' }} />
              </div>
            </div>
          </div>

          {/* Macro pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            <StatPill label="Prot." val={`${todayLog?.proteins || 0}g`} target={diet?.protein_target ? `${diet.protein_target}g` : null} color="#93c5fd" />
            <StatPill label="Carbo" val={`${todayLog?.carbs || 0}g`} target={diet?.carbs_target ? `${diet.carbs_target}g` : null} color="#fcd34d" />
            <StatPill label="Grassi" val={`${todayLog?.fats || 0}g`} target={diet?.fats_target ? `${diet.fats_target}g` : null} color="#fca5a5" />
            <StatPill label="Acqua" val={`${Math.round(waterLog/100)/10}L`} target="2.5L" color="#7dd3fc" />
          </div>

          {/* Motivational message */}
          <div style={{ marginTop: 12, background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '10px 14px', border: '1px solid rgba(255,255,255,.15)' }}>
            <p style={{ color: 'rgba(255,255,255,.9)', fontSize: 13, fontWeight: 500 }}>{motivationalMsg}</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Quick actions 4x2 */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Accesso rapido</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {ACTIONS.map(({ label, icon: Icon, to, color, bg }) => (
              <Link key={to} to={to} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 54, height: 54, borderRadius: 18, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color, boxShadow: 'var(--shadow-xs)', border: '1px solid rgba(0,0,0,.04)', transition: 'transform .15s', position: 'relative' }}>
                  <Icon size={22} strokeWidth={1.8} />
                  {label === 'Chat' && unreadChat > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#dc4a4a', color: 'white', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface-2)' }}>{unreadChat}</span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'center' }}>{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Water bar */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Droplets size={16} color="#2f7de8" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600 }}>Idratazione</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{waterLog} ml / {waterTarget} ml</p>
              </div>
            </div>
            <Link to="/acqua" style={{ fontSize: 13, color: 'var(--green-main)', fontWeight: 600, textDecoration: 'none' }}>+ Aggiungi</Link>
          </div>
          <div style={{ height: 8, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${waterPct}%`, background: 'linear-gradient(90deg, #60a5fa, #2f7de8)', borderRadius: 4, transition: 'width 1.2s ease' }} />
          </div>
        </div>

        {/* Next meal */}
        {nextMealInfo && (
          <Link to="/dieta" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>
                {nextMealInfo.meta.icon}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Prossimo pasto</p>
                <p style={{ fontSize: 15, fontWeight: 600 }}>{nextMealInfo.meta.label}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                  🕐 {nextMealInfo.meta.time}
                  {nextMealInfo.meal.kcal ? ` · ${nextMealInfo.meal.kcal} kcal` : ''}
                </p>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>
          </Link>
        )}

        {/* Weight + diet summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Scale size={16} color="#7c3aed" />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Peso attuale</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{weight ? `${weight} kg` : '–'}</p>
            {profile?.target_weight && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Obiettivo: {profile.target_weight} kg</p>}
          </div>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Leaf size={16} color="var(--green-main)" />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Piano attivo</p>
            <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{diet?.name || 'Nessun piano'}</p>
            {diet && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{diet.kcal_target} kcal</p>}
          </div>
        </div>

        {/* Appointment reminder */}
        {appointment && (
          <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid var(--green-main)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Calendar size={20} color="var(--green-main)" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Prossima visita</p>
              <p style={{ fontSize: 15, fontWeight: 600 }}>{appointment.title}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1, textTransform: 'capitalize' }}>
                {apptLabel} · {apptTime}
              </p>
              {appointment.notes && <p style={{ fontSize: 12, color: 'var(--green-dark)', marginTop: 4 }}>💡 {appointment.notes}</p>}
            </div>
          </div>
        )}

        {/* Unread messages from dietitian */}
        {unreadChat > 0 && (
          <Link to="/chat" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid #dc4a4a' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: '#fff0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                <MessageCircle size={20} color="#dc4a4a" />
                <span style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: '#dc4a4a', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface-2)' }}>{unreadChat}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Messaggi non letti</p>
                <p style={{ fontSize: 15, fontWeight: 600 }}>
                  {unreadChat === 1 ? '1 nuovo messaggio' : `${unreadChat} nuovi messaggi`} dal dietista
                </p>
                <p style={{ fontSize: 12, color: '#dc4a4a', fontWeight: 500, marginTop: 1 }}>Tocca per leggere →</p>
              </div>
            </div>
          </Link>
        )}

        {/* Diet preview */}
        {diet && (
          <Link to="/dieta" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, var(--green-pale), #c8f5e2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Utensils size={20} color="var(--green-main)" strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Piano personalizzato</p>
                <p style={{ fontSize: 15, fontWeight: 600 }}>{diet.name || 'Vedi la tua dieta'}</p>
                {diet.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>{diet.notes}</p>}
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
