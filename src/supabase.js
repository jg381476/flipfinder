import { createClient } from '@supabase/supabase-js'

// These two values are PUBLIC by design (the anon key only works together with the
// row-level-security rules in supabase/schema.sql). Real secrets (the AI key)
// live only inside the Supabase Edge Function and are never in this code.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const cloudEnabled = Boolean(url && key)
export const supabase = cloudEnabled ? createClient(url, key) : null
