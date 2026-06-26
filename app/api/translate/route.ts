import { NextRequest, NextResponse } from 'next/server'
import { parseSrt, parseVtt, chunkLines, linesToText, parseTranslatedText } from '@/lib/srt'
import { getGlossary, buildTranslatePrompt } from '@/lib/glossary'
import { SrtLine } from '@/types'

// Gemini API တိုက်ရိုက်သုံးမယ် - OpenRouter မလို
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite-preview-06-17',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
]

async function translateWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
          }),
        }
      )

      if (res.ok) {
        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (text) {
          console.log(`✓ Used: ${model}`)
          return text
        }
      }

      const err = await res.json().catch(() => ({}))
      console.warn(`✗ ${model}:`, err?.error?.message)

    } catch (e: any) {
      console.warn(`✗ ${model}:`, e.message)
    }
  }

  throw new Error('All Gemini models failed')
}

export async function POST(req: NextRequest) {
  try {
    const { srtContent, glossaryId } = await req.json()

    if (!srtContent) {
      return NextResponse.json({ error: 'SRT content required' }, { status: 400 })
    }

    let lines: SrtLine[]
    if (srtContent.trim().startsWith('WEBVTT')) {
      lines = parseVtt(srtContent)
    } else {
      lines = parseSrt(srtContent)
    }

    if (!lines.length) {
      return NextResponse.json({ error: 'Could not parse subtitle' }, { status: 400 })
    }

    const glossary = glossaryId ? getGlossary(glossaryId) : undefined
    const chunks = chunkLines(lines, 60)
    let allLines: SrtLine[] = []

    for (const chunk of chunks) {
      const prompt = buildTranslatePrompt(linesToText(chunk), glossary)
      const raw = await translateWithGemini(prompt)
      const translated = parseTranslatedText(raw, chunk)
      allLines = [...allLines, ...translated]

      if (chunks.length > 1) {
        await new Promise(r => setTimeout(r, 300))
      }
    }

    return NextResponse.json({ lines: allLines })

  } catch (err: any) {
    console.error('Translate error:', err)
    return NextResponse.json({ error: err.message || 'Translation failed' }, { status: 500 })
  }
}
