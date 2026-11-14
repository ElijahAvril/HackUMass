class PcmResampler extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetRate = options.processorOptions.targetRate;
    this.step = sampleRate / this.targetRate;
    this.nextSamplePosition = 0;
    this.inputPosition = 0;
    this.previousSample = 0;
    this.hasPreviousSample = false;
    this.output = new Float32Array(2048);
    this.outputLength = 0;
    this.port.onmessage = (event) => {
      if (event.data?.type === "flush") {
        this.flush();
        this.port.postMessage({ type: "flushed" });
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (output) {
      output.fill(0);
    }

    if (!input) {
      return true;
    }

    for (const sample of input) {
      const position = this.inputPosition;
      if (!this.hasPreviousSample) {
        this.previousSample = sample;
        this.hasPreviousSample = true;
        this.appendSample(sample);
        this.nextSamplePosition += this.step;
      } else {
        while (this.nextSamplePosition <= position) {
          const fraction = this.nextSamplePosition - (position - 1);
          this.appendSample(
            this.previousSample + (sample - this.previousSample) * fraction
          );
          this.nextSamplePosition += this.step;
        }
        this.previousSample = sample;
      }
      this.inputPosition += 1;
    }
    return true;
  }

  appendSample(sample) {
    this.output[this.outputLength] = sample;
    this.outputLength += 1;
    if (this.outputLength === this.output.length) {
      this.sendOutput();
    }
  }

  sendOutput() {
    if (this.outputLength === 0) {
      return;
    }
    const samples = this.output.slice(0, this.outputLength);
    this.port.postMessage({ type: "audio", samples }, [samples.buffer]);
    this.outputLength = 0;
  }

  flush() {
    this.sendOutput();
  }
}

registerProcessor("pcm-resampler", PcmResampler);
