// ---------------------------------------------------------------------------
// ENTRY POINT
// ---------------------------------------------------------------------------
// Mounts React and wraps the app in the store. StrictMode is on deliberately:
// it double-invokes effects in development, which surfaces the kind of
// cleanup bug (a speech recogniser left running, a timer left scheduled) that
// this app is particularly prone to.
// ---------------------------------------------------------------------------
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { StoreProvider } from './state/store.jsx'
import { AuthGate } from './components/AuthGate.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      {/* Login + cloud sync wrap the app; the app itself doesn't know. */}
      <AuthGate>
        <App />
      </AuthGate>
    </StoreProvider>
  </React.StrictMode>
)
