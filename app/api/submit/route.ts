import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const serviceUrl = process.env.YTDLP_SERVICE_URL
    if (!serviceUrl) return NextResponse.json({ error: 'Service not configured' }, { status: 500 })

    // Railway yt-dlp service ကို call
    const res = await fetch(`${serviceUrl}/subtitle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    const data = await res.json()

    if (!res.ok || data.error) {
      return NextResponse.json({ error: data.error || 'Download failed' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      title: data.title,
      srtContent: data.content,
    })

  } catch (err: any) {
    console.error('Submit error:', err)
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
