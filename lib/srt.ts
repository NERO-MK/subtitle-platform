import { SrtLine } from '@/types'

// ── Parse .srt text → SrtLine[] ───────────────────────────
export function parseSrt(content: string): SrtLine[] {
  const lines: SrtLine[] = []
  // Normalize line endings
  const blocks = content.replace(/\r\n/g, '\n').trim().split(/\n\n+/)

  for (const block of blocks) {
    const parts = block.trim().split('\n')
    if (parts.length < 3) continue

    const index = parseInt(parts[0].trim(), 10)
    if (isNaN(index)) continue

    const timePart = parts[1].trim()
    const timeMatch = timePart.match(
      /(\d{2}:\d{2}:\d{2}[,:.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,:.]\d{3})/
    )
    if (!timeMatch) continue

    const text = parts.slice(2).join('\n').trim()

    lines.push({
      index,
      startTime: timeMatch[1].replace('.', ','),
      endTime: timeMatch[2].replace('.', ','),
      text,
    })
  }

  return lines
}

// ── SrtLine[] → .srt file string ─────────────────────────
export function formatSrt(lines: SrtLine[], useTranslated = false): string {
  return lines
    .map((line, i) => {
      const text = useTranslated && line.translated ? line.translated : line.text
      return `${i + 1}\n${line.startTime} --> ${line.endTime}\n${text}`
    })
    .join('\n\n')
}

// ── Parse VTT (YouTube auto-subtitle format) → SrtLine[] ──
export function parseVtt(content: string): SrtLine[] {
  const lines: SrtLine[] = []
  const cleaned = content
    .replace(/WEBVTT.*\n/, '')
    .replace(/NOTE.*\n/g, '')
    .replace(/\n\n+/g, '\n\n')
    .trim()

  const blocks = cleaned.split(/\n\n+/)
  let idx = 1

  for (const block of blocks) {
    const parts = block.trim().split('\n')
    const timeLineIdx = parts.findIndex(p => p.includes('-->'))
    if (timeLineIdx === -1) continue

    const timePart = parts[timeLineIdx]
    const timeMatch = timePart.match(
      /(\d{2}:\d{2}:\d{2}[,:.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,:.]\d{3})/
    )
    if (!timeMatch) continue

    // Strip VTT tags <c>, <00:00:00.000>, etc.
    const textLines = parts
      .slice(timeLineIdx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim()

    if (!textLines) continue

    lines.push({
      index: idx++,
      startTime: timeMatch[1].replace('.', ','),
      endTime: timeMatch[2].replace('.', ','),
      text: textLines,
    })
  }

  return lines
}

// ── Split lines into chunks for Claude API ────────────────
// Claude has context window limits — translate in batches
export function chunkLines(lines: SrtLine[], chunkSize = 80): SrtLine[][] {
  const chunks: SrtLine[][] = []
  for (let i = 0; i < lines.length; i += chunkSize) {
    chunks.push(lines.slice(i, i + chunkSize))
  }
  return chunks
}

// ── Build plain text from lines for translation input ─────
export function linesToText(lines: SrtLine[]): string {
  return lines
    .map(l => `[${l.index}] ${l.text}`)
    .join('\n')
}

// ── Parse Claude's translated output back to lines ────────
export function parseTranslatedText(
  raw: string,
  originalLines: SrtLine[]
): SrtLine[] {
  const result = [...originalLines]
  const translatedMap = new Map<number, string>()

  // Match [index] translated text patterns
  const regex = /\[(\d+)\]\s*(.+?)(?=\n\[\d+\]|\n*$)/gs
  let match

  while ((match = regex.exec(raw)) !== null) {
    const idx = parseInt(match[1], 10)
    const text = match[2].trim()
    translatedMap.set(idx, text)
  }

  return result.map(line => ({
    ...line,
    translated: translatedMap.get(line.index) ?? line.text,
  }))
}
