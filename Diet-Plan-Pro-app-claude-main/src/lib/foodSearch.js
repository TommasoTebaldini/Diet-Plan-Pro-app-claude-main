import { supabase } from './supabase'
import { DIETITIAN_FOODS } from '../data/foods'

// ─── Dietitian food database (primary, trusted source) ───────────────────────
// Uses the comprehensive database from the dietitian app (Diet-Plan-Pro).
// This is prioritised over OpenFoodFacts as it contains professionally
// curated nutritional values per 100 g.

function searchDietitianFoods(query) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const tokens = q.split(/\s+/)
  const results = DIETITIAN_FOODS.filter(f => {
    const name = f.name.toLowerCase()
    return tokens.every(t => name.includes(t))
  })
  // Sort: exact-start matches first, then partial matches
  results.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1
    return aStarts - bStarts
  })
  return results.map(f => ({ ...f, brand: `📋 DB Dietista — ${f.category || 'Generico'}`, source: 'dietitian' }))
}

// Recent foods from patient's own logs (fastest, most relevant)
async function searchRecentFoods(query) {
  try {
    const { data } = await supabase
      .from('food_logs')
      .select('food_name, kcal, proteins, carbs, fats, grams, food_data')
      .ilike('food_name', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(80)
    if (!data?.length) return []
    const seen = new Map()
    for (const row of data) {
      if (seen.has(row.food_name)) continue
      const fd = row.food_data || {}
      const g = row.grams || 100
      seen.set(row.food_name, {
        id: `recent_${row.food_name}`,
        name: row.food_name,
        brand: fd.brand || '',
        kcal_100g: fd.kcal_100g ?? Math.round(row.kcal / g * 100),
        proteins_100g: fd.proteins_100g ?? Math.round(row.proteins / g * 1000) / 10,
        carbs_100g: fd.carbs_100g ?? Math.round(row.carbs / g * 1000) / 10,
        fats_100g: fd.fats_100g ?? Math.round(row.fats / g * 1000) / 10,
        fiber_100g: fd.fiber_100g || 0,
        source: 'recent',
      })
    }
    return [...seen.values()].slice(0, 6)
  } catch { return [] }
}

// Foods from dietitian's diet meals (foods in prescribed diets)
async function searchDietMealFoods(query) {
  try {
    const { data } = await supabase
      .from('diet_meals').select('foods').not('foods', 'is', null).limit(200)
    if (!data?.length) return []
    const seen = new Set()
    const results = []
    const q = query.toLowerCase()
    for (const meal of data) {
      if (!Array.isArray(meal.foods)) continue
      for (const food of meal.foods) {
        const name = food.name || food.nome || ''
        if (!name || !name.toLowerCase().includes(q) || seen.has(name)) continue
        seen.add(name)
        results.push({
          id: `diet_${name}`,
          name, brand: '🥗 Dal tuo piano',
          kcal_100g: food.kcal_100g || food.calorie || 0,
          proteins_100g: food.proteins_100g || food.proteine || 0,
          carbs_100g: food.carbs_100g || food.carboidrati || 0,
          fats_100g: food.fats_100g || food.grassi || 0,
          fiber_100g: food.fiber_100g || 0,
          source: 'diet',
        })
      }
    }
    return results.slice(0, 8)
  } catch { return [] }
}

// Recipes table
async function searchRicette(query) {
  try {
    const { data } = await supabase.from('ricette').select('*').ilike('nome', `%${query}%`).limit(8)
    if (!data?.length) return []
    return data.map(r => ({
      id: `ricetta_${r.id}`, name: r.nome || r.name || '',
      brand: '🍳 Ricetta',
      kcal_100g: r.kcal_100g || r.calorie_porzione || r.calorie || r.kcal || 0,
      proteins_100g: r.proteins_100g || r.proteine || r.proteins || 0,
      carbs_100g: r.carbs_100g || r.carboidrati || r.carbs || 0,
      fats_100g: r.fats_100g || r.grassi || r.lipidi || 0,
      fiber_100g: r.fibra || 0, source: 'recipe',
    })).filter(r => r.name)
  } catch { return [] }
}

// Custom meals (user-created meal combos)
async function searchCustomMeals(query) {
  try {
    const { data } = await supabase
      .from('custom_meals')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(6)
    if (!data?.length) return []
    return data.map(m => {
      const w = m.peso_totale_g || 100
      return {
        id: `meal_${m.id}`,
        name: m.name,
        brand: '🍽️ Pasto personalizzato',
        kcal_100g: w > 0 ? Math.round(m.kcal_total / w * 100) : 0,
        proteins_100g: w > 0 ? Math.round(m.proteins_total / w * 1000) / 10 : 0,
        carbs_100g: w > 0 ? Math.round(m.carbs_total / w * 1000) / 10 : 0,
        fats_100g: w > 0 ? Math.round(m.fats_total / w * 1000) / 10 : 0,
        fiber_100g: 0,
        source: 'custom_meal',
        meal_id: m.id,
        default_grams: w,
      }
    })
  } catch { return [] }
}

// Open Food Facts — Italian-first search with multiple endpoint fallbacks
function mapOFFProduct(p) {
  const n = p.nutriments || {}
  // Try kcal directly, then convert from kJ (1 kcal ≈ 4.184 kJ)
  const kcal = n['energy-kcal_100g']
    || (n['energy_100g'] ? Math.round(n['energy_100g'] / 4.184) : 0)
    || n['energy-kcal']
    || 0
  const name = p.product_name_it || p.product_name || p.product_name_en || ''
  return {
    id: p.code || p._id, name, brand: p.brands || '',
    kcal_100g: Math.round(kcal),
    proteins_100g: Math.round((n['proteins_100g'] || 0) * 10) / 10,
    carbs_100g: Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
    fats_100g: Math.round((n['fat_100g'] || 0) * 10) / 10,
    fiber_100g: Math.round((n['fiber_100g'] || 0) * 10) / 10,
    source: 'openfoodfacts',
  }
}

function hasUsefulData(p) {
  const n = p.nutriments || {}
  const name = p.product_name_it || p.product_name || p.product_name_en || ''
  if (!name) return false
  return (
    n['energy-kcal_100g'] || n['energy_100g'] || n['energy-kcal'] ||
    n['proteins_100g'] || n['carbohydrates_100g'] || n['fat_100g']
  )
}

export async function searchOpenFoodFacts(query) {
  const fields = 'code,product_name,product_name_it,product_name_en,brands,nutriments'
  const q = encodeURIComponent(query)

  // Primary: Italian regional database — returns products sold in Italy in Italian
  try {
    const res = await fetch(
      `https://it.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&fields=${fields}&page_size=24&sort_by=unique_scans_n`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const data = await res.json()
      const hits = (data.products || []).filter(hasUsefulData).map(mapOFFProduct).filter(p => p.name)
      if (hits.length >= 3) return hits
    }
  } catch { /* fall through */ }

  // Secondary: Meilisearch-based API with Italian language filter
  try {
    const res = await fetch(
      `https://search.openfoodfacts.org/search?q=${q}&page_size=24&fields=${fields}&langs=it`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const data = await res.json()
      const hits = (data.hits || []).filter(hasUsefulData).map(mapOFFProduct).filter(p => p.name)
      if (hits.length >= 3) return hits
    }
  } catch { /* fall through */ }

  // Tertiary: world database filtered by Italian country tag, sorted by scans
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&fields=${fields}&page_size=24&tagtype_0=countries&tag_contains_0=contains&tag_0=italy&sort_by=unique_scans_n`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const data = await res.json()
      const hits = (data.products || []).filter(hasUsefulData).map(mapOFFProduct).filter(p => p.name)
      if (hits.length > 0) return hits
    }
  } catch { /* fall through */ }

  // Quaternary: world database fallback (no country filter)
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&fields=${fields}&page_size=24&sort_by=unique_scans_n`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const data = await res.json()
      return (data.products || []).filter(hasUsefulData).map(mapOFFProduct).filter(p => p.name)
    }
  } catch { /* ignore */ }

  return []
}

