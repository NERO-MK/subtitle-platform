import { NextRequest, NextResponse } from 'next/server'
import { uploadToB2, getSignedDownloadUrl } from '@/lib/b2'
import { sendMessage } from '@/lib/telegram'
import { parseSrt, parseVtt, chunkLines, linesToText, parseTranslatedText } from '@/lib/srt'
import { buildTranslatePrompt, getGlossary } from '@/lib/glossary'
import { SrtLine } from '@/types'
import { randomUUID } from 'crypto'

// ── AI providers ───────────────────────────────────────────
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
  if (!process.env.GROQ_API_KEY) throw new Error('no groq key')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 4096 }),
  })
  if (!res.ok) throw new Error(`groq ${res.status}`)
  const d = await res.json()
  const text = d.choices?.[0]?.message?.content || ''
  if (!text) throw new Error('groq empty')
  return text
}

async function callAI(prompt: string): Promise<string> {
  const models = [
    { name: 'gemini-2.5-flash',                    fn: () => tryGemini(prompt, 'gemini-2.5-flash') },
    { name: 'gemini-2.5-flash-lite',               fn: () => tryGemini(prompt, 'gemini-2.5-flash-lite-preview-06-17') },
    { name: 'gemini-2.0-flash',                    fn: () => tryGemini(prompt, 'gemini-2.0-flash') },
    { name: 'gemini-2.0-flash-lite',               fn: () => tryGemini(prompt, 'gemini-2.0-flash-lite') },
    { name: 'gemini-1.5-flash',                    fn: () => tryGemini(prompt, 'gemini-1.5-flash') },
    { name: 'groq-llama-3.3-70b',                  fn: () => tryGroq(prompt) },
  ]

  for (const m of models) {
    try {
      const result = await m.fn()
      console.log(`✓ AI: ${m.name}`)
      return result
    } catch (e: any) {
      console.warn(`✗ AI ${m.name}: ${e.message}`)
      if (e.message?.includes('429') || e.message?.includes('quota')) {
        await new Promise(r => setTimeout(r, 800))
      }
    }
  }
  throw new Error('All AI providers failed')
}

// ── YouTube subtitle download ──────────────────────────────
function extractYouTubeId(url: string): string | null {
  const patterns = [/[?&]v=([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/, /embed\/([a-zA-Z0-9_-]{11})/, /shorts\/([a-zA-Z0-9_-]{11})/]
  for (const p of patterns) { const m = url.match(p); if (m) return m[1] }
  return null
}

const RAPID_HOST = 'youtube-captions-transcript-subtitles-video-combiner.p.rapidapi.com'

async function downloadSubtitle(url: string): Promise<string> {
  const videoId = extractYouTubeId(url)
  if (!videoId) throw new Error('YouTube URL မဟုတ်ဘူး')

  const headers = { 'Content-Type': 'application/json', 'x-rapidapi-host': RAPID_HOST, 'x-rapidapi-key': process.env.RAPIDAPI_KEY! }

  // Get available languages
  let targetLang = 'en'
  try {
    const langRes = await fetch(`https://${RAPID_HOST}/language-list/${videoId}`, { headers })
    if (langRes.ok) {
      const langs = await langRes.json()
      const priority = ['zh-Hans', 'zh', 'zh-CN', 'en']
      if (Array.isArray(langs)) {
        for (const p of priority) {
          const found = langs.find((l: any) => (l.languageCode || '').toLowerCase().startsWith(p.toLowerCase()))
          if (found) { targetLang = found.languageCode; break }
        }
      }
    }
  } catch {}

  console.log('Target lang:', targetLang)

  // Download SRT
  for (const lang of [targetLang, 'en']) {
    const res = await fetch(`https://${RAPID_HOST}/download-srt/${videoId}?language=${lang}&response_mode=default`, { headers })
    console.log(`SRT status (${lang}):`, res.status)
    if (res.ok) {
      const content = await res.text()
      if (content && content.length > 50) return content
    }
  }
  throw new Error('Subtitle မတွေ့ဘူး — SRT paste mode သုံးပါ')
}

// ── Translate ──────────────────────────────────────────────
async function translateSrt(content: string, glossaryId?: string): Promise<SrtLine[]> {
  const lines = content.trim().startsWith('WEBVTT') ? parseVtt(content) : parseSrt(content)
  if (!lines.length) throw new Error('Could not parse subtitle')
  const isEnglish = !content.match(/[\u4e00-\u9fff]/)
  const glossary = getGlossary(glossaryId || (isEnglish ? 'default-english' : 'default-donghua'))
  const chunks = chunkLines(lines, 60)
  let all: SrtLine[] = []
  for (const chunk of chunks) {
    const raw = await callAI(buildTranslatePrompt(linesToText(chunk), glossary))
    all = [...all, ...parseTranslatedText(raw, chunk)]
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 300))
  }
  return all
}

