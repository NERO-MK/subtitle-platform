'use client'

import { useState } from 'react'
import { SrtLine, JobStatus } from '@/types'
import { formatSrt } from '@/lib/srt'
import { loadGlossaries } from '@/lib/glossary'
import Link from 'next/link'

type InputMode = 'url' | 'paste'

export default function Home() {
  const [mode, setMode] = useState<InputMode>('paste')
  const [url, setUrl] = useState('')
  const [pastedSrt, setPastedSrt] = useState('')
  const [glossaryId, setGlossaryId] = useState('default-donghua')
  const [status, setStatus] = useState<JobStatus>('idle')
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState(0)
  const [lines, setLines] = useState<SrtLine[]>([])
  const [title, setTitle] = useState('')
  const glossaries = loadGlossaries()

  async function handleSubmit() {
    setStatus('idle')
    setLines([])
    setMessage('')
    setProgress(0)

    let srtContent = ''

    if (mode === 'url') {
      if (!url.trim()) return
      setStatus('downloading')
      setMessage('Downloading subtitle...')
      setProgress(20)

      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setStatus('error')
        setMessage(data.error || 'Download failed')
        return
      }

      srtContent = data.srtContent
      setTitle(data.title || 'subtitle')
      setProgress(40)
    } else {
      if (!pastedSrt.trim()) return
      srtContent = pastedSrt
      setTitle('subtitle')
      setProgress(30)
    }

    setStatus('translating')
    setMessage('Translating to Myanmar...')
    setProgress(50)

    const res2 = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ srtContent, glossaryId }),
    })
    const data2 = await res2.json()

    if (!res2.ok || data2.error) {
      setStatus('error')
      setMessage(data2.error || 'Translation failed')
      return
    }

    setLines(data2.lines)
    setStatus('done')
    setMessage('Done!')
    setProgress(100)

    // Editor အတွက် localStorage သုံးမယ် (sessionStorage မဟုတ်ဘဲ)
    try {
      localStorage.setItem('editor_lines', JSON.stringify(data2.lines))
      localStorage.setItem('editor_title', data.title || 'subtitle')
    } catch (e) {}
  }

  function downloadFile(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const engSrt = lines.length ? formatSrt(lines, false) : ''
  const mySrt = lines.length ? formatSrt(lines, true) : ''
  const safeName = title.replace(/[^a-zA-Z0-9_\u1000-\u109F]/g, '_').slice(0, 60) || 'subtitle'

  return (
    <main style={{ minHeight: '100vh', background: '#0e0e12', color: '#e8e6de', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid #2a2a32', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>SubMM</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: '#666', background: '#1a1a22', padding: '2px 8px', borderRadius: 4 }}>beta</span>
        </div>
        <nav style={{ display: 'flex', gap: 20, fontSize: 14 }}>
          <Link href="/" style={{ color: '#ccc', textDecoration: 'none' }}>Translate</Link>
          <Link href="/editor" style={{ color: '#888', textDecoration: 'none' }}>Editor</Link>
          <Link href="/glossary" style={{ color: '#888', textDecoration: 'none' }}>Glossary</Link>
        </nav>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Subtitle translate လုပ်ပါ</h1>
          <p style={{ color: '#888', fontSize: 14 }}>URL paste ဒါမှမဟုတ် .srt text paste → English + Myanmar .srt download</p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: '#1a1a22', borderRadius: 8, padding: 4, width: 'fit-content' }}>
          {(['paste', 'url'] as InputMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '7px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
              background: mode === m ? '#7c6af7' : 'transparent',
              color: mode === m ? '#fff' : '#888',
            }}>
              {m === 'url' ? 'URL' : 'SRT paste'}
            </button>
          ))}
        </div>

        <div style={{ background: '#16161e', border: '1px solid #2a2a32', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          {mode === 'url' ? (
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>Video URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #2a2a32', background: '#0e0e12', color: '#e8e6de', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>SRT / VTT content paste လုပ်ပါ</label>
              <textarea value={pastedSrt} onChange={e => setPastedSrt(e.target.value)}
                placeholder={"1\n00:00:01,000 --> 00:00:03,000\n你好世界\n\n2\n00:00:03,500 --> 00:00:05,000\n修炼成仙"}
                rows={8}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #2a2a32', background: '#0e0e12', color: '#e8e6de', fontSize: 13, fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 13, color: '#888' }}>Glossary</label>
            <select value={glossaryId} onChange={e => setGlossaryId(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #2a2a32', background: '#0e0e12', color: '#e8e6de', fontSize: 14, outline: 'none' }}>
              <option value="">None</option>
              {glossaries.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <Link href="/glossary" style={{ fontSize: 13, color: '#7c6af7', textDecoration: 'none' }}>+ Edit</Link>
          </div>
        </div>

        <button onClick={handleSubmit}
          disabled={status === 'downloading' || status === 'translating'}
          style={{
            width: '100%', padding: '14px', borderRadius: 10, border: 'none',
            background: status === 'downloading' || status === 'translating' ? '#3a3a52' : '#7c6af7',
            color: '#fff', fontSize: 16, fontWeight: 600,
            cursor: status === 'downloading' || status === 'translating' ? 'not-allowed' : 'pointer',
          }}>
          {status === 'downloading' ? '⏳ Downloading...' : status === 'translating' ? '🔄 Translating...' : 'Translate →'}
        </button>

        {(status === 'downloading' || status === 'translating') && (
          <div style={{ marginTop: 16 }}>
            <div style={{ height: 4, background: '#2a2a32', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: '#7c6af7', transition: 'width 0.3s', borderRadius: 2 }} />
            </div>
            <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div style={{ marginTop: 16, padding: '14px 16px', background: '#2a1515', border: '1px solid #5a2222', borderRadius: 8, color: '#ff8080', fontSize: 14 }}>
            ❌ {message}
          </div>
        )}

        {status === 'done' && lines.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ padding: '14px 16px', background: '#122212', border: '1px solid #1e4a1e', borderRadius: 8, marginBottom: 16, fontSize: 14, color: '#6ab86a' }}>
              ✅ {lines.length} lines translated
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <button onClick={() => downloadFile(engSrt, `${safeName}.en.srt`)}
                style={{ padding: '14px', borderRadius: 10, border: '1px solid #2a2a32', background: '#16161e', color: '#e8e6de', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
                ⬇ English .srt
              </button>
              <button onClick={() => downloadFile(mySrt, `${safeName}.my.srt`)}
                style={{ padding: '14px', borderRadius: 10, border: 'none', background: '#7c6af7', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                ⬇ Myanmar .srt
              </button>
            </div>

            <Link href="/editor"
              style={{ display: 'block', textAlign: 'center', padding: '12px', borderRadius: 10, border: '1px solid #2a2a3e', color: '#b8a8ff', textDecoration: 'none', fontSize: 14 }}>
              ✏️ Editor မှာ review / ပြင်ဆင်ရန် →
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
