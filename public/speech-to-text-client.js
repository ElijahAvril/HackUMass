const TARGET_SAMPLE_RATE = 16000;

function encodePcm16(samples) {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return bytes;
}

function bytesToBase64(bytes) {
  let binary = "";
  const segmentSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += segmentSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + segmentSize));
  }
  return btoa(binary);
}

function createWavRecording(chunks) {
  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);
  if (sampleCount === 0) {
    return new Blob([], { type: "audio/wav" });
  }

  const dataLength = sampleCount * 2;
  const wav = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wav);
  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataLength, true);

  let byteOffset = 44;
  for (const chunk of chunks) {
    new Uint8Array(wav, byteOffset, chunk.length).set(chunk);
    byteOffset += chunk.length;
  }

  return new Blob([wav], { type: "audio/wav" });
}

export class SpeechToTextClient {
  constructor({
    url = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/speech-to-text`,
    onEvent = () => {},
    onStatus = () => {},
    onError = () => {}
  } = {}) {
    this.url = url;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.onError = onError;
    this.socket = null;
    this.stream = null;
    this.recordingChunks = [];
    this.context = null;
    this.source = null;
    this.worklet = null;
    this.capturing = false;
    this.flushResolver = null;
    this.connectionPromise = null;
  }

  async start() {
    if (this.capturing) {
      throw new Error("The microphone is already recording.");
    }

    await this.connect();
    this.onStatus("Requesting microphone access...");

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.context = new AudioContext();
      await this.context.resume();
      if (this.context.state !== "running") {
        throw new Error("The audio device could not be started.");
      }
      await this.context.audioWorklet.addModule(
        new URL("./audio-capture-worklet.js", import.meta.url)
      );
      this.source = this.context.createMediaStreamSource(this.stream);
      this.worklet = new AudioWorkletNode(this.context, "pcm-resampler", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: "explicit",
        processorOptions: { targetRate: TARGET_SAMPLE_RATE }
      });
      this.worklet.port.onmessage = (event) => {
        if (event.data.type === "audio") {
          const audioBytes = encodePcm16(event.data.samples);
          this.recordingChunks.push(audioBytes);
          this.send({
            type: "input_audio_buffer.append",
            audio: bytesToBase64(audioBytes)
          });
        } else if (event.data.type === "flushed") {
          this.flushResolver?.();
          this.flushResolver = null;
        }
      };
      this.recordingChunks = [];
      this.source.connect(this.worklet);
      this.worklet.connect(this.context.destination);
      this.capturing = true;
      this.onStatus("Recording. Speak naturally, then stop when you are finished.");
    } catch (error) {
      await this.releaseAudio();
      throw error;
    }
  }

  async stop() {
    if (!this.capturing) {
      return;
    }

    this.capturing = false;
    this.source?.disconnect();
    const flush = new Promise((resolve) => {
      this.flushResolver = resolve;
      this.worklet.port.postMessage({ type: "flush" });
      setTimeout(() => {
        if (this.flushResolver === resolve) {
          this.flushResolver = null;
          resolve();
        }
      }, 1000);
    });
    let recordedAudio;
    try {
      await flush;
      recordedAudio = createWavRecording(this.recordingChunks);
      this.recordingChunks = [];
    } finally {
      await this.releaseAudio();
    }
    this.send({ type: "input_audio_buffer.commit" });
    this.onStatus("Audio submitted. Waiting for the completed transcript...");
    return recordedAudio;
  }

  async close() {
    if (this.capturing) {
      await this.stop();
    }
    this.socket?.close();
    this.socket = null;
  }

  async connect() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.onStatus("Connecting to the speech-to-text backend...");
    const socket = new WebSocket(this.url);
    this.socket = socket;

    this.connectionPromise = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        socket.removeEventListener("error", onError);
        if (error) {
          socket.removeEventListener("message", onMessage);
          reject(error);
        } else {
          resolve();
        }
      };
      const onMessage = (message) => {
        try {
          const event = JSON.parse(message.data);
          this.onEvent(event);
          if (event.type === "speech_to_text.ready") {
            this.onStatus("Connected. Starting microphone...");
            finish();
          } else if (event.type === "error") {
            const error = new Error(
              event.message ?? event.error?.message ?? "Speech service error."
            );
            if (!settled) {
              finish(error);
            }
          }
        } catch (error) {
          this.onError(error);
          if (!settled) {
            finish(error);
          }
        }
      };
      const onError = () => {
        const error = new Error("Could not connect to the speech-to-text backend.");
        this.onError(error);
        finish(error);
      };
      const onClose = () => {
        if (this.socket === socket) {
          this.socket = null;
        }
        if (!settled) {
          finish(new Error("The speech-to-text backend closed the connection."));
        }
        if (this.capturing) {
          this.capturing = false;
          void this.releaseAudio();
        }
        this.onStatus("Disconnected from the speech-to-text backend.");
      };
      socket.addEventListener("message", onMessage);
      socket.addEventListener("error", onError, { once: true });
      socket.addEventListener("close", onClose, { once: true });
    });
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  send(event) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      const error = new Error("The speech-to-text connection is not open.");
      this.onError(error);
      throw error;
    }
    this.socket.send(JSON.stringify(event));
  }

  async releaseAudio() {
    this.source?.disconnect();
    this.worklet?.disconnect();
    this.source = null;
    this.worklet = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.context && this.context.state !== "closed") {
      await this.context.close();
    }
    this.context = null;
  }
}
