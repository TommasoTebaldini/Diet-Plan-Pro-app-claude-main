import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { FileText, Download, Calendar, ChevronRight, BookOpen, Utensils, Apple, Heart, Bookmark, BookmarkCheck, ArrowUpDown, Star } from 'lucide-react'

const TYPE_META = {
  // Diet plans
  diet:          { label: 'Piano alimentare',       icon: <Utensils size={18} />, color: '#1a7f5a', bg: '#e6f5ee' },
  dieta:         { label: 'Piano alimentare',       icon: <Utensils size={18} />, color: '#1a7f5a', bg: '#e6f5ee' },
  piano:         { label: 'Piano alimentare',       icon: <Utensils size={18} />, color: '#1a7f5a', bg: '#e6f5ee' },
  chetogenica:   { label: 'Dieta Chetogenica',      icon: <Utensils size={18} />, color: '#0891b2', bg: '#ecfeff' },
  renale:        { label: 'Dieta Renale',           icon: <Utensils size={18} />, color: '#0891b2', bg: '#ecfeff' },
  diabete:       { label: 'Dieta Diabete',          icon: <Utensils size={18} />, color: '#0891b2', bg: '#ecfeff' },
  // Specific consiglio types
  advice:        { label: 'Consiglio nutrizionale', icon: <Heart size={18} />,    color: '#e05a5a', bg: '#fff0f0' },
  consiglio:     { label: 'Consiglio nutrizionale', icon: <Heart size={18} />,    color: '#e05a5a', bg: '#fff0f0' },
  ristorazione:  { label: 'Ristorazione',           icon: <Heart size={18} />,    color: '#e05a5a', bg: '#fff0f0' },
  pediatria:     { label: 'Pediatria',              icon: <Heart size={18} />,    color: '#e05a5a', bg: '#fff0f0' },
  disfagia:      { label: 'Disfagia',               icon: <Heart size={18} />,    color: '#e05a5a', bg: '#fff0f0' },
  pancreas:      { label: 'Pancreas',               icon: <Heart size={18} />,    color: '#e05a5a', bg: '#fff0f0' },
  sport:         { label: 'Nutrizione Sportiva',    icon: <Heart size={18} />,    color: '#e05a5a', bg: '#fff0f0' },
  // Clinical assessments
  questionario:  { label: 'Questionario',           icon: <FileText size={18} />, color: '#7c3aed', bg: '#f5f3ff' },
  dca:           { label: 'Sessione DCA',           icon: <FileText size={18} />, color: '#7c3aed', bg: '#f5f3ff' },
  // Documents
  document:      { label: 'Documento',              icon: <FileText size={18} />, color: '#3b82f6', bg: '#eff6ff' },
  referto:       { label: 'Referto',                icon: <FileText size={18} />, color: '#3b82f6', bg: '#eff6ff' },
  // Education
  education:     { label: 'Materiale educativo',    icon: <BookOpen size={18} />, color: '#8b5cf6', bg: '#f5f3ff' },
  educazione:    { label: 'Materiale educativo',    icon: <BookOpen size={18} />, color: '#8b5cf6', bg: '#f5f3ff' },
  // Catering/Ristorazione
  ristorazione:  { label: 'Menu ristorazione',      icon: <Utensils size={18} />, color: '#0891b2', bg: '#ecfeff' },
  // Recipes
  recipe:        { label: 'Ricetta',                icon: <Apple size={18} />,    color: '#f0922b', bg: '#fff4e6' },
  ricetta:       { label: 'Ricetta',                icon: <Apple size={18} />,    color: '#f0922b', bg: '#fff4e6' },
}

const DATE_FILTERS = [
  { key: 'all', label: 'Sempre' },
  { key: 'week', label: 'Settimana' },
  { key: 'month', label: 'Mese' },
  { key: 'year', label: 'Anno' },
]

const DOCS_EPOCH = '1970-01-01T00:00:00Z'

