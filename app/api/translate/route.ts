import { NextRequest, NextResponse } from 'next/server'
import { parseSrt, parseVtt, chunkLines, linesToText, parseTranslatedText } from '@/lib/srt'
import { getGlossary, buildTranslatePrompt } from '@/lib/glossary'
import { SrtLine } from '@/types'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'deepseek/deepseek-chat:free'

async function translate(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
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
      return NextResponse.json({ error: 'Could not parse subtitle file' }, { status: 400 })
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
