// Multi-provider AI fallback chain
// Gemini 2.5 Flash → 2.5 Flash Lite → 2.0 Pro → Groq

async function callGemini(prompt: string, model: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini ${model} failed: ${res.status}`)
  const d = await res.json()
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text || ''
  if (!text) throw new Error(`Gemini ${model} empty response`)
  return text
}

async function callGroq(prompt: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  })
  if (!res.ok) throw new Error(`Groq failed: ${res.status}`)
  const d = await res.json()
  const text = d.choices?.[0]?.message?.content || ''
  if (!text) throw new Error('Groq empty response')
  return text
}

export async function callAI(prompt: string): Promise<string> {
  const providers = [
    { name: 'Gemini 2.5 Flash',      fn: () => callGemini(prompt, 'gemini-2.5-flash') },
    { name: 'Gemini 2.5 Flash Lite',  fn: () => callGemini(prompt, 'gemini-2.5-flash-lite-preview-06-17') },
    { name: 'Gemini 2.0 Pro',         fn: () => callGemini(prompt, 'gemini-2.0-pro-exp') },
    { name: 'Gemini 2.0 Flash',       fn: () => callGemini(prompt, 'gemini-2.0-flash') },
    { name: 'Gemini 1.5 Flash',       fn: () => callGemini(prompt, 'gemini-1.5-flash') },
    { name: 'Groq Llama 3.3 70B',     fn: () => callGroq(prompt) },
  ]

  for (const provider of providers) {
    try {
      console.log(`Trying ${provider.name}...`)
      const result = await provider.fn()
      console.log(`✓ ${provider.name} succeeded`)
      return result
    } catch (e: any) {
      console.warn(`✗ ${provider.name}: ${e.message}`)
      // Rate limit ဆိုရင် နည်းနည်း စောင့်မယ်
      if (e.message?.includes('429') || e.message?.includes('quota')) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }
  }

  throw new Error('All AI providers failed')
}
