import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { searchFoods, searchByBarcode } from '../lib/foodSearch'
import { Plus, Trash2, Apple, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Clock, ScanLine, AlertCircle } from 'lucide-react'
import BarcodeScanner from '../components/BarcodeScanner'

function calcMacros(food, grams) {
  const f = (parseFloat(grams) || 100) / 100
  return {
    kcal: Math.round((food.kcal_100g || 0) * f),
    proteins: Math.round((food.proteins_100g || 0) * f * 10) / 10,
    carbs: Math.round((food.carbs_100g || 0) * f * 10) / 10,
    fats: Math.round((food.fats_100g || 0) * f * 10) / 10,
  }
}

const MEALS = [
  { key: 'colazione', label: 'Colazione', emoji: '☀️', defaultTime: '07:30' },
  { key: 'spuntino_mattina', label: 'Spuntino', emoji: '🍎', defaultTime: '10:00' },
  { key: 'pranzo', label: 'Pranzo', emoji: '🍽️', defaultTime: '12:30' },
  { key: 'spuntino_pomeriggio', label: 'Merenda', emoji: '🥤', defaultTime: '15:30' },
  { key: 'cena', label: 'Cena', emoji: '🌙', defaultTime: '19:30' },
]

const MOOD_OPTIONS = [
  { value: 1, emoji: '😞', label: 'Pessimo' },
  { value: 2, emoji: '😕', label: 'Non bene' },
  { value: 3, emoji: '😐', label: 'Normale' },
  { value: 4, emoji: '😊', label: 'Bene' },
  { value: 5, emoji: '😄', label: 'Ottimo' },
]

