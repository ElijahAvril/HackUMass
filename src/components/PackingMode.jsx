// ---------------------------------------------------------------------------
// PACKING MODE - the full-screen, one-item-at-a-time view
// ---------------------------------------------------------------------------
// Why a separate mode at all: the checklist view is for PLANNING (sitting at a
// desk, adding things). Packing mode is for DOING - standing in a room, phone
// in one hand. So it strips everything except the current item, shows it very
// large, reads it aloud, and accepts voice commands.
//
// Order comes from selectRemainingItems, which puts flagged items first. That
// is the flagged-item requirement doing real work: the thing you always forget
// is literally the first thing this screen asks you for.
//
// VOICE COMMANDS (continuous recognition while the mic is on):
//   "packed" / "got it" / "yes"  -> tick the current item
//   "skip" / "next"              -> move on without ticking
//   "repeat" / "where"           -> read the item and its location again
//   or just say the item's name  -> ticks that item, wherever it is in the list
// ---------------------------------------------------------------------------
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon.jsx'
import { useStore } from '../state/store.jsx'
import { useSpeech } from '../hooks/useSpeech.js'
import { useDictation, matchSpokenItem } from '../hooks/useDictation.js'
import { selectProgress, selectRemainingItems } from '../state/selectors.js'
import './Packing.css'

export function PackingMode({ event }) {
  const { state, actions } = useStore()
  const speech = useSpeech()
  const [index, setIndex] = useState(0)

  const remaining = useMemo(() => selectRemainingItems(event), [event])
  const progress = selectProgress(event)
  const current = remaining[Math.min(index, Math.max(remaining.length - 1, 0))]

  const say = useCallback((item) => {
    if (!item) return
    speech.speak(item.note ? `${item.name}. Kept: ${item.note}` : item.name)
  }, [speech])

  // Announce each new item as it comes up, if read-aloud is on.
  useEffect(() => {
    if (state.settings.speakOnToggle) say(current)
    // Intentionally keyed on the item id only: re-speaking on every render
    // would stutter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  const packItem = useCallback((item) => {
    if (!item) return
    actions.toggleItem(event.id, item.categoryId, item.id, true)
    actions.announce(`${item.name} packed`)
    // Index stays put: the array shrinks under it, so the next unpacked item
    // slides into the same slot. Simpler than incrementing and clamping.
  }, [actions, event.id])

  // ---- Voice command handling --------------------------------------------
  const handleSpeech = useCallback((phrase) => {
    const text = phrase.toLowerCase()
    if (/\b(packed|got it|done|yes|yep|check)\b/.test(text)) { packItem(current); return }
    if (/\b(skip|next|later)\b/.test(text)) { setIndex((i) => (i + 1) % Math.max(remaining.length, 1)); return }
    if (/\b(repeat|again|where)\b/.test(text)) { say(current); return }
    // Fall back to matching the phrase against item names, so you can pack
    // things out of order: "water bottle" ticks the water bottle.
    const match = matchSpokenItem(text, remaining)
    if (match) packItem(match)
  }, [current, remaining, packItem, say])

  const dictation = useDictation({ onResult: handleSpeech, continuous: true })

  // Stop the mic and any speech when leaving the mode.
  useEffect(() => () => { dictation.stop(); speech.stop() }, []) // eslint-disable-line

  const done = remaining.length === 0

  return (
    <div className="packing" role="region" aria-label={`Packing mode for ${event.title}`}>
      <header className="packing__bar">
        <button type="button" className="btn" onClick={actions.stopPacking}>
          <Icon name="back" size={18} /> Done for now
        </button>
        <p className="packing__title">{event.title}</p>
        <p className="packing__count" aria-live="polite">
          {progress.packed} of {progress.total}
        </p>
      </header>

      <div className="packing__track" role="progressbar" aria-valuemin={0} aria-valuemax={100}
           aria-valuenow={progress.percent}
           aria-valuetext={`${progress.packed} of ${progress.total} packed`}>
        <span style={{ width: `${progress.percent}%` }} />
      </div>

      {done ? (
        <div className="packing__done">
          <Icon name="check" size={64} strokeWidth={2.5} />
          <h2>Everything is packed</h2>
          <p>{progress.total} item{progress.total === 1 ? '' : 's'} for {event.title}.</p>
          <button type="button" className="btn btn--primary btn--xl" onClick={actions.stopPacking}>
            Back to the list
          </button>
        </div>
      ) : (
        <>
          {/* The current item, as large as the screen allows. */}
          <div className="packing__card" aria-live="polite">
            {current.flagged ? (
              <p className="packing__flag"><Icon name="warning" size={18} /> Priority — {current.flagReason || 'easy to forget'}</p>
            ) : null}
            <p className="packing__cat">{current.categoryName}</p>
            <h2 className="packing__item">{current.name}</h2>
            {current.note ? (
              <p className="packing__where"><Icon name="pin" size={20} /> {current.note}</p>
            ) : (
              <p className="packing__where packing__where--none">No location saved for this one</p>
            )}
          </div>

          <div className="packing__controls">
            <button type="button" className="btn btn--xl packing__primary" onClick={() => packItem(current)}>
              <Icon name="check" size={26} strokeWidth={2.6} /> Packed it
            </button>

            <div className="packing__secondary">
              <button type="button" className="btn" onClick={() => setIndex((i) => (i + 1) % remaining.length)}>
                <Icon name="forward" size={18} /> Skip
              </button>
              {speech.supported ? (
                <button type="button" className="btn" onClick={() => say(current)}>
                  <Icon name="speaker" size={18} /> Say it again
                </button>
              ) : null}
              {dictation.supported ? (
                <button
                  type="button"
                  className={`btn ${dictation.listening ? 'packing__mic--on' : ''}`}
                  onClick={dictation.toggle}
                  aria-pressed={dictation.listening}
                >
                  <Icon name="mic" size={18} /> {dictation.listening ? 'Listening' : 'Use voice'}
                </button>
              ) : null}
            </div>

            {dictation.listening ? (
              <p className="packing__hint" aria-live="polite">
                Say “packed”, “skip”, “repeat”, or an item’s name.
              </p>
            ) : (
              <p className="packing__hint">{remaining.length} left on the list</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
