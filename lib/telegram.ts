const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

export async function sendMessage(chatId: string, text: string) {
  await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

export async function sendJobResult(chatId: string, job: {
  title?: string
  srt_mm_url?: string
  srt_en_url?: string
  recap_text?: string
  highlights_text?: string
  captions_text?: string
}) {
  const title = job.title || 'Video'
  const msg = `✅ <b>${title}</b> ပြီးပြီ!

📥 Download (24h):
${job.srt_mm_url ? `🇲🇲 <a href="${job.srt_mm_url}">Myanmar .srt</a>` : ''}
${job.srt_en_url ? `🇬🇧 <a href="${job.srt_en_url}">English .srt</a>` : ''}

${job.recap_text ? `📝 <b>Recap</b>\n${job.recap_text.slice(0, 600)}` : ''}

${job.highlights_text ? `🎯 <b>Highlights</b>\n${job.highlights_text.slice(0, 400)}` : ''}`

  await sendMessage(chatId, msg)

  if (job.captions_text) {
    await sendMessage(chatId, `📱 <b>Captions + Hashtags</b>\n\n${job.captions_text}`)
  }
}
