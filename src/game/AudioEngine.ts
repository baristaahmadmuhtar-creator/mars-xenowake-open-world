export type AudioCue = 'pickup' | 'pulse' | 'activate' | 'hit' | 'dash' | 'win' | 'jump' | 'land' | 'step';

type AudioContextConstructor = typeof AudioContext;

interface WebKitAudioWindow extends Window {
  webkitAudioContext?: AudioContextConstructor;
}

interface ToneOptions {
  frequency: number;
  endFrequency?: number;
  duration: number;
  volume: number;
  delay?: number;
  type?: OscillatorType;
}

interface NoiseOptions {
  duration: number;
  volume: number;
  frequency: number;
  endFrequency?: number;
  delay?: number;
  filterType?: BiquadFilterType;
  resonance?: number;
}

const MASTER_VOLUME = 0.38;
const SILENCE = 0.0001;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.AudioContext
    ?? (window as WebKitAudioWindow).webkitAudioContext
    ?? null;
}

/**
 * Small procedural audio engine with no downloaded assets.
 *
 * `start()` is intentionally the only method that may create an AudioContext.
 * Call it directly from a trusted user gesture (the expedition start button on
 * mobile). `play()` never attempts to unlock or resume audio by itself.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private droneA: OscillatorNode | null = null;
  private droneB: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  private muted: boolean;
  private intensity = 0;
  private paused = false;
  private disposed = false;

  constructor(muted = false) {
    this.muted = muted;
  }

  get isSupported(): boolean {
    return getAudioContextConstructor() !== null;
  }

  get isStarted(): boolean {
    return this.context !== null && this.context.state !== 'closed';
  }

  /** Create/unlock audio. This should be called synchronously from a gesture. */
  async start(): Promise<void> {
    if (this.disposed) {
      return;
    }

    if (this.context === null) {
      const Context = getAudioContextConstructor();
      if (Context === null) {
        return;
      }

      try {
        const context = new Context({ latencyHint: 'interactive' });
        this.context = context;
        this.createAudioGraph(context);
      } catch {
        this.releaseGraph();
        this.context = null;
        return;
      }
    }

    const context = this.context;
    if (context.state === 'suspended') {
      try {
        // Calling resume here, before any other awaited work, preserves the
        // browser's user-activation window on iOS Safari.
        await context.resume();
      } catch {
        return;
      }
    }

    if (context.state === 'running') {
      this.paused = false;
      this.applyMute();
      this.applyIntensity();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMute();
  }

  setIntensity(intensity: number): void {
    this.intensity = Number.isFinite(intensity)
      ? Math.min(1, Math.max(0, intensity))
      : 0;
    this.applyIntensity();
  }

  play(name: AudioCue): void {
    if (
      this.disposed
      || this.paused
      || this.muted
      || this.context?.state !== 'running'
      || this.effects === null
    ) {
      return;
    }

    switch (name) {
      case 'pickup':
        this.playTone({
          frequency: 390,
          endFrequency: 790,
          duration: 0.16,
          volume: 0.15,
          type: 'triangle',
        });
        this.playTone({
          frequency: 760,
          endFrequency: 1180,
          duration: 0.12,
          volume: 0.08,
          delay: 0.07,
          type: 'sine',
        });
        return;

      case 'pulse':
        this.playTone({
          frequency: 105,
          endFrequency: 43,
          duration: 0.4,
          volume: 0.2,
          type: 'sawtooth',
        });
        this.playNoise({
          duration: 0.3,
          volume: 0.14,
          frequency: 1050,
          endFrequency: 180,
          filterType: 'lowpass',
          resonance: 3,
        });
        return;

      case 'activate':
        this.playTone({ frequency: 220, duration: 0.24, volume: 0.12, type: 'sine' });
        this.playTone({ frequency: 330, duration: 0.24, volume: 0.12, delay: 0.11, type: 'sine' });
        this.playTone({ frequency: 495, duration: 0.34, volume: 0.15, delay: 0.22, type: 'triangle' });
        return;

      case 'jump':
        this.playTone({
          frequency: 240,
          endFrequency: 520,
          duration: 0.18,
          volume: 0.12,
          type: 'triangle',
        });
        return;

      case 'land':
        this.playNoise({
          duration: 0.14,
          volume: 0.12,
          frequency: 520,
          endFrequency: 90,
          filterType: 'lowpass',
          resonance: 1.4,
        });
        this.playTone({ frequency: 150, endFrequency: 70, duration: 0.12, volume: 0.08, type: 'sine' });
        return;

      case 'step':
        this.playNoise({
          duration: 0.07,
          volume: 0.045,
          frequency: 780,
          endFrequency: 260,
          filterType: 'lowpass',
          resonance: 1.1,
        });
        return;

      case 'hit':
        this.playNoise({
          duration: 0.14,
          volume: 0.24,
          frequency: 1400,
          endFrequency: 260,
          filterType: 'bandpass',
          resonance: 1.4,
        });
        this.playTone({
          frequency: 82,
          endFrequency: 46,
          duration: 0.19,
          volume: 0.17,
          type: 'square',
        });
        return;

      case 'dash':
        this.playNoise({
          duration: 0.23,
          volume: 0.14,
          frequency: 230,
          endFrequency: 1800,
          filterType: 'highpass',
          resonance: 0.8,
        });
        this.playTone({
          frequency: 135,
          endFrequency: 285,
          duration: 0.16,
          volume: 0.08,
          type: 'triangle',
        });
        return;

      case 'win': {
        const notes = [262, 330, 392, 523, 659];
        notes.forEach((frequency, index) => {
          this.playTone({
            frequency,
            endFrequency: frequency * 1.008,
            duration: index === notes.length - 1 ? 0.8 : 0.35,
            volume: index === notes.length - 1 ? 0.16 : 0.11,
            delay: index * 0.13,
            type: index % 2 === 0 ? 'triangle' : 'sine',
          });
        });
      }
    }
  }

  async pause(): Promise<void> {
    this.paused = true;
    const context = this.context;

    if (context === null || context.state !== 'running') {
      return;
    }

    try {
      await context.suspend();
    } catch {
      // Suspending may fail while a page is being backgrounded. Remaining in
      // the logical paused state still prevents new effects from being made.
    }
  }

  /** Resume an existing context; invoke this from a user gesture on mobile. */
  async resume(): Promise<void> {
    const context = this.context;
    if (this.disposed || context === null || context.state === 'closed') {
      return;
    }

    try {
      if (context.state === 'suspended') {
        await context.resume();
      }
      if (context.state === 'running') {
        this.paused = false;
        this.applyMute();
      }
    } catch {
      // Audio remains paused when browser policy denies the resume request.
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.paused = true;

    const context = this.context;
    this.releaseGraph();
    this.context = null;

    if (context !== null && context.state !== 'closed') {
      void context.close().catch(() => {
        // Closing can race a browser-driven interruption; there is nothing
        // else to release once references to the graph have been dropped.
      });
    }
  }

  private createAudioGraph(context: AudioContext): void {
    const master = context.createGain();
    master.gain.setValueAtTime(this.muted ? 0 : MASTER_VOLUME, context.currentTime);
    master.connect(context.destination);
    this.master = master;

    const effects = context.createGain();
    effects.gain.setValueAtTime(0.82, context.currentTime);
    effects.connect(master);
    this.effects = effects;

    const windBuffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const windSamples = windBuffer.getChannelData(0);
    let smoothedNoise = 0;
    for (let index = 0; index < windSamples.length; index += 1) {
      smoothedNoise = smoothedNoise * 0.965 + (Math.random() * 2 - 1) * 0.08;
      windSamples[index] = smoothedNoise;
    }

    const windSource = context.createBufferSource();
    windSource.buffer = windBuffer;
    windSource.loop = true;

    const windFilter = context.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.Q.setValueAtTime(0.7, context.currentTime);

    const windGain = context.createGain();
    windGain.gain.setValueAtTime(0.024 + this.intensity * 0.065, context.currentTime);
    windFilter.frequency.setValueAtTime(420 + this.intensity * 1550, context.currentTime);
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);

    this.windSource = windSource;
    this.windFilter = windFilter;
    this.windGain = windGain;

    const droneA = context.createOscillator();
    droneA.type = 'sine';
    droneA.frequency.setValueAtTime(43.65, context.currentTime);

    const droneB = context.createOscillator();
    droneB.type = 'triangle';
    droneB.frequency.setValueAtTime(65.41, context.currentTime);
    droneB.detune.setValueAtTime(-7, context.currentTime);

    const droneGain = context.createGain();
    droneGain.gain.setValueAtTime(0.014 + this.intensity * 0.032, context.currentTime);
    droneA.connect(droneGain);
    droneB.connect(droneGain);
    droneGain.connect(master);

    this.droneA = droneA;
    this.droneB = droneB;
    this.droneGain = droneGain;

    this.applyIntensity();
    windSource.start();
    droneA.start();
    droneB.start();
  }

  private applyMute(): void {
    const context = this.context;
    const master = this.master;
    if (context === null || master === null || context.state === 'closed') {
      return;
    }

    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(this.muted ? 0 : MASTER_VOLUME, now + 0.035);
  }

  private applyIntensity(): void {
    const context = this.context;
    const windGain = this.windGain;
    const windFilter = this.windFilter;
    const droneGain = this.droneGain;
    if (
      context === null
      || windGain === null
      || windFilter === null
      || droneGain === null
      || context.state === 'closed'
    ) {
      return;
    }

    const now = context.currentTime;
    const transitionEnd = now + 0.4;
    const windVolume = 0.024 + this.intensity * 0.065;
    const droneVolume = 0.014 + this.intensity * 0.032;
    const windFrequency = 420 + this.intensity * 1550;

    windGain.gain.cancelScheduledValues(now);
    windGain.gain.setValueAtTime(windGain.gain.value, now);
    windGain.gain.linearRampToValueAtTime(windVolume, transitionEnd);

    droneGain.gain.cancelScheduledValues(now);
    droneGain.gain.setValueAtTime(droneGain.gain.value, now);
    droneGain.gain.linearRampToValueAtTime(droneVolume, transitionEnd);

    windFilter.frequency.cancelScheduledValues(now);
    windFilter.frequency.setValueAtTime(windFilter.frequency.value, now);
    windFilter.frequency.linearRampToValueAtTime(windFrequency, transitionEnd);
  }

  private playTone(options: ToneOptions): void {
    const context = this.context;
    const effects = this.effects;
    if (context === null || effects === null || context.state !== 'running') {
      return;
    }

    const start = context.currentTime + (options.delay ?? 0);
    const end = start + options.duration;
    const attackEnd = start + Math.min(0.025, options.duration * 0.2);
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = options.type ?? 'sine';
    oscillator.frequency.setValueAtTime(Math.max(1, options.frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, options.endFrequency ?? options.frequency),
      end,
    );

    envelope.gain.setValueAtTime(SILENCE, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(SILENCE, options.volume), attackEnd);
    envelope.gain.exponentialRampToValueAtTime(SILENCE, end);

    oscillator.connect(envelope);
    envelope.connect(effects);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }

  private playNoise(options: NoiseOptions): void {
    const context = this.context;
    const effects = this.effects;
    if (context === null || effects === null || context.state !== 'running') {
      return;
    }

    const start = context.currentTime + (options.delay ?? 0);
    const end = start + options.duration;
    const sampleCount = Math.max(1, Math.floor(context.sampleRate * options.duration));
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = buffer;
    filter.type = options.filterType ?? 'lowpass';
    filter.Q.setValueAtTime(options.resonance ?? 0.8, start);
    filter.frequency.setValueAtTime(Math.max(20, options.frequency), start);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(20, options.endFrequency ?? options.frequency),
      end,
    );

    envelope.gain.setValueAtTime(SILENCE, start);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(SILENCE, options.volume),
      start + Math.min(0.012, options.duration * 0.15),
    );
    envelope.gain.exponentialRampToValueAtTime(SILENCE, end);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(effects);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
    source.start(start);
    source.stop(end + 0.01);
  }

  private releaseGraph(): void {
    for (const source of [this.windSource, this.droneA, this.droneB]) {
      if (source !== null) {
        try {
          source.stop();
        } catch {
          // A source can already have ended during teardown.
        }
      }
    }

    for (const node of [
      this.windSource,
      this.windFilter,
      this.windGain,
      this.droneA,
      this.droneB,
      this.droneGain,
      this.effects,
      this.master,
    ]) {
      node?.disconnect();
    }

    this.windSource = null;
    this.windFilter = null;
    this.windGain = null;
    this.droneA = null;
    this.droneB = null;
    this.droneGain = null;
    this.effects = null;
    this.master = null;
  }
}

export default AudioEngine;
