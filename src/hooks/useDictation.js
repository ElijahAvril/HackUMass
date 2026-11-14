// ---------------------------------------------------------------------------
// SPEECH TO TEXT  (voice input)
// ---------------------------------------------------------------------------
// Streams microphone audio to the server's Gemini transcription service. Used two ways:
//   * dictate an item name into the Add-item form (hands full of luggage)
//   * voice commands in packing mode: "pack the blazer", "next", "what's left"
//
// The component hides the mic button when the required browser audio APIs are
// unavailable, rather than rendering a control that cannot work.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from 'react'
import { SpeechToTextClient } from '../speech-to-text-client.js'

export function useDictation({ onResult, continuous = false } = {}) {
  const supported = typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof window.AudioContext === 'function'
    && typeof window.AudioWorkletNode === 'function'
    && typeof window.WebSocket === 'function'
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const clientRef = useRef(null)
  const activeRef = useRef(false)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    if (!supported) return undefined
    const client = new SpeechToTextClient({
      onEvent(event) {
        if (clientRef.current !== client) return
        if (event.type === 'speech_to_text.transcript' && event.text?.trim()) {
          onResultRef.current?.(event.text.trim())
        } else if (event.type === 'error') {
          activeRef.current = false
          setListening(false)
          setError(event.message || 'Speech recognition had a problem. Try again.')
        }
      },
      onError(cause) {
        if (clientRef.current !== client) return
        activeRef.current = false
        setListening(false)
        setError(cause instanceof Error ? cause.message : 'Speech recognition had a problem. Try again.')
      },
      onStatus(message) {
        if (clientRef.current !== client) return
        if (message.startsWith('Disconnected')) {
          activeRef.current = false
          setListening(false)
          setError(message)
        }
      }
    })
    clientRef.current = client
    return () => {
      clientRef.current = null
      activeRef.current = false
      void client.close().catch((cause) => {
        console.error('Could not close the speech-to-text connection:', cause)
      })
    }
  }, [supported])

  const start = useCallback(async () => {
    if (!supported || activeRef.current) return
    activeRef.current = true
    setError('')
    setListening(true)
    try {
      await clientRef.current.start()
    } catch (cause) {
      activeRef.current = false
      setListening(false)
      setError(cause instanceof Error ? cause.message : 'Voice input had a problem. Try again.')
    }
  }, [supported])

  const stop = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false
    setListening(false)
    void clientRef.current?.stop().catch((cause) => {
      setError(cause instanceof Error ? cause.message : 'Voice input had a problem. Try again.')
    })
  }, [])

  const toggle = useCallback(() => {
    if (activeRef.current) stop()
    else void start()
  }, [start, stop])

  return { supported, listening, error, start, stop, toggle }
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
