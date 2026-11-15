import React, { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import { useSpeech } from '../hooks/useSpeech.js'
import {
  hasAssistantEndPhrase,
  removeAssistantEndPhrase,
  resolvePackingActions,
} from '../packing-assistant.js'
import { SpeechToTextClient } from '../speech-to-text-client.js'
import { speechHttpUrl, speechSocketUrl } from '../speechServer.js'
import { useStore } from '../state/store.jsx'

const COMPLETION_TIMEOUT_MS = 20000
const FINAL_TRANSCRIPT_GRACE_MS = 1800

export function PackingAssistantButton({ event }) {
  const { actions } = useStore()
  const speech = useSpeech()
  const [phase, setPhase] = useState('idle')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [transcription, setTranscription] = useState('')
  const clientRef = useRef(null)
  const phaseRef = useRef('idle')
  const transcriptRef = useRef([])
  const turnCompleteRef = useRef(false)
  const completeRef = useRef(null)
  const finishConversationRef = useRef(null)
  const eventRef = useRef(event)
  eventRef.current = event
  const audioSupported = typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof window !== 'undefined'
    && typeof window.AudioContext === 'function'
    && typeof window.AudioWorkletNode === 'function'
    && typeof window.WebSocket === 'function'

  const updatePhase = (nextPhase) => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }

  useEffect(() => {
    const client = new SpeechToTextClient({
      url: speechSocketUrl(),
      onEvent(transcriptionEvent) {
        if (clientRef.current !== client) return
        if (transcriptionEvent.type === 'speech_to_text.interim_transcript') {
          const interim = transcriptionEvent.text?.trim() || ''
          setTranscription([...transcriptRef.current, interim].filter(Boolean).join(' '))
        } else if (
          transcriptionEvent.type === 'speech_to_text.transcript'
          && transcriptionEvent.text?.trim()
        ) {
          transcriptRef.current.push(transcriptionEvent.text.trim())
          const fullTranscript = transcriptRef.current.join(' ')
          setTranscription(fullTranscript)
          if (
            phaseRef.current === 'recording'
            && hasAssistantEndPhrase(fullTranscript)
          ) {
            void finishConversationRef.current?.()
          }
          if (phaseRef.current === 'processing' && completeRef.current) {
            clearTimeout(completeRef.current.settleTimer)
            if (turnCompleteRef.current) {
              completeRef.current.resolve()
            } else {
              completeRef.current.settleTimer = setTimeout(
                completeRef.current.resolve,
                FINAL_TRANSCRIPT_GRACE_MS,
              )
            }
          }
        } else if (transcriptionEvent.type === 'speech_to_text.complete') {
          turnCompleteRef.current = true
          if (transcriptRef.current.length > 0) {
            completeRef.current?.resolve()
          }
        } else if (transcriptionEvent.type === 'error') {
          completeRef.current?.reject(new Error(transcriptionEvent.message))
        }
      },
      onError(cause) {
        if (clientRef.current !== client) return
        completeRef.current?.reject(cause)
        if (phaseRef.current !== 'idle') {
          setError(cause instanceof Error ? cause.message : 'Speech recognition had a problem.')
          updatePhase('idle')
        }
      },
      onStatus(status) {
        if (
          clientRef.current === client
          && status.startsWith('Disconnected')
          && phaseRef.current !== 'idle'
        ) {
          setError(status)
          updatePhase('idle')
        }
      },
      autoSubmitOnSilence: false,
    })
    clientRef.current = client
    return () => {
      clientRef.current = null
      phaseRef.current = 'idle'
      void client.close().catch((cause) => {
        console.error('Could not close the speech-to-text connection:', cause)
      })
    }
  }, [])

  const startConversation = async () => {
    if (phaseRef.current !== 'idle') return
    setError('')
    setMessage('')
    transcriptRef.current = []
    setTranscription('')
    turnCompleteRef.current = false
    updatePhase('starting')
    try {
      await clientRef.current.start()
      updatePhase('recording')
      setMessage('Listening. Say what you want to pack, unpack, add, or remove.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start voice input.')
      updatePhase('idle')
    }
  }

  const finishConversation = async () => {
    if (phaseRef.current !== 'recording') return
    setError('')
    updatePhase('processing')
    setMessage('Finishing transcription and asking Gemini…')

    let timeoutId
    const completion = new Promise((resolve, reject) => {
      completeRef.current = { resolve, reject, settleTimer: null }
      timeoutId = setTimeout(
        () => reject(new Error('Gemini has not returned a finalized transcription yet. Check the temporary transcription above and try again.')),
        COMPLETION_TIMEOUT_MS,
      )
    })

    try {
      await clientRef.current.stop()
      if (turnCompleteRef.current && transcriptRef.current.length > 0) {
        completeRef.current?.resolve()
      }
      else if (transcriptRef.current.length > 0) {
        completeRef.current.settleTimer = setTimeout(
          completeRef.current.resolve,
          FINAL_TRANSCRIPT_GRACE_MS,
        )
      }
      await completion
      const transcript = removeAssistantEndPhrase(transcriptRef.current.join(' '))
      if (!transcript) {
        throw new Error('I heard “I’m done,” but not a packing request to act on.')
      }

      const currentEvent = eventRef.current
      if (currentEvent.id !== event.id) {
        throw new Error('The selected event changed. Start a new conversation for that list.')
      }

      const response = await fetch(speechHttpUrl('/api/packing/interpret'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          categories: currentEvent.categories.map((category) => ({
            name: category.name,
            items: category.items.map(({ name, packed }) => ({ name, packed })),
          })),
          reminders: currentEvent.reminders.map(({ offsetMinutes }) => ({ offsetMinutes })),
          event: {
            title: currentEvent.title,
            startsAt: currentEvent.startsAt,
            location: currentEvent.location,
          },
          now: new Date().toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Gemini could not interpret that request.')
      }

      const latestEvent = eventRef.current
      if (latestEvent.id !== currentEvent.id) {
        throw new Error('The selected event changed. Start a new conversation for that list.')
      }
      const { operations, skipped } = resolvePackingActions(
        latestEvent.categories,
        result.assistant.actions,
        latestEvent.reminders,
      )
      for (const operation of operations) {
        if (operation.type === 'create_list') {
          actions.addCategory(latestEvent.id, operation.categoryName)
        } else if (operation.type === 'remove_list') {
          actions.removeCategory(latestEvent.id, operation.categoryId)
        } else if (operation.type === 'add_reminder') {
          actions.addReminder(latestEvent.id, operation.offsetMinutes)
        } else if (operation.type === 'update_event') {
          actions.updateEvent(latestEvent.id, {
            [operation.field]: operation.value,
            ...(operation.field === 'startsAt' ? { isAllDay: false } : {}),
          })
        } else if (operation.type === 'add_item') {
          actions.addItem(
            latestEvent.id,
            operation.categoryId,
            operation.itemName,
            '',
            operation.itemId,
          )
        } else if (operation.type === 'remove_item') {
          actions.removeItem(latestEvent.id, operation.categoryId, operation.itemId)
        } else {
          actions.toggleItem(
            latestEvent.id,
            operation.categoryId,
            operation.itemId,
            operation.type === 'mark_packed',
          )
        }
      }

      const changes = operations.map((operation) => {
        if (operation.type === 'create_list') {
          return `Created the ${operation.categoryName} list`
        }
        if (operation.type === 'remove_list') {
          return `Deleted the ${operation.categoryName} list and its items`
        }
        if (operation.type === 'update_event') {
          return operation.field === 'location'
            ? `Set the location to ${operation.value}`
            : `Updated the event time to ${new Date(operation.value).toLocaleString()}`
        }
        if (operation.type === 'add_reminder') {
          const days = Math.floor(operation.offsetMinutes / 1440)
          const hours = Math.floor((operation.offsetMinutes % 1440) / 60)
          const minutes = operation.offsetMinutes % 60
          const label = [
            days ? `${days} day${days === 1 ? '' : 's'}` : '',
            hours ? `${hours} hour${hours === 1 ? '' : 's'}` : '',
            minutes ? `${minutes} minute${minutes === 1 ? '' : 's'}` : '',
          ].filter(Boolean).join(' ')
          return `Added a reminder ${label} before the event`
        }
        if (operation.type === 'add_item') {
          return `Added ${operation.itemName} to ${operation.categoryName}`
        }
        if (operation.type === 'remove_item') {
          return `Removed ${operation.itemName} from ${operation.categoryName}`
        }
        return `${operation.type === 'mark_packed' ? 'Packed' : 'Unpacked'} ${operation.itemName}`
      })
      const summary = [
        result.assistant.reply,
        ...changes,
        skipped > 0 ? `${skipped} requested change${skipped === 1 ? ' was' : 's were'} skipped because the target was unclear or already up to date.` : '',
        result.assistant.clarification,
      ].filter(Boolean).join(' ')
      setMessage(summary || 'Gemini did not find a packing-list action in that request.')
      if (summary && speech.supported) speech.speak(summary)
      updatePhase('idle')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not process that packing request.')
      updatePhase('idle')
    } finally {
      clearTimeout(timeoutId)
      clearTimeout(completeRef.current?.settleTimer)
      completeRef.current = null
    }
  }

  finishConversationRef.current = finishConversation

  if (!audioSupported) return null

  return (
    <div className="packing-assistant">
      <button
        type="button"
        className={`btn ${phase === 'recording' ? 'btn--primary' : ''}`}
        onClick={phase === 'recording' ? finishConversation : startConversation}
        disabled={phase === 'starting' || phase === 'processing'}
        aria-pressed={phase === 'recording'}
      >
        <Icon name={phase === 'recording' ? 'stop' : 'mic'} size={18} />
        {phase === 'starting' ? 'Connecting…'
          : phase === 'recording' ? 'Submit now'
            : phase === 'processing' ? 'Gemini is thinking…'
              : 'Talk to Packuroo'}
      </button>
      {message ? <p className="packing-assistant__message" role="status">{message}</p> : null}
      {phase === 'recording' ? (
        <p className="packing-assistant__message">
          Say &quot;I&apos;m done&quot; to submit your request, or submit it now.
        </p>
      ) : null}
      <section className="packing-assistant__transcription" aria-live="polite">
        <strong>Temporary transcription</strong>
        {/* Hint text is lighter than real speech, so it reads as a placeholder. */}
        <p className={transcription ? undefined : 'is-placeholder'}>
          {transcription || (phase === 'recording' ? 'Listening for speech…' : 'Your recognized speech will appear here.')}
        </p>
      </section>
      {error ? <p className="packing-assistant__error" role="alert">{error}</p> : null}
    </div>
  )
}
