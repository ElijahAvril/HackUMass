// ---------------------------------------------------------------------------
// LOGIN SCREEN (+ the small Splash used while loading)
// ---------------------------------------------------------------------------
// One big button. No sign-up form and no password: "Continue with Google"
// creates the account the first time and signs back in every time after.
// Fewer steps and nothing to remember is the accessible choice here.
// ---------------------------------------------------------------------------
import React, { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import { signInWithGoogle, signInAsGuest, friendlyAuthError } from '../data/auth.js'
import './Login.css'

/** Centered card for "Opening PackPal…", "Loading your lists…" and errors. */
export function Splash({ title, message }) {
  return (
    <main id="main" className="login">
      <section className="card login__card login__card--small" role="status" aria-live="polite">
        <span className="tape tape--left" aria-hidden="true" />
        <div className="login__brand">
          <span className="sidebar__mark" aria-hidden="true"><Icon name="bag" size={20} /></span> PackPal
        </div>
        <h1 className="login__splash">{title}</h1>
        {message ? <p className="login__sub">{message}</p> : <span className="login__spinner" aria-hidden="true" />}
      </section>
    </main>
  )
}

export function LoginScreen() {
  const [busy, setBusy] = useState('') // '' | 'google' | 'guest'
  const [error, setError] = useState('')
  const headingRef = useRef(null)

  // Move focus to the heading, so screen readers start at the top of the page.
  useEffect(() => { headingRef.current?.focus() }, [])

  const run = async (kind, fn) => {
    setBusy(kind); setError('')
    try { await fn() } // on success the auth listener swaps this screen out
    catch (err) { console.error(err); setError(friendlyAuthError(err)) }
    finally { setBusy('') }
  }

  return (
    <main id="main" className="login">
      <section className="card login__card" aria-labelledby="login-title">
        <span className="tape tape--left" aria-hidden="true" />
        <span className="tape tape--right" aria-hidden="true" />

        <div className="login__brand">
          <span className="sidebar__mark" aria-hidden="true"><Icon name="bag" size={22} /></span>
          PackPal
        </div>

        <h1 className="login__title" id="login-title" tabIndex={-1} ref={headingRef}>
          Never forget what to bring.
        </h1>
        <p className="login__sub">
          A packing list for every event, reminders that name the items, and kits you only make once.
        </p>

        <button
          type="button"
          className="btn btn--primary btn--xl login__google"
          onClick={() => run('google', signInWithGoogle)}
          disabled={!!busy}
          aria-describedby="login-google-hint"
        >
          <Icon name="user" size={22} />
          {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
        </button>
        <p className="login__hint" id="login-google-hint">
          No sign-up and no new password. The first time creates your account.
        </p>

        <button
          type="button"
          className="btn login__guest"
          onClick={() => run('guest', signInAsGuest)}
          disabled={!!busy}
        >
          {busy === 'guest' ? 'Starting…' : 'Try it without an account'}
        </button>

        {error ? <p className="login__error" role="alert"><Icon name="warning" size={18} /> {error}</p> : null}

        <ul className="login__points">
          <li><Icon name="check" size={18} /> Stay signed in. Nothing to remember next time.</li>
          <li><Icon name="calendar" size={18} /> Your lists on your phone and laptop.</li>
          <li><Icon name="speaker" size={18} /> Works with screen readers, voice, and large text.</li>
        </ul>

        <p className="login__fine">
          PackPal only uses your Google name and email to keep your lists private to you.
        </p>
      </section>
    </main>
  )
}
