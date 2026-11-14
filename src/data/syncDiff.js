// ---------------------------------------------------------------------------
// SYNC DIFFING - pure functions, no Firebase, so they're easy to test
// ---------------------------------------------------------------------------
// The app keeps working off its normal reducer store. Sync works by comparing
// "what the cloud last had" with "what the store has now" and writing only
// the documents that changed - checking one item rewrites one event, not the
// whole account.
// ---------------------------------------------------------------------------

/**
 * JSON.stringify with object keys sorted. Firestore can hand back fields in a
 * different order than we wrote them; without this, identical data would look
 * "changed" and bounce back and forth between the device and the cloud.
 */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** Map of id -> stable JSON, for a list of documents with `id`s. */
export const snapshotOf = (docs) => new Map(docs.map((d) => [d.id, stableStringify(d)]))

/**
 * What to write so the cloud matches `docs`, given the cloud's last-known
 * state `known` (Map id -> json). Returns { save: [doc], remove: [id] }.
 */
export function diffDocs(known, docs) {
  const save = []
  const seen = new Set()
  docs.forEach((d) => {
    seen.add(d.id)
    if (known.get(d.id) !== stableStringify(d)) save.push(d)
  })
  const remove = [...known.keys()].filter((id) => !seen.has(id))
  return { save, remove }
}

/** True when two lists hold the same documents, ignoring order. */
export function sameDocs(a, b) {
  if (a.length !== b.length) return false
  const left = snapshotOf(a)
  return b.every((d) => left.get(d.id) === stableStringify(d))
}

/**
 * Settings that follow the user to every device. `notifications` is left out
 * on purpose: browser notification permission belongs to one device.
 */
export function syncedSettings(settings = {}) {
  const { notifications, ...rest } = settings // eslint-disable-line no-unused-vars
  return rest
}
