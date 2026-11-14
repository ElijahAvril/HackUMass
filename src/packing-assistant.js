import { uid } from './state/seed.js'

const normalize = (value) => value.trim().toLocaleLowerCase()
const normalizeForMatching = (value) => normalize(value)
  .normalize('NFKC')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => {
    if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`
    if (word.endsWith('s') && word.length > 3 && !/(ss|us|is)$/.test(word)) {
      return word.slice(0, -1)
    }
    return word
  })
  .join(' ')

function findMatchingEntries(entries, requestedName) {
  const exactMatches = entries.filter(
    (entry) => normalize(entry.name) === normalize(requestedName),
  )
  if (exactMatches.length > 0) return exactMatches

  const canonicalName = normalizeForMatching(requestedName)
  return entries.filter(
    (entry) => normalizeForMatching(entry.name) === canonicalName,
  )
}
const END_PHRASE_PATTERN = /\bi['’]m\s+done[.!?,\s]*$/i

export function hasAssistantEndPhrase(transcript) {
  return END_PHRASE_PATTERN.test(transcript.trim())
}

export function removeAssistantEndPhrase(transcript) {
  return transcript.replace(END_PHRASE_PATTERN, '').trim()
}

export function resolvePackingActions(
  categories,
  requestedActions,
  existingReminders = [],
  eventContext = {},
) {
  const workingCategories = categories.map((category) => ({
    ...category,
    items: category.items.map((item) => ({ ...item })),
  }))
  const operations = []
  let skipped = 0

  for (const command of requestedActions) {
    if (command.type === 'add_reminder') {
      const eventStart = Date.parse(eventContext.startsAt)
      const now = Date.parse(eventContext.now ?? new Date().toISOString())
      const alreadyExists = operations.some(
        (operation) =>
          operation.type === 'add_reminder'
          && operation.offsetMinutes === command.offsetMinutes,
      ) || existingReminders.some(
        (reminder) => reminder.offsetMinutes === command.offsetMinutes,
      )
      if (
        !Number.isInteger(command.offsetMinutes)
        || command.offsetMinutes < 1
        || !Number.isSafeInteger(command.offsetMinutes)
        || !Number.isFinite(eventStart)
        || !Number.isFinite(now)
        || eventStart <= now
        || command.offsetMinutes * 60000 >= eventStart - now
        || alreadyExists
      ) {
        skipped += 1
        continue
      }
      operations.push({
        type: 'add_reminder',
        offsetMinutes: command.offsetMinutes,
      })
      continue
    }

    if (command.type === 'update_event') {
      if (
        !['location', 'startsAt'].includes(command.field)
        || typeof command.value !== 'string'
        || !command.value.trim()
        || (command.field === 'startsAt'
          && (!Number.isFinite(Date.parse(command.value))
            || Date.parse(command.value) <= Date.parse(eventContext.now ?? new Date().toISOString())))
      ) {
        skipped += 1
        continue
      }
      operations.push({
        type: 'update_event',
        field: command.field,
        value: command.field === 'location' ? command.value.trim() : command.value,
      })
      continue
    }

    if (command.type === 'create_list') {
      const name = command.category.trim()
      if (
        !name
        || findMatchingEntries(workingCategories, name).length > 0
      ) {
        skipped += 1
        continue
      }
      const categoryId = uid('cat')
      operations.push({
        type: 'create_list',
        categoryId,
        categoryName: name,
      })
      workingCategories.push({
        id: categoryId,
        name,
        items: [],
      })
      continue
    }

    if (command.type === 'remove_list') {
      const matches = findMatchingEntries(workingCategories, command.category)
      if (matches.length !== 1) {
        skipped += 1
        continue
      }
      const category = matches[0]
      operations.push({
        type: 'remove_list',
        categoryId: category.id,
        categoryName: category.name,
      })
      workingCategories.splice(workingCategories.indexOf(category), 1)
      continue
    }

    const matchingCategories = findMatchingEntries(workingCategories, command.category)
    if (matchingCategories.length !== 1) {
      skipped += 1
      continue
    }

    const category = matchingCategories[0]
    const matchingItems = findMatchingEntries(category.items, command.itemName)

    if (command.type === 'add_item') {
      if (matchingItems.length > 0) {
        skipped += 1
        continue
      }

      const itemId = uid('it')
      operations.push({
        type: 'add_item',
        categoryId: category.id,
        itemId,
        itemName: command.itemName.trim(),
        categoryName: category.name,
      })
      category.items.push({
        id: itemId,
        name: command.itemName.trim(),
        note: '',
        packed: false,
        flagged: false,
        flagReason: '',
      })
      continue
    }

    if (matchingItems.length !== 1) {
      skipped += 1
      continue
    }

    const item = matchingItems[0]
    if (command.type === 'remove_item') {
      operations.push({
        type: command.type,
        categoryId: category.id,
        itemId: item.id,
        itemName: item.name,
        categoryName: category.name,
      })
      category.items = category.items.filter((candidate) => candidate.id !== item.id)
    } else {
      const packed = command.type === 'mark_packed'
      if (item.packed === packed) {
        skipped += 1
        continue
      }
      operations.push({
        type: command.type,
        categoryId: category.id,
        itemId: item.id,
        itemName: item.name,
        categoryName: category.name,
      })
      item.packed = packed
    }
  }

  return { operations, skipped }
}
