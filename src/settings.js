import { DEFAULT_FEE_PCT, DEFAULT_SHIPPING } from './calc.js'

const KEY = 'flipfinder.settings'
export const defaultSettings = { feePct: DEFAULT_FEE_PCT, shipping: DEFAULT_SHIPPING }

export function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...defaultSettings }
  }
}
export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}