function MacroBar({ label, value, target, color }) {
  const pct = Math.min(100, target > 0 ? Math.round((value / target) * 100) : 0)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>{value}g{target ? ` / ${target}g` : ''}</span>
      </div>
      <div style={{ height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

export default function MacroTrackerPage() {
  const { user } = useAuth()
  const todayStr = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(todayStr)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [grams, setGrams] = useState('100')
  const [mealTime, setMealTime] = useState('12:30')
  const [meal, setMeal] = useState('pranzo')
  const [log, setLog] = useState([])
  const [diet, setDiet] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [expandedMeal, setExpandedMeal] = useState('colazione')
  const [activeMealAdd, setActiveMealAdd] = useState(null)
  const [mood, setMood] = useState(null)
  const [addedFood, setAddedFood] = useState(null)
  const [showScanner, setShowScanner] = useState(false)
  const [scanningBarcode, setScanningBarcode] = useState(false)
  const [barcodeError, setBarcodeError] = useState('')
  const searchRef = useRef(null)
  const searchCacheRef = useRef(new Map())
  const latestSearchIdRef = useRef(0)

  useEffect(() => { loadLog() }, [date])

  async function loadLog() {
    const [foodRes, dietRes, wellnessRes] = await Promise.all([
      supabase.from('food_logs').select('*').eq('user_id', user.id).eq('date', date).order('created_at'),
      supabase.from('patient_diets').select('*').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      supabase.from('daily_wellness').select('mood').eq('user_id', user.id).eq('date', date).maybeSingle(),
    ])
    setLog(foodRes.data || [])
    setDiet(dietRes.data)
    setMood(wellnessRes.data?.mood || null)
  }

  // Live search as you type (debounced)
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    const normalizedQuery = query.trim().toLowerCase()
    const cachedResults = searchCacheRef.current.get(normalizedQuery)
    if (cachedResults) {
      setResults(cachedResults)
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      const searchId = ++latestSearchIdRef.current
      const foods = await searchFoods(normalizedQuery)
      if (searchId !== latestSearchIdRef.current) return
      searchCacheRef.current.set(normalizedQuery, foods)
      // Prevent unbounded memory growth while keeping recent queries instant.
      if (searchCacheRef.current.size > 40) {
        const firstKey = searchCacheRef.current.keys().next().value
        if (firstKey) searchCacheRef.current.delete(firstKey)
      }
      setResults(foods)
      setSearching(false)
    }, 220)
    return () => clearTimeout(timer)
  }, [query])

  function selectMealType(key) {
    setMeal(key)
    const def = MEALS.find(m => m.key === key)
    if (def) setMealTime(def.defaultTime)
  }

  function openMealSearch(mealKey) {
    selectMealType(mealKey)
    setActiveMealAdd(mealKey)
    setSelected(null)
    setQuery('')
    setResults([])
  }

  function closeSearch() {
    setActiveMealAdd(null)
    setSelected(null)
    setResults([])
    setSaveError('')
    setAddedFood(null)
  }

  async function handleBarcodeFound(barcode) {
    setShowScanner(false)
    setScanningBarcode(true)
    setBarcodeError('')
    const food = await searchByBarcode(barcode)
    setScanningBarcode(false)
    if (food) {
      setSelected(food)
      setGrams(food.default_grams ? String(food.default_grams) : '100')
      setQuery(food.name)
      setResults([])
    } else {
      setBarcodeError(`Prodotto con codice "${barcode}" non trovato. Prova la ricerca manuale.`)
      setTimeout(() => setBarcodeError(''), 5000)
    }
  }

  async function addFood() {
    if (!selected) return
    setSaving(true)
    setSaveError('')
    const m = calcMacros(selected, grams)
    let savedName = null
    try {
      // Build food_data with only defined values
      const foodData = {
        id: selected.id, name: selected.name, brand: selected.brand || '',
        kcal_100g: selected.kcal_100g || 0, proteins_100g: selected.proteins_100g || 0,
        carbs_100g: selected.carbs_100g || 0, fats_100g: selected.fats_100g || 0,
        fiber_100g: selected.fiber_100g || 0, source: selected.source || '',
        meal_time: mealTime || null,
      }
      const { data, error } = await supabase.from('food_logs').insert({
        user_id: user.id,
        date, meal_type: meal, meal_time: mealTime || null, food_name: selected.name,
        grams: parseFloat(grams) || 100, ...m,
        food_data: foodData,
      }).select().single()
      if (error) {
        console.error('Errore salvataggio alimento:', error)
        setSaveError(`Errore nel salvare l'alimento: ${error.message || 'errore sconosciuto'}. Riprova.`)
        return
      }
      if (!data) {
        setSaveError("Errore nel salvare l'alimento. Riprova.")
        return
      }
      setLog(l => [...l, data])
      await updateDailyLog()
      savedName = selected.name
      setSelected(null); setQuery(''); setResults([])
      setExpandedMeal(meal)
    } catch (e) {
      console.error('Errore imprevisto salvataggio:', e)
      setSaveError("Errore imprevisto nel salvare l'alimento. Riprova.")
    } finally {
      setSaving(false)
    }
    if (savedName) {
      setAddedFood(savedName)
      setTimeout(() => setAddedFood(null), 2500)
    }
  }

  async function updateDailyLog() {
    const { data } = await supabase.from('food_logs').select('*').eq('user_id', user.id).eq('date', date)
    if (!data) return
    const t = data.reduce((a, f) => ({
      kcal: a.kcal + (f.kcal || 0), proteins: a.proteins + (f.proteins || 0),
      carbs: a.carbs + (f.carbs || 0), fats: a.fats + (f.fats || 0),
    }), { kcal: 0, proteins: 0, carbs: 0, fats: 0 })
    await supabase.from('daily_logs').upsert({ user_id: user.id, date, ...t }, { onConflict: 'user_id,date' })
  }

  async function removeFood(id) {
    await supabase.from('food_logs').delete().eq('id', id)
    setLog(l => l.filter(x => x.id !== id))
    await updateDailyLog()
  }

  async function saveMood(value) {
    const newMood = mood === value ? null : value
    setMood(newMood)
    // First check if a wellness entry already exists for this date
    const { data: existing } = await supabase.from('daily_wellness').select('id')
      .eq('user_id', user.id).eq('date', date).maybeSingle()
    if (existing) {
      // Only update the mood field to preserve other wellness data
      await supabase.from('daily_wellness').update({ mood: newMood })
        .eq('user_id', user.id).eq('date', date)
    } else {
      await supabase.from('daily_wellness').insert(
        { user_id: user.id, date, mood: newMood }
      )
    }
  }

  function changeDate(delta) {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    const next = d.toISOString().split('T')[0]
    setDate(next)
    setActiveMealAdd(null)
    setSelected(null)
    setQuery('')
    setResults([])
    setExpandedMeal('colazione')
  }

  const totals = log.reduce((a, f) => ({
    kcal: a.kcal + (f.kcal || 0), proteins: a.proteins + (f.proteins || 0),
    carbs: a.carbs + (f.carbs || 0), fats: a.fats + (f.fats || 0),
  }), { kcal: 0, proteins: 0, carbs: 0, fats: 0 })

  const preview = selected ? calcMacros(selected, grams) : null
  const isToday = date === todayStr
  const displayDate = new Date(date + 'T12:00:00')

  return (
    <div className="page">
      {/* ── Header ── */}
      <div style={{ background: 'linear-gradient(160deg, var(--green-dark), var(--green-main))', padding: 'calc(env(safe-area-inset-top) + 16px) 16px 18px', flexShrink: 0 }}>
        {/* Date navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={() => changeDate(-1)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', flexShrink: 0 }}>
            <ChevronLeft size={18} />
          </button>

          <div style={{ textAlign: 'center', flex: 1 }}>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>Diario alimentare</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'white', fontWeight: 300, lineHeight: 1.2 }}>
              {isToday ? 'Oggi · ' : ''}{displayDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
            </h1>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => changeDate(1)} disabled={isToday} style={{ background: isToday ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isToday ? 'default' : 'pointer', color: isToday ? 'rgba(255,255,255,0.3)' : 'white' }}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Macro totals */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[
            { label: 'Kcal', val: `${totals.kcal}${diet?.kcal_target ? `/${diet.kcal_target}` : ''}` },
            { label: 'Prot.', val: `${totals.proteins}g` },
            { label: 'Carbo', val: `${totals.carbs}g` },
            { label: 'Grassi', val: `${totals.fats}g` },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '7px 4px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.12)' }}>
              <p style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>{s.val}</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Mood row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, flexShrink: 0 }}>Umore:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {MOOD_OPTIONS.map(m => (
              <button key={m.value} onClick={() => saveMood(m.value)} title={m.label} style={{
                background: mood === m.value ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)',
                border: `1.5px solid ${mood === m.value ? 'rgba(255,255,255,0.7)' : 'transparent'}`,
                borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 17, transition: 'all 0.15s',
                transform: mood === m.value ? 'scale(1.15)' : 'none',
              }}>
                {m.emoji}
              </button>
            ))}
          </div>
          {mood && (
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginLeft: 2 }}>
              {MOOD_OPTIONS.find(m => m.value === mood)?.label}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* ── Macro targets ── */}
        {diet && (
          <div className="card" style={{ padding: 14 }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Obiettivi giornalieri</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <MacroBar label="Proteine" value={totals.proteins} target={diet.protein_target} color="#3b82f6" />
              <MacroBar label="Carboidrati" value={totals.carbs} target={diet.carbs_target} color="#f0922b" />
              <MacroBar label="Grassi" value={totals.fats} target={diet.fats_target} color="#e05a5a" />
            </div>
          </div>
        )}

        {/* ── Meal cards ── */}
        {MEALS.map(m => {
          const mealFoods = log.filter(f => f.meal_type === m.key)
          const mealKcal = mealFoods.reduce((s, f) => s + (f.kcal || 0), 0)
          const isOpen = expandedMeal === m.key
          const isSearching = activeMealAdd === m.key
          const times = mealFoods.map(f => f.food_data?.meal_time).filter(Boolean).sort()
          const timeLabel = times.length > 0 ? times[0] : null
          return (
            <div key={m.key} className="card" style={{ padding: 0, overflow: isSearching ? 'visible' : 'hidden', position: 'relative', zIndex: isSearching ? 30 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '13px 14px', gap: 9 }}>
                <button onClick={() => { setExpandedMeal(isOpen ? null : m.key); if (isOpen && isSearching) closeSearch() }} style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0, textAlign: 'left' }}>
                  <span style={{ fontSize: 20 }}>{m.emoji}</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{m.label}</span>
                    {timeLabel && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                        <Clock size={10} color="var(--text-muted)" />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeLabel}</span>
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>{mealKcal > 0 ? `${mealKcal} kcal` : ''}</span>
                  {isOpen ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
                </button>
                <button
                  onClick={() => { if (isSearching) { closeSearch() } else { openMealSearch(m.key); setExpandedMeal(m.key) } }}
                  title={`Aggiungi a ${m.label}`}
                  style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: isSearching ? 'var(--green-main)' : 'var(--green-pale)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSearching ? 'white' : 'var(--green-main)' }}
                >
                  {isSearching ? <X size={14} /> : <Plus size={14} />}
                </button>
              </div>
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border-light)', padding: '10px 14px 12px' }}>
                  {mealFoods.map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 9 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Apple size={14} color="var(--green-main)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.food_name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {f.grams}g · {f.kcal} kcal · P:{f.proteins}g
                          {f.food_data?.meal_time && <> · <Clock size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> {f.food_data.meal_time}</>}
                        </p>
                      </div>
                      <button onClick={() => removeFood(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 5, flexShrink: 0 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {mealFoods.length === 0 && !isSearching && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                      Nessun alimento — tocca + per aggiungere
                    </p>
                  )}

                  {/* ── Inline search form ── */}
                  {isSearching && (
                    <div className="animate-slideUp" style={{ marginTop: mealFoods.length > 0 ? 6 : 0, padding: '10px 0 0' }}>
                      {/* Success confirmation */}
                      {addedFood && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--green-pale)', borderRadius: 10, padding: '9px 12px', marginBottom: 10, color: 'var(--green-dark)', fontSize: 13, fontWeight: 500 }}>
                          <span>✅</span> <span>"{addedFood}" aggiunto!</span>
                        </div>
                      )}
                      {/* Error feedback */}
                      {saveError && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff0f0', borderRadius: 10, padding: '9px 12px', marginBottom: 10, color: '#dc4a4a', fontSize: 13, fontWeight: 500 }}>
                          <span>⚠️</span> <span>{saveError}</span>
                        </div>
                      )}

                      {/* Live search input */}
                      <div style={{ position: 'relative', marginBottom: 8 }} ref={searchRef}>
                        <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Cerca alimento (es. pollo, pasta, mela…)"
                            value={query}
                            onChange={e => { setQuery(e.target.value); setSelected(null); setSaveError('') }}
                            autoComplete="off"
                            style={{ flex: 1, paddingRight: searching ? 40 : 14 }}
                          />
                          {(searching || scanningBarcode) && (
                            <span style={{ position: 'absolute', right: 52, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--green-main)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} />
                          )}
                          <button
                            type="button"
                            onClick={() => setShowScanner(true)}
                            title="Scansiona codice a barre"
                            style={{ flexShrink: 0, width: 42, height: 42, background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
                          >
                            <ScanLine size={18} />
                          </button>
                        </div>

                        {/* Barcode error */}
                        {barcodeError && (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#fff0f0', padding: '8px 12px', borderRadius: 8, marginTop: 8, color: '#dc4a4a', fontSize: 12 }}>
                            <AlertCircle size={14} style={{ flexShrink: 0 }} />
                            <span>{barcodeError}</span>
                          </div>
                        )}

                        {/* Dropdown results */}
                        {!selected && results.length > 0 && (
                          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-md)', maxHeight: 260, overflowY: 'auto' }}>
                            {results.map((f, i) => (
                              <button key={`${f.id}_${i}`} onClick={() => { setSelected(f); setGrams(f.default_grams ? String(f.default_grams) : '100'); setResults([]) }} style={{
                                width: '100%', background: 'none', border: 'none', borderBottom: i < results.length - 1 ? '1px solid var(--border-light)' : 'none',
                                padding: '10px 13px', textAlign: 'left', cursor: 'pointer', font: 'inherit',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                                  <p style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, flex: 1 }}>{f.name}</p>
                                  {(() => {
                                    const badges = { recent: ['🕐', '#fff4e6', '#c45e00'], diet: ['🥗', 'var(--green-pale)', 'var(--green-main)'], recipe: ['🍳', '#fff4e6', '#c45e00'], custom_meal: ['🍽️', '#f0fdf4', 'var(--green-dark)'], openfoodfacts: ['🌍', '#f1f5f9', 'var(--text-muted)'], database: ['DB', 'var(--green-pale)', 'var(--green-main)'] }
                                    const [label, bg, color] = badges[f.source] || badges.openfoodfacts
                                    return <span style={{ fontSize: 9, background: bg, color, padding: '2px 5px', borderRadius: 100, fontWeight: 700, flexShrink: 0 }}>{label}</span>
                                  })()}
                                </div>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                  {f.brand ? `${f.brand} · ` : ''}{f.kcal_100g} kcal · P:{f.proteins_100g} C:{f.carbs_100g} G:{f.fats_100g}
                                </p>
                              </button>
                            ))}
                          </div>
                        )}

                        {!selected && !searching && query.trim().length >= 2 && results.length === 0 && (
                          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', padding: '10px 0' }}>
                            Nessun risultato per "{query}". Prova con un termine diverso.
                          </p>
                        )}
                      </div>

                      {/* Selected food + grams + time */}
                      {selected && (
                        <div>
                          <div style={{ background: 'var(--green-pale)', borderRadius: 12, padding: '11px 13px', marginBottom: 11, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{selected.name}</p>
                              {preview && <p style={{ fontSize: 12, color: 'var(--green-dark)' }}>{preview.kcal} kcal · P:{preview.proteins}g · C:{preview.carbs}g · G:{preview.fats}g</p>}
                            </div>
                            <button onClick={() => { setSelected(null); setQuery('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)' }}><X size={15} /></button>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <div className="input-group" style={{ flex: 1 }}>
                              <label className="input-label">Quantità (g)</label>
                              <input type="number" className="input-field" value={grams} onChange={e => setGrams(e.target.value)} min={1} inputMode="decimal" />
                            </div>
                            <div className="input-group" style={{ width: 110 }}>
                              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />Orario</label>
                              <input type="time" className="input-field" value={mealTime} onChange={e => setMealTime(e.target.value)} />
                            </div>
                          </div>
                          <button className="btn btn-primary btn-full" onClick={addFood} disabled={saving}>
                            {saving ? '…' : 'Aggiungi al diario'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showScanner && (
        <BarcodeScanner
          onFound={handleBarcodeFound}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}
