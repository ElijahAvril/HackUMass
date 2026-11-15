import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createSpeechToTextServer, validateEventsAssistantResponse } from "../server.js";
import { capitalizeFirst, normalizeKitName } from "../src/packing-assistant.js";

function geminiReply(payload) {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }]
  }), { status: 200 });
}

async function withService(geminiFetch, run) {
  const service = createSpeechToTextServer({ apiKey: "test-key", geminiFetch });
  service.server.listen(0, "127.0.0.1");
  await once(service.server, "listening");
  try {
    await run(`http://127.0.0.1:${service.server.address().port}/api/events/interpret`);
  } finally {
    await new Promise((resolve) => service.server.close(resolve));
  }
}

const body = {
  transcript: "Dentist on Friday at 3, bring my insurance card. Add sunscreen to beach day.",
  now: "2026-11-14T20:00:00-05:00",
  timeZone: "America/New_York",
  events: [{
    title: "Beach day",
    startsAt: "2026-11-15T05:00:00.000Z",
    kits: [{ id: "kit_interview", name: "Interview" }]
  }],
  kits: ["Interview"]
};

test("events route turns speech into new events and additions", async () => {
  let sent;
  await withService(async (_url, options) => {
    sent = JSON.parse(options.body);
    return geminiReply({
      reply: "Done!",
      clarification: "",
      events: [{
        title: "Dentist", date: "2026-11-20", time: "15:00", location: "", notes: "",
        items: ["insurance card", "Insurance card"], kits: []
      }],
      additions: [{ eventTitle: "Beach day", items: ["sunscreen"] }],
      newKits: [{ name: "Travel", items: ["passport", "Passport"] }],
      kitAssignments: [{ eventTitle: "Beach day", kits: ["Interview", "Interview"] }],
      deletions: ["Old event", "Old event"],
      kitRemovals: [{ eventTitle: "Beach day", kits: ["Interview", "Interview"] }]
    });
  }, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    assert.equal(response.status, 200);
    const { assistant } = await response.json();
    assert.equal(assistant.events.length, 1);
    assert.deepEqual(assistant.events[0].items, ["insurance card"]); // duplicate dropped
    assert.equal(assistant.events[0].time, "15:00");
    assert.deepEqual(assistant.additions, [{ eventTitle: "Beach day", items: ["sunscreen"] }]);
    assert.deepEqual(assistant.newKits, [{
      name: "Travel",
      items: ["passport"]
    }]);
    assert.deepEqual(assistant.kitAssignments, [{
      eventTitle: "Beach day",
      kits: ["Interview"]
    }]);
    assert.deepEqual(assistant.deletions, ["Old event"]);
    assert.deepEqual(assistant.kitRemovals, [{
      eventTitle: "Beach day",
      kits: ["Interview"]
    }]);
  });
  // Gemini gets the existing events and kit names as context.
  const context = JSON.parse(sent.contents[0].parts[0].text);
  assert.deepEqual(context.savedKits, ["Interview"]);
  assert.deepEqual(context.existingEvents[0], {
    title: "Beach day",
    startsAt: "2026-11-15T05:00:00.000Z",
    kits: [{ id: "kit_interview", name: "Interview" }]
  });
  assert.match(sent.systemInstruction.parts[0].text, /'kit' and 'list' as synonyms/);
  assert.match(sent.systemInstruction.parts[0].text, /kitAssignments/);
  assert.match(sent.systemInstruction.parts[0].text, /must not delete the reusable saved kit/);
  assert.match(sent.systemInstruction.parts[0].text, /instead of creating a duplicate/);
  assert.match(sent.systemInstruction.parts[0].text, /ask the user to confirm separately/);
  assert.match(sent.systemInstruction.parts[0].text, /9:00 PM is 21:00/);
});

test("events route rejects bad input without calling Gemini", async () => {
  let called = false;
  await withService(async () => { called = true; }, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, transcript: "" })
    });
    assert.equal(response.status, 400);
  });
  assert.equal(called, false);
});

test("events without a real date are skipped, bad times become all day", () => {
  const result = validateEventsAssistantResponse({
    reply: "", clarification: "Which day is the party?",
    events: [
      { title: "Party", date: "", time: "", items: [] },
      { title: "Exam", date: "2026-02-30", time: "09:00", items: [] },
      { title: "Exam", date: "2026-13-01", time: "09:00", items: [] },
      { title: "", date: "2026-11-16", time: "09:00", items: [] },
      { title: "Gym", date: "2026-11-16", time: "25:99", items: ["towel"] }
    ],
    additions: [{ eventTitle: "Nothing", items: [] }],
    newKits: [],
    kitAssignments: [],
    deletions: [],
    kitRemovals: []
  });
  assert.deepEqual(result.events.map((e) => [e.title, e.time]), [["Gym", ""]]);
  assert.deepEqual(result.additions, []);
});

test("event date and name are required while time and location are optional", () => {
  const result = validateEventsAssistantResponse({
    reply: "",
    clarification: "What should I call it, and what date is it?",
    events: [
      { title: "Dentist", date: "", time: "21:00", location: "Clinic", items: [] },
      { title: "", date: "2026-11-16", time: "", location: "", items: [] },
      { title: "Dentist", date: "2026-11-16", time: "", location: "", items: [] }
    ],
    additions: [],
    newKits: [],
    kitAssignments: [],
    deletions: [],
    kitRemovals: []
  });
  assert.deepEqual(result.events, [{
    title: "Dentist",
    date: "2026-11-16",
    time: "",
    location: "",
    notes: "",
    items: [],
    kits: []
  }]);
  assert.match(result.clarification, /what should I call/i);
  assert.match(result.clarification, /what date/i);
});

test("spoken item names get a capital first letter", () => {
  assert.equal(capitalizeFirst("water bottle"), "Water bottle");
  assert.equal(capitalizeFirst("  laptop charger "), "Laptop charger");
  assert.equal(capitalizeFirst("ID card"), "ID card");
  assert.equal(capitalizeFirst("iPhone charger"), "iPhone charger");
  assert.equal(capitalizeFirst("éclair"), "Éclair");
  assert.equal(capitalizeFirst(""), "");
});

test("kit names match saved kits regardless of capitalization or trailing kit/list", () => {
  assert.equal(normalizeKitName("Travel"), normalizeKitName("travel kit"));
  assert.equal(normalizeKitName("Interview List"), normalizeKitName("interview"));
  assert.notEqual(normalizeKitName("Travel"), normalizeKitName("Beach"));
});
