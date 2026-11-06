// Pure profit logic. No React, no network - easy to test.

export const DEFAULT_FEE_PCT = 8   // platform/payment fees + packaging, % of selling price
export const DEFAULT_SHIPPING = 5  // shipping paid by the seller, EUR

// Thresholds for the traffic light
export const GREEN = { profit: 10, roi: 100 }
export const ORANGE = { profit: 5, roi: 40 }

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

export function num(v) {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * sell: expected selling price, buy: purchase price (null/'' = not entered yet)
 * feePct: selling costs in % of sell, shipping: EUR paid by seller
 */
export function calculate({ sell, buy, feePct = DEFAULT_FEE_PCT, shipping = DEFAULT_SHIPPING }) {
  const s = num(sell)
  const fee = Math.min(num(feePct), 100)
  const ship = num(shipping)
  const hasBuy = buy !== null && buy !== undefined && buy !== ''
  const b = num(buy)

  const fees = round2((s * fee) / 100)
  const netProceeds = round2(s - fees - ship) // what you keep before paying for the item
  // Highest purchase price that still gives a GREEN result:
  // ROI >= 100% means buy <= net / 2, and profit >= 10 means buy <= net - 10. Take the stricter one.
  const maxBuy = Math.max(0, Math.floor(Math.min(netProceeds / (1 + GREEN.roi / 100), netProceeds - GREEN.profit)))

  const out = { sell: s, fees, shipping: ship, netProceeds, maxBuy, buy: b, hasBuy, profit: null, roi: null, verdict: null }
  if (!hasBuy || s <= 0) return out

  const profit = round2(netProceeds - b)
  const roi = b > 0 ? round2((profit / b) * 100) : profit > 0 ? Infinity : 0
  out.profit = profit
  out.roi = roi
  out.verdict = verdictFor(profit, roi)
  return out
}

export function verdictFor(profit, roi) {
  if (profit >= GREEN.profit && roi >= GREEN.roi) return 'green'
  if (profit >= ORANGE.profit && roi >= ORANGE.roi) return 'orange'
  return 'red'
}

export const VERDICT_TEXT = {
  green: { title: 'Good deal', sub: 'Buy it - healthy profit.' },
  orange: { title: 'Possible deal', sub: 'Thin margin. Haggle or check real prices first.' },
  red: { title: 'Not worth buying', sub: 'Too little profit for the risk.' },
}

export const eur = (n) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? '-'
    : new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n)

export const pct = (n) => (n === null || n === undefined ? '-' : n === Infinity ? '∞' : `${Math.round(n)}%`)

// ---- search links (we only open the marketplaces' own search pages; no scraping) ----

export function searchQuery({ brand, name, model }) {
  const seen = new Set()
  const words = []
  for (const part of [brand, name, model]) {
    for (const w of String(part || '').split(/\s+/).filter(Boolean)) {
      const k = w.toLowerCase()
      if (!seen.has(k)) { seen.add(k); words.push(w) }
    }
  }
  return words.join(' ')
}

export function searchLinks(item) {
  const q = encodeURIComponent(searchQuery(item))
  return [
    { id: 'ebay', label: 'eBay', note: 'sold listings', url: `https://www.ebay.es/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1` },
    { id: 'vinted', label: 'Vinted', note: 'asking prices', url: `https://www.vinted.es/catalog?search_text=${q}` },
    { id: 'wallapop', label: 'Wallapop', note: 'asking prices', url: `https://es.wallapop.com/app/search?keywords=${q}` },
    { id: 'finn', label: 'FINN.no', note: 'asking prices', url: `https://www.finn.no/recommerce/forsale/search?q=${q}` },
  ]
}
