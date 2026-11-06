import { useState } from 'react'
import { supabase } from '../supabase.js'
import { Logo } from './bits.jsx'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setErr(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message)
    setBusy(false)
  }

  return (
    <div className="app login">
      <Logo big />
      <p className="muted">Sign in with the shared FlipFinder login. You only need to do this once per phone.</p>
      <form onSubmit={submit}>
        <label>
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  )
}
