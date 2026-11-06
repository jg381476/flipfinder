import { FindRow } from './bits.jsx'
import { eur } from '../calc.js'

export default function Finds({ finds, loading, error, onRetry, onOpen }) {
  const total = finds.reduce((s, f) => s + (f.profit > 0 ? f.profit : 0), 0)
  return (
    <section>
      <h2>Saved finds</h2>
      {finds.length > 0 && (
        <p className="muted">
          {finds.length} item{finds.length === 1 ? '' : 's'} · potential profit if all sell: <strong>{eur(Math.round(total * 100) / 100)}</strong>
        </p>
      )}
      {error && (
        <p className="error">
          Could not load finds: {error} <button className="link" onClick={onRetry}>Retry</button>
        </p>
      )}
      {loading && <p className="muted">Loading…</p>}
      {!loading && !error && finds.length === 0 && <p className="empty">Nothing saved yet.</p>}
      <div className="list">
        {finds.map((f) => (
          <FindRow key={f.id} f={f} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}
