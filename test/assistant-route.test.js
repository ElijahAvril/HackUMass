import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createSpeechToTextServer } from "../server.js";

async function createService(geminiFetch) {
  const service = createSpeechToTextServer({
    apiKey: "test-gemini-key",
    firebaseProjectId: undefined,
    geminiFetch
  });
  service.server.listen(0, "127.0.0.1");
  await once(service.server, "listening");

  return {
    service,
    baseUrl: `http://127.0.0.1:${service.server.address().port}`,
    url: `http://127.0.0.1:${service.server.address().port}/api/assistant/interpret`,
    async close() {
      await new Promise((resolve) => service.server.close(resolve));
    }
  };
}

function packingAssistantResponse(actions = [{
  type: "mark_packed",
  category: "Documents",
  itemName: "Passport"
}]) {
  return new Response(JSON.stringify({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            reply: "I marked the passport packed.",
            clarification: "",
            actions
          })
        }]
      }
    }]
  }), { status: 200 });
}

function assistantResponse() {
  return new Response(JSON.stringify({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            reply: "I made a checklist for your plan.",
            title: "Plan the event",
            items: [{
              text: "Confirm the venue",
              dueAt: "2030-04-04T09:00:00-04:00"
            }],
            clarification: ""
          })
        }]
      }
    }]
  }), { status: 200 });
}

function requestBody(overrides = {}) {
  return {
    transcript: "Make a checklist to plan the event and check the venue Thursday.",
    draft: { title: "", items: [] },
    now: "2030-04-01T10:00:00.000Z",
    timeZone: "America/New_York",
    isFinal: true,
    ...overrides
  };
}

test("updates a temporary assistant draft without Firebase authentication", async (t) => {
  let geminiRequest;
  const testService = await createService(async (url, options) => {
    geminiRequest = {
      url: new URL(url),
      body: JSON.parse(options.body)
    };
    return assistantResponse();
  });
  t.after(() => testService.close());

  const response = await fetch(testService.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody())
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    assistant: {
      reply: "I made a checklist for your plan.",
      title: "Plan the event",
      items: [{
        text: "Confirm the venue",
        dueAt: "2030-04-04T09:00:00-04:00"
      }],
      clarification: ""
    }
  });
  assert.equal(geminiRequest.url.pathname,
    "/v1beta/models/gemini-3.5-flash-lite:generateContent");
  const prompt = JSON.parse(
    geminiRequest.body.contents[0].parts[0].text
  );
  assert.equal(prompt.thoughtComplete, true);
  assert.equal(prompt.timeZone, "America/New_York");
});

test("rejects invalid assistant requests before calling Gemini", async (t) => {
  const testService = await createService(async () => {
    assert.fail("Gemini must not be called for invalid input.");
  });
  t.after(() => testService.close());

  const response = await fetch(testService.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody({ transcript: " " }))
  });

  assert.equal(response.status, 400);
});

test("rate limits the unauthenticated assistant endpoint", async (t) => {
  let geminiCalls = 0;
  const testService = await createService(async () => {
    geminiCalls += 1;
    return assistantResponse();
  });
  t.after(() => testService.close());

  let response;
  for (let request = 0; request < 9; request += 1) {
    response = await fetch(testService.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody())
    });
  }

  assert.equal(response.status, 429);
  assert.equal(geminiCalls, 8);
});

