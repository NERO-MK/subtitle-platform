'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { SrtLine } from '@/types'
import { formatSrt } from '@/lib/srt'
import Link from 'next/link'

function timeToSeconds(t: string): number {
  const [h, m, s] = t.replace(',', '.').split(':')
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s)
}

export default function EditorPage() {
  const [lines, setLines] = useState<SrtLine[]>([])
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [videoSrc, setVideoSrc] = useState<string>('')
  const [currentLine, setCurrentLine] = useState<number | null>(null)
  const [showVideo, setShowVideo] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem('editor_lines')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) setLines(parsed)
      }
    } catch {}
    setLoaded(true)
  }, [])

  // Video time → subtitle highlight
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !lines.length) return
    const t = videoRef.current.currentTime
    const active = lines.find(l =>
      t >= timeToSeconds(l.startTime) && t <= timeToSeconds(l.endTime)
    )
    if (active && active.index !== currentLine) {
      setCurrentLine(active.index)
      // Auto scroll to active line
      lineRefs.current[active.index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [lines, currentLine])

  // Click line → jump video
  function jumpToLine(line: SrtLine) {
    if (videoRef.current) {
      videoRef.current.currentTime = timeToSeconds(line.startTime)
      videoRef.current.play()
    }
    setCurrentLine(line.index)
  }

  function handleVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setVideoSrc(url)
    setShowVideo(true)
  }

  function handleVideoUrl(url: string) {
    if (!url.trim()) return
    setVideoSrc(url)
    setShowVideo(true)
  }

  function updateLine(index: number, field: 'text' | 'translated', value: string) {
    setLines(prev => prev.map(l => l.index === index ? { ...l, [field]: value } : l))
    setSaved(false)
  }

  function save() {
    try {
      localStorage.setItem('editor_lines', JSON.stringify(lines))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
  }

  function downloadFile(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const filtered = search
    ? lines.filter(l =>
        l.text.toLowerCase().includes(search.toLowerCase()) ||
        (l.translated || '').includes(search)
      )
    : lines

  if (!loaded) return (
    <main style={{ minHeight: '100vh', background: '#0e0e12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#888' }}>Loading...</p>
    </main>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#0e0e12', color: '#e8e6de', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid #2a2a32', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, background: '#0e0e12', zIndex: 20, flexWrap: 'wrap' }}>
        <Link href="/" style={{ color: '#888', textDecoration: 'none', fontSize: 13 }}>← Back</Link>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Editor</span>
        <span style={{ fontSize: 12, color: '#555' }}>{lines.length} lines</span>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #2a2a32', background: '#16161e', color: '#e8e6de', fontSize: 13, outline: 'none', width: 140, marginLeft: 'auto' }}
        />
        <button onClick={() => setShowVideo(v => !v)}
          style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #2a2a32', background: showVideo ? '#2a1e52' : '#16161e', color: showVideo ? '#b8a8ff' : '#888', fontSize: 13, cursor: 'pointer' }}>
          {showVideo ? '🎬 Hide' : '🎬 Video'}
        </button>
        <button onClick={save}
          style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: saved ? '#1e4a1e' : '#2a2a3a', color: saved ? '#6ab86a' : '#ccc', fontSize: 13, cursor: 'pointer' }}>
          {saved ? '✓ Saved' : 'Save'}
        </button>
        <button onClick={() => downloadFile(formatSrt(lines, true), 'translated.my.srt')}
          style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#7c6af7', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
          ⬇ Myanmar .srt
        </button>
        <button onClick={() => downloadFile(formatSrt(lines, false), 'original.en.srt')}
          style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #2a2a32', background: '#16161e', color: '#ccc', fontSize: 13, cursor: 'pointer' }}>
          ⬇ English .srt
        </button>
      </header>

      {/* Video Panel */}
      {showVideo && (
        <div style={{ background: '#0a0a10', borderBottom: '1px solid #2a2a32', padding: 16 }}>
          {!videoSrc ? (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* File upload */}
              <label style={{ padding: '10px 18px', borderRadius: 8, border: '1px dashed #3a3a52', color: '#888', fontSize: 14, cursor: 'pointer', background: '#16161e' }}>
                📁 Device မှ video ရွေး
                <input type="file" accept="video/*" onChange={handleVideoFile} style={{ display: 'none' }} />
              </label>

              {/* URL input */}
              <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 260 }}>
                <input
                  placeholder="Video URL paste လုပ်ပါ..."
                  onKeyDown={e => e.key === 'Enter' && handleVideoUrl((e.target as HTMLInputElement).value)}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #2a2a32', background: '#16161e', color: '#e8e6de', fontSize: 14, outline: 'none' }}
                />
                <button
                  onClick={e => {
                    const input = (e.currentTarget.previousSibling as HTMLInputElement)
                    handleVideoUrl(input.value)
                  }}
                  style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#7c6af7', color: '#fff', fontSize: 14, cursor: 'pointer' }}>
                  Load
                </button>
              </div>
            </div>
          ) : (
            <div>
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                onTimeUpdate={handleTimeUpdate}
                style={{ width: '100%', maxHeight: 320, borderRadius: 8, background: '#000' }}
              />
              {/* Current subtitle overlay */}
              {currentLine !== null && (
                <div style={{ textAlign: 'center', marginTop: 8, padding: '8px 16px', background: '#1a1a2e', borderRadius: 6 }}>
                  <p style={{ fontSize: 13, color: '#9090a0', marginBottom: 4 }}>
                    {lines.find(l => l.index === currentLine)?.text}
                  </p>
                  <p style={{ fontSize: 14, color: '#c8c0f0', fontWeight: 500 }}>
                    {lines.find(l => l.index === currentLine)?.translated || '—'}
                  </p>
                </div>
              )}
              <button onClick={() => { setVideoSrc(''); setCurrentLine(null) }}
                style={{ marginTop: 8, padding: '6px 12px', borderRadius: 6, border: '1px solid #3a1515', background: 'transparent', color: '#884444', fontSize: 12, cursor: 'pointer' }}>
                ✕ Remove video
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {lines.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 24px', color: '#555' }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No subtitle loaded</p>
          <p style={{ fontSize: 14, marginBottom: 20, color: '#444' }}>Main page မှာ translate လုပ်ပြီးမှ editor ဖွင့်ပါ</p>
          <Link href="/" style={{ color: '#7c6af7', textDecoration: 'none', fontSize: 14, padding: '10px 20px', border: '1px solid #7c6af7', borderRadius: 8 }}>
            ← Translate လုပ်ဖို့ သွားမယ်
          </Link>
        </div>
      )}

      {/* Lines */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '12px 12px 80px' }}>
        {filtered.map(line => {
          const isActive = currentLine === line.index
          return (
            <div
              key={line.index}
              ref={el => { lineRefs.current[line.index] = el }}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 100px 1fr 1fr',
                gap: 8,
                padding: '10px 8px',
                borderBottom: '1px solid #1a1a22',
                alignItems: 'start',
                background: isActive ? '#1a1830' : 'transparent',
                borderRadius: isActive ? 8 : 0,
                transition: 'background 0.2s',
              }}
            >
              {/* Index + jump button */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 8 }}>
                <span style={{ fontSize: 11, color: '#444' }}>{line.index}</span>
                {videoSrc && (
                  <button
                    onClick={() => jumpToLine(line)}
                    title="Jump to this line"
                    style={{ padding: '2px 5px', borderRadius: 4, border: 'none', background: isActive ? '#7c6af7' : '#2a2a3a', color: isActive ? '#fff' : '#666', fontSize: 10, cursor: 'pointer' }}>
                    ▶
                  </button>
                )}
              </div>

              {/* Timestamp */}
              <div style={{ paddingTop: 8, cursor: videoSrc ? 'pointer' : 'default' }} onClick={() => jumpToLine(line)}>
                <span style={{ fontSize: 10, color: isActive ? '#b8a8ff' : '#555', fontFamily: 'monospace', display: 'block' }}>
                  {line.startTime.slice(0, 8)}
                </span>
                <span style={{ fontSize: 10, color: '#444', fontFamily: 'monospace' }}>
                  → {line.endTime.slice(0, 8)}
                </span>
              </div>

              {/* Original */}
              <textarea
                value={line.text}
                onChange={e => updateLine(line.index, 'text', e.target.value)}
                rows={2}
                style={{
                  padding: '7px', borderRadius: 6,
                  border: `1px solid ${isActive ? '#3a3a5e' : '#1e1e2a'}`,
                  background: '#13131a', color: '#9090a0', fontSize: 13,
                  resize: 'vertical', outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
              />

              {/* Myanmar translation */}
              <textarea
                value={line.translated || ''}
                onChange={e => updateLine(line.index, 'translated', e.target.value)}
                rows={2}
                placeholder="Myanmar..."
                style={{
                  padding: '7px', borderRadius: 6,
                  border: `1px solid ${isActive ? '#4a3a7e' : '#2a2a3e'}`,
                  background: '#14141e', color: '#c8c0f0', fontSize: 13,
                  resize: 'vertical', outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
              />
            </div>
          )
        })}
      </div>
    </main>
  )
}
