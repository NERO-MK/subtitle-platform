import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile, unlink, readdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

const execAsync = promisify(exec)

export async function POST(req: NextRequest) {
  let jobDir = ''

  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL required' }, { status: 400 })
    }

    // Validate URL
    try { new URL(url) } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    // Create temp dir for this job
    jobDir = join(tmpdir(), `srt_${randomUUID()}`)
    await execAsync(`mkdir -p ${jobDir}`)

    const outputTemplate = join(jobDir, '%(title)s.%(ext)s')

    // yt-dlp: subtitle only, skip video download
    const ytdlpCmd = [
      'yt-dlp',
      '--skip-download',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs', 'zh-Hans,zh,en,zh-Hant',
      '--sub-format', 'vtt/srt/best',
      '--convert-subs', 'srt',
      `--output "${outputTemplate}"`,
      '--no-playlist',
      `"${url}"`,
    ].join(' ')

    await execAsync(ytdlpCmd, { timeout: 30000 })

    // Find downloaded subtitle file
    const files = await readdir(jobDir)
    const srtFile = files.find(f => f.endsWith('.srt'))
    const vttFile = files.find(f => f.endsWith('.vtt'))
    const subtitleFile = srtFile || vttFile

    if (!subtitleFile) {
      return NextResponse.json(
        { error: 'No subtitle found. This video may not have subtitles available.' },
        { status: 404 }
      )
    }

    const content = await readFile(join(jobDir, subtitleFile), 'utf-8')

    // Extract title from filename (remove extension and lang code)
    const title = subtitleFile
      .replace(/\.(zh-Hans|zh|en|zh-Hant)?\.?(srt|vtt)$/i, '')
      .trim()

    return NextResponse.json({
      srtContent: content,
      title,
      filename: subtitleFile,
    })

  } catch (err: any) {
    const msg = err?.message || 'Download failed'

    // User-friendly error messages
    if (msg.includes('not found') || msg.includes('command not found')) {
      return NextResponse.json(
        { error: 'yt-dlp not installed on server' },
        { status: 500 }
      )
    }
    if (msg.includes('Private video') || msg.includes('members-only')) {
      return NextResponse.json(
        { error: 'This video is private or members-only' },
        { status: 403 }
      )
    }
    if (msg.includes('no subtitles')) {
      return NextResponse.json(
        { error: 'No subtitles available for this video' },
        { status: 404 }
      )
    }

    return NextResponse.json({ error: msg }, { status: 500 })

  } finally {
    // Cleanup temp files
    if (jobDir) {
      execAsync(`rm -rf ${jobDir}`).catch(() => {})
    }
  }
}
