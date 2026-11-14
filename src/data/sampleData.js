// Returns a date string like "2026-11-15T10:00", `days` from today
function daysFromNow(days, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(minute)}`;
}

/*
  DATA SHAPES (everyone codes against these):

  Event    { id, title, start, location, color, done, reminders: [Reminder], sections: [Section] }
  Section  { id, name, items: [Item] }
  Item     { id, name, where, packed }
  Reminder { id, minutes, fired }        // minutes = how long before the event
  Kit      { id, name, items: [{ name, where }] }

  color is one of: "pink", "green", "yellow", "blue", "lav"
  Never use `undefined`; use "" or null (Firestore rejects undefined)
*/

export const sampleEvents = [
  {
    id: "event-interview",
    title: "Job interview",
    start: daysFromNow(1, 10),
    location: "Boston Regional Office",
    color: "yellow",
    done: false,
    reminders: [
      { id: "r1", minutes: 1440, fired: false }, // 1 day before
      { id: "r2", minutes: 120, fired: false },  // 2 hours before
      { id: "r3", minutes: 15, fired: false },   // 15 minutes before
    ],
    sections: [
      {
        id: "s-docs",
        name: "Documents",
        items: [
          { id: "i1", name: "Resume, 3 copies", where: "", packed: true },
          { id: "i2", name: "Portfolio on USB stick", where: "the blue pencil case", packed: false },
          { id: "i3", name: "ID card", where: "the top drawer of the desk", packed: false },
          { id: "i4", name: "Reference letters", where: "", packed: false },
        ],
      },
      {
        id: "s-clothes",
        name: "Clothes",
        items: [
          { id: "i5", name: "Blazer", where: "", packed: true },
          { id: "i6", name: "Dress shirt, ironed", where: "", packed: false },
          { id: "i7", name: "Dress shoes", where: "the hall closet", packed: false },
        ],
      },
      {
        id: "s-bag",
        name: "Bag",
        items: [
          { id: "i8", name: "Laptop charger", where: "the top drawer of the desk", packed: false },
          { id: "i9", name: "Notebook and pen", where: "", packed: true },
          { id: "i10", name: "Water bottle", where: "the kitchen counter", packed: false },
        ],
      },
    ],
  },
  {
    id: "event-swim",
    title: "Swim practice",
    start: daysFromNow(2, 6, 30),
    location: "Campus pool",
    color: "blue",
    done: false,
    reminders: [{ id: "r4", minutes: 600, fired: false }],
    sections: [
      {
        id: "s-swim",
        name: "Swim bag",
        items: [
          { id: "i11", name: "Swimsuit", where: "the dresser, 2nd drawer", packed: true },
          { id: "i12", name: "Goggles", where: "the hook by the door", packed: false },
          { id: "i13", name: "Swim cap", where: "the hook by the door", packed: false },
          { id: "i14", name: "Towel", where: "the bathroom", packed: false },
        ],
      },
    ],
  },
  {
    id: "event-trip",
    title: "Weekend trip home",
    start: daysFromNow(9, 16),
    location: "Bus station",
    color: "pink",
    done: false,
    reminders: [{ id: "r5", minutes: 2880, fired: false }],
    sections: [
      {
        id: "s-makeup",
        name: "Makeup bag",
        items: [
          { id: "i15", name: "Foundation", where: "the bathroom shelf", packed: false },
          { id: "i16", name: "Mascara", where: "the bathroom shelf", packed: false },
        ],
      },
    ],
  },
];

export const sampleKits = [
  {
    id: "kit-docs",
    name: "Documents",
    items: [
      { name: "Resume, 3 copies", where: "" },
      { name: "Portfolio on USB stick", where: "the blue pencil case" },
      { name: "ID card", where: "the top drawer of the desk" },
      { name: "Reference letters", where: "" },
    ],
  },
  {
    id: "kit-swim",
    name: "Swim bag",
    items: [
      { name: "Swimsuit", where: "the dresser, 2nd drawer" },
      { name: "Goggles", where: "the hook by the door" },
      { name: "Swim cap", where: "the hook by the door" },
      { name: "Towel", where: "the bathroom" },
      { name: "Flip-flops", where: "by the door" },
    ],
  },
  {
    id: "kit-overnight",
    name: "Overnight bag",
    items: [
      { name: "Pajamas", where: "the dresser" },
      { name: "Toothbrush", where: "the bathroom" },
      { name: "Laptop charger", where: "the top drawer of the desk" },
    ],
  },
];

// Items left unpacked at past events (used for the "You forgot this" sticky notes)
export const sampleForgotten = {
  "laptop charger": { name: "Laptop charger", count: 2 },
  goggles: { name: "Goggles", count: 1 },
};