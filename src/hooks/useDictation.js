// ---------------------------------------------------------------------------
// SPEECH TO TEXT  (voice input)
// ---------------------------------------------------------------------------
// Wraps the Web Speech API's SpeechRecognition. Used two ways:
//   * dictate an item name into the Add-item form (hands full of luggage)
//   * voice commands in packing mode: "pack the blazer", "next", "what's left"
//
// Support is Chrome/Edge/Safari-ish. We feature-detect and the component hides
// the mic button where unsupported, so there's no dead control in the UI.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from 'react'

const Recognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

export function useDictation({ onResult, continuous = false } = {}) {
  const supported = Boolean(Recognition)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)
  // Keeping the callback in a ref means re-rendering the parent doesn't tear
  // down and rebuild the recogniser mid-sentence.
  const onResultRef = useRef(onResult)
  useEffect(() => { onResultRef.current = onResult }, [onResult])

  useEffect(() => {
    if (!supported) return undefined
    const recognition = new Recognition()
    recognition.continuous = continuous
    recognition.interimResults = true   // lets us show words as they're spoken
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interimText += result[0].transcript
      }
      setTranscript(finalText || interimText)
      if (finalText) onResultRef.current?.(finalText.trim())
    }

    recognition.onerror = (event) => {
      // 'no-speech' and 'aborted' are normal, not worth alarming the user about.
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(
          event.error === 'not-allowed'
            ? 'Microphone permission was blocked.'
            : 'Voice input had a problem. Try again.'
        )
      }
      setListening(false)
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    return () => { recognition.abort() }
  }, [supported, continuous])

  const start = useCallback(() => {
    if (!supported || listening) return
    setError(''); setTranscript('')
    try { recognitionRef.current?.start(); setListening(true) }
    catch { /* start() throws if already running - safe to ignore */ }
  }, [supported, listening])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return { supported, listening, transcript, error, start, stop, toggle: () => (listening ? stop() : start()) }
}

/**
 * Matches a spoken phrase against item names.
 *
 * Deliberately fuzzy: speech recognition drops articles and mangles plurals,
 * so we score on shared words rather than requiring an exact match. Returns
 * the best item above a confidence floor, or null.
 *
 * Tweak SCORE_FLOOR if the demo mic is picking the wrong item.
 */
const SCORE_FLOOR = 0.34
export function matchSpokenItem(phrase, items) {
  const clean = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  const stop = new Set(['the', 'a', 'an', 'my', 'pack', 'packed', 'check', 'off', 'tick', 'got', 'i', 'have'])
  const spoken = clean(phrase).filter((w) => !stop.has(w))
  if (!spoken.length) return null

  let best = null
  let bestScore = 0
  for (const item of items) {
    const words = clean(item.name)
    const hits = words.filter((w) => spoken.includes(w)).length
    const score = hits / Math.max(words.length, 1)
    if (score > bestScore) { bestScore = score; best = item }
  }
  return bestScore >= SCORE_FLOOR ? best : null
}
