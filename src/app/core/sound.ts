import { Injectable, signal } from '@angular/core';
import { load, save } from './storage';

const KEY = 'wtw:muted';

/** Chords for the roll music: a slow, warm Cmaj7 - Am7 - Dm7 - G7 loop (MIDI note numbers). */
const CHORDS = [
  [48, 55, 59, 64],
  [45, 52, 55, 60],
  [50, 57, 60, 65],
  [43, 50, 53, 59],
];
const BEAT = 60 / 116;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * Every sound is synthesised with Web Audio, so there are no files to download or cache:
 * light lounge music while the film rolls, a projector click for each frame that passes the
 * gate, and a bell when the ticket prints. Muted state is remembered on this device.
 */
@Injectable({ providedIn: 'root' })
export class Sound {
  readonly muted = signal(load(KEY, { muted: false }).muted === true);
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private music: { gain: GainNode; timer: ReturnType<typeof setInterval> } | null = null;

  toggleMute() {
    this.muted.set(!this.muted());
    save(KEY, { muted: this.muted() });
    if (this.muted()) this.stopMusic(0.1);
  }

  /** Must be called from a tap (browsers only allow audio after a user gesture). */
  private audio(): AudioContext | null {
    if (this.muted() || typeof AudioContext === 'undefined') return null;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.05);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Starts the roll music: a soft pad, a walking bass and a vibraphone-like arpeggio. */
  startMusic() {
    const ctx = this.audio();
    if (!ctx || !this.master) return;
    this.stopMusic(0);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 0.25);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    gain.connect(tone).connect(this.master);

    let next = ctx.currentTime + 0.02;
    let step = 0;
    const schedule = () => {
      // Look ahead 300 ms so timer jitter never causes gaps.
      while (next < ctx.currentTime + 0.3) {
        const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
        const beat = step % 8;
        if (beat === 0) {
          for (const n of chord.slice(1)) this.note(gain, hz(n), next, BEAT * 7.5, 'sine', 0.05);
        }
        if (beat % 2 === 0) {
          const bass = chord[0] - 12 + (beat === 4 ? 7 : 0);
          this.note(gain, hz(bass), next, BEAT * 0.9, 'triangle', 0.22);
        }
        const arp = chord[[1, 2, 3, 2, 3, 1, 2, 3][beat]] + 12;
        this.note(gain, hz(arp), next, BEAT * 0.45, 'triangle', 0.07);
        next += BEAT / 2;
        step++;
      }
    };
    schedule();
    this.music = { gain, timer: setInterval(schedule, 100) };
  }

  stopMusic(fade = 0.6) {
    const m = this.music;
    if (!m || !this.ctx) return;
    this.music = null;
    clearInterval(m.timer);
    const t = this.ctx.currentTime;
    m.gain.gain.cancelScheduledValues(t);
    m.gain.gain.setValueAtTime(m.gain.gain.value, t);
    m.gain.gain.linearRampToValueAtTime(0, t + Math.max(0.01, fade));
    setTimeout(() => m.gain.disconnect(), (fade + 0.1) * 1000);
  }

  /** One projector click: a short filtered noise burst with a low knock under it. */
  tick() {
    const ctx = this.audio();
    if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800 + Math.random() * 400;
    band.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    src.connect(band).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.04);
    this.note(this.master, 110, t, 0.04, 'square', 0.05);
  }

  /** The film leader's countdown beep. */
  beep() {
    const ctx = this.audio();
    if (!ctx || !this.master) return;
    this.note(this.master, 1000, ctx.currentTime, 0.09, 'sine', 0.12);
  }

  /** The ticket prints: a quick paper zip and a two-note bell. */
  ding() {
    const ctx = this.audio();
    if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2500, t);
    hp.frequency.linearRampToValueAtTime(6000, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.linearRampToValueAtTime(0, t + 0.2);
    src.connect(hp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.22);
    this.note(this.master, hz(84), t + 0.12, 1.2, 'sine', 0.18);
    this.note(this.master, hz(91), t + 0.24, 1.4, 'sine', 0.14);
  }

  private note(
    out: AudioNode,
    freq: number,
    at: number,
    dur: number,
    type: OscillatorType,
    level: number,
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }
}
