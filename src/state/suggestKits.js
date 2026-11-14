// Suggests saved kits for a new event. No built-in keyword list:
// it learns from the kits this user put on similar events before.

// Filler words that shouldn't count as a match
const IGNORE = ['kit', 'bag', 'the', 'and', 'for', 'with']

// "Swim bag!" becomes ["swim"]. Works with any alphabet.
const words = (text) =>
  (text || '').toLowerCase().split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !IGNORE.includes(w))

export function suggestKits(title, kits, events = []) {
  const titleWords = words(title)
  if (titleWords.length === 0) return []

  // 1. Kits used on past events that share a word with this title
  const usedBefore = new Set()
  for (const event of events) {
    if (!words(event.title).some((w) => titleWords.includes(w))) continue
    for (const category of event.categories || []) {
      if (category.kitId) usedBefore.add(category.kitId)
    }
  }

  // 2. Kits whose own name shares a word with this title
  return kits.filter((kit) =>
    usedBefore.has(kit.id) || words(kit.name).some((w) => titleWords.includes(w))
  )
}

