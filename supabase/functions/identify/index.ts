// Supabase Edge Function: identify an item from a photo with a FREE vision model.
// Works with any OpenAI-compatible provider (default: OpenRouter's free models).
// The AI key lives ONLY here, as a Supabase secret. It never reaches the browser.
//
// Secrets:
//   AI_API_KEY   (required)  e.g. an OpenRouter key
//   AI_BASE_URL  (optional)  default https://openrouter.ai/api/v1
//   AI_MODELS    (optional)  comma-separated, tried in order. Default: free vision models on OpenRouter

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const DEFAULT_MODELS = 'google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,openrouter/free'

const PROMPT = `You help a second-hand reseller in Spain decide whether to buy an item. Look at the photo and identify the item (clothing, shoes, bags, electronics, home goods, toys, collectibles, ...).

Reply with ONLY a JSON object (no markdown, no extra text) with these keys:
- "name": short product name a buyer would search for (e.g. "Levi's 501 straight jeans"), in English
- "brand": brand if visible or certain, otherwise ""
- "model": model name/number/style if visible or certain, otherwise ""
- "category": one or two words
- "condition": one of "new", "like_new", "good", "fair", "poor" (judge from the photo)
- "confidence": "low", "medium" or "high" - how sure you are about the exact product AND the price
- "price_low_eur", "price_likely_eur", "price_high_eur": realistic prices this item in this condition actually SELLS for (not asking prices) on Spanish second-hand marketplaces such as Wallapop, Vinted and eBay.es, in euros. Be conservative.
- "notes": one short sentence on what drives the price (or why you are unsure)

Rules: never invent a brand or model you cannot see or are not sure of. If you cannot identify the item well enough to price it, set all three prices to null and confidence to "low". Prices are estimates, not facts.`

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v
  return typeof n === 'number' && isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}
const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const oneOf = (v: unknown, allowed: string[], fallback: string) =>
  typeof v === 'string' && allowed.includes(v.toLowerCase()) ? v.toLowerCase() : fallback

// Models sometimes wrap JSON in prose or code fences. Take the outermost {...}.
export function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const v = JSON.parse(text.slice(start, end + 1))
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}

function contentText(message: { content?: unknown } | undefined): string {
  const c = message?.content
  if (typeof c === 'string') return c
  if (Array.isArray(c)) return c.map((p) => (typeof p === 'string' ? p : (p as { text?: string })?.text || '')).join('')
  return ''
}

export function shape(raw: Record<string, unknown>) {
  let low = num(raw.price_low_eur)
  let likely = num(raw.price_likely_eur)
  let high = num(raw.price_high_eur)
  if (likely === null) low = high = null
  else {
    low = Math.min(low ?? likely, likely)
    high = Math.max(high ?? likely, likely)
  }
  return {
    name: str(raw.name),
    brand: str(raw.brand, 60),
    model: str(raw.model, 60),
    category: str(raw.category, 40),
    condition: oneOf(raw.condition, ['new', 'like_new', 'good', 'fair', 'poor'], 'good'),
    confidence: likely === null ? 'low' : oneOf(raw.confidence, ['low', 'medium', 'high'], 'low'),
    priceLow: low,
    priceLikely: likely,
    priceHigh: high,
    notes: str(raw.notes, 200),
  }
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  // Only signed-in FlipFinder users may spend our free AI quota.
  // We ask Supabase Auth who the caller is, using the user's token and the project's public key
  // that the app sends in the `apikey` header.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const publicKey = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || ''
  if (!token || !publicKey) return json({ error: 'Please sign in again.' }, 401)
  const who = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: publicKey },
  })
  if (!who.ok) return json({ error: 'Please sign in again.' }, 401)

  const apiKey = Deno.env.get('AI_API_KEY')
  if (!apiKey) return json({ error: 'AI is not set up yet (missing AI_API_KEY). Fill in the details by hand.' }, 500)
  const baseUrl = (Deno.env.get('AI_BASE_URL') || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
  const models = (Deno.env.get('AI_MODELS') || DEFAULT_MODELS).split(',').map((m) => m.trim()).filter(Boolean)

  let body: { image?: string; mime?: string; hints?: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }
  if (!body.image || typeof body.image !== 'string') return json({ error: 'No image.' }, 400)
  if (body.image.length > 5_000_000) return json({ error: 'Image too large.' }, 413)

  let prompt = PROMPT
  const h = body.hints
  if (h) {
    const parts = [
      h.name && `name: ${str(h.name)}`,
      h.brand && `brand: ${str(h.brand)}`,
      h.model && `model: ${str(h.model)}`,
      h.condition && `condition: ${str(h.condition, 20)}`,
    ].filter(Boolean)
    if (parts.length) prompt += `\n\nThe user has corrected the details. Trust these over the photo: ${parts.join('; ')}.`
  }
  const dataUrl = `data:${body.mime || 'image/jpeg'};base64,${body.image}`

  // Free models are sometimes busy or retired: try each in turn.
  let lastStatus = 0
  let sawRateLimit = false
  for (const model of models) {
    let res: Response
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://jg381476.github.io/flipfinder/',
          'X-Title': 'FlipFinder',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 700,
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }],
        }),
        signal: AbortSignal.timeout(50_000),
      })
    } catch (e) {
      console.error('AI request failed', model, String(e))
      continue
    }
    lastStatus = res.status
    if (res.status === 401 || res.status === 403) {
      console.error('AI key rejected', res.status, await res.text())
      return json({ error: 'The AI key was rejected. Fill in the details by hand.' }, 502)
    }
    if (res.status === 429) sawRateLimit = true
    if (!res.ok) {
      console.error('AI error', model, res.status, (await res.text()).slice(0, 300))
      continue
    }
    const out = await res.json().catch(() => null)
    const raw = extractJson(contentText(out?.choices?.[0]?.message))
    if (!raw) {
      console.error('Unreadable AI answer from', model)
      continue
    }
    return json({ ...shape(raw), model })
  }

  if (sawRateLimit) return json({ error: 'The free AI is busy or its daily limit is used up. Try again in a minute, or fill in the details by hand.' }, 429)
  return json({ error: `The AI could not read this photo (${lastStatus || 'no answer'}). Fill in the details by hand.` }, 502)
}

// Only start the server when running inside Supabase/Deno (so the logic can be tested in Node).
if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') Deno.serve(handler)
