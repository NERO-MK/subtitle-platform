import { NextRequest, NextResponse } from 'next/server'
import { parseSrt, parseVtt, chunkLines, linesToText, parseTranslatedText } from '@/lib/srt'
import { getGlossary, buildTranslatePrompt } from '@/lib/glossary'
import { SrtLine } from '@/types'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Free models - တစ်ခုမရရင် နောက်တစ်ခု auto fallback
const FREE_MODELS = [
  'google/gemini-2.5-flash:free',
  'google/gemini-2.5-flash-lite:free',
  'google/gemini-2.0-flash-exp:free',
  'google/gemini-flash-1.5:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
]

async function translate(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  let lastError = ''

  for (const model of FREE_MODELS) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: 0.3,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.choices?.[0]?.message?.content || ''
        if (text) {
          console.log(`✓ Used model: ${model}`)
          return text
        }
      }

      const err = await res.json().catch(() => ({}))
      lastError = err?.error?.message || `HTTP ${res.status}`
      console.warn(`✗ ${model}: ${lastError}`)

    } catch (e: any) {
      lastError = e.message
      console.warn(`✗ ${model}: ${lastError}`)
    }
  }

  throw new Error(`All models failed. Last error: ${lastError}`)
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
      const raw = await translate(prompt)
      const translated = parseTranslatedText(raw, chunk)
      allLines = [...allLines, ...translated]

      if (chunks.length > 1) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    return NextResponse.json({ lines: allLines })

  } catch (err: any) {
    console.error('Translate error:', err)
    return NextResponse.json({ error: err.message || 'Translation failed' }, { status: 500 })
  }
}
