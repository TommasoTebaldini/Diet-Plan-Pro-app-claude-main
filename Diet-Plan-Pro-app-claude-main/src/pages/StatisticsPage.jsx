import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell, RadialBarChart,
  RadialBar, Legend,
} from 'recharts'
import {
  BarChart2, TrendingUp, TrendingDown, Minus, FileText,
  Download, Droplets, Scale, Flame, ChevronLeft, ChevronRight,
  Check, X as XIcon,
} from 'lucide-react'
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, addWeeks, subWeeks } from 'date-fns'
import { it } from 'date-fns/locale'
import jsPDF from 'jspdf'

// ── helpers ────────────────────────────────────────────────────
const TABS = [
  { key: 'weekly', label: '📊 Settimana' },
  { key: 'adherence', label: '✅ Aderenza' },
  { key: 'comparison', label: '⚖️ Confronto' },
  { key: 'report', label: '📄 Report PDF' },
]

const MEAL_TYPES = ['colazione', 'spuntino_mattina', 'pranzo', 'spuntino_pomeriggio', 'cena']
const MEAL_LABELS = {
  colazione: 'Colazione',
  spuntino_mattina: 'Spuntino mat.',
  pranzo: 'Pranzo',
  spuntino_pomeriggio: 'Merenda',
  cena: 'Cena',
}

function isoDate(d) {
  return d.toISOString().split('T')[0]
}

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function round1(n) { return Math.round((n || 0) * 10) / 10 }

// ── custom tooltip ─────────────────────────────────────────────
function SmallTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: 'var(--shadow-sm)' }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {round1(p.value)}{unit}
        </p>
      ))}
    </div>
  )
}

// ── stat card ──────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, trend }) {
  const trendColor = trend > 0 ? 'var(--green-main)' : trend < 0 ? 'var(--red)' : 'var(--text-muted)'
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12 }}>
        {icon}<span style={{ fontWeight: 500 }}>{label}</span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</p>}
      {trend !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: trendColor, fontSize: 11, fontWeight: 600 }}>
          {trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
          {trend > 0 ? '+' : ''}{round1(trend)} vs settimana prec.
        </div>
      )}
    </div>
  )
}

