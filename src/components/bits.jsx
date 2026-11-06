import { eur } from '../calc.js'

export function Logo({ big }) {
  return (
    <div className={big ? 'logo big' : 'logo'}>
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={big ? 56 : 32} height={big ? 56 : 32} />
      <span>FlipFinder</span>
    </div>
  )
}

const paths = {
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  list: <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
}
export function Icon({ name }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

export function Dot({ verdict }) {
  return <span className={`dot ${verdict || 'none'}`} title={verdict || 'no verdict'} />
}

export function FindRow({ f, onOpen }) {
  const date = new Date(f.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <button className="find" onClick={() => onOpen({ ...f, key: f.id })}>
      {f.photo ? <img src={f.photo} alt="" /> : <div className="noimg" />}
      <div className="find-main">
        <strong>{f.name}</strong>
        <span className="muted small">
          Paid {eur(f.purchasePrice)} · Sell {eur(f.sellPrice)}
        </span>
        <span className="muted small">{date}</span>
      </div>
      <div className="find-profit">
        <Dot verdict={f.verdict} />
        <strong className={f.profit < 0 ? 'neg' : ''}>{f.profit === null || f.profit === undefined ? '-' : (f.profit > 0 ? '+' : '') + eur(f.profit)}</strong>
        <span className="muted small">profit</span>
      </div>
    </button>
  )
}
