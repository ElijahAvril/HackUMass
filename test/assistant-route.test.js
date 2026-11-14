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
    url: `http://127.0.0.1:${service.server.address().port}/api/assistant/interpret`,
    async close() {
      await new Promise((resolve) => service.server.close(resolve));
    }
  };
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
