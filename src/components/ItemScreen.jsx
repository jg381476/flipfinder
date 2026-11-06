import { useEffect, useMemo, useRef, useState } from 'react'
import { calculate, eur, pct, searchLinks, VERDICT_TEXT, num } from '../calc.js'
import { identify, aiAvailable, CONDITIONS } from '../ai.js'
import { store } from '../store.js'
import { Icon } from './bits.jsx'

const s = (v) => (v === null || v === undefined ? '' : String(v))

export default function ItemScreen({ initial, settings, onBack, onChanged }) {
  const isNew = Boolean(initial.isNew)
  const [name, setName] = useState(initial.name || '')
  const [brand, setBrand] = useState(initial.brand || '')
  const [model, setModel] = useState(initial.model || '')
  const [condition, setCondition] = useState(initial.condition || 'good')
  const [sell, setSell] = useState(s(initial.sellPrice))
  const [sellSource, setSellSource] = useState(initial.priceSource || 'manual')
  const [buy, setBuy] = useState(s(initial.purchasePrice))
  const [feePct, setFeePct] = useState(s(initial.feePct ?? settings.feePct))
  const [shipping, setShipping] = useState(s(initial.shipping ?? settings.shipping))
  const [ai, setAi] = useState({ status: 'idle' }) // idle | loading | done | error
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const photo = initial.photo || ''
  const ranFirst = useRef(false)

  // Photo scan: identify automatically once.
  useEffect(() => {
    if (ranFirst.current) return
    ranFirst.current = true
    if (isNew && initial.aiImage && aiAvailable) runAi(false)
    else if (isNew && initial.aiImage) setAi({ status: 'off' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runAi(withHints) {
    const image = initial.aiImage || photo
    if (!image) return
    setAi((a) => ({ ...a, status: 'loading', error: '' }))
    try {
      const r = await identify(image, withHints ? { name, brand, model, condition } : undefined)
      if (!withHints) {
        // first pass: fill in what the AI found
        if (r.name) setName(r.name)
        setBrand(r.brand || '')
        setModel(r.model || '')
        setCondition(r.condition || 'good')
      }
      if (r.priceLikely !== null && r.priceLikely !== undefined) {
        setSell(String(Math.round(r.priceLikely)))
        setSellSource('ai')
      }
      setAi({ status: 'done', confidence: r.confidence, low: r.priceLow, high: r.priceHigh, notes: r.notes, noPrice: r.priceLikely == null })
    } catch (e) {
      setAi({ status: 'error', error: e.message })
    }
  }

  const calc = useMemo(
    () => calculate({ sell, buy: buy === '' ? null : buy, feePct, shipping }),
    [sell, buy, feePct, shipping],
  )
  const links = searchLinks({ brand, name, model })
  const canSearch = (name || brand || model).trim().length > 0
  const verdict = calc.verdict ? VERDICT_TEXT[calc.verdict] : null

  async function save() {
    setErr('')
    setBusy(true)
    try {
      await store.save({
        id: initial.id,
        createdAt: initial.createdAt,
        name: name.trim() || 'Unnamed item',
        brand: brand.trim(),
        model: model.trim(),
        condition,
        photo,
        purchasePrice: buy === '' ? null : num(buy),
        sellPrice: sell === '' ? null : num(sell),
        feePct: num(feePct),
        shipping: num(shipping),
        profit: calc.profit,
        verdict: calc.verdict,
        priceSource: sellSource,
      })
      onChanged()
    } catch (e) {
      setErr(e.message)
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm('Delete this find for both of you?')) return
    setBusy(true)
    try {
      await store.remove(initial.id)
      onChanged()
    } catch (e) {
      setErr(e.message)
      setBusy(false)
    }
  }

  const canReestimate = aiAvailable && (initial.aiImage || photo) && ai.status !== 'loading'

  return (
    <div className="item">
      <header className="topbar">
        <button className="back" onClick={onBack} aria-label="Back">
          <Icon name="back" /> Back
        </button>
        <strong>{isNew ? 'New item' : 'Saved find'}</strong>
        <span style={{ width: 64 }} />
      </header>

      <main className="page">
        {photo && <img className="photo" src={photo} alt="Item" />}

        {/* ---------- 1. what is it ---------- */}
        <section className="card">
          <div className="row-between">
            <h3>What is it?</h3>
            <Confidence ai={ai} manual={!isNew} />
          </div>
          {ai.status === 'loading' && <p className="loading"><span className="spinner" /> Identifying with AI…</p>}
          {ai.status === 'off' && <p className="muted small">AI scanning is not set up yet, so fill in the details by hand (see README to switch it on).</p>}
          {ai.status === 'error' && <p className="error">{ai.error}</p>}
          <label>
            Product name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Seiko 5 automatic watch" />
          </label>
          <div className="two">
            <label>
              Brand
              <input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </label>
            <label>
              Model
              <input value={model} onChange={(e) => setModel(e.target.value)} />
            </label>
          </div>
          <label>
            Condition
            <select value={condition} onChange={(e) => setCondition(e.target.value)}>
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          {canReestimate && (
            <button className="secondary" onClick={() => runAi(true)}>
              Re-estimate with my corrections
            </button>
          )}
        </section>

        {/* ---------- 2. value ---------- */}
        <section className="card value">
          <h3>Estimated resale value</h3>
          <div className="big">{sell === '' ? '-' : eur(num(sell))}</div>
          {sellSource === 'ai' && sell !== '' ? (
            <p className="note">
              <strong>AI estimate, not a real market price.</strong>
              {ai.low != null && ai.high != null && ai.low !== ai.high ? ` AI range ${eur(ai.low)} - ${eur(ai.high)}.` : ''} Check the sold prices below before you trust it.
              {ai.notes ? <span className="muted small block">{ai.notes}</span> : null}
            </p>
          ) : sell !== '' ? (
            <p className="note ok">Your own price. Based on what you checked, not on the AI.</p>
          ) : (
            <p className="note">
              {ai.noPrice ? 'The AI could not price this item. ' : 'No price yet. '}
              Look it up with the buttons below and type what similar items sell for.
            </p>
          )}
          <div className="max">
            <span>Suggested max purchase price</span>
            <strong>{sell === '' ? '-' : eur(calc.maxBuy)}</strong>
          </div>
          <p className="muted small">Max price = the most you can pay and still make ≥ €10 profit and double your money, after selling costs.</p>
        </section>

        {/* ---------- 3. compare ---------- */}
        <section className="card">
          <h3>Check real prices</h3>
          <p className="muted small">Opens each marketplace's own search. Use eBay "sold" results first: they show what people really paid. The others show asking prices, which are usually higher.</p>
          <div className="links">
            {links.map((l) => (
              <a key={l.id} className={'market ' + l.id + (canSearch ? '' : ' disabled')} href={canSearch ? l.url : undefined} target="_blank" rel="noopener noreferrer">
                <span>
                  <strong>{l.label}</strong>
                  <small>{l.note}</small>
                </span>
                <Icon name="external" />
              </a>
            ))}
          </div>
          {!canSearch && <p className="muted small">Enter a product name first.</p>}
        </section>

        {/* ---------- 4. calculator ---------- */}
        <section className="card">
          <h3>Profit calculator</h3>
          <div className="two">
            <label>
              Selling price (€)
              <input
                inputMode="decimal"
                value={sell}
                onChange={(e) => {
                  setSell(e.target.value)
                  setSellSource('manual')
                }}
                placeholder="0"
              />
            </label>
            <label className="strong">
              Purchase price (€)
              <input inputMode="decimal" value={buy} onChange={(e) => setBuy(e.target.value)} placeholder="What are they asking?" />
            </label>
          </div>
          <div className="two">
            <label>
              Selling costs (%)
              <input inputMode="decimal" value={feePct} onChange={(e) => setFeePct(e.target.value)} />
            </label>
            <label>
              Shipping you pay (€)
              <input inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} />
            </label>
          </div>
          <div className="chips">
            {[['Pickup', 0], ['Small', 3.5], ['Medium', 6], ['Large', 12]].map(([l, v]) => (
              <button key={l} className={num(shipping) === v ? 'chip on' : 'chip'} onClick={() => setShipping(String(v))}>
                {l} {eur(v)}
              </button>
            ))}
          </div>

          <table className="sum">
            <tbody>
              <tr><td>Estimated selling price</td><td>{eur(calc.sell)}</td></tr>
              <tr><td>Selling costs ({num(feePct)}%)</td><td>− {eur(calc.fees)}</td></tr>
              <tr><td>Shipping paid by you</td><td>− {eur(calc.shipping)}</td></tr>
              <tr><td>Purchase price</td><td>{calc.hasBuy ? `− ${eur(calc.buy)}` : '-'}</td></tr>
              <tr className="total"><td>Estimated net profit</td><td className={calc.profit < 0 ? 'neg' : ''}>{calc.profit === null ? '-' : eur(calc.profit)}</td></tr>
              <tr><td>Return on investment</td><td>{pct(calc.roi)}</td></tr>
            </tbody>
          </table>

          {verdict ? (
            <div className={`verdict ${calc.verdict}`} role="status">
              <span className="light" />
              <div>
                <strong>{verdict.title}</strong>
                <span>{verdict.sub}</span>
              </div>
            </div>
          ) : (
            <div className="verdict none">
              <span className="light" />
              <div>
                <strong>Enter the purchase price</strong>
                <span>{sell === '' ? 'And the expected selling price.' : `Rule of thumb: pay no more than ${eur(calc.maxBuy)}.`}</span>
              </div>
            </div>
          )}
        </section>

        {err && <p className="error">{err}</p>}
        <div className="actions">
          <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : isNew ? 'Save to finds' : 'Save changes'}</button>
          {!isNew && <button className="danger" disabled={busy} onClick={remove}>Delete</button>}
        </div>
      </main>
    </div>
  )
}

function Confidence({ ai, manual }) {
  if (ai.status === 'done' && ai.confidence) {
    return <span className={`pill ${ai.confidence}`}>AI confidence: {ai.confidence}</span>
  }
  if (ai.status === 'loading') return null
  return <span className="pill none">{manual ? 'Saved' : 'Manual entry'}</span>
}
