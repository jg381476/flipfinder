import { useRef, useState } from 'react'
import { resizeImage } from '../image.js'
import { Logo, FindRow } from './bits.jsx'

export default function Home({ finds, loading, error, onRetry, onOpen, onSeeAll }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow choosing the same photo again
    if (!file) return
    setBusy(true)
    setErr('')
    try {
      const [aiImage, photo] = await Promise.all([resizeImage(file, 1024, 0.8), resizeImage(file, 600, 0.68)])
      onOpen({ key: 'new-' + Date.now(), isNew: true, photo, aiImage })
    } catch (ex) {
      setErr(ex.message || 'Could not open that photo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="hero">
        <Logo big />
        <p className="muted">Snap it. Price it. Flip it.</p>
        {/* No "capture" attribute on purpose: phones then offer Take Photo AND Photo Library. */}
        <input ref={input} type="file" accept="image/*" hidden onChange={onFile} />
        <button className="scan" disabled={busy} onClick={() => input.current.click()}>
          {busy ? 'Preparing photo…' : 'SCAN ITEM'}
        </button>
        <button className="link" onClick={() => onOpen({ key: 'manual-' + Date.now(), isNew: true, photo: '' })}>
          or enter an item by hand
        </button>
        {err && <p className="error">{err}</p>}
      </section>

      <section>
        <div className="row-between">
          <h2>Saved finds</h2>
          {finds.length > 3 && (
            <button className="link" onClick={onSeeAll}>
              See all ({finds.length})
            </button>
          )}
        </div>
        {error && (
          <p className="error">
            Could not load finds: {error} <button className="link" onClick={onRetry}>Retry</button>
          </p>
        )}
        {loading && <p className="muted">Loading…</p>}
        {!loading && !error && finds.length === 0 && <p className="empty">Nothing saved yet. Scan your first item!</p>}
        <div className="list">
          {finds.slice(0, 3).map((f) => (
            <FindRow key={f.id} f={f} onOpen={onOpen} />
          ))}
        </div>
      </section>
    </>
  )
}
