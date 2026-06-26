import { Glossary, GlossaryTerm } from '@/types'

const STORAGE_KEY = 'subtitle_glossaries'

export const DEFAULT_DONGHUA_GLOSSARY: Glossary = {
  id: 'default-donghua',
  name: 'Donghua / Xianxia (Chinese→MM)',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  terms: [
    // Cultivation stages
    { id: 'c1', source: '修炼', target: 'ကျင့်ကြံမြောက်ခြင်း', category: 'cultivation' },
    { id: 'c2', source: '渡劫', target: 'ဒုက္ခဖြတ်ကျော်ခြင်း', category: 'cultivation' },
    { id: 'c3', source: '突破', target: 'အဆင့်တက်ခြင်း', category: 'cultivation' },
    { id: 'c4', source: '境界', target: 'တရားအဆင့်', category: 'cultivation' },
    { id: 'c5', source: '元婴', target: 'နာမ်ကလေး', category: 'cultivation' },
    { id: 'c6', source: '法力', target: 'ဆေးဝါးအင်အား', category: 'cultivation' },
    { id: 'c7', source: '灵力', target: 'နတ်အင်အား', category: 'cultivation' },
    { id: 'c8', source: '真气', target: 'စစ်မှန်သောအင်အား', category: 'cultivation' },
    { id: 'c9', source: '丹田', target: 'အင်အားဗဟို', category: 'cultivation' },
    { id: 'c10', source: '经脉', target: 'အင်အားကြောများ', category: 'cultivation' },
    { id: 'c11', source: '修为', target: 'ကျင့်ကြံမှုအဆင့်', category: 'cultivation' },
    { id: 'c12', source: '天劫', target: 'နတ်ကောင်းကင်ဒဏ်', category: 'cultivation' },
    { id: 'c13', source: '飞升', target: 'နတ်ဘုံတက်ခြင်း', category: 'cultivation' },
    { id: 'c14', source: '闭关', target: 'တရားဝင်ကာလ', category: 'cultivation' },
    { id: 'c15', source: '丹药', target: 'ဆေးတောင့်', category: 'cultivation' },
    { id: 'c16', source: '灵丹', target: 'နတ်ဆေး', category: 'cultivation' },
    { id: 'c17', source: '法宝', target: 'နတ်လက်နက်', category: 'cultivation' },
    { id: 'c18', source: '神识', target: 'နတ်သိမြင်မှု', category: 'cultivation' },
    { id: 'c19', source: '魂魄', target: 'ဝိညာဉ်', category: 'cultivation' },
    { id: 'c20', source: '气息', target: 'အင်အားလှိုင်း', category: 'cultivation' },

    // Realms
    { id: 'r1', source: '仙人', target: 'ရှင်မင်း', category: 'cultivation' },
    { id: 'r2', source: '真仙', target: 'စစ်မှန်သောရှင်မင်း', category: 'cultivation' },
    { id: 'r3', source: '大乘', target: 'မဟာယာနအဆင့်', category: 'cultivation' },
    { id: 'r4', source: '化神', target: 'နတ်ပြောင်းအဆင့်', category: 'cultivation' },
    { id: 'r5', source: '炼虚', target: 'အလွတ်သဘောကျင့်အဆင့်', category: 'cultivation' },
    { id: 'r6', source: '合体', target: 'ပေါင်းစည်းအဆင့်', category: 'cultivation' },
    { id: 'r7', source: '筑基', target: 'အခြေခံတည်ဆောက်အဆင့်', category: 'cultivation' },
    { id: 'r8', source: '金丹', target: 'ရွှေဆေးတောင့်အဆင့်', category: 'cultivation' },
    { id: 'r9', source: '练气', target: 'အင်အားလေ့ကျင့်အဆင့်', category: 'cultivation' },

    // Places
    { id: 'p1', source: '仙界', target: 'နတ်ဘုံ', category: 'place' },
    { id: 'p2', source: '魔界', target: 'မာရ်နတ်ဘုံ', category: 'place' },
    { id: 'p3', source: '凡界', target: 'လောကဘုံ', category: 'place' },
    { id: 'p4', source: '冥界', target: 'မြေအောက်ဘုံ', category: 'place' },
    { id: 'p5', source: '灵界', target: 'နတ်စိတ်ဘုံ', category: 'place' },
    { id: 'p6', source: '宗门', target: 'တပည့်စုဖွဲ့', category: 'place' },
    { id: 'p7', source: '宗族', target: 'မျိုးနွယ်', category: 'place' },
    { id: 'p8', source: '秘境', target: 'လျှို့ဝှက်နယ်မြေ', category: 'place' },

    // Relations / Titles
    { id: 't1', source: '前辈', target: 'သူကြီး', category: 'general' },
    { id: 't2', source: '师父', target: 'ဆရာ', category: 'general' },
    { id: 't3', source: '弟子', target: 'တပည့်', category: 'general' },
    { id: 't4', source: '道友', target: 'တရားဆွေ', category: 'general' },
    { id: 't5', source: '师兄', target: 'ဆရာနောင်', category: 'general' },
    { id: 't6', source: '师姐', target: 'ဆရာမနောင်', category: 'general' },
    { id: 't7', source: '师弟', target: 'ဆရာညီ', category: 'general' },
    { id: 't8', source: '师妹', target: 'ဆရာမညီ', category: 'general' },
    { id: 't9', source: '掌门', target: 'အုပ်ချုပ်သူ', category: 'general' },
    { id: 't10', source: '长老', target: 'သက်ကြီးသူ', category: 'general' },
    { id: 't11', source: '宗主', target: 'မျိုးနွယ်ခေါင်းဆောင်', category: 'general' },
    { id: 't12', source: '陛下', target: 'မင်းတပါး', category: 'general' },
    { id: 't13', source: '殿下', target: 'မင်းသားတပါး', category: 'general' },
    { id: 't14', source: '阁下', target: 'ကိုယ်တော်', category: 'general' },

    // Combat
    { id: 'b1', source: '神通', target: 'နတ်တန်ခိုး', category: 'cultivation' },
    { id: 'b2', source: '术法', target: 'စာပေတန်ခိုး', category: 'cultivation' },
    { id: 'b3', source: '禁术', target: 'တားမြစ်ထားသောတန်ခိုး', category: 'cultivation' },
    { id: 'b4', source: '秘术', target: 'လျှို့ဝှက်တန်ခိုး', category: 'cultivation' },
  ],
}

