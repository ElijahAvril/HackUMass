import React, { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import { useSpeech } from '../hooks/useSpeech.js'
import {
  capitalizeFirst,
  findExplicitKitAssignments,
  hasAssistantEndPhrase,
  normalizeKitName,
  parseDeleteConfirmation,
  removeAssistantEndPhrase,
  resolvePackingActions,
} from '../packing-assistant.js'
import { SpeechToTextClient } from '../speech-to-text-client.js'
import { speechHttpUrl, speechSocketUrl } from '../speechServer.js'
import { useStore } from '../state/store.jsx'
import { uid } from '../state/seed.js'

const COMPLETION_TIMEOUT_MS = 20000
const FINAL_TRANSCRIPT_GRACE_MS = 1800

/** "2026-11-20" + "15:00" (or "" for all day) -> ISO time in the user's timezone. */
function startsAtFrom(date, time) {
  return new Date(`${date}T${time || '00:00'}`).toISOString()
}

/**
 * The voice assistant. Two modes:
 *   <PackingAssistantButton event={event} /> - on an event's page: pack,
 *       unpack, add or remove items and lists, reminders, time, place.
 *   <PackingAssistantButton />               - on the Events page: create new
 *       events, reusable kits, and add items to events that already exist.
 */
export function PackingAssistantButton({ event = null }) {
  const { state, actions } = useStore()
  const eventsMode = !event
  const stateRef = useRef(state)
  stateRef.current = state
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
  const pendingDeleteRef = useRef([])
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
      setMessage(eventsMode
        ? 'Listening. Say an event name and date (time and location are optional), or ask me to make a kit or list.'
        : 'Listening. Say what you want to pack, unpack, add, remove, or create as a list or kit for this event.')
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

      if (eventsMode) {
        if (pendingDeleteRef.current.length > 0) {
          handleDeleteConfirmation(transcript)
          updatePhase('idle')
          return
        }
        await handleEventsRequest(transcript)
        updatePhase('idle')
        return
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
      const resolved = resolvePackingActions(
        latestEvent.categories,
        result.assistant.actions,
        latestEvent.reminders,
      )
      const { skipped } = resolved
      // Spoken names come back lower-case; the app's lists use "Water bottle".
      const operations = resolved.operations.map((operation) => (
        operation.type === 'add_item' ? { ...operation, itemName: capitalizeFirst(operation.itemName) }
          : operation.type === 'create_list' ? { ...operation, categoryName: capitalizeFirst(operation.categoryName) }
            : operation
      ))
      for (const operation of operations) {
        if (operation.type === 'create_list') {
          actions.addCategory(latestEvent.id, operation.categoryName, operation.categoryId)
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

  const handleDeleteConfirmation = (transcript) => {
    const confirmation = parseDeleteConfirmation(transcript)
    const pending = pendingDeleteRef.current[0]
    if (confirmation === null) {
      const question = `Please say yes or no: should I delete ${pending.title}?`
      setMessage(question)
      if (speech.supported) speech.speak(question)
      return
    }

    pendingDeleteRef.current.shift()
    let response
    if (confirmation) {
      const eventStillExists = stateRef.current.events.some((eventItem) => eventItem.id === pending.id)
      if (eventStillExists) {
        actions.removeEvent(pending.id)
        response = `Deleted ${pending.title}.`
        actions.announce(response)
      } else {
        response = `${pending.title} is no longer in your events, so I didn't delete anything.`
      }
    } else {
      response = `Kept ${pending.title}.`
    }

    const next = pendingDeleteRef.current[0]
    const message = next
      ? `${response} Should I also delete ${next.title}? Say yes or no.`
      : response
    setMessage(message)
    if (speech.supported) speech.speak(message)
  }

  /** Events page: turn the request into new events and/or items on existing ones. */
  const handleEventsRequest = async (transcript) => {
    const current = stateRef.current
    const response = await fetch(speechHttpUrl('/api/events/interpret'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        events: current.events.slice(0, 50).map((eventItem) => ({
          title: eventItem.title,
          startsAt: eventItem.startsAt,
          kits: eventItem.categories
            .filter((category) => category.kitId)
            .map(({ name, kitId }) => ({ id: kitId, name })),
        })),
        kits: current.kits.slice(0, 50).map((kit) => kit.name),
        now: new Date().toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || 'Gemini could not interpret that request.')
    }

    const {
      reply,
      clarification,
      events: newEvents,
      additions,
      newKits,
      kitAssignments,
      deletions,
      kitRemovals,
    } = result.assistant
    const changes = []
    const latest = stateRef.current
    const createdKits = []
    const requestedKitAssignments = [
      ...kitAssignments,
      ...findExplicitKitAssignments(transcript, latest.events, latest.kits),
    ]
    const appliedKitIds = new Set()

    for (const removal of kitRemovals) {
      const eventMatches = latest.events.filter(
        (ev) => ev.title.trim().toLowerCase() === removal.eventTitle.trim().toLowerCase(),
      )
      if (eventMatches.length !== 1) {
        changes.push(eventMatches.length
          ? `I found more than one event called ${removal.eventTitle}, so I didn't remove a kit.`
          : `I couldn't find an event called ${removal.eventTitle}.`)
        continue
      }

      const target = eventMatches[0]
      for (const spokenKit of removal.kits) {
        const categoryMatches = target.categories.filter(
          (category) =>
            category.kitId
            && normalizeKitName(category.name) === normalizeKitName(spokenKit),
        )
        if (categoryMatches.length !== 1) {
          changes.push(categoryMatches.length
            ? `I found more than one ${spokenKit} kit on ${target.title}, so I didn't remove either one.`
            : `I couldn't find a ${spokenKit} kit on ${target.title}.`)
          continue
        }

        actions.removeCategory(target.id, categoryMatches[0].id)
        changes.push(`Removed the ${categoryMatches[0].name} kit from ${target.title}. Your saved kit is unchanged.`)
      }
    }

    for (const assignment of requestedKitAssignments) {
      const eventMatches = latest.events.filter(
        (ev) => ev.title.trim().toLowerCase() === assignment.eventTitle.trim().toLowerCase(),
      )
      if (eventMatches.length !== 1) {
        changes.push(eventMatches.length
          ? `I found more than one event called ${assignment.eventTitle}, so I didn't add the kit.`
          : `I couldn't find an event called ${assignment.eventTitle}.`)
        continue
      }

      const target = eventMatches[0]
      for (const spokenKit of assignment.kits) {
        const kitMatches = latest.kits.filter(
          (kit) => normalizeKitName(kit.name) === normalizeKitName(spokenKit),
        )
        if (kitMatches.length !== 1) {
          changes.push(kitMatches.length
            ? `I found more than one kit called ${spokenKit}.`
            : `I couldn't find a saved kit called ${spokenKit}.`)
          continue
        }

        const kit = kitMatches[0]
        const assignmentKey = `${target.id}:${kit.id}`
        if (appliedKitIds.has(assignmentKey)) continue
        appliedKitIds.add(assignmentKey)
        if (target.categories.some((category) => category.kitId === kit.id)) {
          changes.push(`${kit.name} is already on ${target.title}.`)
          continue
        }

        actions.applyKit(target.id, kit)
        changes.push(`Added the ${kit.name} kit to ${target.title}.`)
      }
    }

    for (const spoken of newKits) {
      const name = capitalizeFirst(spoken.name)
      const key = normalizeKitName(name)
      const existingKit = [...latest.kits, ...createdKits].find(
        (kit) => normalizeKitName(kit.name) === key,
      )
      if (existingKit) {
        changes.push(`Using your saved ${existingKit.name} kit.`)
        continue
      }

      const kit = {
        id: uid('kit'),
        name,
        items: spoken.items.map((item) => ({ name: capitalizeFirst(item), note: '' })),
      }
      actions.saveKit(kit.id, kit.name, kit.items)
      createdKits.push(kit)
      changes.push(`Created the ${name} kit${kit.items.length ? ` with ${kit.items.map((item) => item.name).join(', ')}` : ''}.`)
    }

    // Items for events that already exist go into their first list.
    for (const addition of additions) {
      const target = latest.events.find(
        (ev) => ev.title.trim().toLowerCase() === addition.eventTitle.trim().toLowerCase(),
      )
      if (!target) {
        changes.push(`I couldn't find an event called ${addition.eventTitle}.`)
        continue
      }
      const items = addition.items.map(capitalizeFirst)
      if (target.categories.length) {
        const list = target.categories[0]
        const have = new Set(list.items.map((item) => item.name.toLowerCase()))
        const fresh = items.filter((name) => !have.has(name.toLowerCase()))
        for (const name of fresh) actions.addItem(target.id, list.id, name, '')
        if (fresh.length) changes.push(`Added ${fresh.join(', ')} to ${target.title}.`)
      } else {
        // Make the list with a known id, so items can go straight in.
        const listId = `cat_voice_${Date.now()}`
        actions.addCategory(target.id, 'Essentials', listId)
        for (const name of items) actions.addItem(target.id, listId, name, '')
        changes.push(`Added ${items.join(', ')} to ${target.title}.`)
      }
    }

    // New events. Each opens like a normal new event, with the usual reminders.
    for (const spoken of newEvents) {
      const requestedKitNames = spoken.kits.map(normalizeKitName)
      const kits = [...latest.kits, ...createdKits].filter((kit) =>
        requestedKitNames.includes(normalizeKitName(kit.name)))
      const items = spoken.items.map(capitalizeFirst)
      const stamp = Date.now()
      actions.addEvent({
        title: capitalizeFirst(spoken.title),
        startsAt: startsAtFrom(spoken.date, spoken.time),
        isAllDay: !spoken.time,
        location: spoken.location,
        notes: spoken.notes,
        items,
        kits,
        stay: true,
        reminders: [
          { id: `rem_${stamp}_a`, offsetMinutes: 1440, fired: false },
          { id: `rem_${stamp}_b`, offsetMinutes: 120, fired: false },
        ],
      })
      const when = new Date(startsAtFrom(spoken.date, spoken.time))
      const whenText = when.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
        + (spoken.time ? ` at ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ', all day')
      const bring = [...items, ...kits.map((kit) => `the ${kit.name} kit`)]
      changes.push(`Added ${capitalizeFirst(spoken.title)} on ${whenText}${bring.length ? `, bringing ${bring.join(', ')}` : ''}.`)
    }

    const requestedDeletes = []
    for (const title of deletions) {
      const matches = latest.events.filter(
        (eventItem) => eventItem.title.trim().toLowerCase() === title.trim().toLowerCase(),
      )
      if (matches.length !== 1) {
        changes.push(matches.length
          ? `I found more than one event called ${title}, so I won't delete either one.`
          : `I couldn't find an event called ${title}.`)
        continue
      }
      if (!requestedDeletes.some((item) => item.id === matches[0].id)) {
        requestedDeletes.push({ id: matches[0].id, title: matches[0].title })
      }
    }

    if (requestedDeletes.length) {
      pendingDeleteRef.current = requestedDeletes
      changes.push(`Should I delete ${requestedDeletes[0].title}? Say yes or no.`)
    }

    const summary = [reply, ...changes, clarification].filter(Boolean).join(' ')
    setMessage(summary || 'I didn’t hear an event to add. Try “Dentist on Friday at 3 PM.”')
    if (changes.length) actions.announce(changes.join(' '))
    if (summary && speech.supported) speech.speak(summary)
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
