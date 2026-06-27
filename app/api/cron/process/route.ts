import { NextRequest, NextResponse } from 'next/server'
import { getPendingJobs, updateJob, getExpiredJobs } from '@/lib/supabase'
import { uploadToB2, getSignedDownloadUrl, deleteFilesFromB2 } from '@/lib/b2'
import { sendJobResult, sendMessage } from '@/lib/telegram'
import { parseSrt, parseVtt, chunkLines, linesToText, parseTranslatedText } from '@/lib/srt'
import { buildTranslatePrompt, getGlossary } from '@/lib/glossary'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile, readdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { SrtLine } from '@/types'

const execAsync = promisify(exec)

function isAuthorized(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

async function downloadSubtitle(url: string, jobDir: string): Promise<string> {
  const cmd = `yt-dlp --skip-download --write-subs --write-auto-subs --sub-langs "zh-Hans,zh,en" --sub-format "vtt/srt/best" --convert-subs srt --output "${join(jobDir, '%(title)s.%(ext)s')}" --no-playlist "${url}"`
  await execAsync(cmd, { timeout: 30000 })
  const files = await readdir(jobDir)
  const sub = files.find(f => f.endsWith('.srt') || f.endsWith('.vtt'))
  if (!sub) throw new Error('No subtitle found')
  return readFile(join(jobDir, sub), 'utf-8')
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
        return d.candidates?.[0]?.content?.parts?.[0]?.text || ''
      }
    } catch {}
  }
  throw new Error('Gemini failed')
}

async function translateSrt(content: string): Promise<SrtLine[]> {
  const lines = content.trim().startsWith('WEBVTT') ? parseVtt(content) : parseSrt(content)
  if (!lines.length) throw new Error('Could not parse subtitle')
  const glossary = getGlossary('default-donghua')
  const chunks = chunkLines(lines, 60)
  let all: SrtLine[] = []
  for (const chunk of chunks) {
    const raw = await callGemini(buildTranslatePrompt(linesToText(chunk), glossary))
    all = [...all, ...parseTranslatedText(raw, chunk)]
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 500))
  }
  return all
}

async function generateContent(lines: SrtLine[], title: string) {
  const text = lines.map(l => l.translated || l.text).join('\n').slice(0, 6000)
  const [recap, highlights, captions] = await Promise.all([
    callGemini(`"${title}" ဇာတ်လမ်း၏ Myanmar ဘာသာဖြင့် 150 စကားလုံး recap ရေးပါ။\n${text}`),
    callGemini(`"${title}" မှ အကောင်းဆုံး moments 5 ခုကို timestamp နဲ့ Myanmar ဘာသာဖြင့် ဖော်ပြပါ။\nFormat: [timestamp] - ဖော်ပြချက်\n${text}`),
    callGemini(`"${title}" အတွက် Myanmar social media captions 3 ခု နှင့် hashtags 10 ခု ရေးပါ။ Emoji ထည့်ပါ။\n${text.slice(0, 2000)}`),
  ])
  return { recap, highlights, captions }
}

function formatSrt(lines: SrtLine[], translated: boolean) {
  return lines.map((l, i) => `${i+1}\n${l.startTime} --> ${l.endTime}\n${translated && l.translated ? l.translated : l.text}`).join('\n\n')
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Cleanup expired
  const expired = await getExpiredJobs()
  for (const job of expired) {
    if (job.b2_file_keys?.length) await deleteFilesFromB2(job.b2_file_keys).catch(() => {})
    await updateJob(job.id, { status: 'failed', error: 'Expired' })
  }

  // Process pending
  const jobs = await getPendingJobs()
  if (!jobs.length) return NextResponse.json({ message: 'No pending jobs' })

  for (const job of jobs) {
    const jobDir = join(tmpdir(), `job_${randomUUID()}`)
    await execAsync(`mkdir -p ${jobDir}`)
    try {
      await updateJob(job.id, { status: 'processing' })
      if (job.telegram_chat_id) await sendMessage(job.telegram_chat_id, `⏳ <b>${job.title || 'Video'}</b> processing စနေပြီ...`)

      const srtContent = await downloadSubtitle(job.url, jobDir)
      const lines = await translateSrt(srtContent)
      const { recap, highlights, captions } = await generateContent(lines, job.title || 'Video')

      const enKey = `jobs/${job.id}/subtitle.en.srt`
      const mmKey = `jobs/${job.id}/subtitle.mm.srt`
      await uploadToB2(enKey, formatSrt(lines, false))
      await uploadToB2(mmKey, formatSrt(lines, true))

      const [enUrl, mmUrl] = await Promise.all([getSignedDownloadUrl(enKey), getSignedDownloadUrl(mmKey)])

      await updateJob(job.id, { status: 'done', srt_en_url: enUrl, srt_mm_url: mmUrl, recap_text: recap, highlights_text: highlights, captions_text: captions, b2_file_keys: [enKey, mmKey] })

      if (job.telegram_chat_id) await sendJobResult(job.telegram_chat_id, { title: job.title, srt_en_url: enUrl, srt_mm_url: mmUrl, recap_text: recap, highlights_text: highlights, captions_text: captions })

    } catch (err: any) {
      await updateJob(job.id, { status: 'failed', error: err.message })
      if (job.telegram_chat_id) await sendMessage(job.telegram_chat_id, `❌ Error: ${err.message}`)
    } finally {
      await rm(jobDir, { recursive: true, force: true })
    }
  }

  return NextResponse.json({ processed: jobs.length })
}
