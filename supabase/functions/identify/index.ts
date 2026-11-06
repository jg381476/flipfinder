// Supabase Edge Function: identify an item from a photo with Google Gemini (free tier).
// The Gemini key lives ONLY here, as a Supabase secret. It never reaches the browser.
//
// Secrets: GEMINI_API_KEY (required), GEMINI_MODEL (optional, default "gemini-flash-latest")

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const PROMPT = `You help a second-hand reseller in Spain decide whether to buy an item. Look at the photo and identify the item.

Reply with ONLY a JSON object with these keys:
- "name": short product name a buyer would search for (e.g. "Moulinex blender LM2000"), in English
- "brand": brand if visible or certain, otherwise ""
- "model": model name/number if visible or certain, otherwise ""
- "category": one or two words
- "condition": one of "new", "like_new", "good", "fair", "poor" (judge from the photo)
- "confidence": "low", "medium" or "high" - how sure you are about the exact product AND the price
- "price_low_eur", "price_likely_eur", "price_high_eur": realistic prices this item in this condition actually SELLS for (not asking prices) on Spanish second-hand marketplaces such as Wallapop, Vinted and eBay.es, in euros. Be conservative.
- "notes": one short sentence on what drives the price (or why you are unsure)

Rules: never invent a brand or model you cannot see or are not sure of. If you cannot identify the item well enough to price it, set all three prices to null and confidence to "low". Prices are estimates, not facts.`

const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null)
const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const oneOf = (v: unknown, allowed: string[], fallback: string) =>
  typeof v === 'string' && allowed.includes(v) ? v : fallback

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  // Only signed-in FlipFinder users may spend our free Gemini quota.
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data: userData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !userData?.user) return json({ error: 'Please sign in again.' }, 401)

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'AI is not configured on the server (missing GEMINI_API_KEY).' }, 500)
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest'

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

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: body.mime || 'image/jpeg', data: body.image } }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  })

  if (res.status === 429) return json({ error: 'The free AI limit is used up for now. Try again in a minute, or fill in the details by hand.' }, 429)
  if (!res.ok) {
    console.error('Gemini error', res.status, await res.text())
    return json({ error: `AI service error (${res.status}). Fill in the details by hand.` }, 502)
  }

  const out = await res.json()
  const text: string = out?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || ''
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''))
  } catch {
    return json({ error: 'The AI answer could not be read. Fill in the details by hand.' }, 502)
  }

  let low = num(raw.price_low_eur)
  let likely = num(raw.price_likely_eur)
  let high = num(raw.price_high_eur)
  if (likely === null) low = high = null
  else {
    low = Math.min(low ?? likely, likely)
    high = Math.max(high ?? likely, likely)
  }

  return json({
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
  })
})