export async function searchFoods(query) {
  const normalizedQuery = query.toLowerCase().trim()
  if (!normalizedQuery) return []
  // Avoid expensive remote lookups on very short terms.
  const shouldSearchOpenFoodFacts = normalizedQuery.length >= 3
  // Priority order: Dietitian DB (trusted) → Recent → Diet meals → Recipes → Custom meals → OpenFoodFacts
  const [a, b, c, d, e, f] = await Promise.allSettled([
    Promise.resolve(searchDietitianFoods(normalizedQuery)),
    searchRecentFoods(normalizedQuery),
    searchDietMealFoods(normalizedQuery),
    searchRicette(normalizedQuery),
    searchCustomMeals(normalizedQuery),
    shouldSearchOpenFoodFacts ? searchOpenFoodFacts(normalizedQuery) : Promise.resolve([]),
  ])
  const seen = new Set()
  const dedup = arr => (arr.status === 'fulfilled' ? arr.value : []).filter(food => {
    const k = (food.name || '').toLowerCase().trim()
    if (!k || seen.has(k)) return false
    seen.add(k); return true
  })
  return [...dedup(a), ...dedup(b), ...dedup(c), ...dedup(d), ...dedup(e), ...dedup(f)].slice(0, 30)
}

export async function searchDatabaseFoods(query) {
  return searchDietMealFoods(query)
}

export async function searchByBarcode(barcode) {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`,
      { signal: AbortSignal.timeout(8000) }
    )
    const data = await res.json()
    if (data.status !== 1 || !data.product) return null
    const p = data.product
    const n = p.nutriments || {}
    const name = p.product_name_it || p.product_name || ''
    if (!name) return null
    return {
      id: p.code || barcode,
      name,
      brand: p.brands || '',
      kcal_100g: Math.round(n['energy-kcal_100g'] || 0),
      proteins_100g: Math.round((n['proteins_100g'] || 0) * 10) / 10,
      carbs_100g: Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
      fats_100g: Math.round((n['fat_100g'] || 0) * 10) / 10,
      fiber_100g: Math.round((n['fiber_100g'] || 0) * 10) / 10,
      source: 'openfoodfacts',
    }
  } catch { return null }
}
