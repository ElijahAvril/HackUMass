import assert from "node:assert/strict";
import test from "node:test";
import { SpeechToTextClient } from "../src/speech-to-text-client.js";

class MockWebSocket {
  static OPEN = 1;

  static latest;

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.OPEN;
    this.listeners = new Map();
    MockWebSocket.latest = this;
  }

  addEventListener(type, listener, options = {}) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ listener, once: options.once ?? false });
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((entry) => entry.listener !== listener)
    );
  }

  emit(type, event) {
    for (const entry of [...(this.listeners.get(type) ?? [])]) {
      entry.listener(event);
      if (entry.once) {
        this.removeEventListener(type, entry.listener);
      }
    }
  }

  send() {}
}

test("keeps receiving transcript events after the session is ready", async () => {
  const originalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = MockWebSocket;
  try {
    const events = [];
    const client = new SpeechToTextClient({
      url: "ws://localhost/speech-to-text",
      onEvent: (event) => events.push(event)
    });

    const connected = client.connect();
    const socket = MockWebSocket.latest;
    socket.emit("message", {
      data: JSON.stringify({ type: "speech_to_text.ready" })
    });
    await connected;

    const transcript = {
      type: "speech_to_text.transcript",
      text: "hello"
    };
    socket.emit("message", { data: JSON.stringify(transcript) });

    assert.deepEqual(events, [
      { type: "speech_to_text.ready" },
      transcript
    ]);
  } finally {
    globalThis.WebSocket = originalWebSocket;
  }
});

test("adapts to ambient noise and ends after 1.5 seconds of speech silence", async () => {
  const defaultClient = new SpeechToTextClient({
    url: "ws://localhost/speech-to-text"
  });
  assert.equal(defaultClient.silenceDurationMs, 1500);

  let silenceCount = 0;
  const client = new SpeechToTextClient({
    url: "ws://localhost/speech-to-text",
    silenceDurationMs: 30,
    vadCalibrationMs: 100,
    onSilence: () => { silenceCount += 1 }
  });
  client.capturing = true;

  const ambient = new Float32Array(2048).fill(0.02);
  client.detectSpeech(ambient);
  client.detectSpeech(ambient);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(silenceCount, 0, "steady ambient noise must not trigger speech or keep recording alive");

  client.detectSpeech(new Float32Array(2048).fill(0.1));
  await new Promise((resolve) => setTimeout(resolve, 20));
  client.detectSpeech(new Float32Array(2048).fill(0.1));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(silenceCount, 0, "continued speech must reset the silence timer");

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(silenceCount, 1);
  client.capturing = false;
});

test("can disable silence-based submission for explicit end-phrase conversations", async () => {
  let silenceCount = 0;
  const client = new SpeechToTextClient({
    url: "ws://localhost/speech-to-text",
    silenceDurationMs: 20,
    autoSubmitOnSilence: false,
    onSilence: () => { silenceCount += 1 }
  });
  client.capturing = true;
  client.detectSpeech(new Float32Array(2048).fill(0.1));
  await new Promise((resolve) => setTimeout(resolve, 40));

  assert.equal(silenceCount, 0);
  client.capturing = false;
});
