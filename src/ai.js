import { supabase, cloudEnabled } from './supabase.js'

export const aiAvailable = cloudEnabled

// Sends the photo to our own Supabase Edge Function, which holds the AI key.
// hints = the user's manual corrections (optional).
export async function identify(imageDataUrl, hints) {
  if (!aiAvailable) throw new Error('AI is not set up. Fill in the details by hand.')
  const base64 = imageDataUrl.split(',')[1]
  const { data, error } = await supabase.functions.invoke('identify', { body: { image: base64, mime: 'image/jpeg', hints } })
  if (error) {
    let msg = error.message
    try {
      const body = await error.context?.json?.()
      if (body?.error) msg = body.error
    } catch {
      /* keep default */
    }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor / for parts' },
]
