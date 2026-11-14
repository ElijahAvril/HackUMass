import assert from "node:assert/strict";
import test from "node:test";
import {
  hasAssistantEndPhrase,
  removeAssistantEndPhrase,
  resolvePackingActions
} from "../src/packing-assistant.js";

test("recognizes and removes the explicit I'm done end phrase", () => {
  assert.equal(hasAssistantEndPhrase("Pack the reference letter. I'm done."), true);
  assert.equal(hasAssistantEndPhrase("Pack the reference letter, I’m done"), true);
  assert.equal(hasAssistantEndPhrase("I'm done unpacking"), false);
  assert.equal(
    removeAssistantEndPhrase("Pack the reference letter. I'm done."),
    "Pack the reference letter."
  );
  assert.equal(removeAssistantEndPhrase("I'm done"), "");
});

test("resolves unambiguous packing actions with simple singular/plural variations", () => {
  const categories = [
    {
      id: "documents",
      name: "Documents",
      items: [
        { id: "passport", name: "Passport", packed: false },
        { id: "letters", name: "Reference letters", packed: false }
      ]
    },
    {
      id: "clothes",
      name: "Clothes",
      items: [{ id: "shoes", name: "Dress shoes", packed: true }]
    }
  ];

  const result = resolvePackingActions(categories, [
    { type: "mark_packed", category: "documents", itemName: "passport" },
    { type: "unpack", category: "Clothes", itemName: "Dress shoes" },
    { type: "add_item", category: "Clothes", itemName: "Jacket" },
    { type: "mark_packed", category: "Clothes", itemName: "Jacket" },
    { type: "remove_item", category: "Document", itemName: "Reference letter" },
    { type: "add_item", category: "Document", itemName: "Nationalization" },
    { type: "add_item", category: "Clothes", itemName: "jacket" },
    { type: "remove_item", category: "Documents", itemName: "Unknown item" },
    { type: "unpack", category: "Unknown list", itemName: "Passport" }
  ], [], { startsAt: "2030-04-05T10:00:00Z", now: "2030-04-01T10:00:00Z" });

  assert.deepEqual(
    result.operations.map(({ type, itemName, categoryName }) => ({
      type,
      itemName,
      categoryName
    })),
    [
      { type: "mark_packed", itemName: "Passport", categoryName: "Documents" },
      { type: "unpack", itemName: "Dress shoes", categoryName: "Clothes" },
      { type: "add_item", itemName: "Jacket", categoryName: "Clothes" },
      { type: "mark_packed", itemName: "Jacket", categoryName: "Clothes" },
      { type: "remove_item", itemName: "Reference letters", categoryName: "Documents" },
      { type: "add_item", itemName: "Nationalization", categoryName: "Documents" }
    ]
  );
  assert.equal(result.skipped, 3);
  assert.equal(categories[0].items.length, 2, "input event state is not mutated");
});

test("creates requested lists and adds only new event-relative reminders", () => {
  const categories = [{ id: "documents", name: "Documents", items: [] }];
  const reminders = [{ offsetMinutes: 1440 }];
  const result = resolvePackingActions(categories, [
    { type: "create_list", category: "Clothes" },
    { type: "create_list", category: "documents" },
    { type: "add_reminder", offsetMinutes: 1440 },
    { type: "add_reminder", offsetMinutes: 61 },
    { type: "add_reminder", offsetMinutes: 6000 },
    { type: "add_reminder", offsetMinutes: 60 },
    { type: "add_reminder", offsetMinutes: 60 },
    { type: "add_reminder", offsetMinutes: 0 }
  ], reminders, { startsAt: "2030-04-05T10:00:00Z", now: "2030-04-01T10:00:00Z" });

  assert.deepEqual(
    result.operations.map(({ type, categoryName, offsetMinutes }) => ({
      type,
      categoryName,
      offsetMinutes
    })),
    [
      { type: "create_list", categoryName: "Clothes", offsetMinutes: undefined },
      { type: "add_reminder", categoryName: undefined, offsetMinutes: 61 },
      { type: "add_reminder", categoryName: undefined, offsetMinutes: 60 }
    ]
  );
  assert.equal(result.skipped, 5);
  assert.deepEqual(categories.map(({ name }) => name), ["Documents"]);
});

test("deletes only an explicitly named existing list and updates event details", () => {
  const categories = [
    { id: "documents", name: "Documents", items: [{ id: "passport", name: "Passport" }] },
    { id: "clothes", name: "Clothes", items: [] }
  ];
  const result = resolvePackingActions(categories, [
    { type: "remove_list", category: "Documents" },
    { type: "remove_list", category: "Missing" },
    { type: "update_event", field: "location", value: "Boston Garden" },
    { type: "update_event", field: "startsAt", value: "2030-04-05T19:00:00-04:00" },
    { type: "update_event", field: "startsAt", value: "invalid" }
  ], [], { now: "2030-04-01T10:00:00-04:00" });

  assert.deepEqual(result.operations.map(({ type, categoryName, field, value }) => ({
    type,
    categoryName,
    field,
    value
  })), [
    { type: "remove_list", categoryName: "Documents", field: undefined, value: undefined },
    { type: "update_event", categoryName: undefined, field: "location", value: "Boston Garden" },
    { type: "update_event", categoryName: undefined, field: "startsAt", value: "2030-04-05T19:00:00-04:00" }
  ]);
  assert.equal(result.skipped, 2);
  assert.deepEqual(categories.map(({ name }) => name), ["Documents", "Clothes"]);
});
