'use client'

import { useState, useEffect } from 'react'
import { SrtLine } from '@/types'
import { formatSrt } from '@/lib/srt'
import Link from 'next/link'

export default function EditorPage() {
  const [lines, setLines] = useState<SrtLine[]>([])
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Load from sessionStorage (set by main page)
    const raw = sessionStorage.getItem('editor_lines')
    if (raw) {
      try { setLines(JSON.parse(raw)) } catch {}
    }
  }, [])

  function updateLine(index: number, field: 'text' | 'translated', value: string) {
    setLines(prev => prev.map(l => l.index === index ? { ...l, [field]: value } : l))
    setSaved(false)
  }

  function save() {
    sessionStorage.setItem('editor_lines', JSON.stringify(lines))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function downloadFile(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
  }

  const filtered = search
    ? lines.filter(l =>
        l.text.toLowerCase().includes(search.toLowerCase()) ||
        (l.translated || '').includes(search)
      )
    : lines

  return (
    <main style={{ minHeight: '100vh', background: '#0e0e12', color: '#e8e6de', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid #2a2a32', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 20, position: 'sticky', top: 0, background: '#0e0e12', zIndex: 10 }}>
        <Link href="/" style={{ color: '#888', textDecoration: 'none', fontSize: 14 }}>← Back</Link>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>Subtitle Editor</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#555' }}>{lines.length} lines</span>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          style={{
            padding: '7px 12px', borderRadius: 6, border: '1px solid #2a2a32',
            background: '#16161e', color: '#e8e6de', fontSize: 13, outline: 'none', width: 200,
          }}
        />

        <button
          onClick={save}
          style={{
            padding: '8px 18px', borderRadius: 6, border: 'none',
            background: saved ? '#1e4a1e' : '#2a2a3a',
            color: saved ? '#6ab86a' : '#ccc',
            fontSize: 13, cursor: 'pointer',
          }}
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>

        <button
          onClick={() => downloadFile(formatSrt(lines, true), 'translated.my.srt')}
          style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#7c6af7', color: '#fff', fontSize: 13, cursor: 'pointer' }}
        >
          ⬇ Export Myanmar
        </button>
      </header>

      {/* Empty state */}
      {lines.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 24px', color: '#555' }}>
          <p style={{ fontSize: 18, marginBottom: 12 }}>No subtitle loaded</p>
          <Link href="/" style={{ color: '#7c6af7', textDecoration: 'none', fontSize: 14 }}>
            ← Translate first
          </Link>
        </div>
      )}

      {/* Lines table */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px' }}>
        {filtered.map(line => (
          <div
            key={line.index}
            style={{
              display: 'grid', gridTemplateColumns: '52px 140px 1fr 1fr',
              gap: 12, padding: '12px 0', borderBottom: '1px solid #1a1a22',
              alignItems: 'start',
            }}
          >
            {/* Index */}
            <span style={{ fontSize: 12, color: '#444', paddingTop: 10, textAlign: 'right' }}>
              {line.index}
            </span>

            {/* Timestamp */}
            <div style={{ paddingTop: 8 }}>
              <span style={{ fontSize: 11, color: '#555', fontFamily: 'monospace', display: 'block' }}>
                {line.startTime.slice(0, 8)}
              </span>
              <span style={{ fontSize: 11, color: '#444', fontFamily: 'monospace' }}>
                → {line.endTime.slice(0, 8)}
              </span>
            </div>

            {/* Original */}
            <textarea
              value={line.text}
              onChange={e => updateLine(line.index, 'text', e.target.value)}
              rows={2}
              style={{
                padding: '8px 10px', borderRadius: 6, border: '1px solid #1e1e2a',
                background: '#13131a', color: '#9090a0', fontSize: 13,
                fontFamily: 'system-ui, sans-serif', resize: 'vertical', outline: 'none',
                lineHeight: 1.5,
              }}
            />

            {/* Myanmar translation */}
            <textarea
              value={line.translated || ''}
              onChange={e => updateLine(line.index, 'translated', e.target.value)}
              rows={2}
              placeholder="Myanmar translation..."
              style={{
                padding: '8px 10px', borderRadius: 6, border: '1px solid #2a2a3e',
                background: '#14141e', color: '#c8c0f0', fontSize: 13,
                fontFamily: 'system-ui, sans-serif', resize: 'vertical', outline: 'none',
                lineHeight: 1.5,
              }}
            />
          </div>
        ))}
      </div>
    </main>
  )
}
