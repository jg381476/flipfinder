// Runs the real Edge Function code in Node with a fake Supabase Auth and a fake AI provider.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const env = {}
globalThis.Deno = { env: { get: (k) => env[k] } }
const { handler, extractJson, shape } = await import('../supabase/functions/identify/index.ts')

let calls // requests the function made to the AI provider
let authOk
let providerScript // array of {status, body} per call
const realFetch = globalThis.fetch

beforeEach(() => {
  Object.keys(env).forEach((k) => delete env[k])
  Object.assign(env, { SUPABASE_URL: 'https://proj.supabase.co', AI_API_KEY: 'test-key' })
  calls = []
  authOk = true
  providerScript = []
  globalThis.fetch = async (url, opts) => {
    if (String(url).endsWith('/auth/v1/user')) return new Response('{}', { status: authOk ? 200 : 401 })
    calls.push({ url: String(url), headers: opts.headers, body: JSON.parse(opts.body) })
    const step = providerScript.shift() ?? { status: 500, body: 'no script' }
    return new Response(typeof step.body === 'string' ? step.body : JSON.stringify(step.body), { status: step.status })
  }
})

const req = (over = {}) =>
  new Request('https://x/functions/v1/identify', {
    method: 'POST',
    headers: { Authorization: 'Bearer user-token', apikey: 'pub-key', 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: 'QUJD', mime: 'image/jpeg', ...over }),
  })
const chat = (content) => ({ status: 200, body: { choices: [{ message: { content } }] } })
const GOOD = { name: "Levi's 501 jeans", brand: "Levi's", model: '501', category: 'jeans', condition: 'good', confidence: 'medium', price_low_eur: 12, price_likely_eur: 18, price_high_eur: 25, notes: 'Classic fit.' }

test('rejects callers without a login', async () => {
  const r = await handler(new Request('https://x', { method: 'POST', body: '{}' }))
  assert.equal(r.status, 401)
})

test('rejects an invalid token (Supabase Auth says no) and never calls the AI', async () => {
  authOk = false
  const r = await handler(req())
  assert.equal(r.status, 401)
  assert.equal(calls.length, 0)
})

test('explains when the AI key is not configured', async () => {
  delete env.AI_API_KEY
  const r = await handler(req())
  assert.equal(r.status, 500)
  assert.match((await r.json()).error, /AI_API_KEY/)
})

test('success: sends photo as data URL with bearer key, parses fenced JSON with prose', async () => {
  providerScript = [chat('Sure! Here you go:\n```json\n' + JSON.stringify(GOOD) + '\n```')]
  const r = await handler(req())
  assert.equal(r.status, 200)
  const j = await r.json()
  assert.equal(j.name, "Levi's 501 jeans")
  assert.equal(j.priceLikely, 18)
  assert.equal(j.priceLow, 12)
  assert.equal(j.priceHigh, 25)
  assert.equal(j.confidence, 'medium')
  assert.equal(j.model, 'google/gemma-4-31b-it:free')
  const c = calls[0]
  assert.equal(c.url, 'https://openrouter.ai/api/v1/chat/completions')
  assert.equal(c.headers.Authorization, 'Bearer test-key')
  const parts = c.body.messages[0].content
  assert.equal(parts[1].image_url.url, 'data:image/jpeg;base64,QUJD')
  assert.match(parts[0].text, /Spain/)
})

test('falls back to the next free model when one is rate limited', async () => {
  providerScript = [{ status: 429, body: 'slow down' }, chat(JSON.stringify(GOOD))]
  const j = await (await handler(req())).json()
  assert.equal(calls.length, 2)
  assert.equal(j.model, 'google/gemma-4-26b-a4b-it:free')
})

test('all models busy -> friendly 429', async () => {
  providerScript = [{ status: 429, body: '' }, { status: 429, body: '' }, { status: 429, body: '' }]
  const r = await handler(req())
  assert.equal(r.status, 429)
  assert.match((await r.json()).error, /busy|limit/i)
})

test('rejected AI key -> 502 and stops (no point trying other models)', async () => {
  providerScript = [{ status: 401, body: 'bad key' }]
  const r = await handler(req())
  assert.equal(r.status, 502)
  assert.equal(calls.length, 1)
  assert.match((await r.json()).error, /key was rejected/)
})

test('unreadable answers try the next model, then fail politely', async () => {
  providerScript = [chat('I cannot help'), chat('{broken'), chat('no json')]
  const r = await handler(req())
  assert.equal(r.status, 502)
  assert.equal(calls.length, 3)
})

test('custom provider and models via secrets; array-style content is accepted', async () => {
  env.AI_BASE_URL = 'https://api.groq.com/openai/v1/'
  env.AI_MODELS = 'my/model'
  providerScript = [{ status: 200, body: { choices: [{ message: { content: [{ type: 'text', text: JSON.stringify(GOOD) }] } }] } }]
  const j = await (await handler(req())).json()
  assert.equal(calls[0].url, 'https://api.groq.com/openai/v1/chat/completions')
  assert.equal(calls[0].body.model, 'my/model')
  assert.equal(j.model, 'my/model')
})

test('user corrections are passed to the model as hints', async () => {
  providerScript = [chat(JSON.stringify(GOOD))]
  await handler(req({ hints: { name: 'Wrangler jacket', brand: 'Wrangler' } }))
  assert.match(calls[0].body.messages[0].content[0].text, /name: Wrangler jacket; brand: Wrangler/)
})

test('no price from the AI -> prices null and confidence forced to low', () => {
  const s = shape({ name: 'Mystery', confidence: 'high', price_likely_eur: null, price_low_eur: 5 })
  assert.equal(s.priceLikely, null)
  assert.equal(s.priceLow, null)
  assert.equal(s.confidence, 'low')
})

test('sanitises odd values: decimal comma strings, negatives, bad enums, long text', () => {
  const s = shape({ name: 'x'.repeat(500), condition: 'MINT', confidence: 'certain', price_likely_eur: '14,5', price_low_eur: -3, price_high_eur: 9 })
  assert.equal(s.name.length, 120)
  assert.equal(s.condition, 'good')
  assert.equal(s.confidence, 'low')
  assert.equal(s.priceLikely, 14.5)
  assert.equal(s.priceLow, 14.5) // negative low is ignored -> clamped to likely
  assert.equal(s.priceHigh, 14.5) // high below likely is raised to likely
})

test('extractJson edge cases', () => {
  assert.equal(extractJson('nothing here'), null)
  assert.deepEqual(extractJson('x {"a":1} y'), { a: 1 })
})

test.after(() => { globalThis.fetch = realFetch })
