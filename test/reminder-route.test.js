import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createSpeechToTextServer } from "../server.js";

async function createService(options) {
  const service = createSpeechToTextServer({
    apiKey: "test-gemini-key",
    firebaseProjectId: "test-firebase-project",
    ...options
  });
  service.server.listen(0, "127.0.0.1");
  await once(service.server, "listening");

  return {
    service,
    url: `http://127.0.0.1:${service.server.address().port}/api/reminders/interpret`,
    async close() {
      await new Promise((resolve) => service.server.close(resolve));
    }
  };
}

test("interprets an authenticated transcript into a reviewable reminder", async (t) => {
  let geminiRequest;
  const testService = await createService({
    verifyFirebaseToken: async (token, projectId) => {
      assert.equal(token, "valid-test-token");
      assert.equal(projectId, "test-firebase-project");
    },
    geminiFetch: async (url, options) => {
      geminiRequest = { url: new URL(url), body: JSON.parse(options.body) };
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                isReminder: true,
                title: "Call the dentist",
                notes: "Ask about an appointment",
                dueAt: "2030-04-04T09:00:00-04:00",
                clarification: ""
              })
            }]
          }
        }]
      }), { status: 200 });
    }
  });
  t.after(() => testService.close());

  const response = await fetch(testService.url, {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-test-token",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      transcript: "Remind me to call the dentist Thursday at 9 and ask about an appointment.",
      now: "2030-04-01T10:00:00.000Z",
      timeZone: "America/New_York"
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    proposal: {
      isReminder: true,
      title: "Call the dentist",
      notes: "Ask about an appointment",
      dueAt: "2030-04-04T09:00:00-04:00",
      clarification: ""
    }
  });
  assert.equal(
    geminiRequest.url.pathname,
    "/v1beta/models/gemini-3.5-flash-lite:generateContent"
  );
  assert.equal(
    geminiRequest.body.generationConfig.responseMimeType,
    "application/json"
  );
});

test("requires Firebase sign-in before interpreting a transcript", async (t) => {
  const testService = await createService({
    geminiFetch: async () => {
      assert.fail("Gemini must not be called without authentication.");
    }
  });
  t.after(() => testService.close());

  const response = await fetch(testService.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: "Remind me tomorrow at 9",
      now: "2030-04-01T10:00:00.000Z",
      timeZone: "America/New_York"
    })
  });

  assert.equal(response.status, 401);
});

test("rejects malformed or oversized transcripts before calling Gemini", async (t) => {
  const testService = await createService({
    verifyFirebaseToken: async () => {},
    geminiFetch: async () => {
      assert.fail("Gemini must not be called for invalid input.");
    }
  });
  t.after(() => testService.close());

  const response = await fetch(testService.url, {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-test-token",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      transcript: " ",
      now: "not-a-date",
      timeZone: "America/New_York"
    })
  });

  assert.equal(response.status, 400);
});
