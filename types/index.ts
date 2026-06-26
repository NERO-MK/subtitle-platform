// ── Glossary ──────────────────────────────────────────────
export interface GlossaryTerm {
  id: string
  source: string        // Chinese / original term  e.g. "渡劫"
  target: string        // Myanmar translation       e.g. "ဒုက္ခဖြတ်ကျော်ခြင်း"
  category: 'cultivation' | 'character' | 'place' | 'general'
  notes?: string
}

export interface Glossary {
  id: string
  name: string          // e.g. "Renegade Immortal"
  terms: GlossaryTerm[]
  createdAt: string
  updatedAt: string
}

// ── SRT Parsing ───────────────────────────────────────────
export interface SrtLine {
  index: number
  startTime: string     // "00:01:23,456"
  endTime: string       // "00:01:25,789"
  text: string          // original text
  translated?: string   // Myanmar translated text
}

// ── Job / Pipeline ────────────────────────────────────────
export type JobStatus =
  | 'idle'
  | 'downloading'
  | 'translating'
  | 'done'
  | 'error'

export interface TranslateJob {
  id: string
  url?: string
  rawSrt?: string       // pasted SRT text
  status: JobStatus
  progress: number      // 0-100
  message: string
  lines: SrtLine[]
  glossaryId?: string
  createdAt: string
  error?: string
}

// ── API Request / Response ────────────────────────────────
export interface TranslateRequest {
  url?: string
  rawSrt?: string
  glossaryId?: string
}

export interface TranslateResponse {
  jobId: string
  lines: SrtLine[]
  error?: string
}

export interface DownloadRequest {
  url: string
}

export interface DownloadResponse {
  srtContent: string
  title?: string
  duration?: number
  error?: string
}
