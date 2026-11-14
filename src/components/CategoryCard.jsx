// ---------------------------------------------------------------------------
// CATEGORY CARD - one "bag" of the checklist (Documents, Clothes, Bag...)
// ---------------------------------------------------------------------------
// Renders the pastel tab, the per-category count, the ordered items, and the
// add form. It pulls ordering from selectOrderedItems rather than sorting
// inline, so the "flagged floats to the top" rule lives in exactly one place
// and both this card and packing mode obey the same rule.
// ---------------------------------------------------------------------------
import React from 'react'
import { Icon } from './Icon.jsx'
import { ItemRow } from './ItemRow.jsx'
import { AddItemForm } from './AddItemForm.jsx'
import { useStore } from '../state/store.jsx'
import { selectCategoryProgress, selectOrderedItems, categoryTone } from '../state/selectors.js'
import { useSpeech } from '../hooks/useSpeech.js'
import './Checklist.css'

export function CategoryCard({ event, category, index }) {
  const { state, actions } = useStore()
  const speech = useSpeech()
  const { packed, total } = selectCategoryProgress(category)
  const items = selectOrderedItems(category.items)

  const speakItem = (item) =>
    speech.speak(item.note ? `${item.name}. Kept: ${item.note}` : item.name)

  const handleToggle = (itemId, checked) => {
    actions.toggleItem(event.id, category.id, itemId, checked)
    const item = category.items.find((i) => i.id === itemId)
    if (!item) return
    // Announce to screen readers via the shared live region...
    actions.announce(`${item.name} ${checked ? 'packed' : 'unpacked'}`)
    // ...and optionally say it out loud, for users who aren't running a
    // screen reader but still want audio confirmation.
    if (state.settings.speakOnToggle && checked) speech.speak(`${item.name} packed`)
  }

  return (
    <section className="category" aria-labelledby={`cat-${category.id}`}>
      {/* The pastel folder tab. Colour comes from the token cycle, so a new
          category never needs a developer to pick a hex value. */}
      <h3 className="category__tab" id={`cat-${category.id}`} style={{ background: categoryTone(index) }}>
        <Icon name={category.kitId ? 'star' : 'bag'} size={18} />
        {category.name}
      </h3>

      <div className="card category__body">
        <div className="category__meta">
          {category.kitId ? (
            <span className="chip chip--kit"><Icon name="star" size={14} /> Saved kit</span>
          ) : <span />}

          <span className="category__count">
            {packed} of {total} packed
          </span>
        </div>

        {items.length === 0 ? (
          <p className="category__empty">Nothing here yet. Add the first item below.</p>
        ) : (
          /* A real <ul>. Screen readers announce "list, 4 items", which gives
             blind users the same at-a-glance sense of size that sighted users
             get from the card height. */
          <ul className="category__items">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                speechSupported={speech.supported}
                onSpeak={speakItem}
                onToggle={handleToggle}
                onRemove={(id) => {
                  const target = category.items.find((i) => i.id === id)
                  actions.removeItem(event.id, category.id, id)
                  actions.announce(`${target?.name || 'Item'} removed`)
                }}
                onToggleFlag={(id) => {
                  const target = category.items.find((i) => i.id === id)
                  actions.toggleFlag(event.id, category.id, id, 'Flagged as a priority')
                  actions.announce(
                    `${target?.name || 'Item'} ${target?.flagged ? 'no longer a priority' : 'moved to the top as a priority'}`
                  )
                }}
              />
            ))}
          </ul>
        )}

        <AddItemForm
          categoryName={category.name}
          onAdd={(name, note) => {
            actions.addItem(event.id, category.id, name, note)
            actions.announce(`${name} added to ${category.name}`)
          }}
        />

        {/* Saving back to a kit is only offered for kit-backed categories.
            Showing it everywhere would imply kits exist where they don't. */}
        <div className="category__footer">
          {category.kitId ? (
            <button
              type="button"
              className="btn btn--ghost category__save"
              onClick={() => {
                actions.saveKit(
                  category.kitId,
                  category.name,
                  category.items.map((i) => ({ name: i.name, note: i.note }))
                )
                actions.announce(`${category.name} kit updated`)
              }}
            >
              <Icon name="star" size={16} /> Save these back to the kit
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--ghost category__save"
              onClick={() => {
                actions.saveKit(null, category.name, category.items.map((i) => ({ name: i.name, note: i.note })))
                actions.announce(`${category.name} saved as a new kit`)
              }}
            >
              <Icon name="star" size={16} /> Save as a reusable kit
            </button>
          )}

          <button
            type="button"
            className="btn btn--ghost btn--danger"
            onClick={() => {
              actions.removeCategory(event.id, category.id)
              actions.announce(`${category.name} list removed`)
            }}
          >
            <Icon name="trash" size={16} /> Remove list
          </button>
        </div>
      </div>
    </section>
  )
}
