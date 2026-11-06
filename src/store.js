import { supabase, cloudEnabled } from './supabase.js'

// One small API for saved finds. Cloud mode = shared Supabase table.
// Local mode = this phone's localStorage (works with zero setup, but is not shared).

const LOCAL_KEY = 'flipfinder.finds'

const newId = () =>
  globalThis.crypto?.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2)

const toRow = (i) => ({
  name: i.name,
  brand: i.brand || null,
  model: i.model || null,
  condition: i.condition || null,
  photo: i.photo || null,
  purchase_price: i.purchasePrice,
  sell_price: i.sellPrice,
  fee_pct: i.feePct,
  shipping: i.shipping,
  profit: i.profit,
  verdict: i.verdict,
  price_source: i.priceSource,
})

const fromRow = (r) => ({
  id: r.id,
  createdAt: r.created_at,
  name: r.name,
  brand: r.brand || '',
  model: r.model || '',
  condition: r.condition || 'good',
  photo: r.photo || '',
  purchasePrice: r.purchase_price,
  sellPrice: r.sell_price,
  feePct: r.fee_pct,
  shipping: r.shipping,
  profit: r.profit,
  verdict: r.verdict,
  priceSource: r.price_source || 'manual',
})

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')
  } catch {
    return []
  }
}
function writeLocal(list) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
  } catch {
    throw new Error('This phone is out of local storage space. Delete some finds or set up shared storage.')
  }
}

export const store = {
  async list() {
    if (!cloudEnabled) return readLocal().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const { data, error } = await supabase.from('finds').select('*').order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data.map(fromRow)
  },

  async save(item) {
    if (!cloudEnabled) {
      const list = readLocal()
      const saved = { ...item, id: item.id || newId(), createdAt: item.createdAt || new Date().toISOString() }
      const idx = list.findIndex((x) => x.id === saved.id)
      if (idx >= 0) list[idx] = saved
      else list.push(saved)
      writeLocal(list)
      return saved
    }
    const q = item.id
      ? supabase.from('finds').update(toRow(item)).eq('id', item.id)
      : supabase.from('finds').insert(toRow(item))
    const { data, error } = await q.select().single()
    if (error) throw new Error(error.message)
    return fromRow(data)
  },

  async remove(id) {
    if (!cloudEnabled) {
      writeLocal(readLocal().filter((x) => x.id !== id))
      return
    }
    const { error } = await supabase.from('finds').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