test("interprets packing requests using only the supplied event lists", async (t) => {
  let prompt;
  const testService = await createService(async (_url, options) => {
    prompt = JSON.parse(options.body);
    return packingAssistantResponse();
  });
  t.after(() => testService.close());

  const response = await fetch(`${testService.baseUrl}/api/packing/interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: "Pack my passport.",
      event: {
        title: "Trip",
        startsAt: "2030-04-04T10:00:00-04:00",
        location: "Boston"
      },
      now: "2030-04-01T10:00:00-04:00",
      timeZone: "America/New_York",
      categories: [{
        name: "Documents",
        items: [{ name: "Passport", packed: false }]
      }],
      reminders: []
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).assistant.actions, [{
    type: "mark_packed",
    category: "Documents",
    itemName: "Passport"
  }]);
  const context = JSON.parse(prompt.contents[0].parts[0].text);
  assert.deepEqual(context.eventCategories, [{
    name: "Documents",
    items: [{ name: "Passport", packed: false }]
  }]);
  assert.deepEqual(context.event, {
    title: "Trip",
    startsAt: "2030-04-04T10:00:00-04:00",
    location: "Boston"
  });
  assert.equal(context.timeZone, "America/New_York");
  assert.deepEqual(
    prompt.generationConfig.responseSchema.properties.actions.items.required,
    ["type"]
  );
});

test("supports creating a list and adding a relative reminder", async (t) => {
  let prompt;
  const testService = await createService(async (_url, options) => {
    prompt = JSON.parse(options.body);
    return packingAssistantResponse([
      {
        type: "create_list",
        category: "Toiletries",
        itemName: "",
        offsetMinutes: 0
      },
      {
        type: "add_reminder",
        category: "",
        itemName: "",
        offsetMinutes: 1440
      }
    ]);
  });
  t.after(() => testService.close());

  const response = await fetch(`${testService.baseUrl}/api/packing/interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: "Create a Toiletries list and remind me one day before the event.",
      event: {
        title: "Trip",
        startsAt: "2030-04-04T10:00:00-04:00",
        location: "Boston"
      },
      now: "2030-04-01T10:00:00-04:00",
      timeZone: "America/New_York",
      categories: [],
      reminders: []
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).assistant.actions, [
    { type: "create_list", category: "Toiletries" },
    { type: "add_reminder", offsetMinutes: 1440 }
  ]);
  const context = JSON.parse(prompt.contents[0].parts[0].text);
  assert.deepEqual(context.eventCategories, []);
  assert.deepEqual(context.existingReminderOffsets, []);
});

test("validates spoken event time and flexible reminder actions", async (t) => {
  const testService = await createService(async () =>
    packingAssistantResponse([
      {
        type: "update_event",
        category: "",
        itemName: "",
        offsetMinutes: 0,
        field: "startsAt",
        value: "2030-04-05T19:00:00-04:00"
      },
      {
        type: "add_reminder",
        category: "",
        itemName: "",
        offsetMinutes: 135,
        field: "",
        value: ""
      }
    ])
  );
  t.after(() => testService.close());

  const response = await fetch(`${testService.baseUrl}/api/packing/interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: "Move it to 7 PM and remind me 2 hours and 15 minutes before.",
      event: {
        title: "Trip",
        startsAt: "2030-04-04T10:00:00-04:00",
        location: "Boston"
      },
      now: "2030-04-01T10:00:00-04:00",
      timeZone: "America/New_York",
      categories: [],
      reminders: []
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).assistant.actions.map((action) => action.type), [
    "update_event",
    "add_reminder"
  ]);
});

test("defaults an unspecified reminder time to one day before the event", async (t) => {
  const testService = await createService(async () =>
    packingAssistantResponse([{
      type: "add_reminder",
      category: "",
      itemName: "",
      offsetMinutes: 0
    }])
  );
  t.after(() => testService.close());

  const response = await fetch(`${testService.baseUrl}/api/packing/interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: "Please remind me about this event.",
      event: {
        title: "Trip",
        startsAt: "2030-04-04T10:00:00-04:00",
        location: "Boston"
      },
      now: "2030-04-01T10:00:00-04:00",
      timeZone: "America/New_York",
      categories: [],
      reminders: []
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).assistant.actions, [{
    type: "add_reminder",
    offsetMinutes: 1440
  }]);
});

test("rejects packing requests with malformed event context", async (t) => {
  const testService = await createService(async () => {
    assert.fail("Gemini must not be called for invalid context.");
  });
  t.after(() => testService.close());

  const response = await fetch(`${testService.baseUrl}/api/packing/interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: "Pack my passport.",
      event: { title: "Trip", startsAt: "2030-04-04T10:00:00-04:00", location: "" },
      now: "2030-04-01T10:00:00-04:00",
      timeZone: "America/New_York",
      categories: "invalid"
    })
  });

  assert.equal(response.status, 400);
});

test("rejects unsupported actions returned by Gemini", async (t) => {
  const testService = await createService(async () =>
    packingAssistantResponse([{
      type: "delete_event",
      category: "Documents",
      itemName: "Passport",
      offsetMinutes: 0
    }])
  );
  t.after(() => testService.close());

  const response = await fetch(`${testService.baseUrl}/api/packing/interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: "Delete the event.",
      event: {
        title: "Trip",
        startsAt: "2030-04-04T10:00:00-04:00",
        location: ""
      },
      now: "2030-04-01T10:00:00-04:00",
      timeZone: "America/New_York",
      categories: [{
        name: "Documents",
        items: [{ name: "Passport", packed: false }]
      }],
      reminders: []
    })
  });

  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /invalid packing action/i);
});
