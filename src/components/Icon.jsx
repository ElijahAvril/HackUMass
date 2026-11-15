// ---------------------------------------------------------------------------
// ICONS
// ---------------------------------------------------------------------------
// Every icon in the app is an inline SVG defined in this one file.
//
// WHY NOT AN ICON LIBRARY: a library is ~40kB for the dozen glyphs we use, and
// a PWA that must work offline pays that on first load. Inline SVG also
// inherits `currentColor`, so icons re-theme with the palette for free.
//
// TO ADD AN ICON: add a key to PATHS with its path data (24x24 viewBox), then
// use <Icon name="yourkey" />. Nothing else needs touching.
//
// ACCESSIBILITY: icons are decorative by default (aria-hidden) because the
// label is always next to them in text. Pass a `title` only when an icon is
// the sole content of a control.
// ---------------------------------------------------------------------------
import React from 'react'

const PATHS = {
  // --- navigation & chrome ---
  calendar: 'M7 3v3M17 3v3M3.5 9.5h17M5 6h14a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6Z',
  star: 'M12 3.8l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8L12 3.8Z',
  settings: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  bag: 'M6 8.5h12l1 11.5H5L6 8.5ZM9 8.5V6.8a3 3 0 0 1 6 0v1.7',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM12 7.5V12l3 2',
  pin: 'M12 21s6.5-6 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 15 12 21 12 21ZM12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  bell: 'M18 16.5H6l1.5-2.2V11a4.5 4.5 0 0 1 9 0v3.3L18 16.5ZM10 19.5a2 2 0 0 0 4 0',
  plus: 'M12 5.5v13M5.5 12h13',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  trash: 'M4.5 7h15M9.5 7V5.2h5V7M6.5 7l1 12.3h9L17.5 7M10 10.5v6M14 10.5v6',
  pencil: 'M4.5 19.5l.9-3.6L16 5.3a1.6 1.6 0 0 1 2.3 0l.4.4a1.6 1.6 0 0 1 0 2.3L8.1 18.6l-3.6.9Z',
  mic: 'M12 3.5a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-5 0V6A2.5 2.5 0 0 1 12 3.5ZM6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6',
  speaker: 'M4.5 9.5h3l4-3.5v12l-4-3.5h-3v-5ZM15 9a4 4 0 0 1 0 6M17.8 6.6a7.5 7.5 0 0 1 0 10.8',
  stop: 'M7 7h10v10H7z',
  warning: 'M12 4.5 21 19.5H3L12 4.5ZM12 10v4M12 16.5v.6',
  back: 'M14.5 5.5 8 12l6.5 6.5',
  forward: 'M9.5 5.5 16 12l-6.5 6.5',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  grid: 'M3.5 5.5h17v15h-17v-15ZM3.5 10h17M3.5 15.2h17M9.2 10v10.5M14.8 10v10.5M8 3.5v3M16 3.5v3',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0',
  logout: 'M14 4.5h4.5v15H14M10 8.5 6.5 12l3.5 3.5M6.5 12H15',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4',
  // --- item glyphs (matched by keyword, see pickItemIcon below) ---
  doc: 'M7 3.5h7l4 4v13H7v-17ZM14 3.5v4h4M9.5 12h6M9.5 15.5h6',
  usb: 'M11 20.5v-9M11 11.5H8.5v-4h5v4H11ZM11 7.5V4M9.5 4h3',
  card: 'M3.5 6.5h17v11h-17v-11ZM7 10.5h3v3H7v-3ZM13 10.5h4M13 14h4',
  mail: 'M3.5 6.5h17v11h-17v-11ZM3.5 7l8.5 6.5L20.5 7',
  hanger: 'M12 7.5a2 2 0 1 1 2-2M12 7.5v2.5L4 15.5c-1 .7-.5 2 .7 2h14.6c1.2 0 1.7-1.3.7-2L12 10',
  shirt: 'M8.5 3.5 5 5.5l1.5 4 2-1v11h7v-11l2 1 1.5-4-3.5-2a2.5 2.5 0 0 1-5 0Z',
  shoe: 'M3.5 16.5h17a0 0 0 0 1 0 0v2h-17v-2ZM3.5 16.5v-5h3l3 2.5h5l3 2.5h2.5',
  plug: 'M9 3.5v5M15 3.5v5M6.5 8.5h11v2a5.5 5.5 0 0 1-11 0v-2ZM12 16v4.5',
  pen: 'M5 19.5l1-3.5L16.5 5.5l2.5 2.5L8.5 18.5 5 19.5ZM14.5 7.5l2.5 2.5',
  bottle: 'M10 3.5h4v2.5l1.5 2v11.5h-7V8l1.5-2V3.5ZM8.5 12h7',
  laptop: 'M5.5 6.5h13v9h-13v-9ZM3 18.5h18',
  keys: 'M14.5 4.5a4.5 4.5 0 1 1-3.2 7.7L5 18.5v2h2.5v-2h2v-2h2l1.3-1.3a4.5 4.5 0 0 0 1.7-10.7Z',
  box: 'M12 3.5 20.5 8v8L12 20.5 3.5 16V8L12 3.5ZM3.5 8l8.5 4.5L20.5 8M12 12.5v8',
}

export function Icon({ name, size = 20, title, strokeWidth = 1.8, className = '' }) {
  const d = PATHS[name] || PATHS.box // unknown names degrade to a neutral glyph
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative unless a title is supplied, in which case it becomes an
      // image with an accessible name.
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d={d} />
    </svg>
  )
}

/**
 * Guesses an icon from an item's name so user-added items don't all look the
 * same. Purely cosmetic - a wrong guess costs nothing because the name is
 * always shown as text beside it.
 *
 * TO EXTEND: add a [keyword, iconName] pair. First match wins, so put more
 * specific keywords above general ones.
 */
const KEYWORD_ICONS = [
  ['resume', 'doc'], ['letter', 'mail'], ['reference', 'mail'], ['document', 'doc'],
  ['passport', 'card'], ['id', 'card'], ['ticket', 'card'], ['badge', 'card'],
  ['usb', 'usb'], ['drive', 'usb'], ['charger', 'plug'], ['cable', 'plug'],
  ['laptop', 'laptop'], ['computer', 'laptop'], ['key', 'keys'], ['wallet', 'card'],
  ['blazer', 'hanger'], ['jacket', 'hanger'], ['coat', 'hanger'], ['suit', 'hanger'],
  ['shirt', 'shirt'], ['tee', 'shirt'], ['dress', 'shirt'],
  ['shoe', 'shoe'], ['boot', 'shoe'], ['trainer', 'shoe'], ['sneaker', 'shoe'],
  ['notebook', 'pen'], ['pen', 'pen'], ['pencil', 'pen'], ['notes', 'pen'],
  ['bottle', 'bottle'], ['water', 'bottle'], ['snack', 'box'],
  ['bag', 'bag'], ['towel', 'box'], ['goggle', 'box'], ['calculator', 'card'],
]

export function pickItemIcon(name = '') {
  const lower = name.toLowerCase()
  const hit = KEYWORD_ICONS.find(([word]) => lower.includes(word))
  return hit ? hit[1] : 'box'
}
