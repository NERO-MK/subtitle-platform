import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseSrt, parseVtt, chunkLines, linesToText, parseTranslatedText } from '@/lib/srt'
import { getGlossary, buildTranslatePrompt } from '@/lib/glossary'
import { SrtLine } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { srtContent, glossaryId } = await req.json()

    if (!srtContent || typeof srtContent !== 'string') {
      return NextResponse.json({ error: 'SRT content required' }, { status: 400 })
    }

    // Parse SRT or VTT
    let lines: SrtLine[]
    if (srtContent.trim().startsWith('WEBVTT')) {
      lines = parseVtt(srtContent)
    } else {
      lines = parseSrt(srtContent)
    }

    if (!lines.length) {
      return NextResponse.json({ error: 'Could not parse subtitle file' }, { status: 400 })
    }

    // Load glossary if provided
    const glossary = glossaryId ? getGlossary(glossaryId) : undefined

    // Split into chunks of 80 lines to stay within Claude's context
    const chunks = chunkLines(lines, 80)
    let allTranslatedLines: SrtLine[] = []

    for (const chunk of chunks) {
      const prompt = buildTranslatePrompt(linesToText(chunk), glossary)

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })

      const rawOutput = message.content
        .filter(b => b.type === 'text')
        .map(b => (b as any).text)
        .join('\n')

      const translatedChunk = parseTranslatedText(rawOutput, chunk)
      allTranslatedLines = [...allTranslatedLines, ...translatedChunk]
    }

    return NextResponse.json({ lines: allTranslatedLines })

  } catch (err: any) {
    console.error('Translate error:', err)

    if (err?.status === 401) {
      return NextResponse.json({ error: 'Invalid Anthropic API key' }, { status: 500 })
    }
    if (err?.status === 429) {
      return NextResponse.json({ error: 'Rate limit hit. Please wait a moment.' }, { status: 429 })
    }

    return NextResponse.json(
      { error: err?.message || 'Translation failed' },
      { status: 500 }
    )
  }
}
