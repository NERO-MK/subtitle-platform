import { NextRequest, NextResponse } from 'next/server'
import { uploadToB2, getSignedDownloadUrl } from '@/lib/b2'
import { sendMessage } from '@/lib/telegram'
import { parseSrt, parseVtt, chunkLines, linesToText, parseTranslatedText } from '@/lib/srt'
import { buildTranslatePrompt, getGlossary } from '@/lib/glossary'
import { rm, mkdir, readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { SrtLine } from '@/types'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// yt-dlp-exec binary path
function getYtDlpPath(): string {
  try {
    // yt-dlp-exec package ထဲက binary
    const pkg = require.resolve('yt-dlp-exec/bin/yt-dlp')
    return pkg
  } catch {
    // fallback paths
    const paths = [
      join(process.cwd(), 'node_modules/yt-dlp-exec/bin/yt-dlp'),
      join(process.cwd(), 'node_modules/.bin/yt-dlp'),
      '/var/task/node_modules/yt-dlp-exec/bin/yt-dlp',
    ]
    return paths[0]
  }
}

async function downloadSubtitle(url: string, jobDir: string): Promise<string> {
  await mkdir(jobDir, { recursive: true })

  const ytdlp = getYtDlpPath()
  const cmd = `"${ytdlp}" --skip-download --write-subs --write-auto-subs --sub-langs "zh-Hans,zh,en" --sub-format "vtt/srt/best" --convert-subs srt --output "${join(jobDir, '%(title)s.%(ext)s')}" --no-playlist "${url}"`

  console.log('yt-dlp path:', ytdlp)
  await execAsync(cmd, { timeout: 30000 })

  const files = await readdir(jobDir)
  const subFile = files.find(f => f.endsWith('.srt') || f.endsWith('.vtt'))
  if (!subFile) throw new Error('No subtitle found for this video')
  return readFile(join(jobDir, subFile), 'utf-8')
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

function formatSrt(lines: SrtLine[], translated: boolean) {
  return lines.map((l, i) =>
    `${i + 1}\n${l.startTime} --> ${l.endTime}\n${translated && l.translated ? l.translated : l.text}`
  ).join('\n\n')
}

export async function POST(req: NextRequest) {
  const jobDir = join(tmpdir(), `job_${randomUUID()}`)

  try {
    const { url, title, telegram_chat_id, glossaryId } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const srtContent = await downloadSubtitle(url, jobDir)
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
      uploadToB2(keys.en, formatSrt(lines, false)),
      uploadToB2(keys.mm, formatSrt(lines, true)),
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
  } finally {
    await rm(jobDir, { recursive: true, force: true }).catch(() => {})
  }
}
