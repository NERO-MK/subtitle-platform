'use client'

import { useState } from 'react'
import { SrtLine, JobStatus } from '@/types'
import { formatSrt } from '@/lib/srt'
import { loadGlossaries } from '@/lib/glossary'
import Link from 'next/link'

type InputMode = 'paste' | 'url'
type Tab = 'translate' | 'submit'

export default function Home() {
  // Tab
  const [tab, setTab] = useState<Tab>('translate')

  // Translate tab
  const [mode, setMode] = useState<InputMode>('paste')
  const [url, setUrl] = useState('')
  const [pastedSrt, setPastedSrt] = useState('')
  const [glossaryId, setGlossaryId] = useState('default-donghua')
  const [status, setStatus] = useState<JobStatus>('idle')
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState(0)
  const [lines, setLines] = useState<SrtLine[]>([])
  const [title, setTitle] = useState('')

  // Submit tab
  const [submitUrl, setSubmitUrl] = useState('')
  const [submitTitle, setSubmitTitle] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle'|'processing'|'done'|'error'>('idle')
  const [submitResult, setSubmitResult] = useState<any>(null)
  const [submitError, setSubmitError] = useState('')

  const glossaries = loadGlossaries()

  // ── Translate tab ──────────────────────────────────────
  async function handleTranslate() {
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
      if (!res.ok || data.error) { setStatus('error'); setMessage(data.error || 'Download failed'); return }
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
    if (!res2.ok || data2.error) { setStatus('error'); setMessage(data2.error || 'Translation failed'); return }

    setLines(data2.lines)
    setStatus('done')
    setMessage('Done!')
    setProgress(100)

    try {
      localStorage.setItem('editor_lines', JSON.stringify(data2.lines))
      localStorage.setItem('editor_title', title || 'subtitle')
    } catch {}
  }

  // ── Submit tab (URL → full pipeline) ──────────────────
  async function handleSubmit() {
    if (!submitUrl.trim()) return
    setSubmitStatus('processing')
    setSubmitError('')
    setSubmitResult(null)

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: submitUrl,
          title: submitTitle || undefined,
          telegram_chat_id: telegramChatId || undefined,
          glossaryId,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed')
      setSubmitResult(data)
      setSubmitStatus('done')
    } catch (err: any) {
      setSubmitError(err.message)
      setSubmitStatus('error')
    }
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
  const safeName = (title || 'subtitle').replace(/[^a-zA-Z0-9_\u1000-\u109F]/g, '_').slice(0, 60)

  const s = { background: '#0e0e12', color: '#e8e6de', fontFamily: 'system-ui,sans-serif' }

  return (
    <main style={{ minHeight: '100vh', ...s }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #2a2a32', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>SubMM</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: '#666', background: '#1a1a22', padding: '2px 8px', borderRadius: 4 }}>beta</span>
        </div>
        <nav style={{ display: 'flex', gap: 16, fontSize: 14 }}>
          <Link href="/" style={{ color: '#ccc', textDecoration: 'none' }}>Home</Link>
          <Link href="/editor" style={{ color: '#888', textDecoration: 'none' }}>Editor</Link>
          <Link href="/glossary" style={{ color: '#888', textDecoration: 'none' }}>Glossary</Link>
        </nav>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>

        {/* Main tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, background: '#1a1a22', borderRadius: 10, padding: 4 }}>
          {[
            { key: 'translate', label: '📄 SRT Translate' },
            { key: 'submit', label: '🚀 Full Pipeline' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as Tab)}
              style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                background: tab === t.key ? '#7c6af7' : 'transparent',
                color: tab === t.key ? '#fff' : '#888' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TRANSLATE TAB ── */}
        {tab === 'translate' && (
          <div>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>SRT paste ဒါမှမဟုတ် URL → Myanmar + English .srt download</p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, background: '#1a1a22', borderRadius: 8, padding: 4, width: 'fit-content' }}>
              {(['paste', 'url'] as InputMode[]).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  style={{ padding: '7px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                    background: mode === m ? '#7c6af7' : 'transparent', color: mode === m ? '#fff' : '#888' }}>
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
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #2a2a32', background: '#0e0e12', color: '#e8e6de', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>SRT / VTT paste လုပ်ပါ</label>
                  <textarea value={pastedSrt} onChange={e => setPastedSrt(e.target.value)}
                    placeholder={"1\n00:00:01,000 --> 00:00:03,000\n你好世界"}
                    rows={7}
                    style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #2a2a32', background: '#0e0e12', color: '#e8e6de', fontSize: 13, fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
              )}
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ fontSize: 13, color: '#888' }}>Glossary</label>
                <select value={glossaryId} onChange={e => setGlossaryId(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #2a2a32', background: '#0e0e12', color: '#e8e6de', fontSize: 14, outline: 'none' }}>
                  <option value="">None</option>
                  {glossaries.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <Link href="/glossary" style={{ fontSize: 13, color: '#7c6af7', textDecoration: 'none' }}>+ Edit</Link>
              </div>
            </div>

            <button onClick={handleTranslate} disabled={status === 'downloading' || status === 'translating'}
              style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                background: status === 'downloading' || status === 'translating' ? '#3a3a52' : '#7c6af7',
                color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
              {status === 'downloading' ? '⏳ Downloading...' : status === 'translating' ? '🔄 Translating...' : 'Translate →'}
            </button>

            {(status === 'downloading' || status === 'translating') && (
              <div style={{ marginTop: 14 }}>
                <div style={{ height: 4, background: '#2a2a32', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: '#7c6af7', transition: 'width 0.3s', borderRadius: 2 }} />
                </div>
                <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>{message}</p>
              </div>
            )}

            {status === 'error' && (
              <div style={{ marginTop: 14, padding: '14px', background: '#2a1515', border: '1px solid #5a2222', borderRadius: 8, color: '#ff8080', fontSize: 14 }}>
                ❌ {message}
              </div>
            )}

            {status === 'done' && lines.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ padding: '12px 16px', background: '#122212', border: '1px solid #1e4a1e', borderRadius: 8, marginBottom: 14, fontSize: 14, color: '#6ab86a' }}>
                  ✅ {lines.length} lines translated
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <button onClick={() => downloadFile(engSrt, `${safeName}.en.srt`)}
                    style={{ padding: '13px', borderRadius: 10, border: '1px solid #2a2a32', background: '#16161e', color: '#e8e6de', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
                    ⬇ English .srt
                  </button>
                  <button onClick={() => downloadFile(mySrt, `${safeName}.my.srt`)}
                    style={{ padding: '13px', borderRadius: 10, border: 'none', background: '#7c6af7', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                    ⬇ Myanmar .srt
                  </button>
                </div>
                <Link href="/editor"
                  style={{ display: 'block', textAlign: 'center', padding: '11px', borderRadius: 10, border: '1px solid #2a2a3e', color: '#b8a8ff', textDecoration: 'none', fontSize: 14 }}>
                  ✏️ Editor မှာ review →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── FULL PIPELINE TAB ── */}
        {tab === 'submit' && (
          <div>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>
              URL ထည့်ပေးရုံနဲ့ — subtitle translate + recap + highlights + captions အကုန် generate လုပ်ပေးမယ်
            </p>

            <div style={{ background: '#16161e', border: '1px solid #2a2a32', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>Video URL *</label>
                <input value={submitUrl} onChange={e => setSubmitUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #2a2a32', background: '#0e0e12', color: '#e8e6de', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>Title (optional)</label>
                <input value={submitTitle} onChange={e => setSubmitTitle(e.target.value)}
                  placeholder="Renegade Immortal Episode 146"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #2a2a32', background: '#0e0e12', color: '#e8e6de', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>
                  Telegram Chat ID <span style={{ color: '#555' }}>(ပြီးရင် Telegram မှာ notify ရမယ်)</span>
                </label>
                <input value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)}
                  placeholder="123456789"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #2a2a32', background: '#0e0e12', color: '#e8e6de', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
                <p style={{ fontSize: 12, color: '#555', marginTop: 6 }}>@userinfobot ကို message ပို့ရင် ID ရမယ်</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ fontSize: 13, color: '#888' }}>Glossary</label>
                <select value={glossaryId} onChange={e => setGlossaryId(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #2a2a32', background: '#0e0e12', color: '#e8e6de', fontSize: 14, outline: 'none' }}>
                  <option value="">None</option>
                  {glossaries.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={submitStatus === 'processing'}
              style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                background: submitStatus === 'processing' ? '#3a3a52' : '#7c6af7',
                color: '#fff', fontSize: 16, fontWeight: 600, cursor: submitStatus === 'processing' ? 'not-allowed' : 'pointer' }}>
              {submitStatus === 'processing' ? '⏳ Processing... (1-2 mins)' : '🚀 Generate All →'}
            </button>

            {submitStatus === 'processing' && (
              <div style={{ marginTop: 14, padding: '14px', background: '#16161e', borderRadius: 8, fontSize: 13, color: '#888' }}>
                <p>⏳ Subtitle download လုပ်နေတယ်...</p>
                <p>🔄 Myanmar translate လုပ်နေတယ်...</p>
                <p>✍️ Recap + Highlights generate လုပ်နေတယ်...</p>
                <p style={{ color: '#555', marginTop: 8 }}>1-3 minutes လောက် ကြာနိုင်တယ်</p>
              </div>
            )}

            {submitStatus === 'error' && (
              <div style={{ marginTop: 14, padding: '14px', background: '#2a1515', border: '1px solid #5a2222', borderRadius: 8, color: '#ff8080', fontSize: 14 }}>
                ❌ {submitError}
              </div>
            )}

            {submitStatus === 'done' && submitResult && (
              <div style={{ marginTop: 20 }}>
                <div style={{ padding: '12px 16px', background: '#122212', border: '1px solid #1e4a1e', borderRadius: 8, marginBottom: 16, fontSize: 14, color: '#6ab86a' }}>
                  ✅ {submitResult.title} — {submitResult.lines} lines translated
                </div>

                {/* Downloads */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <a href={submitResult.downloads.mmUrl} download
                    style={{ padding: '13px', borderRadius: 10, border: 'none', background: '#7c6af7', color: '#fff', fontSize: 14, fontWeight: 600, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                    ⬇ Myanmar .srt
                  </a>
                  <a href={submitResult.downloads.enUrl} download
                    style={{ padding: '13px', borderRadius: 10, border: '1px solid #2a2a32', background: '#16161e', color: '#e8e6de', fontSize: 14, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                    ⬇ English .srt
                  </a>
                  <a href={submitResult.downloads.recapUrl} download
                    style={{ padding: '13px', borderRadius: 10, border: '1px solid #2a2a32', background: '#16161e', color: '#e8e6de', fontSize: 14, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                    📝 Recap
                  </a>
                  <a href={submitResult.downloads.highlightsUrl} download
                    style={{ padding: '13px', borderRadius: 10, border: '1px solid #2a2a32', background: '#16161e', color: '#e8e6de', fontSize: 14, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                    🎯 Highlights
                  </a>
                  <a href={submitResult.downloads.captionsUrl} download
                    style={{ padding: '13px', borderRadius: 10, border: '1px solid #2a2a32', background: '#16161e', color: '#e8e6de', fontSize: 14, textAlign: 'center', textDecoration: 'none', display: 'block', gridColumn: '1/-1' }}>
                    📱 Captions + Hashtags
                  </a>
                </div>

                {/* Recap preview */}
                {submitResult.recap && (
                  <div style={{ background: '#16161e', border: '1px solid #2a2a32', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <p style={{ fontSize: 13, color: '#7c6af7', marginBottom: 8, fontWeight: 600 }}>📝 Recap</p>
                    <p style={{ fontSize: 14, color: '#c8c0f0', lineHeight: 1.6 }}>{submitResult.recap.slice(0, 400)}...</p>
                  </div>
                )}

                {/* Highlights preview */}
                {submitResult.highlights && (
                  <div style={{ background: '#16161e', border: '1px solid #2a2a32', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <p style={{ fontSize: 13, color: '#f7a06a', marginBottom: 8, fontWeight: 600 }}>🎯 Highlights</p>
                    <p style={{ fontSize: 13, color: '#e8d0b0', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{submitResult.highlights.slice(0, 500)}</p>
                  </div>
                )}

                {/* Captions preview */}
                {submitResult.captions && (
                  <div style={{ background: '#16161e', border: '1px solid #2a2a32', borderRadius: 10, padding: 16 }}>
                    <p style={{ fontSize: 13, color: '#6af7b0', marginBottom: 8, fontWeight: 600 }}>📱 Captions + Hashtags</p>
                    <p style={{ fontSize: 13, color: '#b0e8d0', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{submitResult.captions.slice(0, 500)}</p>
                  </div>
                )}

                <p style={{ fontSize: 12, color: '#555', marginTop: 12, textAlign: 'center' }}>⚠️ Download links 24h သာ ရမယ်</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
