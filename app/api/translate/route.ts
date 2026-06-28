import { NextRequest, NextResponse } from 'next/server'
import { parseSrt, parseVtt, chunkLines, linesToText, parseTranslatedText } from '@/lib/srt'
import { getGlossary, buildTranslatePrompt } from '@/lib/glossary'
import { SrtLine } from '@/types'

async function tryGemini(prompt: string, model: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 4096 } }) }
  )
  if (!res.ok) throw new Error(`${res.status}`)
  const d = await res.json()
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text || ''
  if (!text) throw new Error('empty')
  return text
}

async function tryGroq(prompt: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error('no key')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 4096 }),
  })
  if (!res.ok) throw new Error(`groq ${res.status}`)
  const d = await res.json()
  const text = d.choices?.[0]?.message?.content || ''
  if (!text) throw new Error('empty')
  return text
}

async function callAI(prompt: string): Promise<string> {
  const providers = [
    () => tryGemini(prompt, 'gemini-2.5-flash'),
    () => tryGemini(prompt, 'gemini-2.5-flash-lite-preview-06-17'),
    () => tryGemini(prompt, 'gemini-2.0-flash'),
    () => tryGemini(prompt, 'gemini-2.0-flash-lite'),
    () => tryGemini(prompt, 'gemini-1.5-flash-latest'),
    () => tryGroq(prompt),
  ]

  for (const fn of providers) {
    try {
      return await fn()
    } catch (e: any) {
      console.warn('AI failed:', e.message)
      if (e.message?.includes('429')) await new Promise(r => setTimeout(r, 800))
    }
  }
  throw new Error('All AI providers failed')
}

export async function POST(req: NextRequest) {
  try {
    const { srtContent, glossaryId } = await req.json()
    if (!srtContent) return NextResponse.json({ error: 'SRT content required' }, { status: 400 })

    let lines: SrtLine[]
    if (srtContent.trim().startsWith('WEBVTT')) {
      lines = parseVtt(srtContent)
    } else {
      lines = parseSrt(srtContent)
    }

    if (!lines.length) return NextResponse.json({ error: 'Could not parse subtitle' }, { status: 400 })

    const glossary = glossaryId ? getGlossary(glossaryId) : undefined
    const chunks = chunkLines(lines, 60)
    let allLines: SrtLine[] = []

    for (const chunk of chunks) {
      const prompt = buildTranslatePrompt(linesToText(chunk), glossary)
      const raw = await callAI(prompt)
      const translated = parseTranslatedText(raw, chunk)
      allLines = [...allLines, ...translated]
      if (chunks.length > 1) await new Promise(r => setTimeout(r, 500))
    }

    return NextResponse.json({ lines: allLines })

  } catch (err: any) {
    console.error('Translate error:', err)
    return NextResponse.json({ error: err.message || 'Translation failed' }, { status: 500 })
  }
}