// ── Generate content ───────────────────────────────────────
async function generateContent(lines: SrtLine[], title: string) {
  const text = lines.map(l => l.translated || l.text).join('\n').slice(0, 6000)
  const [recap, highlights, captions] = await Promise.all([
    callAI(`"${title}" ဇာတ်လမ်း၏ Myanmar ဘာသာဖြင့် 150 စကားလုံး recap ရေးပါ။\n${text}`),
    callAI(`"${title}" မှ အကောင်းဆုံး moments 5 ခုကို timestamp နဲ့ Myanmar ဘာသာဖြင့်။\nFormat: [timestamp] - ဖော်ပြချက်\n${text}`),
    callAI(`"${title}" အတွက် TikTok/Facebook Myanmar captions 3 ခု နှင့် hashtags 10 ခု။ Emoji ထည့်ပါ။\n${text.slice(0, 2000)}`),
  ])
  return { recap, highlights, captions }
}

function formatSrtFile(lines: SrtLine[], translated: boolean) {
  return lines.map((l, i) => `${i + 1}\n${l.startTime} --> ${l.endTime}\n${translated && l.translated ? l.translated : l.text}`).join('\n\n')
}

// ── Main handler ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { url, title, telegram_chat_id, glossaryId } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const srtContent = await downloadSubtitle(url)
    const videoTitle = title || 'Video'
    const lines = await translateSrt(srtContent, glossaryId)
    const { recap, highlights, captions } = await generateContent(lines, videoTitle)

    const jobId = randomUUID().slice(0, 8)
    const keys = { en: `jobs/${jobId}/subtitle.en.srt`, mm: `jobs/${jobId}/subtitle.mm.srt`, recap: `jobs/${jobId}/recap.txt`, highlights: `jobs/${jobId}/highlights.txt`, captions: `jobs/${jobId}/captions.txt` }

    await Promise.all([
      uploadToB2(keys.en, formatSrtFile(lines, false)),
      uploadToB2(keys.mm, formatSrtFile(lines, true)),
      uploadToB2(keys.recap, recap),
      uploadToB2(keys.highlights, highlights),
      uploadToB2(keys.captions, captions),
    ])

    const [enUrl, mmUrl, recapUrl, highlightsUrl, captionsUrl] = await Promise.all([
      getSignedDownloadUrl(keys.en), getSignedDownloadUrl(keys.mm),
      getSignedDownloadUrl(keys.recap), getSignedDownloadUrl(keys.highlights), getSignedDownloadUrl(keys.captions),
    ])

    if (telegram_chat_id) {
      await sendMessage(telegram_chat_id, `✅ <b>${videoTitle}</b> ပြီးပြီ!\n\n📥 Download (24h):\n🇲🇲 <a href="${mmUrl}">Myanmar .srt</a>\n🇬🇧 <a href="${enUrl}">English .srt</a>\n📝 <a href="${recapUrl}">Recap</a>\n🎯 <a href="${highlightsUrl}">Highlights</a>\n📱 <a href="${captionsUrl}">Captions</a>`)
    }

    return NextResponse.json({ success: true, title: videoTitle, lines: lines.length, downloads: { enUrl, mmUrl, recapUrl, highlightsUrl, captionsUrl }, recap, highlights, captions })

  } catch (err: any) {
    console.error('Submit error:', err)
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