export const DEFAULT_ENGLISH_GLOSSARY: Glossary = {
  id: 'default-english',
  name: 'English→MM (General)',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  terms: [
    // Xianxia / Wuxia English terms
    { id: 'e1', source: 'Cultivation', target: 'ကျင့်ကြံမြောက်ခြင်း', category: 'cultivation' },
    { id: 'e2', source: 'Tribulation', target: 'ဒုက္ခဖြတ်ကျော်ခြင်း', category: 'cultivation' },
    { id: 'e3', source: 'Immortal', target: 'ရှင်မင်း', category: 'cultivation' },
    { id: 'e4', source: 'Cultivator', target: 'ကျင့်ကြံသူ', category: 'cultivation' },
    { id: 'e5', source: 'Spiritual energy', target: 'နတ်အင်အား', category: 'cultivation' },
    { id: 'e6', source: 'Qi', target: 'အင်အား', category: 'cultivation' },
    { id: 'e7', source: 'Dao', target: 'တရား', category: 'cultivation' },
    { id: 'e8', source: 'Sect', target: 'တပည့်စုဖွဲ့', category: 'place' },
    { id: 'e9', source: 'Realm', target: 'အဆင့်', category: 'cultivation' },
    { id: 'e10', source: 'Breakthrough', target: 'အဆင့်တက်ခြင်း', category: 'cultivation' },
    { id: 'e11', source: 'Pill', target: 'ဆေးတောင့်', category: 'cultivation' },
    { id: 'e12', source: 'Artifact', target: 'နတ်လက်နက်', category: 'cultivation' },
    { id: 'e13', source: 'Treasure', target: 'နတ်ဝတ္ထု', category: 'cultivation' },
    { id: 'e14', source: 'Divine sense', target: 'နတ်သိမြင်မှု', category: 'cultivation' },
    { id: 'e15', source: 'Soul', target: 'ဝိညာဉ်', category: 'cultivation' },
    // Titles
    { id: 'e16', source: 'Senior', target: 'သူကြီး', category: 'general' },
    { id: 'e17', source: 'Master', target: 'ဆရာ', category: 'general' },
    { id: 'e18', source: 'Disciple', target: 'တပည့်', category: 'general' },
    { id: 'e19', source: 'Fellow Daoist', target: 'တရားဆွေ', category: 'general' },
    { id: 'e20', source: 'Elder', target: 'သက်ကြီးသူ', category: 'general' },
    { id: 'e21', source: 'Sect Master', target: 'အုပ်ချုပ်သူ', category: 'general' },
    { id: 'e22', source: 'Young Master', target: 'မင်းသားလေး', category: 'general' },
    { id: 'e23', source: 'Your Highness', target: 'မင်းသားတပါး', category: 'general' },
    { id: 'e24', source: 'Your Majesty', target: 'မင်းတပါး', category: 'general' },
    // Common drama
    { id: 'e25', source: 'I', target: 'ကျွန်တော်', category: 'general' },
    { id: 'e26', source: 'you', target: 'သင်', category: 'general' },
    { id: 'e27', source: 'This one', target: 'ဤသူ', category: 'general' },
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
  const isEnglish = glossary?.id?.includes('english') || glossary?.name?.toLowerCase().includes('english')
  const sourceLang = isEnglish ? 'English' : 'Chinese (Mandarin)'

  return `You are a professional subtitle translator from ${sourceLang} to Myanmar (Burmese).

${glossaryBlock}
RULES:
- Translate ONLY the dialogue, keep [number] tags exactly as-is
- Myanmar translation must be natural and conversational
- For names without glossary entry: keep original name as-is
- No explanations or notes
- Output format: [number] translated text

INPUT:
${linesText}

OUTPUT (Myanmar only):`
}
