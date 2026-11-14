// ---------------------------------------------------------------------------
// ITEM ROW - one line of a checklist
// ---------------------------------------------------------------------------
// This is the most-reused component in the app and the one most likely to be
// edited during the hackathon, so it keeps a deliberately small contract:
// it receives an item plus callbacks and owns no state of its own.
//
// ACCESSIBILITY NOTES (please keep these if you restyle):
//  * The checkbox is a REAL <input type="checkbox">, visually restyled. A div
//    with role="checkbox" would need manual keyboard and state handling that
//    is easy to get subtly wrong.
//  * The <label> wraps the name, so tapping anywhere on the text toggles it -
//    a much bigger target than the box itself.
//  * "PACKED" is a word, not just a red colour, and the flag has a "!" badge
//    and the word "Priority". Colour is never the only carrier of meaning.
// ---------------------------------------------------------------------------
import React from 'react'
import { Icon, pickItemIcon } from './Icon.jsx'

export function ItemRow({
  item,
  onToggle,
  onRemove,
  onToggleFlag,
  onSpeak,
  speechSupported,
}) {
  const iconName = pickItemIcon(item.name)
  const inputId = `item-${item.id}`

  return (
    <li className={`item ${item.packed ? 'is-packed' : ''} ${item.flagged && !item.packed ? 'is-flagged' : ''}`}>
      <div className="item__main">
        <span className="item__glyph" aria-hidden="true"><Icon name={iconName} size={20} /></span>

        <label className="item__label" htmlFor={inputId}>
          <span className="item__name">{item.name}</span>
          {/* The "where it's kept" note. Rendered only when present so empty
              notes don't leave a gap. */}
          {item.note ? <span className="item__note">{item.note}</span> : null}
        </label>

        {/* Status word + checkbox, mirroring the paper-stamp mockup. */}
        <span className={`item__status ${item.packed ? 'item__status--packed' : ''}`} aria-hidden="true">
          {item.packed ? 'PACKED' : 'To pack'}
        </span>

        <input
          id={inputId}
          className="item__check"
          type="checkbox"
          checked={item.packed}
          onChange={(e) => onToggle(item.id, e.target.checked)}
          // The visible label is the item name; this adds the context a screen
          // reader user needs when tabbing straight onto the control.
          aria-describedby={item.note ? `${inputId}-note` : undefined}
        />
        {item.note ? <span id={`${inputId}-note`} className="sr-only">Kept: {item.note}</span> : null}
      </div>

      {/* Flag banner - the "you forgot this before" highlighter from the mockup.
          Shown only while the item is still unpacked, since a warning about a
          packed item is just noise. */}
      {item.flagged && !item.packed ? (
        <p className="item__flag">
          <Icon name="warning" size={16} />
          <span className="item__flag-tag">Priority</span>
          <span>{item.flagReason || 'Flagged so it stays at the top of the list'}</span>
        </p>
      ) : null}

      {/* Row actions. Always visible rather than hover-revealed: hover states
          don't exist on touch and are invisible to keyboard users. */}
      <div className="item__actions">
        {speechSupported ? (
          <button type="button" className="icon-btn" onClick={() => onSpeak(item)}>
            <Icon name="speaker" size={16} />
            <span className="sr-only">Read {item.name} aloud</span>
          </button>
        ) : null}

        <button
          type="button"
          className={`icon-btn ${item.flagged ? 'is-on' : ''}`}
          onClick={() => onToggleFlag(item.id)}
          aria-pressed={item.flagged}
        >
          <Icon name="warning" size={16} />
          <span className="sr-only">
            {item.flagged ? `Remove priority flag from ${item.name}` : `Flag ${item.name} as a priority`}
          </span>
        </button>

        <button type="button" className="icon-btn icon-btn--danger" onClick={() => onRemove(item.id)}>
          <Icon name="trash" size={16} />
          <span className="sr-only">Remove {item.name}</span>
        </button>
      </div>
    </li>
  )
}
