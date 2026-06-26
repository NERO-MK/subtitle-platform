'use client'

import { useState } from 'react'
import { SrtLine, JobStatus } from '@/types'
import { formatSrt } from '@/lib/srt'
import { loadGlossaries } from '@/lib/glossary'
import Link from 'next/link'

type InputMode = 'url' | 'paste'

export default function Home() {
  const [mode, setMode] = useState<InputMode>('url')
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

    // Step 1: Get SRT content
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

    // Step 2: Translate
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
  const safeName = title.replace(/[^a-zA-Z0-9_\u1000-\u109F]/g, '_').slice(0, 60)

  return (
    <main style={{ minHeight: '100vh', background: '#0e0e12', color: '#e8e6de', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid #2a2a32', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.3px', color: '#fff' }}>SubMM</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: '#666', background: '#1a1a22', padding: '2px 8px', borderRadius: 4 }}>beta</span>
        </div>
        <nav style={{ display: 'flex', gap: 24, fontSize: 14, color: '#888' }}>
          <Link href="/" style={{ color: '#ccc', textDecoration: 'none' }}>Translate</Link>
          <Link href="/editor" style={{ color: '#888', textDecoration: 'none' }}>Editor</Link>
          <Link href="/glossary" style={{ color: '#888', textDecoration: 'none' }}>Glossary</Link>
        </nav>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>

        {/* Hero */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 600, lineHeight: 1.2, marginBottom: 10, color: '#fff' }}>
            Subtitle translate လုပ်ပါ
          </h1>
          <p style={{ color: '#888', fontSize: 15 }}>
            URL paste ဒါမှမဟုတ် .srt /.vtt text paste → English + Myanmar .srt download
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: '#1a1a22', borderRadius: 8, padding: 4, width: 'fit-content' }}>
          {(['url', 'paste'] as InputMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '7px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                background: mode === m ? '#7c6af7' : 'transparent',
                color: mode === m ? '#fff' : '#888',
                transition: 'all 0.15s',
              }}
            >
              {m === 'url' ? 'URL' : 'SRT paste'}
            </button>
          ))}
        </div>

        {/* Input area */}
        <div style={{ background: '#16161e', border: '1px solid #2a2a32', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          {mode === 'url' ? (
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>Video URL</label>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #2a2a32',
                  background: '#0e0e12', color: '#e8e6de', fontSize: 15, outline: 'none', boxSizing: 'border-box',
                }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              <p style={{ fontSize: 12, color: '#555', marginTop: 8 }}>YouTube, Bilibili, Vimeo and 1000+ sites</p>
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>SRT / VTT content paste လုပ်ပါ</label>
              <textarea
                value={pastedSrt}
                onChange={e => setPastedSrt(e.target.value)}
                placeholder={"1\n00:00:01,000 --> 00:00:03,000\n你好世界\n\n2\n..."}
                rows={8}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #2a2a32',
                  background: '#0e0e12', color: '#e8e6de', fontSize: 13, fontFamily: 'monospace',
                  outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Glossary selector */}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 13, color: '#888', whiteSpace: 'nowrap' }}>Glossary</label>
            <select
              value={glossaryId}
              onChange={e => setGlossaryId(e.target.value)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #2a2a32',
                background: '#0e0e12', color: '#e8e6de', fontSize: 14, outline: 'none',
              }}
            >
              <option value="">None</option>
              {glossaries.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <Link href="/glossary" style={{ fontSize: 13, color: '#7c6af7', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              + Edit
            </Link>
          </div>
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={status === 'downloading' || status === 'translating'}
          style={{
            width: '100%', padding: '14px', borderRadius: 10, border: 'none',
            background: status === 'downloading' || status === 'translating' ? '#3a3a52' : '#7c6af7',
            color: '#fff', fontSize: 16, fontWeight: 600, cursor: status === 'downloading' || status === 'translating' ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {status === 'downloading' ? '⏳ Downloading...' :
           status === 'translating' ? '🔄 Translating...' :
           'Translate →'}
        </button>

        {/* Progress */}
        {(status === 'downloading' || status === 'translating') && (
          <div style={{ marginTop: 16 }}>
            <div style={{ height: 4, background: '#2a2a32', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: '#7c6af7', transition: 'width 0.3s', borderRadius: 2 }} />
            </div>
            <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>{message}</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div style={{ marginTop: 16, padding: '14px 16px', background: '#2a1515', border: '1px solid #5a2222', borderRadius: 8, color: '#ff8080', fontSize: 14 }}>
            ❌ {message}
          </div>
        )}

        {/* Result - Download buttons */}
        {status === 'done' && lines.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ padding: '16px', background: '#122212', border: '1px solid #1e4a1e', borderRadius: 8, marginBottom: 20, fontSize: 14, color: '#6ab86a' }}>
              ✅ {lines.length} lines translated
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                onClick={() => downloadFile(engSrt, `${safeName}.en.srt`)}
                style={{
                  padding: '14px', borderRadius: 10, border: '1px solid #2a2a32',
                  background: '#16161e', color: '#e8e6de', fontSize: 15, fontWeight: 500,
                  cursor: 'pointer', textAlign: 'center',
                }}
              >
                ⬇ English .srt
              </button>
              <button
                onClick={() => downloadFile(mySrt, `${safeName}.my.srt`)}
                style={{
                  padding: '14px', borderRadius: 10, border: 'none',
                  background: '#7c6af7', color: '#fff', fontSize: 15, fontWeight: 600,
                  cursor: 'pointer', textAlign: 'center',
                }}
              >
                ⬇ Myanmar .srt
              </button>
            </div>

            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <Link
                href={`/editor?data=${encodeURIComponent(JSON.stringify(lines.slice(0, 5)))}`}
                style={{ fontSize: 13, color: '#7c6af7', textDecoration: 'none' }}
              >
                Editor မှာ ဖွင့်ကြည့် →
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
