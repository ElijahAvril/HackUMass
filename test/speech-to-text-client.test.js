import assert from "node:assert/strict";
import test from "node:test";
import { SpeechToTextClient } from "../public/speech-to-text-client.js";

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
