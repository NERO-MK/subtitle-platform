import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export type JobStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface Job {
  id: string
  telegram_chat_id?: string
  url?: string
  title?: string
  status: JobStatus
  srt_en_url?: string
  srt_mm_url?: string
  recap_text?: string
  highlights_text?: string
  captions_text?: string
  hashtags_text?: string
  b2_file_keys: string[]
  error?: string
  created_at: string
  expires_at: string
}

export async function createJob(data: {
  telegram_chat_id?: string
  url?: string
  title?: string
}): Promise<Job> {
  const { data: job, error } = await supabase
    .from('jobs')
    .insert({ ...data, status: 'pending' })
    .select()
    .single()
  if (error) throw error
  return job
}

export async function updateJob(id: string, data: Partial<Job>) {
  const { error } = await supabase
    .from('jobs')
    .update(data)
    .eq('id', id)
  if (error) throw error
}

export async function getPendingJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select()
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(3) // တစ်ခါ 3 jobs ပဲ process လုပ်
  if (error) throw error
  return data || []
}

export async function getExpiredJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select()
    .eq('status', 'done')
    .lt('expires_at', new Date().toISOString())
  if (error) throw error
  return data || []
}

export async function getJob(id: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select()
    .eq('id', id)
    .single()
  if (error) return null
  return data
}
