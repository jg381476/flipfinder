import { useCallback, useEffect, useState } from 'react'
import { supabase, cloudEnabled } from './supabase.js'
import { store } from './store.js'
import { loadSettings, saveSettings } from './settings.js'
import Login from './components/Login.jsx'
import Home from './components/Home.jsx'
import Finds from './components/Finds.jsx'
import ItemScreen from './components/ItemScreen.jsx'
import Settings from './components/Settings.jsx'
import { Logo, Icon } from './components/bits.jsx'

export default function App() {
  const [session, setSession] = useState(cloudEnabled ? undefined : null)
  const [tab, setTab] = useState('home')
  const [item, setItem] = useState(null) // when set, the item screen is shown
  const [finds, setFinds] = useState([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    if (!cloudEnabled) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const signedIn = !cloudEnabled || Boolean(session)

  const reload = useCallback(async () => {
    try {
      setFinds(await store.list())
      setLoadError('')
    } catch (e) {
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load when signed in, and again whenever the app comes back to the foreground
  // (that is how you see what your partner saved).
  useEffect(() => {
    if (!signedIn) return
    reload()
    const onVis = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [signedIn, reload])

  // Android/iPhone back gesture: close the item screen instead of leaving the app
  useEffect(() => {
    if (!item) return
    window.history.pushState({ ff: 1 }, '')
    const onPop = () => setItem(null)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
    }
  }, [item === null]) // eslint-disable-line react-hooks/exhaustive-deps

  const closeItem = () => {
    if (window.history.state?.ff) window.history.back()
    else setItem(null)
  }

  if (session === undefined) return <div className="center muted">Loading…</div>
  if (!signedIn) return <Login />

  const changeSettings = (s) => {
    setSettings(s)
    saveSettings(s)
  }

  return (
    <div className="app">
      {item ? (
        <ItemScreen
          key={item.key}
          initial={item}
          settings={settings}
          onBack={closeItem}
          onChanged={() => {
            reload()
            closeItem()
          }}
        />
      ) : (
        <>
          {tab !== 'home' && (
            <header className="topbar">
              <Logo />
            </header>
          )}
          <main className="page">
            {tab === 'home' && (
              <Home finds={finds} loading={loading} error={loadError} onRetry={reload} onOpen={setItem} onSeeAll={() => setTab('finds')} />
            )}
            {tab === 'finds' && <Finds finds={finds} loading={loading} error={loadError} onRetry={reload} onOpen={setItem} />}
            {tab === 'settings' && <Settings settings={settings} onChange={changeSettings} session={session} count={finds.length} />}
          </main>
          <nav className="tabs">
            {[
              ['home', 'Scan', 'camera'],
              ['finds', 'Finds', 'list'],
              ['settings', 'Settings', 'gear'],
            ].map(([id, label, icon]) => (
              <button key={id} className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)}>
                <Icon name={icon} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  )
}
