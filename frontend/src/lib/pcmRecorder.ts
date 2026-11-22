/**
 * VoxShield AI — Studio-Grade Native PCM WAV Audio Recorder
 * 
 * Captures pure acoustic signals with DSP filters explicitly disabled
 * (zero aggressive browser noise cancellation or phase distortion),
 * preserving natural vocal harmonics.
 * 
 * Supports both:
 * 1. 'mic': Direct microphone input (getUserMedia)
 * 2. 'call': Live system/call audio intercept (getDisplayMedia for Windows Phone Link, WhatsApp Web, VoIP)
 * 
 * Encodes uncompressed 16-bit RIFF PCM WAV binary chunks at native sample rate.
 * Exposes Web Audio AnalyserNode for real-time 60fps 3D WebGL audio sculpture reactivity.
 */

export type AudioInputMode = "mic" | "call";

export class PcmWavRecorder {
  private audioCtx: AudioContext | null = null;
  private rawStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private dummyGain: GainNode | null = null;
  private pcmBuffer: number[] = [];
  private isRecording = false;
  private onChunkCallback: ((wavBuffer: ArrayBuffer, rms: number) => void) | null = null;
  private nativeSampleRate = 48000;

  public async start(
    onChunk: (wavBuffer: ArrayBuffer, rms: number) => void,
    mode: AudioInputMode = "mic",
    onEnded?: () => void
  ): Promise<{
    stream: MediaStream;
    analyser: AnalyserNode;
  }> {
    this.stop();
    this.onChunkCallback = onChunk;
    this.pcmBuffer = [];

    let stream: MediaStream;

    if (mode === "call") {
      // Capture system/call audio using getDisplayMedia (Windows Phone Link, WhatsApp Web, VoIP)
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.rawStream = stream;

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        // User forgot to tick the audio checkbox -> clean up video track immediately
        stream.getTracks().forEach((track) => track.stop());
        this.rawStream = null;
        throw new Error(
          "No call audio detected. Please tick 'Share system audio' (or 'Share tab audio') in the popup."
        );
      }

      // Attach onended listener so clicking browser's native 'Stop sharing' bar stops protection cleanly
      if (onEnded) {
        audioTracks[0].onended = () => {
          onEnded();
        };
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
          videoTracks[0].onended = () => {
            onEnded();
          };
        }
      }

      // Pass audio-only MediaStream into the exact same Web Audio pipeline
      this.micStream = new MediaStream(audioTracks);
    } else {
      // Direct microphone capture with DSP disabled to preserve vocal dynamics
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });

      this.rawStream = stream;
      this.micStream = stream;

      if (onEnded) {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTracks[0].onended = () => {
            onEnded();
          };
        }
      }
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AudioContextClass();
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }

    this.nativeSampleRate = this.audioCtx.sampleRate;
    const samplesPerChunk = Math.round(this.nativeSampleRate * 3.0);
    const slideOffset = Math.round(this.nativeSampleRate * 2.5);

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.micStream);

    // High-resolution studio frequency analyser for 3D WebGL visual sculpture
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.analyserNode.smoothingTimeConstant = 0.82;

    this.processorNode = this.audioCtx.createScriptProcessor(4096, 1, 1);

    this.processorNode.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const inputData = e.inputBuffer.getChannelData(0);

      for (let i = 0; i < inputData.length; i++) {
        this.pcmBuffer.push(inputData[i]);
      }

      if (this.pcmBuffer.length >= samplesPerChunk) {
        const slice = this.pcmBuffer.slice(0, samplesPerChunk);
        this.pcmBuffer = this.pcmBuffer.slice(slideOffset);

        const floatArr = new Float32Array(slice);
        const rms = this.calculateRms(floatArr);
        const wavBuffer = this.encodeWav(floatArr, this.nativeSampleRate);

        if (this.onChunkCallback) {
          this.onChunkCallback(wavBuffer, rms);
        }
      }
    };

    // Routing: Source -> Analyser -> Processor -> DummyGain(0) -> Destination
    this.sourceNode.connect(this.analyserNode);
    this.analyserNode.connect(this.processorNode);

    this.dummyGain = this.audioCtx.createGain();
    this.dummyGain.gain.value = 0;
    this.processorNode.connect(this.dummyGain);
    this.dummyGain.connect(this.audioCtx.destination);

    this.isRecording = true;
    return {
      stream: this.micStream,
      analyser: this.analyserNode,
    };
  }

  public stop(): void {
    this.isRecording = false;

    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch {}
      this.processorNode = null;
    }

    if (this.dummyGain) {
      try {
        this.dummyGain.disconnect();
      } catch {}
      this.dummyGain = null;
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch {}
      this.analyserNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.audioCtx && this.audioCtx.state !== "closed") {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }

    // Stop raw capture stream (both audio and any hidden video track from display media)
    if (this.rawStream) {
      this.rawStream.getTracks().forEach((t) => t.stop());
      this.rawStream = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    this.pcmBuffer = [];
    this.onChunkCallback = null;
  }

  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }

  public getStream(): MediaStream | null {
    return this.micStream;
  }

  public getSampleRate(): number {
    return this.nativeSampleRate;
  }

  private calculateRms(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  /**
   * Encodes raw mono float32 samples into a standard 44-byte RIFF 16-bit PCM WAV.
   */
  private encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const bufferSize = 44 + dataSize;

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, "WAVE");

    // fmt sub-chunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data sub-chunk
    this.writeString(view, 36, "data");
    view.setUint32(40, dataSize, true);

    // 16-bit signed PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      const intVal = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, intVal, true);
      offset += 2;
    }

    return buffer;
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}
