import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { WebSocket, WebSocketServer } from "ws";
import { createSpeechToTextServer } from "../server.js";

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

function waitForMessage(socket, predicate) {
  return new Promise((resolve, reject) => {
    const onMessage = (data) => {
      const event = JSON.parse(data.toString());
      if (predicate(event)) {
        socket.off("message", onMessage);
        resolve(event);
      }
    };
    socket.on("message", onMessage);
    socket.once("error", reject);
  });
}

test("proxies live PCM audio to Gemini and normalizes transcription events", async (t) => {
  const upstreamHttp = createServer();
  const upstreamServer = new WebSocketServer({ server: upstreamHttp });
  const upstreamEvents = [];
  let upstreamUrl;
  let receiveAudio;
  let receiveAudioEnd;
  const audioReceived = new Promise((resolve) => {
    receiveAudio = resolve;
  });
  const audioEndReceived = new Promise((resolve) => {
    receiveAudioEnd = resolve;
  });

  upstreamServer.on("connection", (socket, request) => {
    upstreamUrl = new URL(request.url, "http://localhost");
    socket.on("message", (data) => {
      const event = JSON.parse(data.toString());
      upstreamEvents.push(event);
      if (event.setup) {
        socket.send(JSON.stringify({ setupComplete: {} }));
      } else if (event.realtimeInput?.audio) {
        receiveAudio(event);
      } else if (event.realtimeInput?.audioStreamEnd) {
        receiveAudioEnd(event);
      }
    });
  });

  const upstreamPort = await listen(upstreamHttp);
  const service = createSpeechToTextServer({
    apiKey: "test-gemini-key",
    realtimeUrl: `ws://127.0.0.1:${upstreamPort}`
  });
  const servicePort = await listen(service.server);

  t.after(async () => {
    for (const socket of service.webSocketServer.clients) {
      socket.terminate();
    }
    for (const socket of upstreamServer.clients) {
      socket.terminate();
    }
    await Promise.all([
      new Promise((resolve) => {
        service.webSocketServer.close(resolve);
      }),
      new Promise((resolve) => {
        upstreamServer.close(resolve);
      }),
      new Promise((resolve) => {
        service.server.close(resolve);
      }),
      new Promise((resolve) => {
        upstreamHttp.close(resolve);
      })
    ]);
  });

  const browserResponse = await fetch(`http://127.0.0.1:${servicePort}/`);
  assert.equal(browserResponse.status, 200);
  const browserHtml = await browserResponse.text();
  assert.match(browserHtml, /Packuroo/);
  assert.doesNotMatch(browserHtml, /Live speech-to-text demo/);
  const bundlePath = browserHtml.match(/src="([^"]+\.js)"/)?.[1];
  assert.ok(bundlePath, "built Packuroo JavaScript should be linked from the page");
  const bundleResponse = await fetch(
    `http://127.0.0.1:${servicePort}${bundlePath}`
  );
  assert.equal(bundleResponse.status, 200);
  assert.match(await bundleResponse.text(), /speech_to_text\.transcript/);
  const workletResponse = await fetch(
    `http://127.0.0.1:${servicePort}/audio-capture-worklet.js`
  );
  assert.equal(workletResponse.status, 200);
  assert.match(await workletResponse.text(), /registerProcessor/);

  const client = new WebSocket(`ws://127.0.0.1:${servicePort}/speech-to-text`);
  await once(client, "open");
  const ready = await waitForMessage(
    client,
    (event) => event.type === "speech_to_text.ready"
  );
  assert.equal(ready.type, "speech_to_text.ready");
  assert.equal(upstreamUrl.searchParams.get("key"), "test-gemini-key");
  assert.deepEqual(upstreamEvents[0], {
    setup: {
      model: "models/gemini-3.5-transcribe-live",
      generationConfig: { responseModalities: ["TEXT"] },
      inputAudioTranscription: { languageCodes: [] }
    }
  });

  const audio = Buffer.from([1, 2, 3, 4]).toString("base64");
  client.send(JSON.stringify({ type: "input_audio_buffer.append", audio }));
  assert.deepEqual(await audioReceived, {
    realtimeInput: {
      audio: { data: audio, mimeType: "audio/pcm;rate=16000" }
    }
  });

  client.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
  assert.deepEqual(await audioEndReceived, {
    realtimeInput: { audioStreamEnd: true }
  });

  const interimReceived = waitForMessage(
    client,
    (event) => event.type === "speech_to_text.interim_transcript"
  );
  const finalReceived = waitForMessage(
    client,
    (event) => event.type === "speech_to_text.transcript"
  );
  const completionReceived = waitForMessage(
    client,
    (event) => event.type === "speech_to_text.complete"
  );
  const upstreamClient = [...upstreamServer.clients][0];
  upstreamClient.send(JSON.stringify({
    serverContent: {
      interimInputTranscription: { text: "hell" },
      inputTranscription: { text: "hello" },
      turnComplete: true
    }
  }));
  assert.deepEqual(await interimReceived, {
    type: "speech_to_text.interim_transcript",
    text: "hell"
  });
  assert.deepEqual(await finalReceived, {
    type: "speech_to_text.transcript",
    text: "hello"
  });
  assert.deepEqual(await completionReceived, {
    type: "speech_to_text.complete"
  });
});

test("requires a Gemini API key", () => {
  assert.throws(
    () => createSpeechToTextServer({ apiKey: "" }),
    /Gemini API key is required/
  );
});
