import { Glossary, GlossaryTerm } from '@/types'

const STORAGE_KEY = 'subtitle_glossaries'

export const DEFAULT_DONGHUA_GLOSSARY: Glossary = {
  id: 'default-donghua',
  name: 'Donghua / Xianxia (Chinese→MM)',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  terms: [
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

export const DEFAULT_ENGLISH_GLOSSARY: Glossary = {
  id: 'default-english',
  name: 'English→MM (General)',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  terms: [
    { id: 'e1', source: 'Cultivation', target: 'ကျင့်ကြံမြောက်ခြင်း', category: 'cultivation' },
    { id: 'e2', source: 'Tribulation', target: 'ဒုက္ခဖြတ်ကျော်ခြင်း', category: 'cultivation' },
    { id: 'e3', source: 'Immortal', target: 'နတ်ဒေဝါ', category: 'cultivation' },
    { id: 'e4', source: 'Senior', target: 'သူကြီး', category: 'general' },
    { id: 'e5', source: 'Master', target: 'ဆရာ', category: 'general' },
    { id: 'e6', source: 'Disciple', target: 'တပည့်', category: 'general' },
  ],
}

export function loadGlossaries(): Glossary[] {
  if (typeof window === 'undefined') return [DEFAULT_DONGHUA_GLOSSARY, DEFAULT_ENGLISH_GLOSSARY]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const saved: Glossary[] = raw ? JSON.parse(raw) : []
    const result = [...saved]
    if (!result.find(g => g.id === DEFAULT_DONGHUA_GLOSSARY.id)) result.unshift(DEFAULT_DONGHUA_GLOSSARY)
    if (!result.find(g => g.id === DEFAULT_ENGLISH_GLOSSARY.id)) result.splice(1, 0, DEFAULT_ENGLISH_GLOSSARY)
    return result
  } catch {
    return [DEFAULT_DONGHUA_GLOSSARY, DEFAULT_ENGLISH_GLOSSARY]
  }
}

export function saveGlossaries(glossaries: Glossary[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(glossaries))
}

export function getGlossary(id: string): Glossary | undefined {
  return loadGlossaries().find(g => g.id === id)
}

export function buildGlossaryPrompt(glossary: Glossary): string {
  if (!glossary.terms.length) return ''
  const lines = glossary.terms.map(t => `${t.source} → ${t.target}`)
  return `TRANSLATION GLOSSARY (use exactly):\n${lines.join('\n')}\n`
}

export function buildTranslatePrompt(linesText: string, glossary?: Glossary): string {
  const glossaryBlock = glossary ? buildGlossaryPrompt(glossary) : ''

  // Glossary ID ကြည့်ပြီး source language သိနိုင်တယ်
  const isEnglish = glossary?.id?.includes('english') || 
                    glossary?.name?.toLowerCase().includes('english')

  const sourceLang = isEnglish ? 'English' : 'Chinese (Mandarin)'

  return `You are a professional subtitle translator from ${sourceLang} to Myanmar (Burmese).

${glossaryBlock}
RULES:
- Translate ONLY the dialogue, keep [number] tags exactly as-is
- Myanmar translation must be natural, conversational — not word-for-word literal
- For names without glossary entry: if Chinese, transliterate to Myanmar script; if English, keep the English name
- No explanations, no notes, output only translations
- Format: [number] translated text

INPUT:
${linesText}

OUTPUT (Myanmar only):`
}
