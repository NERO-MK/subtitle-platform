import { Glossary, GlossaryTerm } from '@/types'

const STORAGE_KEY = 'subtitle_glossaries'

// ── Default Donghua glossary ──────────────────────────────
export const DEFAULT_DONGHUA_GLOSSARY: Glossary = {
  id: 'default-donghua',
  name: 'Donghua / Xianxia (Default)',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  terms: [
    // Cultivation stages
    { id: '1', source: '修炼', target: 'ကျင့်ကြံမြောက်ခြင်း', category: 'cultivation' },
    { id: '2', source: '渡劫', target: 'ဒုက္ခဖြတ်ကျော်ခြင်း', category: 'cultivation' },
    { id: '3', source: '仙人', target: 'နတ်ဒေဝါ', category: 'cultivation' },
    { id: '4', source: '道友', target: 'တရားသော်ဆွေ', category: 'cultivation' },
    { id: '5', source: '境界', target: 'တရားအဆင့်', category: 'cultivation' },
    { id: '6', source: '元婴', target: 'နာမ်ကလေး', category: 'cultivation' },
    { id: '7', source: '法力', target: 'ဆေးဝါးအင်အား', category: 'cultivation' },
    { id: '8', source: '仙界', target: 'နတ်ဘုံ', category: 'place' },
    { id: '9', source: '魔界', target: 'မာရ်နတ်ဘုံ', category: 'place' },
    { id: '10', source: '前辈', target: 'သူကြီး', category: 'general' },
    { id: '11', source: '师父', target: 'ဆရာ', category: 'general' },
    { id: '12', source: '弟子', target: 'တပည့်', category: 'general' },
  ],
}

// ── Load all glossaries ───────────────────────────────────
export function loadGlossaries(): Glossary[] {
  if (typeof window === 'undefined') return [DEFAULT_DONGHUA_GLOSSARY]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const saved: Glossary[] = raw ? JSON.parse(raw) : []
    // Always include default
    const hasDefault = saved.find(g => g.id === DEFAULT_DONGHUA_GLOSSARY.id)
    return hasDefault ? saved : [DEFAULT_DONGHUA_GLOSSARY, ...saved]
  } catch {
    return [DEFAULT_DONGHUA_GLOSSARY]
  }
}

// ── Save glossaries ───────────────────────────────────────
export function saveGlossaries(glossaries: Glossary[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(glossaries))
}

// ── Get single glossary ───────────────────────────────────
export function getGlossary(id: string): Glossary | undefined {
  return loadGlossaries().find(g => g.id === id)
}

// ── Build glossary prompt block for Claude ────────────────
export function buildGlossaryPrompt(glossary: Glossary): string {
  if (!glossary.terms.length) return ''

  const lines = glossary.terms.map(
    t => `${t.source} → ${t.target}${t.notes ? ` (${t.notes})` : ''}`
  )

  return `
TRANSLATION GLOSSARY (must use these exact translations):
${lines.join('\n')}

These terms MUST be translated exactly as shown above. Do not deviate.
`.trim()
}

// ── Build full Claude translate prompt ───────────────────
export function buildTranslatePrompt(
  linesText: string,
  glossary?: Glossary
): string {
  const glossaryBlock = glossary ? buildGlossaryPrompt(glossary) : ''

  return `You are a professional subtitle translator specializing in Chinese Donghua (animated series) to Myanmar (Burmese) translation.

${glossaryBlock}

RULES:
- Translate ONLY the dialogue text, preserve the [number] tags exactly
- Keep Myanmar translation natural and conversational, not literal
- Preserve line breaks within a subtitle block
- For names without a glossary entry, transliterate to Myanmar script
- Do not add explanations or notes
- Output format must be exactly: [number] translated text

INPUT SUBTITLES:
${linesText}

OUTPUT (Myanmar translation only):`
}
