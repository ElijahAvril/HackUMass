// ---------------------------------------------------------------------------
// SETTINGS - the accessibility controls
// ---------------------------------------------------------------------------
// Every control here writes ONE key into settings, and the store pushes those
// keys onto <html data-*> so CSS can apply app-wide accessibility preferences.
// ---------------------------------------------------------------------------
import React, { useState } from 'react'
import { Icon } from './Icon.jsx'
import { useStore } from '../state/store.jsx'
import { useSpeech } from '../hooks/useSpeech.js'
import { useDictation } from '../hooks/useDictation.js'
import { requestNotificationPermission } from '../hooks/useReminders.js'
import { useUser } from './AuthGate.jsx'
import { firebaseReady } from '../data/firebase.js'
import { logOut, linkGuestToGoogle, friendlyAuthError } from '../data/auth.js'
import './Views.css'
import './Login.css'

/** Who is signed in, plus Sign out / Save to Google. */
function AccountCard() {
  const user = useUser()
  const { actions } = useStore()
  const [error, setError] = useState('')

  if (!firebaseReady) {
    return (
      <section className="card" aria-labelledby="set-account">
        <h2 className="panel__title" id="set-account">Account</h2>
        <p className="panel__hint" style={{ margin: 0 }}>
          Sign-in isn&apos;t set up on this computer yet, so lists are saved in this browser only.
          Add the <code>.env.local</code> file with the Firebase keys and restart <code>npm run dev</code>.
        </p>
      </section>
    )
  }
  if (!user) return null

  const name = user.isAnonymous ? 'Guest' : (user.displayName || 'Signed in')
  const initial = name.trim().charAt(0).toUpperCase()

  return (
    <section className="card" aria-labelledby="set-account">
      <h2 className="panel__title" id="set-account">Account</h2>
      <div className="account">
        <span className="account__avatar" aria-hidden="true">
          {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : initial}
        </span>
        <span className="account__who">
          <strong>{name}</strong>
          <span>
            {user.isAnonymous
              ? 'Lists are saved, but only on this device until you add a Google account.'
              : `${user.email} · lists sync to every device you sign in on`}
          </span>
        </span>
      </div>

      <div className="account__actions">
        {user.isAnonymous ? (
          <button
            type="button" className="btn btn--primary"
            onClick={async () => {
              setError('')
              try {
                await linkGuestToGoogle()
                actions.announce('Your lists are now saved to your Google account')
              } catch (err) { setError(friendlyAuthError(err)) }
            }}
          >
            <Icon name="user" size={18} /> Save my lists to Google
          </button>
        ) : null}
        <button
          type="button" className="btn"
          onClick={() => {
            if (user.isAnonymous && !window.confirm('Guest lists are deleted when you sign out. Sign out anyway?')) return
            logOut()
          }}
        >
          <Icon name="logout" size={18} /> Sign out
        </button>
      </div>
      {error ? <p className="login__error" role="alert" style={{ marginTop: 'var(--sp-3)' }}>{error}</p> : null}
    </section>
  )
}

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

      <AccountCard />

      {/* ---- Reading ----------------------------------------------------- */}
      <section className="card" aria-labelledby="set-reading">
        <h2 className="panel__title" id="set-reading">Reading and display</h2>

        <Toggle
          label="Use OpenDyslexic font"
          hint="Changes the font throughout the app. Your choice is saved on this device."
          checked={s.dyslexicFont}
          onChange={(enabled) => {
            actions.setSetting('dyslexicFont', enabled)
            actions.announce(`OpenDyslexic font ${enabled ? 'on' : 'off'}`)
          }}
        />

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
          onClick={() => speech.speak('Packuroo will read your list like this.')}
        >
          <Icon name="speaker" size={18} /> Test the voice
        </button>

        <p className="panel__hint">
          Voice input is {dictation.supported ? 'available' : 'not supported in this browser'}.
          {dictation.supported
            ? ' Dictation uses the Gemini speech service. Use a microphone on an Add field or say “packed”, “skip” and item names in packing mode.'
            : ' Use a browser with microphone and audio worklet support, such as a recent Chrome or Edge.'}
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
          Alerts arrive while Packuroo is open. Background delivery needs a push
          server — see the note in <code>src/hooks/useReminders.js</code>.
        </p>
      </section>

      {/* ---- Data -------------------------------------------------------- */}
      <section className="card" aria-labelledby="set-data">
        <h2 className="panel__title" id="set-data">Your data</h2>
        <p className="panel__hint">
          {firebaseReady
            ? 'Your lists are saved to your account and also kept on this device, so they open with no connection and upload when you are back online.'
            : 'Everything is stored on this device only. Nothing is uploaded, and the app works with no connection once installed.'}
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
