import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const videoId = extractYouTubeId(url)
    if (!videoId) return NextResponse.json({ error: 'YouTube URL မဟုတ်ဘူး' }, { status: 400 })

    const headers = {
      'Content-Type': 'application/json',
      'x-rapidapi-host': RAPID_HOST,
      'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
    }

    // Get available languages
    let targetLang = 'en'
    try {
      const langRes = await fetch(
        `https://${RAPID_HOST}/language-list/${videoId}`,
        { headers }
      )
      if (langRes.ok) {
        const langs = await langRes.json()
        const priority = ['zh-Hans', 'zh', 'zh-CN', 'en']
        if (Array.isArray(langs)) {
          for (const p of priority) {
            const found = langs.find((l: any) =>
              (l.languageCode || '').toLowerCase().startsWith(p.toLowerCase())
            )
            if (found) { targetLang = found.languageCode; break }
          }
        }
      }
    } catch {}

    console.log('Video ID:', videoId, 'Lang:', targetLang)

    // Download SRT
    for (const lang of [targetLang, 'en']) {
      const res = await fetch(
        `https://${RAPID_HOST}/download-srt/${videoId}?language=${lang}&response_mode=default`,
        { headers }
      )
      console.log(`SRT (${lang}):`, res.status)
      if (res.ok) {
        const content = await res.text()
        if (content && content.length > 50) {
          return NextResponse.json({
            success: true,
            videoId,
            language: lang,
            srtContent: content,
          })
        }
      }
    }

    return NextResponse.json({ error: 'Subtitle မတွေ့ဘူး' }, { status: 404 })

  } catch (err: any) {
    console.error('Submit error:', err)
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
