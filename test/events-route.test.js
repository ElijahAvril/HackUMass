import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createSpeechToTextServer, validateEventsAssistantResponse } from "../server.js";
import { capitalizeFirst } from "../src/packing-assistant.js";

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
  events: [{ title: "Beach day", startsAt: "2026-11-15T05:00:00.000Z" }],
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
      additions: [{ eventTitle: "Beach day", items: ["sunscreen"] }]
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
  });
  // Gemini gets the existing events and kit names as context.
  const context = JSON.parse(sent.contents[0].parts[0].text);
  assert.deepEqual(context.savedKits, ["Interview"]);
  assert.equal(context.existingEvents[0].title, "Beach day");
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
      { title: "Gym", date: "2026-11-16", time: "25:99", items: ["towel"] }
    ],
    additions: [{ eventTitle: "Nothing", items: [] }]
  });
  assert.deepEqual(result.events.map((e) => [e.title, e.time]), [["Gym", ""]]);
  assert.deepEqual(result.additions, []);
});

test("spoken item names get a capital first letter", () => {
  assert.equal(capitalizeFirst("water bottle"), "Water bottle");
  assert.equal(capitalizeFirst("  laptop charger "), "Laptop charger");
  assert.equal(capitalizeFirst("ID card"), "ID card");
  assert.equal(capitalizeFirst("iPhone charger"), "iPhone charger");
  assert.equal(capitalizeFirst("éclair"), "Éclair");
  assert.equal(capitalizeFirst(""), "");
});