// ── main component ─────────────────────────────────────────────
export default function StatisticsPage() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('weekly')
  const [loading, setLoading] = useState(true)

  // data
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week
  const [weekData, setWeekData] = useState({ macros: [], water: [], weights: [] })
  const [prevWeekData, setPrevWeekData] = useState({ macros: [], water: [], weights: [] })
  const [adherenceData, setAdherenceData] = useState([])
  const [dietTarget, setDietTarget] = useState(null)
  const [mealsCount, setMealsCount] = useState(3)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  const today = new Date()
  const weekStart = startOfWeek(subWeeks(today, weekOffset), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const prevWeekStart = subWeeks(weekStart, 1)
  const prevWeekEnd = subWeeks(weekEnd, 1)

  useEffect(() => {
    loadAll()
  }, [weekOffset])

  async function loadAll() {
    setLoading(true)
    const ws = isoDate(weekStart)
    const we = isoDate(weekEnd)
    const pws = isoDate(prevWeekStart)
    const pwe = isoDate(prevWeekEnd)

    const [macroRes, waterRes, weightRes, pMacroRes, pWaterRes, pWeightRes, dietRes, adherenceRes] = await Promise.all([
      supabase.from('daily_logs').select('date,kcal,proteins,carbs,fats').eq('user_id', user.id).gte('date', ws).lte('date', we).order('date'),
      supabase.from('water_logs').select('date,amount_ml').eq('user_id', user.id).gte('date', ws).lte('date', we),
      supabase.from('weight_logs').select('date,weight_kg').eq('user_id', user.id).gte('date', ws).lte('date', we),
      supabase.from('daily_logs').select('date,kcal,proteins,carbs,fats').eq('user_id', user.id).gte('date', pws).lte('date', pwe).order('date'),
      supabase.from('water_logs').select('date,amount_ml').eq('user_id', user.id).gte('date', pws).lte('date', pwe),
      supabase.from('weight_logs').select('date,weight_kg').eq('user_id', user.id).gte('date', pws).lte('date', pwe),
      supabase.from('patient_diets').select('kcal_target,protein_target,carbs_target,fats_target,meals_count').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      supabase.from('food_logs').select('date,meal_type').eq('user_id', user.id).gte('date', pws).lte('date', we),
    ])

    setDietTarget(dietRes.data || null)
    setMealsCount(dietRes.data?.meals_count || 3)

    // aggregate water by date
    const waterByDate = {}
    for (const w of waterRes.data || []) {
      waterByDate[w.date] = (waterByDate[w.date] || 0) + w.amount_ml
    }
    const pWaterByDate = {}
    for (const w of pWaterRes.data || []) {
      pWaterByDate[w.date] = (pWaterByDate[w.date] || 0) + w.amount_ml
    }

    setWeekData({
      macros: macroRes.data || [],
      water: Object.entries(waterByDate).map(([date, ml]) => ({ date, ml })),
      weights: weightRes.data || [],
    })
    setPrevWeekData({
      macros: pMacroRes.data || [],
      water: Object.entries(pWaterByDate).map(([date, ml]) => ({ date, ml })),
      weights: pWeightRes.data || [],
    })

    // adherence: for each day in 2-week window, which meal types were logged
    const allFoodLogs = adherenceRes.data || []
    const loggedMealsByDate = {}
    for (const fl of allFoodLogs) {
      if (!loggedMealsByDate[fl.date]) loggedMealsByDate[fl.date] = new Set()
      loggedMealsByDate[fl.date].add(fl.meal_type)
    }
    const expectedMeals = (dietRes.data?.meals_count || 3)
    const daysRange = eachDayOfInterval({ start: prevWeekStart, end: weekEnd })
    const adh = daysRange.map(d => {
      const ds = isoDate(d)
      const logged = loggedMealsByDate[ds]?.size || 0
      return {
        date: ds,
        label: format(d, 'dd/MM', { locale: it }),
        dayLabel: format(d, 'EEE', { locale: it }),
        pct: Math.min(100, Math.round((logged / expectedMeals) * 100)),
        logged,
        expected: expectedMeals,
      }
    })
    setAdherenceData(adh)
    setLoading(false)
  }

  // ── computed weekly stats ──────────────────────────────────────
  const days7 = eachDayOfInterval({ start: weekStart, end: weekEnd })

  function buildDailyChart() {
    return days7.map(d => {
      const ds = isoDate(d)
      const m = weekData.macros.find(x => x.date === ds) || {}
      const waterEntries = weekData.water.filter(x => x.date === ds)
      const waterMl = waterEntries.reduce((a, b) => a + b.ml, 0)
      return {
        label: format(d, 'EEE', { locale: it }),
        kcal: m.kcal || 0,
        proteins: Math.round(m.proteins || 0),
        carbs: Math.round(m.carbs || 0),
        fats: Math.round(m.fats || 0),
        water: waterMl,
      }
    })
  }

  const dailyChart = buildDailyChart()

  const weekAvg = {
    kcal: round1(avg(weekData.macros.map(m => m.kcal || 0))),
    proteins: round1(avg(weekData.macros.map(m => m.proteins || 0))),
    carbs: round1(avg(weekData.macros.map(m => m.carbs || 0))),
    fats: round1(avg(weekData.macros.map(m => m.fats || 0))),
    water: round1(avg(weekData.water.map(w => w.ml || 0))),
    weight: weekData.weights.length ? round1(avg(weekData.weights.map(w => w.weight_kg))) : null,
  }
  const prevAvg = {
    kcal: round1(avg(prevWeekData.macros.map(m => m.kcal || 0))),
    proteins: round1(avg(prevWeekData.macros.map(m => m.proteins || 0))),
    carbs: round1(avg(prevWeekData.macros.map(m => m.carbs || 0))),
    fats: round1(avg(prevWeekData.macros.map(m => m.fats || 0))),
    water: round1(avg(prevWeekData.water.map(w => w.ml || 0))),
    weight: prevWeekData.weights.length ? round1(avg(prevWeekData.weights.map(w => w.weight_kg))) : null,
  }

  const weekLabel = `${format(weekStart, 'd MMM', { locale: it })} – ${format(weekEnd, 'd MMM yyyy', { locale: it })}`

  // ── PDF generation ─────────────────────────────────────────────
  async function generatePdf() {
    setGeneratingPdf(true)
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210
      const margin = 14
      let y = 20

      const addText = (text, x, yy, opts = {}) => {
        doc.setFontSize(opts.size || 10)
        doc.setFont('helvetica', opts.style || 'normal')
        doc.setTextColor(...(opts.color || [30, 30, 30]))
        doc.text(text, x, yy)
      }

      const addLine = (yy) => {
        doc.setDrawColor(200, 224, 212)
        doc.setLineWidth(0.3)
        doc.line(margin, yy, W - margin, yy)
      }

      // header
      doc.setFillColor(21, 122, 74)
      doc.rect(0, 0, W, 30, 'F')
      addText('Diet Plan Pro — Report Settimanale', margin, 13, { size: 14, style: 'bold', color: [255, 255, 255] })
      addText(weekLabel, margin, 21, { size: 9, color: [200, 240, 220] })
      if (profile?.full_name) {
        addText(`Paziente: ${profile.full_name}`, W - margin - 50, 13, { size: 9, color: [200, 240, 220] })
      }
      addText(`Generato il ${format(today, 'd MMMM yyyy', { locale: it })}`, W - margin - 50, 21, { size: 8, color: [180, 230, 200] })
      y = 40

      // summary stats
      addText('Medie giornaliere', margin, y, { size: 12, style: 'bold' }); y += 7
      addLine(y); y += 5

      const statsRows = [
        ['Calorie', `${weekAvg.kcal} kcal/die`, dietTarget?.kcal_target ? `Obiettivo: ${dietTarget.kcal_target} kcal` : ''],
        ['Proteine', `${weekAvg.proteins} g/die`, dietTarget?.protein_target ? `Obiettivo: ${dietTarget.protein_target} g` : ''],
        ['Carboidrati', `${weekAvg.carbs} g/die`, dietTarget?.carbs_target ? `Obiettivo: ${dietTarget.carbs_target} g` : ''],
        ['Grassi', `${weekAvg.fats} g/die`, dietTarget?.fats_target ? `Obiettivo: ${dietTarget.fats_target} g` : ''],
        ['Acqua', weekAvg.water ? `${Math.round(weekAvg.water)} ml/die` : 'N/D', ''],
        ['Peso medio', weekAvg.weight ? `${weekAvg.weight} kg` : 'N/D', ''],
      ]
      for (const [label, val, note] of statsRows) {
        doc.setFillColor(247, 250, 248)
        doc.rect(margin, y - 4, W - margin * 2, 7, 'F')
        addText(label, margin + 2, y, { size: 9, style: 'bold', color: [45, 74, 56] })
        addText(val, 80, y, { size: 9 })
        addText(note, 130, y, { size: 8, color: [107, 143, 122] })
        y += 8
      }

      // daily breakdown
      y += 4
      addText('Dettaglio giornaliero', margin, y, { size: 12, style: 'bold' }); y += 7
      addLine(y); y += 5

      // header row
      const cols = [margin + 2, 40, 72, 100, 128, 156]
      const headers = ['Data', 'Kcal', 'Prot.', 'Carbo', 'Grassi', 'Acqua']
      doc.setFillColor(21, 122, 74)
      doc.rect(margin, y - 4.5, W - margin * 2, 7, 'F')
      headers.forEach((h, i) => addText(h, cols[i], y, { size: 8, style: 'bold', color: [255, 255, 255] }))
      y += 8

      for (const row of dailyChart) {
        if (y > 260) { doc.addPage(); y = 20 }
        const rowIdx = dailyChart.indexOf(row)
        if (rowIdx % 2 === 0) { doc.setFillColor(240, 250, 245); doc.rect(margin, y - 4.5, W - margin * 2, 7, 'F') }
        const vals = [row.label, row.kcal || '–', row.proteins || '–', row.carbs || '–', row.fats || '–', row.water ? `${Math.round(row.water)} ml` : '–']
        vals.forEach((v, i) => addText(String(v), cols[i], y, { size: 8 }))
        y += 8
      }

      // adherence
      y += 6
      if (y > 240) { doc.addPage(); y = 20 }
      addText('Aderenza alla dieta', margin, y, { size: 12, style: 'bold' }); y += 7
      addLine(y); y += 5

      const weekAdh = adherenceData.filter(d => d.date >= isoDate(weekStart) && d.date <= isoDate(weekEnd))
      const avgAdh = weekAdh.length ? Math.round(avg(weekAdh.map(d => d.pct))) : 0
      addText(`Media settimanale: ${avgAdh}%`, margin + 2, y, { size: 10, style: 'bold', color: avgAdh >= 80 ? [21, 122, 74] : avgAdh >= 50 ? [200, 120, 20] : [180, 40, 40] })
      y += 8

      for (const d of weekAdh) {
        if (y > 270) { doc.addPage(); y = 20 }
        const barW = Math.round((d.pct / 100) * (W - margin * 2 - 50))
        doc.setFillColor(d.pct >= 80 ? 21 : d.pct >= 50 ? 200 : 180, d.pct >= 80 ? 122 : d.pct >= 50 ? 120 : 40, d.pct >= 80 ? 74 : d.pct >= 50 ? 20 : 40)
        doc.rect(margin + 38, y - 3.5, barW, 5, 'F')
        addText(`${d.label} (${d.dayLabel})`, margin + 2, y, { size: 8 })
        addText(`${d.pct}%`, margin + 38 + barW + 2, y, { size: 8, style: 'bold' })
        y += 7
      }

      // notes
      y += 6
      if (y > 250) { doc.addPage(); y = 20 }
      addText('Note', margin, y, { size: 12, style: 'bold' }); y += 7
      addLine(y); y += 5
      doc.setFillColor(247, 250, 248)
      doc.rect(margin, y - 4, W - margin * 2, 30, 'F')
      addText('_____________________________________', margin + 2, y + 5, { size: 9, color: [180, 200, 190] })
      addText('_____________________________________', margin + 2, y + 13, { size: 9, color: [180, 200, 190] })
      addText('_____________________________________', margin + 2, y + 21, { size: 9, color: [180, 200, 190] })

      // footer
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        addText(`Diet Plan Pro • Pagina ${i} di ${pageCount}`, margin, 290, { size: 8, color: [150, 170, 160] })
        addText('Documento riservato — da condividere con il proprio dietista', W - margin - 80, 290, { size: 7, color: [180, 200, 190] })
      }

      const fileName = `report_${format(weekStart, 'yyyy-MM-dd')}_${profile?.full_name?.replace(/\s+/g, '_') || 'paziente'}.pdf`
      doc.save(fileName)
    } finally {
      setGeneratingPdf(false)
    }
  }

  // ── adherence stats ────────────────────────────────────────────
  const weekAdherenceData = adherenceData.filter(d => d.date >= isoDate(weekStart) && d.date <= isoDate(weekEnd))
  const avgAdherence = weekAdherenceData.length ? Math.round(avg(weekAdherenceData.map(d => d.pct))) : 0

  // ── comparison chart ───────────────────────────────────────────
  const comparisonData = [
    { name: '🔥 Kcal', curr: weekAvg.kcal, prev: prevAvg.kcal, target: dietTarget?.kcal_target || null },
    { name: '💪 Prot.', curr: weekAvg.proteins, prev: prevAvg.proteins, target: dietTarget?.protein_target || null },
    { name: '🌾 Carbo', curr: weekAvg.carbs, prev: prevAvg.carbs, target: dietTarget?.carbs_target || null },
    { name: '🥑 Grassi', curr: weekAvg.fats, prev: prevAvg.fats, target: dietTarget?.fats_target || null },
  ]

  // ── render ─────────────────────────────────────────────────────
  return (
    <div className="page">
      {/* header */}
      <div style={{ background: 'linear-gradient(160deg, var(--green-dark), var(--green-main))', padding: 'calc(env(safe-area-inset-top) + 20px) 24px 24px' }}>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 }}>Analisi avanzata</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'white', fontWeight: 300 }}>Statistiche</h1>
      </div>

      {/* tab bar */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border-light)', background: 'var(--surface)', gap: 0, WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flexShrink: 0, padding: '12px 16px', background: 'none', border: 'none', font: 'inherit', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? 'var(--green-main)' : 'var(--text-muted)', borderBottom: `2px solid ${tab === t.key ? 'var(--green-main)' : 'transparent'}`, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>
          Caricamento…
        </div>
      ) : (
        <div style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* week navigator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', borderRadius: 14, padding: '10px 16px', border: '1px solid var(--border-light)' }}>
            <button onClick={() => setWeekOffset(v => v + 1)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={16} color="var(--text-secondary)" />
            </button>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 600 }}>{weekLabel}</p>
              {weekOffset === 0 && <p style={{ fontSize: 11, color: 'var(--green-main)' }}>Settimana corrente</p>}
              {weekOffset > 0 && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{weekOffset} {weekOffset === 1 ? 'settimana' : 'settimane'} fa</p>}
            </div>
            <button onClick={() => setWeekOffset(v => Math.max(0, v - 1))} disabled={weekOffset === 0} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: weekOffset === 0 ? 'default' : 'pointer', opacity: weekOffset === 0 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
              <ChevronRight size={16} color="var(--text-secondary)" />
            </button>
          </div>

          {/* ── TAB: weekly report ── */}
          {tab === 'weekly' && (
            <>
              {/* summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <StatCard icon={<Flame size={13} />} label="Kcal media/die" value={`${weekAvg.kcal}`} sub={dietTarget?.kcal_target ? `Obiettivo: ${dietTarget.kcal_target}` : undefined} trend={weekAvg.kcal - prevAvg.kcal} />
                <StatCard icon={<Droplets size={13} />} label="Acqua media/die" value={weekAvg.water ? `${Math.round(weekAvg.water)} ml` : 'N/D'} trend={weekAvg.water && prevAvg.water ? weekAvg.water - prevAvg.water : undefined} />
                <StatCard icon={<Scale size={13} />} label="Peso medio" value={weekAvg.weight ? `${weekAvg.weight} kg` : 'N/D'} trend={weekAvg.weight && prevAvg.weight ? weekAvg.weight - prevAvg.weight : undefined} />
                <StatCard icon={<Check size={13} />} label="Aderenza media" value={`${avgAdherence}%`} sub={`${weekAdherenceData.filter(d => d.pct >= 80).length}/7 giorni ≥80%`} />
              </div>

              {/* weekly macro chart */}
              <div className="card" style={{ padding: '16px 10px 14px' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, paddingLeft: 6 }}>📊 Calorie giornaliere</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={dailyChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip content={<SmallTooltip unit=" kcal" />} />
                    {dietTarget?.kcal_target && <ReferenceLine y={dietTarget.kcal_target} stroke="var(--orange)" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: 'Target', fontSize: 9, fill: 'var(--orange)', position: 'insideTopRight' }} />}
                    <Bar dataKey="kcal" name="Kcal" radius={[4, 4, 0, 0]}>
                      {dailyChart.map((e, i) => <Cell key={i} fill={dietTarget?.kcal_target && e.kcal > dietTarget.kcal_target * 1.05 ? '#e05a5a' : 'var(--green-main)'} fillOpacity={0.85} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* macro breakdown bars */}
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>💧 Idratazione giornaliera</h3>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={dailyChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip content={<SmallTooltip unit=" ml" />} />
                    <ReferenceLine y={2000} stroke="#3b82f6" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: '2 L', fontSize: 9, fill: '#3b82f6', position: 'insideTopRight' }} />
                    <Bar dataKey="water" name="Acqua" fill="#3b82f6" fillOpacity={0.75} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* macro averages table */}
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📈 Medie settimanali</h3>
                {[
                  { label: 'Calorie', val: `${weekAvg.kcal} kcal`, target: dietTarget?.kcal_target ? `${dietTarget.kcal_target} kcal` : null, pct: dietTarget?.kcal_target ? Math.min(100, Math.round(weekAvg.kcal / dietTarget.kcal_target * 100)) : null, color: '#f0922b' },
                  { label: 'Proteine', val: `${weekAvg.proteins} g`, target: dietTarget?.protein_target ? `${dietTarget.protein_target} g` : null, pct: dietTarget?.protein_target ? Math.min(100, Math.round(weekAvg.proteins / dietTarget.protein_target * 100)) : null, color: '#3b82f6' },
                  { label: 'Carboidrati', val: `${weekAvg.carbs} g`, target: dietTarget?.carbs_target ? `${dietTarget.carbs_target} g` : null, pct: dietTarget?.carbs_target ? Math.min(100, Math.round(weekAvg.carbs / dietTarget.carbs_target * 100)) : null, color: '#f0922b' },
                  { label: 'Grassi', val: `${weekAvg.fats} g`, target: dietTarget?.fats_target ? `${dietTarget.fats_target} g` : null, pct: dietTarget?.fats_target ? Math.min(100, Math.round(weekAvg.fats / dietTarget.fats_target * 100)) : null, color: '#e05a5a' },
                ].map(row => (
                  <div key={row.label} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                      <span style={{ fontWeight: 500 }}>{row.label}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontWeight: 700 }}>{row.val}</span>
                        {row.target && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/ {row.target}</span>}
                        {row.pct !== null && <span style={{ fontSize: 11, fontWeight: 600, color: row.pct > 105 ? 'var(--red)' : row.pct >= 85 ? 'var(--green-main)' : 'var(--orange)' }}>{row.pct}%</span>}
                      </div>
                    </div>
                    {row.pct !== null && (
                      <div style={{ height: 5, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: 3, transition: 'width 0.6s ease' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── TAB: adherence ── */}
          {tab === 'adherence' && (
            <>
              {/* adherence score */}
              <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Aderenza media questa settimana</p>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 120, height: 120, margin: '0 auto 12px' }}>
                  <svg width="120" height="120" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
                    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border-light)" strokeWidth="10" />
                    <circle cx="60" cy="60" r="50" fill="none"
                      stroke={avgAdherence >= 80 ? 'var(--green-main)' : avgAdherence >= 50 ? 'var(--orange)' : 'var(--red)'}
                      strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 50}`}
                      strokeDashoffset={`${2 * Math.PI * 50 * (1 - avgAdherence / 100)}`}
                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                  </svg>
                  <div>
                    <p style={{ fontSize: 28, fontWeight: 800, color: avgAdherence >= 80 ? 'var(--green-main)' : avgAdherence >= 50 ? 'var(--orange)' : 'var(--red)' }}>{avgAdherence}%</p>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {avgAdherence >= 80 ? '🏆 Ottima aderenza alla dieta!' : avgAdherence >= 60 ? '👍 Buona aderenza, continua così!' : avgAdherence >= 40 ? '💪 Puoi migliorare! Registra tutti i pasti.' : '⚠️ Aderenza bassa. Prova a registrare ogni pasto.'}
                </p>
              </div>

              {/* daily adherence chart */}
              <div className="card" style={{ padding: '16px 10px 14px' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, paddingLeft: 6 }}>📅 Aderenza giornaliera (ultime 2 settimane)</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={adherenceData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} interval={1} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Aderenza']} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <ReferenceLine y={80} stroke="var(--green-main)" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: '80%', fontSize: 9, fill: 'var(--green-main)', position: 'insideTopRight' }} />
                    <Bar dataKey="pct" name="Aderenza" radius={[4, 4, 0, 0]}>
                      {adherenceData.map((e, i) => <Cell key={i} fill={e.pct >= 80 ? 'var(--green-main)' : e.pct >= 50 ? 'var(--orange)' : 'var(--red)'} fillOpacity={0.8} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* daily adherence list */}
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Dettaglio per giorno</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {adherenceData.slice(-14).reverse().map(d => (
                    <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, textAlign: 'center' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{d.dayLabel}</p>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.label}</p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 8, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${d.pct}%`, background: d.pct >= 80 ? 'var(--green-main)' : d.pct >= 50 ? 'var(--orange)' : 'var(--red)', borderRadius: 4, transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                      <div style={{ width: 44, textAlign: 'right' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: d.pct >= 80 ? 'var(--green-main)' : d.pct >= 50 ? 'var(--orange)' : d.pct > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{d.pct > 0 ? `${d.pct}%` : '–'}</span>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.logged}/{d.expected} pasti</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── TAB: comparison ── */}
          {tab === 'comparison' && (
            <>
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>⚖️ Confronto settimane</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Settimana selezionata vs settimana precedente
                </p>

                {comparisonData.map(row => {
                  const diff = row.curr - row.prev
                  const hasPrev = row.prev > 0
                  const pctChange = hasPrev ? Math.round((diff / row.prev) * 100) : null
                  return (
                    <div key={row.name} style={{ marginBottom: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{row.name}</span>
                        {pctChange !== null && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: Math.abs(diff) < 5 ? 'var(--text-muted)' : diff < 0 ? 'var(--green-main)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            {diff > 0 ? <TrendingUp size={13} /> : diff < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
                            {diff > 0 ? '+' : ''}{pctChange}%
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Settimana corrente</p>
                          <div style={{ height: 28, background: 'var(--border-light)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${row.target ? Math.min(100, row.curr / row.target * 100) : Math.min(100, row.prev > 0 ? (row.curr / Math.max(row.curr, row.prev)) * 100 : 100)}%`, background: 'var(--green-main)', opacity: 0.85, borderRadius: 6, transition: 'width 0.6s ease' }} />
                            <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{round1(row.curr)}</span>
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Settimana prec.</p>
                          <div style={{ height: 28, background: 'var(--border-light)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${row.target ? Math.min(100, row.prev / row.target * 100) : Math.min(100, row.curr > 0 ? (row.prev / Math.max(row.curr, row.prev)) * 100 : 100)}%`, background: '#94a3b8', opacity: 0.85, borderRadius: 6, transition: 'width 0.6s ease' }} />
                            <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{round1(row.prev)}</span>
                          </div>
                        </div>
                      </div>
                      {row.target && (
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Obiettivo: {row.target}</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* weight comparison */}
              {(weekAvg.weight || prevAvg.weight) && (
                <div className="card" style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>⚖️ Peso</h3>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1, textAlign: 'center', padding: '14px 10px', background: 'var(--green-pale)', borderRadius: 12 }}>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Questa settimana</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--green-main)' }}>{weekAvg.weight ?? '–'} <span style={{ fontSize: 13 }}>kg</span></p>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center', padding: '14px 10px', background: 'var(--surface-2)', borderRadius: 12 }}>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Settimana prec.</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-secondary)' }}>{prevAvg.weight ?? '–'} <span style={{ fontSize: 13 }}>kg</span></p>
                    </div>
                  </div>
                  {weekAvg.weight && prevAvg.weight && (
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: weekAvg.weight < prevAvg.weight ? 'var(--green-main)' : weekAvg.weight > prevAvg.weight ? 'var(--red)' : 'var(--text-muted)' }}>
                      {weekAvg.weight < prevAvg.weight ? <TrendingDown size={16} /> : weekAvg.weight > prevAvg.weight ? <TrendingUp size={16} /> : <Minus size={16} />}
                      {weekAvg.weight < prevAvg.weight ? 'Persi ' : weekAvg.weight > prevAvg.weight ? 'Guadagnati ' : 'Stabile '}
                      {weekAvg.weight !== prevAvg.weight && `${Math.abs(round1(weekAvg.weight - prevAvg.weight))} kg`}
                    </div>
                  )}
                </div>
              )}

              {/* water comparison */}
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>💧 Idratazione</h3>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '14px 10px', background: 'rgba(59,130,246,0.08)', borderRadius: 12 }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Questa settimana</p>
                    <p style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6' }}>{weekAvg.water ? `${Math.round(weekAvg.water)}` : '–'} <span style={{ fontSize: 13 }}>ml/die</span></p>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '14px 10px', background: 'var(--surface-2)', borderRadius: 12 }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Settimana prec.</p>
                    <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-secondary)' }}>{prevAvg.water ? `${Math.round(prevAvg.water)}` : '–'} <span style={{ fontSize: 13 }}>ml/die</span></p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── TAB: report PDF ── */}
          {tab === 'report' && (
            <>
              <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <FileText size={28} color="var(--green-main)" />
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Report Settimanale PDF</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
                  Genera un report completo della settimana selezionata da condividere con il tuo dietista. Include medie macro, idratazione, peso e aderenza alla dieta.
                </p>
                <button className="btn btn-primary btn-full" onClick={generatePdf} disabled={generatingPdf} style={{ fontSize: 15, padding: '14px 20px' }}>
                  {generatingPdf ? (
                    <span>Generazione in corso…</span>
                  ) : (
                    <><Download size={18} />Scarica Report PDF</>
                  )}
                </button>
              </div>

              {/* report preview */}
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📋 Anteprima contenuto</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { icon: '📅', title: 'Periodo', desc: weekLabel },
                    { icon: '🔥', title: 'Media calorie', desc: `${weekAvg.kcal} kcal/die${dietTarget?.kcal_target ? ` (obiettivo: ${dietTarget.kcal_target})` : ''}` },
                    { icon: '💪', title: 'Proteine medie', desc: `${weekAvg.proteins} g/die` },
                    { icon: '🌾', title: 'Carboidrati medi', desc: `${weekAvg.carbs} g/die` },
                    { icon: '🥑', title: 'Grassi medi', desc: `${weekAvg.fats} g/die` },
                    { icon: '💧', title: 'Acqua media', desc: weekAvg.water ? `${Math.round(weekAvg.water)} ml/die` : 'Nessun dato' },
                    { icon: '⚖️', title: 'Peso medio', desc: weekAvg.weight ? `${weekAvg.weight} kg` : 'Nessun dato' },
                    { icon: '✅', title: 'Aderenza dieta', desc: `${avgAdherence}% media settimanale` },
                  ].map(item => (
                    <div key={item.title} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 10 }}>
                      <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600 }}>{item.title}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                Il PDF viene salvato sul tuo dispositivo e può essere inviato via email o WhatsApp al tuo dietista.
              </p>
            </>
          )}

        </div>
      )}
    </div>
  )
}
