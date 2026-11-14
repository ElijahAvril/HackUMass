// ---------------------------------------------------------------------------
// TEXT TO SPEECH  (read the list aloud)
// ---------------------------------------------------------------------------
// Wraps the browser's built-in SpeechSynthesis API. No library, no API key,
// works offline - which matters for an installable PWA.
//
// Everything that wants to talk goes through this one hook, so if you later
// swap to a cloud voice you change this file and nothing else.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from 'react'

export function useSpeech() {
  // Feature-detect once. Safari on older iOS and some embedded webviews lack it;
  // the UI hides the read-aloud buttons when this is false rather than offering
  // a button that silently does nothing.
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)
  const queueRef = useRef([])

  // Always cancel on unmount, otherwise the voice keeps reading after you
  // navigate away - a genuinely unpleasant bug to demo.
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel() }, [supported])

  const stop = useCallback(() => {
    if (!supported) return
    queueRef.current = []
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  /**
   * Speak one string. `interrupt` (default true) cancels whatever is playing,
   * which is what you want for rapid checkbox ticking - you don't want a
   * backlog of six item names queued up.
   */
  const speak = useCallback((text, { interrupt = true, rate = 1 } = {}) => {
    if (!supported || !text) return
    if (interrupt) window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rate
    utterance.lang = document.documentElement.lang || 'en-US'
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [supported])

  /**
   * Speak a list of lines one after another with a short pause between them.
   * Used by "Read list aloud": each item is a separate utterance so the pause
   * lands between items and the user can follow along.
   */
  const speakSequence = useCallback((lines, { rate = 1 } = {}) => {
    if (!supported || !lines.length) return
    window.speechSynthesis.cancel()
    setSpeaking(true)
    lines.forEach((line, index) => {
      const utterance = new SpeechSynthesisUtterance(line)
      utterance.rate = rate
      utterance.lang = document.documentElement.lang || 'en-US'
      if (index === lines.length - 1) utterance.onend = () => setSpeaking(false)
      window.speechSynthesis.speak(utterance)
    })
  }, [supported])

  return { supported, speaking, speak, speakSequence, stop }
}
