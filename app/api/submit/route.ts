import { NextRequest, NextResponse } from 'next/server'
import { uploadToB2, getSignedDownloadUrl } from '@/lib/b2'
import { sendMessage } from '@/lib/telegram'
import { parseSrt, parseVtt, chunkLines, linesToText, parseTranslatedText } from '@/lib/srt'
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

const RAPID_HOST = 'youtube-captions-transcript-subtitles-video-combiner.p.rapidapi.com'

async function downloadSubtitle(url: string): Promise<string> {
  const videoId = extractYouTubeId(url)
  if (!videoId) throw new Error('YouTube URL မဟုတ်ဘူး')

  const key = process.env.RAPIDAPI_KEY!
  const headers = {
    'Content-Type': 'application/json',
    'x-rapidapi-host': RAPID_HOST,
    'x-rapidapi-key': key,
  }

  // Step 1: Get available languages
  let targetLang = 'en'
  try {
    const langRes = await fetch(
      `https://${RAPID_HOST}/language-list/${videoId}`,
      { headers }
    )
    if (langRes.ok) {
      const langs = await langRes.json()
      console.log('Langs:', JSON.stringify(langs).slice(0, 300))
      const priority = ['zh-Hans', 'zh', 'zh-CN', 'en']
      if (Array.isArray(langs)) {
        for (const p of priority) {
          const found = langs.find((l: any) =>
            (l.languageCode || l.lang || l || '').toLowerCase().startsWith(p.toLowerCase())
          )
          if (found) {
            targetLang = found.languageCode || found.lang || found
            break
          }
        }
      }
    }
  } catch (e) {
    console.log('Lang list error:', e)
  }

  console.log('Target lang:', targetLang)

  // Step 2: Download SRT
  const srtRes = await fetch(
    `https://${RAPID_HOST}/download-srt/${videoId}?language=${targetLang}&response_mode=default`,
    { headers }
  )

  console.log('SRT status:', srtRes.status)

  if (!srtRes.ok) {
    // Fallback English
    const enRes = await fetch(
      `https://${RAPID_HOST}/download-srt/${videoId}?language=en&response_mode=default`,
      { headers }
    )
    if (!enRes.ok) {
      throw new Error(`Subtitle မတွေ့ဘူး (${enRes.status})`)
    }
    return enRes.text()
  }

  const content = await srtRes.text()
  if (!content || content.length < 50) throw new Error('Subtitle empty')
  return content
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
  const lines = content.trim().startsWith('WEBVTT') ? parseVtt(content) : parseSrt(content)
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
