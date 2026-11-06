import { supabase, cloudEnabled } from '../supabase.js'
import { defaultSettings } from '../settings.js'

export default function Settings({ settings, onChange, session, count }) {
  return (
    <section>
      <h2>Settings</h2>

      <div className="card">
        <h3>Storage</h3>
        {cloudEnabled ? (
          <>
            <p>Shared storage is <strong>on</strong>. Signed in as <strong>{session?.user?.email}</strong>. Everything you save is visible on every phone using this login.</p>
            <button className="secondary" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </>
        ) : (
          <p className="warn">
            Shared storage is <strong>not set up</strong>. Your {count} find{count === 1 ? '' : 's'} are saved on this phone only, and AI scanning is off (you fill in details by hand). See the README to switch on sharing + AI.
          </p>
        )}
      </div>

      <div className="card">
        <h3>Default selling costs</h3>
        <p className="muted small">Used for every new item (you can still change them per item). These are rough assumptions, not platform quotes.</p>
        <label>
          Fees &amp; packaging (% of selling price)
          <input inputMode="decimal" value={settings.feePct} onChange={(e) => onChange({ ...settings, feePct: e.target.value })} />
        </label>
        <label>
          Shipping paid by seller (€)
          <input inputMode="decimal" value={settings.shipping} onChange={(e) => onChange({ ...settings, shipping: e.target.value })} />
        </label>
        <button className="link" onClick={() => onChange({ ...defaultSettings })}>Reset to defaults</button>
      </div>

      <div className="card">
        <h3>How the traffic light works</h3>
        <ul className="plain">
          <li><span className="dot green" /> <strong>Good deal</strong>: profit ≥ €10 and at least doubles your money (ROI ≥ 100%)</li>
          <li><span className="dot orange" /> <strong>Possible deal</strong>: profit ≥ €5 and ROI ≥ 40%</li>
          <li><span className="dot red" /> <strong>Not worth buying</strong>: anything less</li>
        </ul>
      </div>
    </section>
  )
}
