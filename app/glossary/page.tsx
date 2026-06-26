'use client'

import { useState, useEffect } from 'react'
import { Glossary, GlossaryTerm } from '@/types'
import { loadGlossaries, saveGlossaries } from '@/lib/glossary'
import Link from 'next/link'
import { randomUUID } from 'crypto'

const CATEGORIES = ['cultivation', 'character', 'place', 'general'] as const

export default function GlossaryPage() {
  const [glossaries, setGlossaries] = useState<Glossary[]>([])
  const [activeId, setActiveId] = useState('default-donghua')
  const [newSource, setNewSource] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [newCat, setNewCat] = useState<GlossaryTerm['category']>('cultivation')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setGlossaries(loadGlossaries())
  }, [])

  const active = glossaries.find(g => g.id === activeId)

  function save(updated: Glossary[]) {
    setGlossaries(updated)
    saveGlossaries(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  function addTerm() {
    if (!newSource.trim() || !newTarget.trim() || !active) return
    const term: GlossaryTerm = {
      id: Date.now().toString(),
      source: newSource.trim(),
      target: newTarget.trim(),
      category: newCat,
    }
    const updated = glossaries.map(g =>
      g.id === activeId ? { ...g, terms: [...g.terms, term] } : g
    )
    save(updated)
    setNewSource('')
    setNewTarget('')
  }

  function deleteTerm(termId: string) {
    const updated = glossaries.map(g =>
      g.id === activeId
        ? { ...g, terms: g.terms.filter(t => t.id !== termId) }
        : g
    )
    save(updated)
  }

  function updateTerm(termId: string, field: keyof GlossaryTerm, value: string) {
    const updated = glossaries.map(g =>
      g.id === activeId
        ? { ...g, terms: g.terms.map(t => t.id === termId ? { ...t, [field]: value } : t) }
        : g
    )
    save(updated)
  }

  const catColors: Record<string, string> = {
    cultivation: '#7c6af7', character: '#f77c6a', place: '#6af7b0', general: '#888',
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0e0e12', color: '#e8e6de', fontFamily: 'system-ui, sans-serif' }}>

      <header style={{ borderBottom: '1px solid #2a2a32', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, background: '#0e0e12', zIndex: 10 }}>
        <Link href="/" style={{ color: '#888', textDecoration: 'none', fontSize: 14 }}>← Back</Link>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>Glossary</span>
        {saved && <span style={{ fontSize: 13, color: '#6ab86a', marginLeft: 'auto' }}>✓ Saved</span>}
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* Glossary tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
          {glossaries.map(g => (
            <button
              key={g.id}
              onClick={() => setActiveId(g.id)}
              style={{
                padding: '7px 16px', borderRadius: 20, border: '1px solid',
                borderColor: activeId === g.id ? '#7c6af7' : '#2a2a32',
                background: activeId === g.id ? '#2a1e52' : '#16161e',
                color: activeId === g.id ? '#b8a8ff' : '#888',
                fontSize: 13, cursor: 'pointer',
              }}
            >
              {g.name} <span style={{ opacity: 0.5 }}>({g.terms.length})</span>
            </button>
          ))}
        </div>

        {active && (
          <>
            {/* Add term form */}
            <div style={{ background: '#16161e', border: '1px solid #2a2a32', borderRadius: 10, padding: 20, marginBottom: 24 }}>
              <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>Term ထပ်ထည့်မယ်</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 10, alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 5 }}>Original (Chinese etc)</label>
                  <input
                    value={newSource}
                    onChange={e => setNewSource(e.target.value)}
                    placeholder="渡劫"
                    style={{ width: '100%', padding: '9px 11px', borderRadius: 6, border: '1px solid #2a2a32', background: '#0e0e12', color: '#e8e6de', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 5 }}>Myanmar</label>
                  <input
                    value={newTarget}
                    onChange={e => setNewTarget(e.target.value)}
                    placeholder="ဒုက္ခဖြတ်ကျော်ခြင်း"
                    style={{ width: '100%', padding: '9px 11px', borderRadius: 6, border: '1px solid #2a2a32', background: '#0e0e12', color: '#e8e6de', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <select
                  value={newCat}
                  onChange={e => setNewCat(e.target.value as any)}
                  style={{ padding: '9px 10px', borderRadius: 6, border: '1px solid #2a2a32', background: '#0e0e12', color: '#e8e6de', fontSize: 13, outline: 'none' }}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                  onClick={addTerm}
                  style={{ padding: '9px 20px', borderRadius: 6, border: 'none', background: '#7c6af7', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Terms table */}
            <div>
              {CATEGORIES.map(cat => {
                const catTerms = active.terms.filter(t => t.category === cat)
                if (!catTerms.length) return null
                return (
                  <div key={cat} style={{ marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: catColors[cat], display: 'inline-block' }} />
                      <span style={{ fontSize: 13, color: '#888', textTransform: 'capitalize' }}>{cat}</span>
                      <span style={{ fontSize: 12, color: '#444' }}>({catTerms.length})</span>
                    </div>
                    {catTerms.map(term => (
                      <div
                        key={term.id}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 8, alignItems: 'center' }}
                      >
                        <input
                          value={term.source}
                          onChange={e => updateTerm(term.id, 'source', e.target.value)}
                          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #1e1e2a', background: '#13131a', color: '#9090a0', fontSize: 14, outline: 'none' }}
                        />
                        <input
                          value={term.target}
                          onChange={e => updateTerm(term.id, 'target', e.target.value)}
                          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #2a2a3e', background: '#14141e', color: '#c8c0f0', fontSize: 14, outline: 'none' }}
                        />
                        <button
                          onClick={() => deleteTerm(term.id)}
                          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #3a1515', background: 'transparent', color: '#884444', fontSize: 13, cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
