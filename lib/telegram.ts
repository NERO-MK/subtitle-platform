const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`

export async function sendMessage(chatId: string, text: string): Promise<void> {
  await fetch(`${BASE_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  })
}

export async function sendDocument(
  chatId: string,
  content: string,
  filename: string,
  caption?: string
): Promise<string | null> {
  const blob = new Blob([content], { type: 'text/plain' })
  const formData = new FormData()
  formData.append('chat_id', chatId)
  formData.append('document', blob, filename)
  if (caption) formData.append('caption', caption)

  const res = await fetch(`${BASE_URL}/sendDocument`, {
    method: 'POST',
    body: formData,
  })
  const data = await res.json()
  return data.ok ? data.result?.document?.file_id : null
}

export async function sendJobResult(chatId: string, job: {
  title?: string
  srt_mm_url?: string
  srt_en_url?: string
  recap_text?: string
  highlights_text?: string
  captions_text?: string
  hashtags_text?: string
}): Promise<void> {
  const title = job.title || 'Video'

  // Summary message
  const msg = `✅ <b>${title}</b> ပြီးပြီ!

📥 Download links (24h သာ ရမယ်):
${job.srt_mm_url ? `🇲🇲 <a href="${job.srt_mm_url}">Myanmar .srt download</a>` : ''}
${job.srt_en_url ? `🇬🇧 <a href="${job.srt_en_url}">English .srt download</a>` : ''}

${job.recap_text ? `📝 <b>Recap</b>\n${job.recap_text.slice(0, 500)}` : ''}

${job.highlights_text ? `🎯 <b>Highlights</b>\n${job.highlights_text.slice(0, 300)}` : ''}

${job.hashtags_text ? `#️⃣ ${job.hashtags_text}` : ''}`

  await sendMessage(chatId, msg)

  // Send captions separately if exists
  if (job.captions_text) {
    await sendMessage(chatId, `📱 <b>Social Media Captions</b>\n\n${job.captions_text}`)
  }
}
