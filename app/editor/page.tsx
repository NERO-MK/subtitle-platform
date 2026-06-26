'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { SrtLine } from '@/types'
import { formatSrt } from '@/lib/srt'
import Link from 'next/link'

function timeToSeconds(t: string): number {
  const [h, m, s] = t.replace(',', '.').split(':')
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s)
}

function secondsToTime(s: number): string {
  if (s < 0) s = 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = (s % 60).toFixed(3).padStart(6, '0')
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${sec.replace('.', ',')}`
}

function shiftTime(t: string, delta: number): string {
  return secondsToTime(Math.max(0, timeToSeconds(t) + delta))
}

export default function EditorPage() {
  const [lines, setLines] = useState<SrtLine[]>([])
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [videoSrc, setVideoSrc] = useState('')
  const [currentLine, setCurrentLine] = useState<number | null>(null)
  const [showVideo, setShowVideo] = useState(false)
  const [globalShift, setGlobalShift] = useState('')
  const [showShift, setShowShift] = useState(false)
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

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !lines.length) return
    const t = videoRef.current.currentTime
    const active = lines.find(l =>
      t >= timeToSeconds(l.startTime) && t <= timeToSeconds(l.endTime)
    )
    if (active && active.index !== currentLine) {
      setCurrentLine(active.index)
      lineRefs.current[active.index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [lines, currentLine])

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
    setVideoSrc(URL.createObjectURL(file))
    setShowVideo(true)
  }

  function updateLine(index: number, field: keyof SrtLine, value: string) {
    setLines(prev => prev.map(l => l.index === index ? { ...l, [field]: value } : l))
    setSaved(false)
  }

  // Global shift — အကုန် +/- seconds
  function applyGlobalShift() {
    const delta = parseFloat(globalShift)
    if (isNaN(delta)) return
    setLines(prev => prev.map(l => ({
      ...l,
      startTime: shiftTime(l.startTime, delta),
      endTime: shiftTime(l.endTime, delta),
    })))
    setGlobalShift('')
    setSaved(false)
  }

  // Per-line timing nudge buttons (+/- 0.1s, 0.5s, 1s)
  function nudgeLine(index: number, field: 'startTime' | 'endTime', delta: number) {
    setLines(prev => prev.map(l =>
      l.index === index ? { ...l, [field]: shiftTime(l[field], delta) } : l
    ))
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
      <header style={{ borderBottom: '1px solid #2a2a32', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: 0, background: '#0e0e12', zIndex: 20, flexWrap: 'wrap' }}>
        <Link href="/" style={{ color: '#888', textDecoration: 'none', fontSize: 13 }}>← Back</Link>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Editor</span>
        <span style={{ fontSize: 12, color: '#555' }}>{lines.length} lines</span>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #2a2a32', background: '#16161e', color: '#e8e6de', fontSize: 13, outline: 'none', width: 120 }}
        />

        <button onClick={() => setShowShift(v => !v)}
          style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #2a2a32', background: showShift ? '#1e2a1e' : '#16161e', color: showShift ? '#6af7a0' : '#888', fontSize: 13, cursor: 'pointer' }}>
          ⏱ Timing
        </button>

        <button onClick={() => setShowVideo(v => !v)}
          style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #2a2a32', background: showVideo ? '#2a1e52' : '#16161e', color: showVideo ? '#b8a8ff' : '#888', fontSize: 13, cursor: 'pointer' }}>
          {showVideo ? '🎬 Hide' : '🎬 Video'}
        </button>

        <button onClick={save}
          style={{ padding: '7px 12px', borderRadius: 6, border: 'none', background: saved ? '#1e4a1e' : '#2a2a3a', color: saved ? '#6ab86a' : '#ccc', fontSize: 13, cursor: 'pointer' }}>
          {saved ? '✓' : 'Save'}
        </button>

        <button onClick={() => downloadFile(formatSrt(lines, true), 'myanmar.srt')}
          style={{ padding: '7px 12px', borderRadius: 6, border: 'none', background: '#7c6af7', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
          ⬇ Myanmar .srt
        </button>

        <button onClick={() => downloadFile(formatSrt(lines, false), 'english.srt')}
          style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #2a2a32', background: '#16161e', color: '#ccc', fontSize: 13, cursor: 'pointer' }}>
          ⬇ English .srt
        </button>
      </header>

      {/* Global Timing Shift Panel */}
      {showShift && (
        <div style={{ background: '#0f1a0f', borderBottom: '1px solid #1e3a1e', padding: '14px 16px' }}>
          <p style={{ fontSize: 13, color: '#6af7a0', marginBottom: 10, fontWeight: 500 }}>⏱ Global Timing Shift — subtitle အကုန် ရွှေ့မယ်</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Quick shift buttons */}
            {[-5, -2, -1, -0.5, 0.5, 1, 2, 5].map(d => (
              <button key={d}
                onClick={() => {
                  const delta = d
                  setLines(prev => prev.map(l => ({
                    ...l,
                    startTime: shiftTime(l.startTime, delta),
                    endTime: shiftTime(l.endTime, delta),
                  })))
                  setSaved(false)
                }}
                style={{
                  padding: '7px 12px', borderRadius: 6, border: '1px solid #2a3a2a',
                  background: d < 0 ? '#1a0e0e' : '#0e1a0e',
                  color: d < 0 ? '#ff8080' : '#80ff80',
                  fontSize: 13, cursor: 'pointer', fontWeight: 500,
                }}>
                {d > 0 ? `+${d}s` : `${d}s`}
              </button>
            ))}

            {/* Custom shift */}
            <input
              value={globalShift}
              onChange={e => setGlobalShift(e.target.value)}
              placeholder="custom (e.g. -1.5)"
              style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #2a3a2a', background: '#0e0e12', color: '#e8e6de', fontSize: 13, outline: 'none', width: 140 }}
              onKeyDown={e => e.key === 'Enter' && applyGlobalShift()}
            />
            <button onClick={applyGlobalShift}
              style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#3a7a3a', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
              Apply
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#4a6a4a', marginTop: 8 }}>
            Video ထက် subtitle နောက်ကျနေရင် + value သုံး ။ စောနေရင် - value သုံး
          </p>
        </div>
      )}

      {/* Video Panel */}
      {showVideo && (
        <div style={{ background: '#0a0a10', borderBottom: '1px solid #2a2a32', padding: 14 }}>
          {!videoSrc ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ padding: '10px 16px', borderRadius: 8, border: '1px dashed #3a3a52', color: '#888', fontSize: 14, cursor: 'pointer', background: '#16161e' }}>
                📁 Device မှ video ရွေး
                <input type="file" accept="video/*" onChange={handleVideoFile} style={{ display: 'none' }} />
              </label>
            </div>
          ) : (
            <div>
              <video ref={videoRef} src={videoSrc} controls onTimeUpdate={handleTimeUpdate}
                style={{ width: '100%', maxHeight: 280, borderRadius: 8, background: '#000' }} />
              {currentLine !== null && (
                <div style={{ textAlign: 'center', marginTop: 8, padding: '8px 14px', background: '#1a1a2e', borderRadius: 6 }}>
                  <p style={{ fontSize: 12, color: '#9090a0', marginBottom: 4 }}>{lines.find(l => l.index === currentLine)?.text}</p>
                  <p style={{ fontSize: 15, color: '#c8c0f0', fontWeight: 600 }}>{lines.find(l => l.index === currentLine)?.translated || '—'}</p>
                </div>
              )}
              <button onClick={() => { setVideoSrc(''); setCurrentLine(null) }}
                style={{ marginTop: 8, padding: '5px 12px', borderRadius: 6, border: '1px solid #3a1515', background: 'transparent', color: '#884444', fontSize: 12, cursor: 'pointer' }}>
                ✕ Remove
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {lines.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#555' }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No subtitle loaded</p>
          <Link href="/" style={{ color: '#7c6af7', textDecoration: 'none', fontSize: 14, padding: '10px 20px', border: '1px solid #7c6af7', borderRadius: 8 }}>
            ← Translate လုပ်ဖို့ သွားမယ်
          </Link>
        </div>
      )}

      {/* Lines */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '12px 10px 100px' }}>
        {filtered.map(line => {
          const isActive = currentLine === line.index
          return (
            <div key={line.index} ref={el => { lineRefs.current[line.index] = el }}
              style={{ marginBottom: 8, padding: '10px', borderRadius: 8, border: `1px solid ${isActive ? '#3a3a6e' : '#1e1e2a'}`, background: isActive ? '#1a1830' : '#12121a', transition: 'all 0.15s' }}>

              {/* Top row: index + timestamps + jump */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: '#444', minWidth: 24 }}>#{line.index}</span>

                {/* Start time */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => nudgeLine(line.index, 'startTime', -0.1)}
                    style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #2a2a3a', background: '#1a0e0e', color: '#ff8080', fontSize: 11, cursor: 'pointer' }}>-</button>
                  <input value={line.startTime} onChange={e => updateLine(line.index, 'startTime', e.target.value)}
                    style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #2a2a3a', background: '#0e0e12', color: '#6af7a0', fontSize: 11, fontFamily: 'monospace', outline: 'none', width: 100 }} />
                  <button onClick={() => nudgeLine(line.index, 'startTime', 0.1)}
                    style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #2a2a3a', background: '#0e1a0e', color: '#80ff80', fontSize: 11, cursor: 'pointer' }}>+</button>
                </div>

                <span style={{ color: '#444', fontSize: 11 }}>→</span>

                {/* End time */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => nudgeLine(line.index, 'endTime', -0.1)}
                    style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #2a2a3a', background: '#1a0e0e', color: '#ff8080', fontSize: 11, cursor: 'pointer' }}>-</button>
                  <input value={line.endTime} onChange={e => updateLine(line.index, 'endTime', e.target.value)}
                    style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #2a2a3a', background: '#0e0e12', color: '#f0a060', fontSize: 11, fontFamily: 'monospace', outline: 'none', width: 100 }} />
                  <button onClick={() => nudgeLine(line.index, 'endTime', 0.1)}
                    style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #2a2a3a', background: '#0e1a0e', color: '#80ff80', fontSize: 11, cursor: 'pointer' }}>+</button>
                </div>

                {/* Jump button */}
                {videoSrc && (
                  <button onClick={() => jumpToLine(line)}
                    style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 5, border: 'none', background: isActive ? '#7c6af7' : '#2a2a3a', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                    ▶ Jump
                  </button>
                )}
              </div>

              {/* Text row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <textarea value={line.text} onChange={e => updateLine(line.index, 'text', e.target.value)}
                  rows={2}
                  style={{ padding: '7px', borderRadius: 6, border: '1px solid #1e1e2a', background: '#13131a', color: '#9090a0', fontSize: 13, resize: 'vertical', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                <textarea value={line.translated || ''} onChange={e => updateLine(line.index, 'translated', e.target.value)}
                  rows={2} placeholder="Myanmar..."
                  style={{ padding: '7px', borderRadius: 6, border: '1px solid #2a2a3e', background: '#14141e', color: '#c8c0f0', fontSize: 13, resize: 'vertical', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
