import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function createJob(data: { telegram_chat_id?: string; url?: string; title?: string }) {
  const { data: job, error } = await supabase.from('jobs').insert({ ...data, status: 'pending' }).select().single()
  if (error) throw error
  return job
}

export async function updateJob(id: string, data: Record<string, any>) {
  const { error } = await supabase.from('jobs').update(data).eq('id', id)
  if (error) throw error
}

export async function getPendingJobs() {
  const { data, error } = await supabase.from('jobs').select().eq('status', 'pending').order('created_at', { ascending: true }).limit(3)
  if (error) throw error
  return data || []
}

export async function getExpiredJobs() {
  const { data, error } = await supabase.from('jobs').select().eq('status', 'done').lt('expires_at', new Date().toISOString())
  if (error) throw error
  return data || []
}

export async function getJob(id: string) {
  const { data } = await supabase.from('jobs').select().eq('id', id).single()
  return data
}
