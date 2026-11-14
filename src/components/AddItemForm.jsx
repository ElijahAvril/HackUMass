// ---------------------------------------------------------------------------
// ADD ITEM FORM
// ---------------------------------------------------------------------------
// Two fields, because the requirement is explicitly "name AND description so
// you can note where things are kept".
//
// The note field is collapsed behind a disclosure by default: in the common
// case you type a name and hit Add, and the optional field doesn't slow that
// down or clutter the card. Expanding is one click and it stays expanded for
// the session once opened.
//
// The mic button dictates into whichever field is focused.
// ---------------------------------------------------------------------------
import React, { useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import { useDictation } from '../hooks/useDictation.js'

export function AddItemForm({ categoryName, onAdd }) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  // Which field dictation should write into. Defaults to the name field.
  const targetRef = useRef('name')

  const dictation = useDictation({
    onResult: (text) => {
      if (targetRef.current === 'note') setNote((prev) => `${prev} ${text}`.trim())
      else setName((prev) => `${prev} ${text}`.trim())
    },
  })

  const submit = (event) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed, note.trim())
    setName(''); setNote('')
  }

  return (
    <form className="additem" onSubmit={submit}>
      <div className="additem__row">
        <label className="sr-only" htmlFor={`add-${categoryName}`}>
          Add an item to {categoryName}
        </label>
        <input
          id={`add-${categoryName}`}
          className="input"
          placeholder="Add an item"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => { targetRef.current = 'name' }}
        />

        {/* Hide the mic where the browser lacks the audio APIs it needs. */}
        {dictation.supported ? (
          <button
            type="button"
            className={`btn btn--ghost additem__mic ${dictation.listening ? 'is-listening' : ''}`}
            onClick={dictation.toggle}
            aria-pressed={dictation.listening}
          >
            <Icon name="mic" size={18} />
            <span className="sr-only">
              {dictation.listening ? 'Stop voice input' : 'Add item using voice'}
            </span>
          </button>
        ) : null}

        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          <Icon name="plus" size={18} /> Add
        </button>
      </div>

      {/* Disclosure for the optional "where it's kept" note. */}
      <button
        type="button"
        className="additem__toggle"
        onClick={() => setShowNote((v) => !v)}
        aria-expanded={showNote}
      >
        <Icon name={showNote ? 'close' : 'plus'} size={14} />
        {showNote ? 'Hide note' : 'Add a note about where it is kept'}
      </button>

      {showNote ? (
        <label className="field additem__note">
          <span>Where is it kept? (optional)</span>
          <input
            className="input"
            placeholder="e.g. Top drawer of the desk"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onFocus={() => { targetRef.current = 'note' }}
          />
        </label>
      ) : null}

      {dictation.listening ? (
        <p className="additem__transcript" aria-live="polite">Listening…</p>
      ) : null}
      {dictation.error ? <p className="additem__error" role="alert">{dictation.error}</p> : null}
    </form>
  )
}