function isNew(doc, lastSeen) {
  return new Date(doc.created_at) > new Date(lastSeen)
}


// ─── Helper: parse JSON safely, handling double-encoded strings ────────────────
function deepParse(value, maxDepth = 3) {
  let v = value
  for (let i = 0; i < maxDepth; i++) {
    if (typeof v !== 'string') break
    try { v = JSON.parse(v) } catch { break }
  }
  return (v && typeof v === 'object') ? v : {}
}

// ─── Print-style header used by all document types ────────────────────────────
function DocHeader({ color, bg, icon, category, title, subtitle }) {
  return (
    <div style={{ background: bg, border: `2px solid ${color}30`, borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{icon}</span>{category}
      </div>
      {title && <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>{title}</div>}
      {subtitle && <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{subtitle}</div>}
    </div>
  )
}

// ─── Reusable data table ──────────────────────────────────────────────────────
function DataTable({ title, rows }) {
  const validRows = rows.filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== false)
  if (!validRows.length) return null
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
      {title && <div style={{ background: '#1a7f5a', color: 'white', padding: '9px 16px', fontSize: 13, fontWeight: 700 }}>{title}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {validRows.map(([k, v], i) => (
            <tr key={k} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '8px 16px', fontSize: 13, color: '#555', fontWeight: 600, width: '45%' }}>{k}</td>
              <td style={{ padding: '8px 16px', fontSize: 13, color: '#1a1a1a' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Reusable portate / items table ──────────────────────────────────────────
function PortateTable({ portate }) {
  if (!portate?.length) return null
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ background: '#1a7f5a', color: 'white', padding: '9px 16px', fontSize: 13, fontWeight: 700 }}>🍽️ Portate / Menu</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            {['Portata', 'Porzione', 'Note'].map(h => (
              <th key={h} style={{ padding: '8px 14px', fontSize: 12, color: '#666', textAlign: 'left', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {portate.map((p, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#1a7f5a' }}>{p.nome || ''}</td>
              <td style={{ padding: '8px 14px', fontSize: 13 }}>{p.porzione || ''}</td>
              <td style={{ padding: '8px 14px', fontSize: 12, color: p.note ? '#444' : '#bbb', fontStyle: p.note ? 'normal' : 'italic' }}>{p.note || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── MAIN DOCUMENT RENDERER ──────────────────────────────────────────────────
function PrintDocRenderer({ doc }) {
  const tipo = (doc.tipo || doc.type || '').toLowerCase().trim()
  const dati = deepParse(doc.dati_raw)

  // ── Questionario MUST / clinico ───────────────────────────────────────────
  if (tipo === 'questionario' || dati.questionario !== undefined) {
    const scoreColor = (dati.score ?? 0) >= 3 ? '#dc2626' : (dati.score ?? 0) >= 1 ? '#d97706' : '#16a34a'
    const scoreBg   = (dati.score ?? 0) >= 3 ? '#fef2f2' : (dati.score ?? 0) >= 1 ? '#fffbeb' : '#f0fdf4'
    return (
      <div>
        <DocHeader color={scoreColor} bg={scoreBg} icon="📋" category={`Questionario ${dati.questionario || ''}`} title={doc.nota || doc.title} />
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{dati.score ?? '—'}</div>
          <div style={{ fontSize: 14, color: scoreColor, fontWeight: 700, marginTop: 4 }}>{dati.label || ''}</div>
        </div>
        {dati.desc && <p style={{ fontSize: 14, lineHeight: 1.8, color: '#333', background: '#f9fafb', borderRadius: 10, padding: 14 }}>{dati.desc}</p>}
      </div>
    )
  }

  // ── Consiglio nutrizionale ────────────────────────────────────────────────
  if (tipo === 'consiglio' || dati.consiglio_id || dati.consiglio_nome) {
    const nome = dati.consiglio_nome || doc.title
    return (
      <div>
        <DocHeader color="#dc2626" bg="#fff0f0" icon="💊" category="Consiglio Nutrizionale" title={nome} />
        {dati.descrizione && <p style={{ fontSize: 14, lineHeight: 1.8, marginBottom: 12 }}>{dati.descrizione}</p>}
        {dati.indicazioni && <p style={{ fontSize: 14, lineHeight: 1.8, marginBottom: 12 }}>{dati.indicazioni}</p>}
        {dati.alimenti_consentiti?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>✅ Alimenti consentiti</p>
            <ul style={{ paddingLeft: 20, fontSize: 14, lineHeight: 2 }}>{dati.alimenti_consentiti.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
        )}
        {dati.alimenti_limitare?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#d97706', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>⚠️ Da limitare</p>
            <ul style={{ paddingLeft: 20, fontSize: 14, lineHeight: 2 }}>{dati.alimenti_limitare.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
        )}
        {dati.alimenti_evitare?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>🚫 Da evitare</p>
            <ul style={{ paddingLeft: 20, fontSize: 14, lineHeight: 2 }}>{dati.alimenti_evitare.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
        )}
        {dati.note && <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: 8, borderLeft: '3px solid #f59e0b', fontSize: 13, color: '#92400e' }}>💡 {dati.note}</div>}
      </div>
    )
  }

  // ── Ristorazione / menu scolastico ────────────────────────────────────────
  // Struttura reale: dati.piano.portate[], dati.valutazione.{tipo,coperti,...}
  if (tipo === 'ristorazione') {
    const val = deepParse(dati.valutazione) || {}
    const piano = deepParse(dati.piano) || {}
    const portate = piano.portate || val.portate || []
    return (
      <div>
        <DocHeader color="#0891b2" bg="#ecfeff" icon="🍽️" category="Menu Ristorazione" title={doc.nota || doc.title} />
        <DataTable title="📋 Struttura" rows={[
          ['Tipo utenza', piano.tipo || val.tipo],
          ['Utenza', piano.utenza || val.utenza],
          ['Coperti', piano.coperti || val.coperti],
          ['Kcal stimate', piano.kcal || val.kcal],
          ['Diete speciali', piano.diete || val.diete],
          ['Allergeni', piano.allergeni || val.allergeni],
          ['Note struttura', piano.note_struttura || val.note_struttura],
        ]} />
        <PortateTable portate={portate} />
        {(piano.note_generali || val.note_generali) && (
          <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: 8, borderLeft: '3px solid #f59e0b', fontSize: 13, color: '#92400e' }}>
            💡 {piano.note_generali || val.note_generali}
          </div>
        )}
      </div>
    )
  }

  // ── Pediatria ─────────────────────────────────────────────────────────────
  if (tipo === 'pediatria') {
    const paz = deepParse(dati.paziente) || {}
    const piano = deepParse(dati.piano) || {}
    const pasti = Array.isArray(dati.pasti) ? dati.pasti : []
    return (
      <div>
        <DocHeader color="#7c3aed" bg="#f5f3ff" icon="👶" category="Schema Nutrizionale Pediatrico" title={doc.nota || doc.title} />
        <DataTable title="👤 Dati paziente" rows={Object.entries(paz).filter(([, v]) => v)} />
        <DataTable title="📋 Piano" rows={Object.entries(piano).filter(([, v]) => v)} />
        {pasti.length > 0 && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ background: '#1a7f5a', color: 'white', padding: '9px 16px', fontSize: 13, fontWeight: 700 }}>🍼 Schema pasti</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Pasto', 'Orario', 'Alimenti'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', fontSize: 12, color: '#666', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pasti.map((p, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#1a7f5a' }}>{p.nome || ''}</td>
                    <td style={{ padding: '8px 14px', fontSize: 13, color: '#666' }}>{p.ora || ''}</td>
                    <td style={{ padding: '8px 14px', fontSize: 13 }}>
                      {Array.isArray(p.items) ? p.items.map(it => `${it.nome} ${it.qt || ''}${it.misura || 'g'}`).join(', ') :
                       Array.isArray(p.alimenti) ? p.alimenti.join(', ') :
                       p.descrizione || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ── Calcoli clinici: chetogenica, renale, diabete, dca, sport, pancreas, disfagia ──
  const CALCOLO_LABELS = {
    peso: 'Peso (kg)', altezza: 'Altezza (cm)', eta: 'Età', sesso: 'Sesso',
    peso_ideale: 'Peso ideale (kg)', imc: 'IMC', bmi: 'BMI',
    fabbisogno: 'Fabbisogno kcal', kcal: 'Kcal/die',
    proteine: 'Proteine (g)', carboidrati: 'Carboidrati (g)', grassi: 'Grassi (g)',
    tipo: 'Tipo', tdd: 'TDD (UI)', metodo: 'Metodo',
    attivita: 'Attività fisica', npasti: 'N° pasti', luogo: 'Luogo pasti',
    appetito: 'Appetito', allergie: 'Allergie',
  }
  const ICONE_TIPO = { chetogenica: '🥑', renale: '🫘', diabete: '💉', dca: '🧠', sport: '🏋️', pancreas: '🫀', disfagia: '🍵' }
  const calcTypes = ['chetogenica','renale','diabete','dca','sport','pancreas','disfagia']
  const calcData = dati.calcolo || dati.rapporto_ic || dati.panoramica || (calcTypes.includes(tipo) ? dati : null)

  if (calcData) {
    const icon = ICONE_TIPO[tipo] || '📊'
    const flatEntries = Object.entries(calcData)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined && typeof v !== 'object')
      .map(([k, v]) => [CALCOLO_LABELS[k] || k.replace(/_/g, ' '), v])
    const nested = Object.entries(calcData).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))
    return (
      <div>
        <DocHeader color="#0891b2" bg="#f0f9ff" icon={icon} category={tipo.charAt(0).toUpperCase() + tipo.slice(1)} title={doc.nota || doc.title} />
        {flatEntries.length > 0 && (
          <DataTable title="📊 Dati clinici" rows={flatEntries} />
        )}
        {nested.map(([k, v]) => {
          const entries = Object.entries(v).filter(([, vv]) => vv !== '' && vv !== null && vv !== undefined && typeof vv !== 'object').map(([kk, vv]) => [CALCOLO_LABELS[kk] || kk.replace(/_/g, ' '), vv])
          return entries.length > 0 ? <DataTable key={k} title={k.replace(/_/g, ' ')} rows={entries} /> : null
        })}
      </div>
    )
  }

  // ── Fallback: testo normale o struttura generica ──────────────────────────
  const hasContent = doc.content && doc.content.trim()
  const hasDati = dati && Object.keys(dati).length > 0

  return (
    <div>
      {doc.nota && doc.nota !== doc.title && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <p style={{ fontSize: 15, color: '#166534' }}>{doc.nota}</p>
        </div>
      )}
      {hasContent
        ? <p style={{ fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{doc.content}</p>
        : hasDati
          ? <DataTable title="Contenuto" rows={Object.entries(dati).filter(([, v]) => v !== '' && v !== null && typeof v !== 'object').map(([k, v]) => [k.replace(/_/g, ' '), v])} />
          : <p style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>Nessun contenuto disponibile</p>
      }
    </div>
  )
}


function MealPlanRenderer({ mealsData, title, dataString }) {
  let days = []
  try {
    const parsed = typeof mealsData === 'string' ? JSON.parse(mealsData) : mealsData
    days = Array.isArray(parsed) ? parsed : []
  } catch { return <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Piano non disponibile</p> }

  return (
    <div style={{ fontFamily: 'Georgia, serif' }}>
      {/* Print header */}
      <div style={{ textAlign: 'center', marginBottom: 28, paddingBottom: 20, borderBottom: '2px solid #1a7f5a' }}>
        <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>Piano Alimentare Personalizzato</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0d5c3a', margin: '0 0 6px' }}>{title}</h1>
        {dataString && <div style={{ fontSize: 13, color: '#666' }}>Data: {new Date(dataString).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
      </div>

      {/* Days */}
      {days.map((day, di) => (
        <div key={day.id || di} style={{ marginBottom: 28, pageBreakInside: 'avoid' }}>
          {/* Day header */}
          <div style={{ background: '#1a7f5a', color: 'white', padding: '8px 16px', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>📅</span>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{day.nome || `Giorno ${di + 1}`}</h2>
          </div>

          {/* Meals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(day.meals || []).map((meal, mi) => {
              const mealKey = meal.id || meal.tipo || ''
              const meta = MEAL_LABELS[mealKey] || { label: meal.nome || meal.id || 'Pasto', emoji: '🍴' }
              // Support new format: items[], qt, misura, emoji
              const foods = meal.items || meal.foods || meal.alimenti || []
              const kcal = meal.kcal || meal.calorie || null
              const note = meal.note || meal.notes || ''
              const mealEmoji = meal.emoji || meta.emoji
              const mealLabel = meal.nome || meta.label

              return (
                <div key={meal.id || mi} style={{ border: '1px solid #e8f2ec', borderRadius: 10, overflow: 'hidden' }}>
                  {/* Meal header */}
                  <div style={{ background: '#f0faf5', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e8f2ec' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{mealEmoji}</span>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#0d5c3a' }}>{mealLabel}</span>
                    </div>
                    {kcal && <span style={{ fontSize: 12, color: '#666', background: 'white', padding: '2px 8px', borderRadius: 100, border: '1px solid #e8f2ec' }}>🔥 {kcal} kcal</span>}
                  </div>

                  {/* Foods */}
                  <div style={{ padding: '10px 14px' }}>
                    {foods.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e8f2ec' }}>
                            <th style={{ textAlign: 'left', padding: '4px 0', color: '#666', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Alimento</th>
                            <th style={{ textAlign: 'right', padding: '4px 0', color: '#666', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Quantità</th>
                          </tr>
                        </thead>
                        <tbody>
                          {foods.map((food, fi) => (
                            <tr key={fi} style={{ borderBottom: fi < foods.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                              <td style={{ padding: '6px 0', color: '#1a1a1a' }}>{food.nome || food.name || food.alimento || ''}</td>
                              <td style={{ padding: '6px 0', textAlign: 'right', color: '#1a7f5a', fontWeight: 500 }}>
                                {food.qt || food.quantita || food.quantity || food.grammi || food.grams || ''}{food.misura || food.unita || food.unit || 'g'}
                              </td>
                            </tr>
                          ))}
                          {foods.some(f => f.altPrint?.length > 0) && (
                            <tr><td colSpan={2} style={{ padding: '4px 0 0', fontSize: 11, color: '#999', fontStyle: 'italic' }}>
                              Alt: {foods.flatMap(f => f.altPrint || []).map(a => `${a.nome} ${a.qt}g`).join(' / ')}
                            </td></tr>
                          )}
                        </tbody>
                      </table>
                    ) : (meal.descrizione || meal.description) ? (
                      <p style={{ fontSize: 13, color: '#333', lineHeight: 1.6, margin: 0 }}>{meal.descrizione || meal.description}</p>
                    ) : null}

                    {note && (
                      <div style={{ marginTop: 8, padding: '6px 10px', background: '#fffbeb', borderRadius: 6, borderLeft: '3px solid #f59e0b', fontSize: 12, color: '#92400e' }}>
                        💡 {note}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function DocModal({ doc, onClose, bookmarked, onToggleBookmark }) {
  if (!doc) return null
  const meta = TYPE_META[doc.type] || TYPE_META.document
  const isPiano = doc.source === 'piano'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', flexDirection: 'column', background: 'white' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, #0d5c3a, #1a7f5a)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', fontSize: 20, flexShrink: 0 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, margin: 0 }}>{meta.label}</p>
          <h2 style={{ color: 'white', fontSize: 17, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</h2>
        </div>
        <button
          onClick={() => onToggleBookmark(doc.id)}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', flexShrink: 0 }}
        >
          {bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 40px', maxWidth: 800, width: '100%', margin: '0 auto' }}>
        {doc.meals_data ? (
          <MealPlanRenderer mealsData={doc.meals_data} title={doc.title} dataString={doc.data_piano} />
        ) : doc.file_url ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
            <p style={{ marginBottom: 16, color: '#666' }}>Documento allegato</p>
            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" download style={{ background: '#1a7f5a', color: 'white', padding: '12px 24px', borderRadius: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Download size={16} />Scarica documento
            </a>
          </div>
        ) : (
          <PrintDocRenderer doc={doc} />
        )}

        {doc.tags && doc.tags.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {doc.tags.map(t => <span key={t} style={{ background: '#e6f5ee', color: '#0d5c3a', padding: '3px 10px', borderRadius: 100, fontSize: 12 }}>{t}</span>)}
          </div>
        )}

        <div style={{ marginTop: 24, padding: 14, background: '#f7faf8', borderRadius: 12, fontSize: 12, color: '#999' }}>
          📅 Pubblicato il {new Date(doc.published_at || doc.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  const { user } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [sortAsc, setSortAsc] = useState(false)
  const [selected, setSelected] = useState(null)
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const raw = localStorage.getItem(`doc_bookmarks_${user?.id}`)
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [lastSeen] = useState(() => localStorage.getItem(`docs_last_seen_${user?.id}`) || DOCS_EPOCH)

  useEffect(() => {
    async function load() {
      setLoadError(null)
      const allDocs = []

      try {
        // Step 1: get cartella_id linked to this patient via patient_dietitian
        const { data: link } = await supabase
          .from('patient_dietitian')
          .select('cartella_id')
          .eq('patient_id', user.id)
          .maybeSingle()

        const cartellaId = link?.cartella_id

        if (cartellaId) {
          // Step 2a: load note_specialistiche visible to patient
          const { data: notes } = await supabase
            .from('note_specialistiche')
            .select('id, tipo, nota, dati, created_at')
            .eq('cartella_id', cartellaId)
            .eq('visible_to_patient', true)
            .order('created_at', { ascending: false })

          for (const n of notes || []) {
            const tipo = (n.tipo || '').toLowerCase().trim()

            // Direct tipo → TYPE_META key mapping
            const TYPE_META_KEYS_SET = new Set(['diet','dieta','piano','chetogenica','renale','diabete','advice','consiglio','ristorazione','pediatria','disfagia','pancreas','sport','questionario','dca','document','referto','education','educazione','recipe','ricetta'])
            const tipoToKey = {
              dieta: 'diet', piano: 'diet',
              consiglio: 'consiglio',
              questionario: 'questionario',
              dca: 'dca',
              diabete: 'diabete',
              chetogenica: 'chetogenica',
              renale: 'renale',
              referto: 'referto',
              ricetta: 'recipe',
              educazione: 'education',
              nota: 'document',
            }
            // Use tipo directly if it has a TYPE_META entry, otherwise lookup, otherwise use tipo itself
            const type = TYPE_META_KEYS_SET.has(tipo) ? tipo : (tipoToKey[tipo] || tipo || 'document')
            const title = n.nota || titleFromDati ||
              (n.tipo ? n.tipo.charAt(0).toUpperCase() + n.tipo.slice(1) : 'Documento')

            // Extract readable content from dati
            let content = ''
            let mealsData = null

            if (n.dati) {
              // dati may be stored as a double-encoded JSON string — always parse it first
              let datiObj = n.dati
              if (typeof datiObj === 'string') {
                try { datiObj = JSON.parse(datiObj) } catch { datiObj = {} }
              }
              content = datiObj.content || datiObj.contenuto || datiObj.testo ||
                        datiObj.descrizione || datiObj.text || datiObj.desc || ''
              if (datiObj.meals || datiObj.giorni) {
                mealsData = datiObj.meals || datiObj.giorni
              }
              // Store parsed object for renderer
              n._dati_parsed = datiObj
            }

            allDocs.push({
              id: `note_${n.id}`,
              title,
              type,
              source: 'note',
              tipo: n.tipo,
              nota: n.nota,
              content,
              dati_raw: n._dati_parsed || n.dati,
              meals_data: mealsData,
              file_url: n.dati?.file_url || n.dati?.pdf_url || null,
              tags: n.dati?.tags || [],
              visible: true,
              published_at: n.created_at,
              created_at: n.created_at,
            })
          }

          // Step 2b: load piani visible to patient
          const { data: piani } = await supabase
            .from('piani')
            .select('id, nome, data_piano, meals, saved_at')
            .eq('cartella_id', cartellaId)
            .eq('visible_to_patient', true)
            .order('saved_at', { ascending: false })

          for (const p of piani || []) {
            allDocs.push({
              id: `piano_${p.id}`,
              title: p.nome || 'Piano alimentare',
              type: 'diet',
              source: 'piano',
              content: p.data_piano || '',
              data_piano: p.data_piano,
              meals_data: p.meals,
              file_url: null,
              tags: [],
              visible: true,
              published_at: p.saved_at,
              created_at: p.saved_at,
            })
          }
        }

        // Step 3 (fallback): also check patient_documents directly
        const { data: patientDocs } = await supabase
          .from('patient_documents')
          .select('*')
          .eq('patient_id', user.id)
          .eq('visible', true)
          .order('created_at', { ascending: false })

        for (const d of patientDocs || []) {
          allDocs.push({ ...d, published_at: d.published_at || d.created_at })
        }

      } catch (e) {
        console.error('Documents load error:', e)
        setLoadError(e.message)
      }

      setDocs(allDocs)
      setLoading(false)
    }
    load()
  }, [user.id])

  const toggleBookmark = useCallback((docId) => {
    setBookmarks(prev => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      try {
        localStorage.setItem(`doc_bookmarks_${user.id}`, JSON.stringify([...next]))
      } catch { /* ignore */ }
      return next
    })
  }, [user.id])

  const getDateThreshold = () => {
    const now = new Date()
    if (dateFilter === 'week') { now.setDate(now.getDate() - 7); return now }
    if (dateFilter === 'month') { now.setMonth(now.getMonth() - 1); return now }
    if (dateFilter === 'year') { now.setFullYear(now.getFullYear() - 1); return now }
    return null
  }

  const types = ['all', 'bookmarks', ...new Set(docs.map(d => d.type).filter(Boolean))]

  const filtered = docs
    .filter(d => {
      if (typeFilter === 'bookmarks') return bookmarks.has(d.id)
      if (typeFilter !== 'all' && d.type !== typeFilter) return false
      const threshold = getDateThreshold()
      if (threshold && new Date(d.created_at) < threshold) return false
      return true
    })
    .sort((a, b) => {
      const diff = new Date(a.created_at) - new Date(b.created_at)
      return sortAsc ? diff : -diff
    })

  const newCount = docs.filter(d => isNew(d, lastSeen)).length

  return (
    <>
      <div className="page">
        <div style={{ background: 'linear-gradient(160deg, var(--green-dark), var(--green-main))', padding: 'calc(env(safe-area-inset-top) + 20px) 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Condivisi dal tuo dietista</p>
            {newCount > 0 && (
              <span style={{ background: '#f59e0b', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100 }}>
                {newCount} nuov{newCount === 1 ? 'o' : 'i'}
              </span>
            )}
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'white', fontWeight: 300, marginBottom: 14 }}>I miei documenti</h1>

          {/* Type filter tabs */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, WebkitOverflowScrolling: 'touch' }}>
            {types.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} style={{
                flexShrink: 0, padding: '7px 14px', borderRadius: 100,
                background: typeFilter === t ? 'white' : 'rgba(255,255,255,0.15)',
                color: typeFilter === t ? 'var(--green-main)' : 'white',
                border: 'none', font: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {t === 'bookmarks' && <Star size={12} fill={typeFilter === 'bookmarks' ? 'var(--green-main)' : 'white'} />}
                {t === 'all' ? 'Tutti' : t === 'bookmarks' ? 'Preferiti' : TYPE_META[t]?.label || t}
              </button>
            ))}
          </div>

          {/* Date filter + sort row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
              {DATE_FILTERS.map(({ key, label }) => (
                <button key={key} onClick={() => setDateFilter(key)} style={{
                  flexShrink: 0, padding: '5px 12px', borderRadius: 100,
                  background: dateFilter === key ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.1)',
                  color: dateFilter === key ? 'var(--green-dark)' : 'rgba(255,255,255,0.8)',
                  border: `1px solid ${dateFilter === key ? 'transparent' : 'rgba(255,255,255,0.2)'}`,
                  font: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}>
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSortAsc(v => !v)}
              title={sortAsc ? 'Dal più vecchio' : 'Dal più recente'}
              style={{ flexShrink: 0, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}
            >
              <ArrowUpDown size={15} />
            </button>
          </div>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--green-main)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
            </div>
          ) : loadError ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
              <FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ fontSize: 15, fontWeight: 500 }}>Errore nel caricamento</p>
              <p style={{ fontSize: 13, marginTop: 4, color: 'var(--red)' }}>{loadError}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
              {typeFilter === 'bookmarks'
                ? <><Star size={40} style={{ marginBottom: 12, opacity: 0.3 }} /><p style={{ fontSize: 15, fontWeight: 500 }}>Nessun preferito</p><p style={{ fontSize: 13, marginTop: 4 }}>Tocca ★ su un documento per salvarlo qui.</p></>
                : <><FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }} /><p style={{ fontSize: 15, fontWeight: 500 }}>Nessun documento</p><p style={{ fontSize: 13, marginTop: 4 }}>Il tuo dietista non ha ancora condiviso documenti.</p></>
              }
            </div>
          ) : filtered.map(doc => {
            const meta = TYPE_META[doc.type] || TYPE_META.document
            const docIsNew = isNew(doc, lastSeen)
            const isBookmarked = bookmarks.has(doc.id)
            return (
              <div key={doc.id} style={{ position: 'relative' }}>
                {docIsNew && (
                  <span style={{ position: 'absolute', top: -6, left: 14, zIndex: 1, background: '#f59e0b', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100 }}>
                    NUOVO
                  </span>
                )}
                <button onClick={() => setSelected(doc)} style={{ width: '100%', background: 'white', border: `1px solid ${docIsNew ? '#fcd34d' : 'var(--border-light)'}`, borderRadius: 'var(--r-lg)', padding: '14px 14px 14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', font: 'inherit', textAlign: 'left', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color, flexShrink: 0 }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</p>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Calendar size={10} />{new Date(doc.created_at).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                    {doc.tags && doc.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                        {doc.tags.slice(0, 3).map(t => <span key={t} className="badge badge-green" style={{ fontSize: 10, padding: '2px 8px' }}>{t}</span>)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        onClick={e => e.stopPropagation()}
                        title="Scarica PDF"
                        style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green-main)', textDecoration: 'none' }}
                      >
                        <Download size={14} />
                      </a>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); toggleBookmark(doc.id) }}
                      title={isBookmarked ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                      style={{ width: 32, height: 32, borderRadius: 8, background: isBookmarked ? '#fff4e6' : 'var(--surface-2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isBookmarked ? '#f0922b' : 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {isBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                    </button>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {selected && (
        <DocModal
          doc={selected}
          onClose={() => setSelected(null)}
          bookmarked={bookmarks.has(selected.id)}
          onToggleBookmark={toggleBookmark}
        />
      )}
    </>
  )
}
