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
    /shorts\/([a-zA-Z0-9_-]{11})/,
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

async function downloadTranscript(url: string): Promise<string> {
  const videoId = extractYouTubeId(url)
  const queryUrl = videoId 
    ? `https://www.youtube.com/watch?v=${videoId}`
    : url

  // Try Chinese first, then English
  for (const lang of ['cn', 'en', 'auto']) {
    try {
      const res = await fetch(
        `https://solid-ap.p.rapidapi.com/api/transcript-with-url?url=${encodeURIComponent(queryUrl)}&lang=${lang}`,
        {
          headers: {
            'x-rapidapi-host': 'solid-ap.p.rapidapi.com',
            'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
          },
        }
      )

      if (!res.ok) continue

      const data = await res.json()
      console.log(`Got transcript lang=${lang}, type:`, typeof data)

      // Convert to SRT
      const items = Array.isArray(data) ? data : data.transcript || data.content || []
      if (!items.length) continue

      const srtLines = items.map((item: any, i: number) => {
        const startMs = Math.round((item.offset || item.start || 0) * 1000)
        const durMs = Math.round((item.duration || 3) * 1000)
        const text = (item.text || item.content || '').replace(/\n/g, ' ').trim()
        if (!text) return null
        return `${i + 1}\n${msToSrtTime(startMs)} --> ${msToSrtTime(startMs + durMs)}\n${text}`
      }).filter(Boolean)

      if (srtLines.length > 0) {
        return srtLines.join('\n\n')
      }
    } catch (e) {
      console.log(`lang=${lang} error:`, e)
    }
  }

  throw new Error('Transcript မတွေ့ဘူး — SRT paste mode သုံးပါ')
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
  const isEnglish = !content.match(/[\u4e00-\u9fff]/)
  const glossary = getGlossary(glossaryId || (isEnglish ? 'default-english' : 'default-donghua'))
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

    const srtContent = await downloadTranscript(url)
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
