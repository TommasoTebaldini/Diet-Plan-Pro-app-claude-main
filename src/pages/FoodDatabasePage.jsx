import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { searchFoods } from '../lib/foodSearch'
import { Search, Plus, X, BookOpen, Star, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

function calcMacros(food, grams) {
  const f = (parseFloat(grams) || 100) / 100
  return {
    kcal: Math.round((food.kcal_100g || 0) * f),
    proteins: Math.round((food.proteins_100g || 0) * f * 10) / 10,
    carbs: Math.round((food.carbs_100g || 0) * f * 10) / 10,
    fats: Math.round((food.fats_100g || 0) * f * 10) / 10,
  }
}

// ── Ingredient search sub-component (shared by Pasti and Ricette) ──────────
function IngredientSearch({ onAdd }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)   // selected food before confirming grams
  const [pendingGrams, setPendingGrams] = useState('100')

  async function handleSearch(e) {
    e?.preventDefault()
    if (!q.trim() || q.trim().length < 2) return
    setBusy(true); setRes([])
    const foods = await searchFoods(q.trim())
    setRes(foods); setBusy(false)
  }

  function select(food) {
    setPending(food)
    setPendingGrams('100')
    setRes([])
  }

  function confirmAdd(e) {
    e.preventDefault()
    if (!pending) return
    const m = calcMacros(pending, pendingGrams)
    onAdd({ food_name: pending.name, food_data: pending, grams: parseFloat(pendingGrams) || 100, ...m })
    setPending(null)
    setQ('')
  }

  return (
    <div>
      {pending ? (
        <form onSubmit={confirmAdd}>
          <div style={{ background: 'var(--green-pale)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{pending.name}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Quantità (g)</label>
                <input type="number" className="input-field" value={pendingGrams} onChange={e => setPendingGrams(e.target.value)} min={1} inputMode="decimal" autoFocus />
              </div>
              <button type="submit" className="btn btn-primary" style={{ flexShrink: 0, height: 42 }}>Aggiungi</button>
              <button type="button" onClick={() => setPending(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-muted)', height: 42, display: 'flex', alignItems: 'center' }}>
                <X size={15} />
              </button>
            </div>
            {(() => { const m = calcMacros(pending, pendingGrams); return <p style={{ fontSize: 11, color: 'var(--green-dark)', marginTop: 4 }}>{m.kcal} kcal · P:{m.proteins}g · C:{m.carbs}g · G:{m.fats}g</p> })()}
          </div>
        </form>
      ) : (
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input type="text" className="input-field" placeholder="Cerca ingrediente…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1 }} autoComplete="off" />
          <button type="submit" className="btn btn-primary" style={{ padding: '0 14px', flexShrink: 0 }} disabled={busy || q.trim().length < 2}>
            {busy ? <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} /> : <Search size={14} />}
          </button>
        </form>
      )}
      {!pending && res.length > 0 && (
        <div style={{ border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
          {res.slice(0, 8).map((f, i) => (
            <button key={`${f.id}_${i}`} onClick={() => select(f)} style={{ width: '100%', background: 'none', border: 'none', borderBottom: i < Math.min(res.length, 8) - 1 ? '1px solid var(--border-light)' : 'none', padding: '9px 12px', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
              <p style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{f.kcal_100g} kcal · P:{f.proteins_100g} C:{f.carbs_100g} G:{f.fats_100g}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FoodDatabasePage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('search')
  // ── Search tab ──
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  // ── Saved / Favorites tab ──
  const [saved, setSaved] = useState([])
  const [recentFoods, setRecentFoods] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', brand: '', kcal_100g: '', proteins_100g: '', carbs_100g: '', fats_100g: '', fiber_100g: '' })
  // ── Pasti (custom meals) tab ──
  const [meals, setMeals] = useState([])
  const [showMealCreate, setShowMealCreate] = useState(false)
  const [mealForm, setMealForm] = useState({ name: '', ingredients: [] })
  const [expandedMeal, setExpandedMeal] = useState(null)
  // ── Ricette tab ──
  const [ricette, setRicette] = useState([])
  const [showRecCreate, setShowRecCreate] = useState(false)
  const [recForm, setRecForm] = useState({ nome: '', porzioni: '1', ingredienti: [], note: '' })
  const [expandedRicetta, setExpandedRicetta] = useState(null)

  useEffect(() => {
    supabase.from('custom_foods').select('*').order('name').then(({ data }) => setSaved(data || []))
    supabase.from('custom_meals').select('*').order('created_at', { ascending: false }).then(({ data }) => setMeals(data || []))
    supabase.from('ricette').select('*').order('created_at', { ascending: false }).then(({ data }) => setRicette(data || []))
    // Load recent / frequent foods
    supabase.from('food_logs').select('food_name, kcal, proteins, carbs, fats, grams, food_data').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => {
        if (!data?.length) return
        const seen = new Map()
        for (const row of data) {
          if (seen.has(row.food_name)) { seen.get(row.food_name).count++; continue }
          const fd = row.food_data || {}; const g = row.grams || 100
          seen.set(row.food_name, {
            name: row.food_name, brand: fd.brand || '', count: 1,
            kcal_100g: fd.kcal_100g ?? Math.round(row.kcal / g * 100),
            proteins_100g: fd.proteins_100g ?? Math.round(row.proteins / g * 1000) / 10,
            carbs_100g: fd.carbs_100g ?? Math.round(row.carbs / g * 1000) / 10,
            fats_100g: fd.fats_100g ?? Math.round(row.fats / g * 1000) / 10,
          })
        }
        setRecentFoods([...seen.values()].sort((a, b) => b.count - a.count).slice(0, 8))
      })
  }, [])

  async function handleSearch(e) {
    e?.preventDefault()
    if (!query.trim()) return
    setSearching(true); setResults([])
    const foods = await searchFoods(query.trim())
    setResults(foods); setSearching(false)
  }

  async function saveToFavorites(food) {
    const already = saved.find(s => s.name === food.name)
    if (already) return
    const { data } = await supabase.from('custom_foods').insert({
      name: food.name, brand: food.brand || '',
      kcal_100g: food.kcal_100g, proteins_100g: food.proteins_100g,
      carbs_100g: food.carbs_100g, fats_100g: food.fats_100g,
      fiber_100g: food.fiber_100g || 0, source: food.source
    }).select().single()
    if (data) setSaved(s => [...s, data])
  }

  async function removeFavorite(id) {
    await supabase.from('custom_foods').delete().eq('id', id)
    setSaved(s => s.filter(x => x.id !== id))
  }

  async function addCustomFood() {
    if (!form.name || !form.kcal_100g) return
    const { data } = await supabase.from('custom_foods').insert({
      name: form.name, brand: form.brand,
      kcal_100g: parseFloat(form.kcal_100g) || 0,
      proteins_100g: parseFloat(form.proteins_100g) || 0,
      carbs_100g: parseFloat(form.carbs_100g) || 0,
      fats_100g: parseFloat(form.fats_100g) || 0,
      fiber_100g: parseFloat(form.fiber_100g) || 0,
      source: 'custom'
    }).select().single()
    if (data) {
      setSaved(s => [...s, data])
      setShowAdd(false)
      setForm({ name: '', brand: '', kcal_100g: '', proteins_100g: '', carbs_100g: '', fats_100g: '', fiber_100g: '' })
    }
  }

  // ── Custom Meals ──
  function mealTotals(ings) {
    return ings.reduce((a, i) => ({ kcal: a.kcal + (i.kcal || 0), proteins: a.proteins + (i.proteins || 0), carbs: a.carbs + (i.carbs || 0), fats: a.fats + (i.fats || 0) }), { kcal: 0, proteins: 0, carbs: 0, fats: 0 })
  }

  async function saveMeal() {
    if (!mealForm.name || mealForm.ingredients.length === 0) return
    const t = mealTotals(mealForm.ingredients)
    const pesoTotale = mealForm.ingredients.reduce((s, i) => s + (parseFloat(i.grams) || 0), 0)
    const { data } = await supabase.from('custom_meals').insert({
      name: mealForm.name,
      ingredients: mealForm.ingredients,
      peso_totale_g: pesoTotale,
      kcal_total: t.kcal,
      proteins_total: t.proteins,
      carbs_total: t.carbs,
      fats_total: t.fats,
    }).select().single()
    if (data) {
      setMeals(m => [data, ...m])
      setMealForm({ name: '', ingredients: [] })
      setShowMealCreate(false)
    }
  }

  async function deleteMeal(id) {
    await supabase.from('custom_meals').delete().eq('id', id)
    setMeals(m => m.filter(x => x.id !== id))
  }

  // ── Ricette ──
  async function saveRicetta() {
    if (!recForm.nome || recForm.ingredienti.length === 0) return
    const t = mealTotals(recForm.ingredienti)
    const pesoTotale = recForm.ingredienti.reduce((s, i) => s + (parseFloat(i.grams) || 0), 0)
    const porzioni = parseInt(recForm.porzioni) || 1
    const kcal100 = pesoTotale > 0 ? Math.round(t.kcal / pesoTotale * 100) : 0
    const { data } = await supabase.from('ricette').insert({
      nome: recForm.nome,
      ingredienti: recForm.ingredienti,
      porzioni,
      peso_totale_g: pesoTotale,
      kcal_100g: kcal100,
      proteins_100g: pesoTotale > 0 ? Math.round(t.proteins / pesoTotale * 1000) / 10 : 0,
      carbs_100g: pesoTotale > 0 ? Math.round(t.carbs / pesoTotale * 1000) / 10 : 0,
      fats_100g: pesoTotale > 0 ? Math.round(t.fats / pesoTotale * 1000) / 10 : 0,
      calorie_porzione: Math.round(t.kcal / porzioni),
      proteine: Math.round(t.proteins / porzioni * 10) / 10,
      carboidrati: Math.round(t.carbs / porzioni * 10) / 10,
      grassi: Math.round(t.fats / porzioni * 10) / 10,
      note: recForm.note,
    }).select().single()
    if (data) {
      setRicette(r => [data, ...r])
      setRecForm({ nome: '', porzioni: '1', ingredienti: [], note: '' })
      setShowRecCreate(false)
    }
  }

  async function deleteRicetta(id) {
    await supabase.from('ricette').delete().eq('id', id)
    setRicette(r => r.filter(x => x.id !== id))
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const TABS = [
    ['search', '🔍 Cerca'],
    ['saved', '⭐ Preferiti'],
    ['meals', '🍽️ Pasti'],
    ['ricette', '🍳 Ricette'],
  ]

  return (
    <div className="page">
      <div style={{ background: 'linear-gradient(160deg, var(--green-dark), var(--green-main))', padding: 'calc(env(safe-area-inset-top) + 18px) 16px 22px', flexShrink: 0 }}>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginBottom: 4 }}>Archivio</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'white', fontWeight: 300, marginBottom: 14 }}>Database alimenti</h1>
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2 }}>
          {TABS.map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 100, background: tab === t ? 'white' : 'rgba(255,255,255,0.15)', color: tab === t ? 'var(--green-main)' : 'white', border: 'none', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── SEARCH TAB ── */}
        {tab === 'search' && (
          <>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
              <input type="text" className="input-field" placeholder="Cerca nel database…" value={query} onChange={e => setQuery(e.target.value)} style={{ flex: 1 }} autoComplete="off" />
              <button type="submit" className="btn btn-primary" style={{ padding: '0 16px' }} disabled={searching || !query.trim()}>
                {searching
                  ? <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} />
                  : <Search size={15} />}
              </button>
            </form>

            {searching && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Ricerca nel database del dietista e in Open Food Facts…
              </div>
            )}

            {results.length === 0 && !searching && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <BookOpen size={36} style={{ marginBottom: 10, opacity: 0.25 }} />
                <p style={{ fontSize: 14, fontWeight: 500 }}>Cerca qualsiasi alimento</p>
                <p style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>Prima dal database del tuo dietista,<br />poi da Open Food Facts (milioni di alimenti)</p>
              </div>
            )}

            {results.map((f, i) => {
              const isSaved = saved.some(s => s.name === f.name)
              return (
                <div key={`${f.id}_${i}`} className="card" style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, flex: 1, lineHeight: 1.3 }}>{f.name}</p>
                      <span style={{ fontSize: 9, background: f.source === 'database' ? 'var(--green-pale)' : '#f1f5f9', color: f.source === 'database' ? 'var(--green-main)' : 'var(--text-muted)', padding: '2px 6px', borderRadius: 100, fontWeight: 700, flexShrink: 0 }}>
                        {f.source === 'database' ? 'DB' : f.source === 'custom_meal' ? '🍽️' : f.source === 'recipe' ? '🍳' : 'OFF'}
                      </span>
                    </div>
                    {f.brand && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{f.brand}</p>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[`🔥 ${f.kcal_100g}kcal`, `P:${f.proteins_100g}g`, `C:${f.carbs_100g}g`, `G:${f.fats_100g}g`].map(v => (
                        <span key={v} style={{ fontSize: 11, background: 'var(--surface-2)', padding: '2px 7px', borderRadius: 100, color: 'var(--text-secondary)' }}>{v}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => saveToFavorites(f)} style={{ background: 'none', border: 'none', cursor: isSaved ? 'default' : 'pointer', padding: 6, flexShrink: 0, color: isSaved ? '#f59e0b' : 'var(--border)' }}>
                    {isSaved ? <Star size={18} fill="#f59e0b" /> : <Star size={18} />}
                  </button>
                </div>
              )
            })}
          </>
        )}

        {/* ── SAVED / FAVORITES TAB ── */}
        {tab === 'saved' && (
          <>
            <button className="btn btn-primary" onClick={() => setShowAdd(v => !v)} style={{ alignSelf: 'flex-start' }}>
              {showAdd ? <X size={15} /> : <Plus size={15} />}{showAdd ? 'Annulla' : 'Aggiungi manualmente'}
            </button>

            {showAdd && (
              <div className="card animate-slideUp" style={{ padding: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Nuovo alimento</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="input-label">Nome *</label>
                      <input className="input-field" value={form.name} onChange={set('name')} placeholder="es. Muesli artigianale" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Marca</label>
                      <input className="input-field" value={form.brand} onChange={set('brand')} placeholder="Opzionale" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Kcal/100g *</label>
                      <input type="number" className="input-field" value={form.kcal_100g} onChange={set('kcal_100g')} placeholder="0" inputMode="decimal" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Proteine/100g</label>
                      <input type="number" className="input-field" value={form.proteins_100g} onChange={set('proteins_100g')} placeholder="0" inputMode="decimal" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Carboidrati/100g</label>
                      <input type="number" className="input-field" value={form.carbs_100g} onChange={set('carbs_100g')} placeholder="0" inputMode="decimal" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Grassi/100g</label>
                      <input type="number" className="input-field" value={form.fats_100g} onChange={set('fats_100g')} placeholder="0" inputMode="decimal" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Fibre/100g</label>
                      <input type="number" className="input-field" value={form.fiber_100g} onChange={set('fiber_100g')} placeholder="0" inputMode="decimal" />
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={addCustomFood} disabled={!form.name || !form.kcal_100g}>Salva alimento</button>
                </div>
              </div>
            )}

            {/* Frequent foods */}
            {recentFoods.length > 0 && (
              <div className="card" style={{ padding: '12px 14px' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>🕐 Usati di frequente</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recentFoods.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.kcal_100g} kcal · P:{f.proteins_100g}g · C:{f.carbs_100g}g · G:{f.fats_100g}g</p>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '2px 7px', borderRadius: 100 }}>×{f.count}</span>
                      <button onClick={() => saveToFavorites(f)} style={{ background: 'none', border: 'none', cursor: saved.some(s => s.name === f.name) ? 'default' : 'pointer', padding: 4, color: saved.some(s => s.name === f.name) ? '#f59e0b' : 'var(--border)' }}>
                        {saved.some(s => s.name === f.name) ? <Star size={16} fill="#f59e0b" /> : <Star size={16} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {saved.length === 0 && !showAdd && recentFoods.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <Star size={36} style={{ marginBottom: 10, opacity: 0.25 }} />
                <p style={{ fontSize: 14, fontWeight: 500 }}>Nessun alimento nei preferiti</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Cerca e salva gli alimenti che usi spesso</p>
              </div>
            )}

            {saved.length > 0 && <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>⭐ Preferiti salvati</p>}
            {saved.map(f => (
              <div key={f.id} className="card" style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>{f.name}</p>
                    <span style={{ fontSize: 9, background: f.source === 'custom' ? '#f5f3ff' : f.source === 'database' ? 'var(--green-pale)' : '#f1f5f9', color: f.source === 'custom' ? '#7c3aed' : f.source === 'database' ? 'var(--green-main)' : 'var(--text-muted)', padding: '2px 5px', borderRadius: 100, fontWeight: 700 }}>
                      {f.source === 'custom' ? '✏️' : f.source === 'database' ? 'DB' : 'OFF'}
                    </span>
                  </div>
                  {f.brand && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{f.brand}</p>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[`🔥 ${f.kcal_100g}kcal`, `P:${f.proteins_100g}g`, `C:${f.carbs_100g}g`, `G:${f.fats_100g}g`].map(v => (
                      <span key={v} style={{ fontSize: 11, background: 'var(--surface-2)', padding: '2px 7px', borderRadius: 100, color: 'var(--text-secondary)' }}>{v}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => removeFavorite(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, flexShrink: 0 }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </>
        )}

        {/* ── PASTI (custom meals) TAB ── */}
        {tab === 'meals' && (
          <>
            <button className="btn btn-primary" onClick={() => setShowMealCreate(v => !v)} style={{ alignSelf: 'flex-start' }}>
              {showMealCreate ? <X size={15} /> : <Plus size={15} />}{showMealCreate ? 'Annulla' : 'Crea pasto'}
            </button>

            {showMealCreate && (
              <div className="card animate-slideUp" style={{ padding: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Nuovo pasto personalizzato</p>
                <div className="input-group" style={{ marginBottom: 12 }}>
                  <label className="input-label">Nome del pasto *</label>
                  <input className="input-field" value={mealForm.name} onChange={e => setMealForm(f => ({ ...f, name: e.target.value }))} placeholder="es. Colazione proteica" />
                </div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Aggiungi ingredienti</p>
                <IngredientSearch onAdd={ing => setMealForm(f => ({ ...f, ingredients: [...f.ingredients, ing] }))} />
                {mealForm.ingredients.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {mealForm.ingredients.map((ing, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500 }}>{ing.food_name}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ing.grams}g · {ing.kcal} kcal</p>
                        </div>
                        <button onClick={() => setMealForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <div style={{ marginTop: 10, background: 'var(--green-pale)', borderRadius: 10, padding: '8px 12px' }}>
                      {(() => { const t = mealTotals(mealForm.ingredients); const g = mealForm.ingredients.reduce((s, i) => s + (parseFloat(i.grams) || 0), 0); return <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-dark)' }}>Totale ({Math.round(g)}g): {t.kcal} kcal · P:{t.proteins}g · C:{t.carbs}g · G:{t.fats}g</p> })()}
                    </div>
                  </div>
                )}
                <button className="btn btn-primary btn-full" onClick={saveMeal} disabled={!mealForm.name || mealForm.ingredients.length === 0} style={{ marginTop: 14 }}>
                  Salva pasto
                </button>
              </div>
            )}

            {meals.length === 0 && !showMealCreate && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: 36, opacity: 0.3, display: 'block', marginBottom: 10 }}>🍽️</span>
                <p style={{ fontSize: 14, fontWeight: 500 }}>Nessun pasto personalizzato</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Crea combinazioni di alimenti riutilizzabili</p>
              </div>
            )}

            {meals.map(m => {
              const isOpen = expandedMeal === m.id
              return (
                <div key={m.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <button onClick={() => setExpandedMeal(isOpen ? null : m.id)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 9, font: 'inherit', textAlign: 'left' }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>🍽️</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.kcal_total} kcal · {Math.round(m.peso_totale_g)}g · {(m.ingredients || []).length} ingredienti</p>
                    </div>
                    {isOpen ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
                    <button onClick={e => { e.stopPropagation(); deleteMeal(m.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-muted)', flexShrink: 0 }}>
                      <Trash2 size={15} />
                    </button>
                  </button>
                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--border-light)', padding: '10px 14px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {[`🔥 ${m.kcal_total} kcal`, `P:${m.proteins_total}g`, `C:${m.carbs_total}g`, `G:${m.fats_total}g`].map(v => (
                          <span key={v} style={{ fontSize: 11, background: 'var(--surface-2)', padding: '2px 7px', borderRadius: 100, color: 'var(--text-secondary)' }}>{v}</span>
                        ))}
                      </div>
                      {(m.ingredients || []).map((ing, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: i < m.ingredients.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                          <p style={{ flex: 1, fontSize: 13 }}>{ing.food_name}</p>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ing.grams}g · {ing.kcal} kcal</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* ── RICETTE TAB ── */}
        {tab === 'ricette' && (
          <>
            <button className="btn btn-primary" onClick={() => setShowRecCreate(v => !v)} style={{ alignSelf: 'flex-start' }}>
              {showRecCreate ? <X size={15} /> : <Plus size={15} />}{showRecCreate ? 'Annulla' : 'Importa ricetta'}
            </button>

            {showRecCreate && (
              <div className="card animate-slideUp" style={{ padding: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Nuova ricetta</p>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="input-label">Nome ricetta *</label>
                    <input className="input-field" value={recForm.nome} onChange={e => setRecForm(f => ({ ...f, nome: e.target.value }))} placeholder="es. Pasta al pomodoro" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Porzioni</label>
                    <input type="number" className="input-field" value={recForm.porzioni} onChange={e => setRecForm(f => ({ ...f, porzioni: e.target.value }))} min={1} inputMode="numeric" />
                  </div>
                </div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Ingredienti</p>
                <IngredientSearch onAdd={ing => setRecForm(f => ({ ...f, ingredienti: [...f.ingredienti, ing] }))} />
                {recForm.ingredienti.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {recForm.ingredienti.map((ing, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500 }}>{ing.food_name}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ing.grams}g · {ing.kcal} kcal</p>
                        </div>
                        <button onClick={() => setRecForm(f => ({ ...f, ingredienti: f.ingredienti.filter((_, i) => i !== idx) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {(() => {
                      const t = mealTotals(recForm.ingredienti)
                      const g = recForm.ingredienti.reduce((s, i) => s + (parseFloat(i.grams) || 0), 0)
                      const porz = parseInt(recForm.porzioni) || 1
                      return (
                        <div style={{ marginTop: 10, background: 'var(--green-pale)', borderRadius: 10, padding: '10px 12px' }}>
                          <p style={{ fontSize: 12, color: 'var(--green-dark)', fontWeight: 600 }}>Totale ricetta ({Math.round(g)}g): {t.kcal} kcal</p>
                          <p style={{ fontSize: 11, color: 'var(--green-dark)', marginTop: 3 }}>Per porzione ({porz} pz): {Math.round(t.kcal / porz)} kcal · P:{Math.round(t.proteins / porz * 10) / 10}g · C:{Math.round(t.carbs / porz * 10) / 10}g · G:{Math.round(t.fats / porz * 10) / 10}g</p>
                        </div>
                      )
                    })()}
                  </div>
                )}
                <div className="input-group" style={{ marginTop: 12 }}>
                  <label className="input-label">Note (opzionale)</label>
                  <textarea className="input-field" rows={2} value={recForm.note} onChange={e => setRecForm(f => ({ ...f, note: e.target.value }))} placeholder="Preparazione, varianti…" style={{ resize: 'vertical' }} />
                </div>
                <button className="btn btn-primary btn-full" onClick={saveRicetta} disabled={!recForm.nome || recForm.ingredienti.length === 0} style={{ marginTop: 14 }}>
                  Salva ricetta
                </button>
              </div>
            )}

            {ricette.length === 0 && !showRecCreate && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: 36, opacity: 0.3, display: 'block', marginBottom: 10 }}>🍳</span>
                <p style={{ fontSize: 14, fontWeight: 500 }}>Nessuna ricetta salvata</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Importa le tue ricette e calcola i macro automaticamente</p>
              </div>
            )}

            {ricette.map(r => {
              const isOpen = expandedRicetta === r.id
              return (
                <div key={r.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <button onClick={() => setExpandedRicetta(isOpen ? null : r.id)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 9, font: 'inherit', textAlign: 'left' }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>🍳</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>{r.nome}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.calorie_porzione} kcal/porz · {r.porzioni} porzioni · {(r.ingredienti || []).length} ingredienti</p>
                    </div>
                    {isOpen ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
                    <button onClick={e => { e.stopPropagation(); deleteRicetta(r.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-muted)', flexShrink: 0 }}>
                      <Trash2 size={15} />
                    </button>
                  </button>
                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--border-light)', padding: '10px 14px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {[`🔥 ${r.calorie_porzione} kcal`, `P:${r.proteine}g`, `C:${r.carboidrati}g`, `G:${r.grassi}g`].map(v => (
                          <span key={v} style={{ fontSize: 11, background: 'var(--surface-2)', padding: '2px 7px', borderRadius: 100, color: 'var(--text-secondary)' }}>{v}</span>
                        ))}
                        <span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 7px', borderRadius: 100, color: 'var(--text-muted)' }}>per porzione</span>
                      </div>
                      {(r.ingredienti || []).map((ing, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: i < r.ingredienti.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                          <p style={{ flex: 1, fontSize: 13 }}>{ing.food_name}</p>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ing.grams}g · {ing.kcal} kcal</p>
                        </div>
                      ))}
                      {r.note && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>{r.note}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

      </div>
    </div>
  )
}
