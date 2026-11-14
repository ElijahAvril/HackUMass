// ---------------------------------------------------------------------------
// SEED DATA
// ---------------------------------------------------------------------------
// The demo content the app starts with on a first run. It is deliberately
// isolated in its own file so that:
//   * judges see a populated app immediately, and
//   * you can empty this array to one-click test the "no events" empty state.
// Delete everything in `events` to see the giant Start-packing screen.
// ---------------------------------------------------------------------------

/** Tiny id helper. Not cryptographic - just needs to be unique in localStorage. */
export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

/**
 * DATA SHAPE (read this before editing anything else)
 * ---------------------------------------------------
 * event = {
 *   id, title, startsAt (ISO string), location,
 *   reminders: [{ id, offsetMinutes, fired }],
 *   categories: [ category ]
 * }
 * category = { id, name, kitId|null, items: [ item ] }
 * item = { id, name, note, packed, flagged }
 *
 * `note` is the "where it's kept" line. `flagged` is the warning that floats
 * an item to the top of its list. `kitId` links a category back to a saved
 * kit so additions can be pushed back into the reusable template.
 */

/** Build an ISO timestamp N days from now at a given local hour. */
const daysFromNow = (days, hour = 9, minute = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export const seedKits = [
  {
    id: 'kit_interview_docs',
    name: 'Documents',
    items: [
      { name: 'Resume, 3 copies', note: '' },
      { name: 'Portfolio on USB stick', note: 'Kept in the blue pencil case' },
      { name: 'ID card', note: 'Kept in the top drawer of the desk' },
      { name: 'Reference letters', note: '' },
    ],
  },
  {
    id: 'kit_gym',
    name: 'Gym bag',
    items: [
      { name: 'Trainers', note: 'Kept by the front door' },
      { name: 'Water bottle', note: '' },
      { name: 'Towel', note: 'Kept in the hall closet' },
    ],
  },
]

export const seedEvents = [
  {
    id: 'evt_interview',
    title: 'Job interview',
    startsAt: daysFromNow(6, 10, 0),
    location: 'Boston Regional Office',
    reminders: [
      { id: uid('rem'), offsetMinutes: 1440, fired: false }, // 1 day before
      { id: uid('rem'), offsetMinutes: 120, fired: false },  // 2 hours before
      { id: uid('rem'), offsetMinutes: 45, fired: false },   // 45 min before
    ],
    categories: [
      {
        id: 'cat_docs',
        name: 'Documents',
        kitId: 'kit_interview_docs', // this category came from a saved kit
        items: [
          { id: uid('it'), name: 'Resume, 3 copies', note: '', packed: true, flagged: false },
          { id: uid('it'), name: 'Portfolio on USB stick', note: 'Kept in the blue pencil case', packed: false, flagged: false },
          { id: uid('it'), name: 'ID card', note: 'Kept in the top drawer of the desk', packed: false, flagged: false },
          { id: uid('it'), name: 'Reference letters', note: '', packed: false, flagged: false },
        ],
      },
      {
        id: 'cat_clothes',
        name: 'Clothes',
        kitId: null,
        items: [
          { id: uid('it'), name: 'Blazer', note: '', packed: true, flagged: false },
          { id: uid('it'), name: 'Dress shirt, ironed', note: '', packed: false, flagged: false },
          { id: uid('it'), name: 'Dress shoes', note: 'Kept in the hall closet', packed: false, flagged: false },
        ],
      },
      {
        id: 'cat_bag',
        name: 'Bag',
        kitId: null,
        items: [
          {
            id: uid('it'),
            name: 'Laptop charger',
            note: 'Kept in the top drawer of the desk',
            packed: false,
            flagged: true, // demonstrates the priority behaviour
            flagReason: 'You forgot this at the last two events',
          },
          { id: uid('it'), name: 'Notebook and pen', note: '', packed: true, flagged: false },
          { id: uid('it'), name: 'Water bottle', note: '', packed: false, flagged: false },
        ],
      },
    ],
  },
  {
    id: 'evt_lab',
    title: 'Lab practical',
    startsAt: daysFromNow(9, 14, 30),
    location: 'Engineering Building, Room 212',
    reminders: [{ id: uid('rem'), offsetMinutes: 1440, fired: false }],
    categories: [
      {
        id: 'cat_lab',
        name: 'Essentials',
        kitId: null,
        items: [
          { id: uid('it'), name: 'Lab goggles', note: 'Kept in the locker', packed: false, flagged: false },
          { id: uid('it'), name: 'Calculator', note: '', packed: false, flagged: false },
        ],
      },
    ],
  },
]

/** The settings object, also the contract for what Settings can toggle. */
export const seedSettings = {
  palette: 'default',      // 'default' | 'colourblind'
  textScale: '100',        // '100' | '115' | '130'
  reduceMotion: false,
  speakOnToggle: true,     // read item names aloud as you check them off
  notifications: false,    // set true once the user grants permission
}
