import { NextRequest, NextResponse } from 'next/server'
import { uploadToB2, getSignedDownloadUrl } from '@/lib/b2'
import { sendMessage } from '@/lib/telegram'
import { parseSrt, chunkLines, linesToText, parseTranslatedText } from '@/lib/srt'
import { buildTranslatePrompt, getGlossary } from '@/lib/glossary'
import { SrtLine } from '@/types'
import { randomUUID } from 'crypto'

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const mil = ms % 1000
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(mil).padStart(3,'0')}`
}

async function downloadSubtitle(url: string): Promise<string> {
  const videoId = extractYouTubeId(url)
  if (!videoId) throw new Error('YouTube URL မဟုတ်ဘူး')

  // RapidAPI - YouTube Transcript API
  const rapidApiKey = process.env.RAPIDAPI_KEY
  if (!rapidApiKey) throw new Error('RAPIDAPI_KEY not set')

  const res = await fetch(
    `https://youtube-transcripts.p.rapidapi.com/youtube/transcript?url=https://www.youtube.com/watch?v=${videoId}&chunkSize=500`,
    {
      headers: {
        'x-rapidapi-host': 'youtube-transcripts.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey,
      },
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Transcript API error: ${res.status} — ${err.slice(0, 100)}`)
  }

  const data = await res.json()

  // Convert to SRT
  const content = data.content || data.transcript || []
  if (!content.length) throw new Error('Subtitle မတွေ့ဘူး')

  const srtLines = content.map((item: any, i: number) => {
    const startMs = Math.round((item.offset || item.start || 0) * 1000)
    const durMs = Math.round((item.duration || 3) * 1000)
    const endMs = startMs + durMs
    const text = (item.text || '').replace(/\n/g, ' ').trim()
    return `${i + 1}\n${msToSrtTime(startMs)} --> ${msToSrtTime(endMs)}\n${text}`
  }).filter((l: string) => l.split('\n')[2]?.trim())

  return srtLines.join('\n\n')
}

async function callGemini(prompt: string): Promise<string> {
  for (const model of ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 4096 } }) }
      )
      if (res.ok) {
        const d = await res.json()
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (text) return text
      }
    } catch {}
  }
  throw new Error('Gemini failed')
}

async function translateSrt(content: string, glossaryId?: string): Promise<SrtLine[]> {
  const lines = parseSrt(content)
  if (!lines.length) throw new Error('Could not parse subtitle')
  const glossary = getGlossary(glossaryId || 'default-english')
  const chunks = chunkLines(lines, 60)
  let all: SrtLine[] = []
  for (const chunk of chunks) {
    const raw = await callGemini(buildTranslatePrompt(linesToText(chunk), glossary))
    all = [...all, ...parseTranslatedText(raw, chunk)]
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 300))
  }
  return all
}

async function generateContent(lines: SrtLine[], title: string) {
  const text = lines.map(l => l.translated || l.text).join('\n').slice(0, 6000)
  const [recap, highlights, captions] = await Promise.all([
    callGemini(`"${title}" ဇာတ်လမ်း၏ Myanmar ဘာသာဖြင့် 150 စကားလုံး recap ရေးပါ။\n${text}`),
    callGemini(`"${title}" မှ အကောင်းဆုံး moments 5 ခုကို timestamp နဲ့ Myanmar ဘာသာဖြင့်။\nFormat: [timestamp] - ဖော်ပြချက်\n${text}`),
    callGemini(`"${title}" အတွက် TikTok/Facebook Myanmar captions 3 ခု နှင့် hashtags 10 ခု။ Emoji ထည့်ပါ။\n${text.slice(0, 2000)}`),
  ])
  return { recap, highlights, captions }
}

function formatSrtFile(lines: SrtLine[], translated: boolean) {
  return lines.map((l, i) =>
    `${i + 1}\n${l.startTime} --> ${l.endTime}\n${translated && l.translated ? l.translated : l.text}`
  ).join('\n\n')
}

export async function POST(req: NextRequest) {
  try {
    const { url, title, telegram_chat_id, glossaryId } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const srtContent = await downloadSubtitle(url)
    const videoTitle = title || 'Video'
    const lines = await translateSrt(srtContent, glossaryId)
    const { recap, highlights, captions } = await generateContent(lines, videoTitle)

    const jobId = randomUUID().slice(0, 8)
    const keys = {
      en: `jobs/${jobId}/subtitle.en.srt`,
      mm: `jobs/${jobId}/subtitle.mm.srt`,
      recap: `jobs/${jobId}/recap.txt`,
      highlights: `jobs/${jobId}/highlights.txt`,
      captions: `jobs/${jobId}/captions.txt`,
    }

    await Promise.all([
      uploadToB2(keys.en, formatSrtFile(lines, false)),
      uploadToB2(keys.mm, formatSrtFile(lines, true)),
      uploadToB2(keys.recap, recap),
      uploadToB2(keys.highlights, highlights),
      uploadToB2(keys.captions, captions),
    ])

    const [enUrl, mmUrl, recapUrl, highlightsUrl, captionsUrl] = await Promise.all([
      getSignedDownloadUrl(keys.en),
      getSignedDownloadUrl(keys.mm),
      getSignedDownloadUrl(keys.recap),
      getSignedDownloadUrl(keys.highlights),
      getSignedDownloadUrl(keys.captions),
    ])

    if (telegram_chat_id) {
      await sendMessage(telegram_chat_id,
        `✅ <b>${videoTitle}</b> ပြီးပြီ!\n\n📥 Download (24h):\n🇲🇲 <a href="${mmUrl}">Myanmar .srt</a>\n🇬🇧 <a href="${enUrl}">English .srt</a>\n📝 <a href="${recapUrl}">Recap</a>\n🎯 <a href="${highlightsUrl}">Highlights</a>\n📱 <a href="${captionsUrl}">Captions</a>`
      )
    }

    return NextResponse.json({
      success: true, title: videoTitle, lines: lines.length,
      downloads: { enUrl, mmUrl, recapUrl, highlightsUrl, captionsUrl },
      recap, highlights, captions,
    })

  } catch (err: any) {
    console.error('Submit error:', err)
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
