// ---------------------------------------------------------------------------
// SETTINGS - the accessibility controls
// ---------------------------------------------------------------------------
// Every control here writes ONE key into settings, and the store pushes those
// keys onto <html data-*>. No component subscribes to "is colour-blind mode
// on?" - the CSS does. That is why adding a third palette later is a block of
// CSS plus one more <option>, with no component edits at all.
// ---------------------------------------------------------------------------
import React from 'react'
import { Icon } from './Icon.jsx'
import { useStore } from '../state/store.jsx'
import { useSpeech } from '../hooks/useSpeech.js'
import { useDictation } from '../hooks/useDictation.js'
import { requestNotificationPermission } from '../hooks/useReminders.js'
import './Views.css'

/** A labelled on/off switch. Uses a real checkbox under the hood. */
function Toggle({ label, hint, checked, onChange, disabled, disabledHint }) {
  return (
    <label className={`toggle ${disabled ? 'is-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled}
             onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__text">
        <strong>{label}</strong>
        <span className="toggle__hint">{disabled ? disabledHint : hint}</span>
      </span>
    </label>
  )
}

export function SettingsTab() {
  const { state, actions } = useStore()
  const speech = useSpeech()
  const dictation = useDictation()
  const s = state.settings

  return (
    <div className="stack">
      <h1 className="page__title">Settings</h1>

      {/* ---- Vision ------------------------------------------------------ */}
      <section className="card" aria-labelledby="set-vision">
        <h2 className="panel__title" id="set-vision">Seeing the app</h2>

        <fieldset className="choices">
          <legend>Colour palette</legend>
          {[
            { id: 'default', label: 'Default', hint: 'Red stamps, yellow highlights' },
            { id: 'colourblind', label: 'Colour-blind friendly', hint: 'Blue and orange instead of red and green' },
          ].map((option) => (
            <label key={option.id} className={`choice ${s.palette === option.id ? 'is-on' : ''}`}>
              <input
                type="radio" name="palette" value={option.id}
                checked={s.palette === option.id}
                onChange={() => {
                  actions.setSetting('palette', option.id)
                  actions.announce(`${option.label} palette on`)
                }}
              />
              <span><strong>{option.label}</strong><span className="choice__hint">{option.hint}</span></span>
            </label>
          ))}
        </fieldset>

        <p className="panel__hint">
          Either way, nothing in PackPal relies on colour alone — packed items
          are stamped with the word, and priorities carry a “!” badge.
        </p>

        <fieldset className="choices">
          <legend>Text size</legend>
          {[['100', 'Normal'], ['115', 'Large'], ['130', 'Largest']].map(([value, label]) => (
            <label key={value} className={`choice ${s.textScale === value ? 'is-on' : ''}`}>
              <input type="radio" name="scale" value={value}
                     checked={s.textScale === value}
                     onChange={() => actions.setSetting('textScale', value)} />
              <span><strong>{label}</strong></span>
            </label>
          ))}
        </fieldset>

        <Toggle
          label="Reduce motion"
          hint="Turns off the progress bar animation and transitions."
          checked={s.reduceMotion}
          onChange={(v) => actions.setSetting('reduceMotion', v)}
        />
      </section>

      {/* ---- Audio ------------------------------------------------------- */}
      <section className="card" aria-labelledby="set-audio">
        <h2 className="panel__title" id="set-audio">Listening and speaking</h2>

        <Toggle
          label="Say items out loud as you pack"
          hint="Confirms each tick, and reads the next item in packing mode."
          checked={s.speakOnToggle}
          onChange={(v) => actions.setSetting('speakOnToggle', v)}
          disabled={!speech.supported}
          disabledHint="This browser has no speech synthesis."
        />

        <button
          type="button" className="btn" style={{ marginTop: 'var(--sp-3)' }}
          disabled={!speech.supported}
          onClick={() => speech.speak('PackPal will read your list like this.')}
        >
          <Icon name="speaker" size={18} /> Test the voice
        </button>

        <p className="panel__hint">
          Voice input is {dictation.supported ? 'available' : 'not supported in this browser'}.
          {dictation.supported
            ? ' Use the mic on any Add field, or say “packed”, “skip” and item names in packing mode.'
            : ' Try Chrome, Edge, or Safari to dictate items.'}
        </p>
      </section>

      {/* ---- Reminders --------------------------------------------------- */}
      <section className="card" aria-labelledby="set-reminders">
        <h2 className="panel__title" id="set-reminders">Reminders</h2>
        <Toggle
          label="Notify me before an event"
          hint="Each alert lists the items you still have to pack."
          checked={s.notifications}
          onChange={async (want) => {
            if (!want) { actions.setSetting('notifications', false); return }
            const granted = await requestNotificationPermission()
            actions.setSetting('notifications', granted)
            if (!granted) actions.announce('Your browser refused notification permission')
          }}
        />
        <p className="panel__hint">
          Alerts arrive while PackPal is open. Background delivery needs a push
          server — see the note in <code>src/hooks/useReminders.js</code>.
        </p>
      </section>

      {/* ---- Data -------------------------------------------------------- */}
      <section className="card" aria-labelledby="set-data">
        <h2 className="panel__title" id="set-data">Your data</h2>
        <p className="panel__hint">
          Everything is stored on this device only. Nothing is uploaded, and the
          app works with no connection once installed.
        </p>
        <button
          type="button" className="btn btn--ghost btn--danger"
          onClick={() => {
            if (window.confirm('Delete every event? Your saved kits are kept.')) actions.resetAll()
          }}
        >
          <Icon name="trash" size={16} /> Clear all events
        </button>
      </section>
    </div>
  )
}
