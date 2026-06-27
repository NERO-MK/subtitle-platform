import { NextRequest, NextResponse } from 'next/server'
import { uploadToB2, getSignedDownloadUrl } from '@/lib/b2'
import { sendMessage } from '@/lib/telegram'
import { parseSrt, parseVtt, chunkLines, linesToText, parseTranslatedText } from '@/lib/srt'
import { buildTranslatePrompt, getGlossary } from '@/lib/glossary'
import { SrtLine } from '@/types'
import { randomUUID } from 'crypto'

// cobalt.tools API — free, no binary needed
async function downloadSubtitle(url: string): Promise<string> {
  // Method 1: cobalt.tools မှာ video info ယူပြီး subtitle URL ရှာ
  // Method 2: YouTube transcript API သုံး
  
  // YouTube video ID ထုတ်မယ်
  const videoId = extractYouTubeId(url)
  if (!videoId) throw new Error('YouTube URL မဟုတ်ဘူး။ YouTube link သာ support လုပ်တယ်')

  // YouTube transcript ဆွဲမယ် (timedtext API)
  const langs = ['zh-Hans', 'zh', 'en']
  
  for (const lang of langs) {
    try {
      const transcriptUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`
      const res = await fetch(transcriptUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      })
      
      if (res.ok) {
        const text = await res.text()
        if (text && text.length > 100) {
          console.log(`Got transcript in ${lang}`)
          return convertTimedTextToSrt(text)
        }
      }
    } catch {}
  }

  // Auto-generated subtitle (asr)
  for (const lang of ['zh-Hans', 'zh', 'en']) {
    try {
      const asrUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&kind=asr&fmt=srv3`
      const res = await fetch(asrUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      })
      if (res.ok) {
        const text = await res.text()
        if (text && text.length > 100) {
          console.log(`Got ASR transcript in ${lang}`)
          return convertTimedTextToSrt(text)
        }
      }
    } catch {}
  }

  throw new Error('Subtitle မတွေ့ဘူး။ ဒီ video မှာ subtitle မပါဘူး ဖြစ်နိုင်တယ်')
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function convertTimedTextToSrt(xml: string): string {
  // Parse YouTube timedtext XML → SRT format
  const lines: string[] = []
  let index = 1

  // Match <p t="start" d="duration">text</p> or <s ac="0">text</s>
  const pRegex = /<p[^>]+t="(\d+)"[^>]+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g
  let match

  while ((match = pRegex.exec(xml)) !== null) {
    const startMs = parseInt(match[1])
    const durationMs = parseInt(match[2])
    const endMs = startMs + durationMs

    // Strip XML tags from text
    const text = match[3]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim()

    if (!text) continue

    const start = msToSrtTime(startMs)
    const end = msToSrtTime(endMs)

    lines.push(`${index}\n${start} --> ${end}\n${text}`)
    index++
  }

  if (!lines.length) throw new Error('Subtitle parse မဖြစ်ဘူး')
  return lines.join('\n\n')
}

function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const mil = ms % 1000
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(mil).padStart(3,'0')}`
}

async function callGemini(prompt: string): Promise<string> {
  for (const model of ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
  const glossary = getGlossary(glossaryId || 'default-donghua')
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
