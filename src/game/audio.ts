// Web Audio API Procedural Sound Engine & Speech Synthesizer for Agent V9: Velocity City

class SoundEngine {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  
  public isMusicPlaying = false;
  private musicTimer: number | null = null;
  private musicStep = 0;

  public soundEnabled = true;
  public musicEnabled = true;
  public voiceEnabled = true;

  constructor() {
    // Lazy initialized on first user interaction
  }

  /**
   * Create + resume the AudioContext from a real user gesture. Android WebViews (and
   * Safari) silently swallow the first sounds unless the context is unlocked inside a
   * genuine tap/click handler — call this from the "tap to start" gate.
   */
  public unlock() {
    this.initCtx();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.7;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.35;
      this.musicGain.connect(this.masterGain);

      // Start engine loop generator
      this.setupEngineSynth();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private setupEngineSynth() {
    if (!this.ctx || !this.sfxGain) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 45;

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 180;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0; // starts silent

      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);

      this.engineOsc.start();
    } catch {
      // Ignored if browser requires strict gesture
    }
  }

  public updateEngine(speedRatio: number, isRiding: boolean, isSilentMode: boolean) {
    if (!this.ctx || !this.engineGain || !this.engineOsc || !this.engineFilter || !this.soundEnabled) return;
    
    if (!isRiding) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }

    if (isSilentMode) {
      // Gentle electric hum
      this.engineGain.gain.setTargetAtTime(0.08, this.ctx.currentTime, 0.1);
      this.engineOsc.frequency.setTargetAtTime(70 + speedRatio * 90, this.ctx.currentTime, 0.05);
      this.engineFilter.frequency.setTargetAtTime(250 + speedRatio * 300, this.ctx.currentTime, 0.05);
    } else {
      // Turbo futuristic motorcycle roar
      const targetGain = 0.15 + speedRatio * 0.25;
      const targetFreq = 50 + speedRatio * 180;
      const targetFilter = 220 + speedRatio * 850;

      this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
      this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
      this.engineFilter.frequency.setTargetAtTime(targetFilter, this.ctx.currentTime, 0.05);
    }
  }

  public playNitro() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(480, this.ctx.currentTime + 0.6);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + 0.6);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.7);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.7);
  }

  public playJump() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(540, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  public playEMP() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;

    // Multi-layered cyber zap
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(80, now + 0.45);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1200, now);
    osc2.frequency.linearRampToValueAtTime(120, now + 0.45);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start();
    osc2.start();
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
  }

  public playFoam() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(180, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.22);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(now + 0.25);
  }

  public playCollectible() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = this.ctx.currentTime + i * 0.07;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.2);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  public playWaypoint() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(now + 0.2);
  }

  public playAlert() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.12);
    osc.frequency.linearRampToValueAtTime(600, now + 0.24);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(now + 0.3);
  }

  public playHorn() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(440, now);
    osc1.frequency.setValueAtTime(554.37, now + 0.08); // Dual tone agent chirp

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.setValueAtTime(1108.73, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start();
    osc2.start();
    osc1.stop(now + 0.22);
    osc2.stop(now + 0.22);
  }

  public playDrift() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.25);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.Q.value = 3;

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(now + 0.25);
  }

  public playCameraSwitch() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(now + 0.12);
  }

  public playReset() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.15);
    osc.frequency.linearRampToValueAtTime(400, now + 0.3);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(now + 0.3);
  }

  public playRefuelHum(progress: number) {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Pitch rises with fuel percentage (from 220Hz to 660Hz)
    const freq = 220 + (progress / 100) * 440;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(freq + 40, now + 0.1);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(now + 0.1);
  }

  public playRefuelComplete() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;

    const now = this.ctx.currentTime;
    const chords = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
    chords.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.08;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  public playLowFuelBeep() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;

    const now = this.ctx.currentTime;
    [0, 0.15].forEach((offset) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + offset;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(740, t + 0.05);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + 0.1);
    });
  }

  public playEscortOut() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;

    const now = this.ctx.currentTime;
    const notes = [349.23, 329.63, 293.66, 261.63]; // F, E, D, C descending cartoon wobble
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.12;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  public playMissionComplete() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || !this.soundEnabled) return;

    const fanfare = [
      { f: 440, d: 0.12 },
      { f: 554.37, d: 0.12 },
      { f: 659.25, d: 0.12 },
      { f: 880, d: 0.4 },
    ];
    let offset = 0;
    fanfare.forEach((n) => {
      if (!this.ctx) return;
      const start = this.ctx.currentTime + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, start);
      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + n.d);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(start);
      osc.stop(start + n.d);
      offset += n.d * 0.85;
    });
  }

  public startMusic() {
    this.initCtx();
    if (this.isMusicPlaying || !this.musicEnabled) return;
    this.isMusicPlaying = true;

    // Futuristic spy groove synthesizer loop
    const bassline = [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83];
    const melody = [440, 0, 523.25, 587.33, 440, 659.25, 587.33, 0];

    const tick = () => {
      if (!this.isMusicPlaying || !this.ctx || !this.musicGain || !this.musicEnabled) return;
      const now = this.ctx.currentTime;
      const step = this.musicStep % 8;

      // Bass note
      const bassFreq = bassline[step];
      if (bassFreq > 0) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(bassFreq, now);
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + 0.18);
      }

      // Synth lead
      const melFreq = melody[step];
      if (melFreq > 0) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(melFreq, now);
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + 0.22);
      }

      this.musicStep++;
      this.musicTimer = window.setTimeout(tick, 180);
    };

    tick();
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public speak(text: string, voicePitch: 'kira' | 'v9' | 'guard' = 'kira') {
    if (!this.voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      if (voicePitch === 'kira') {
        utterance.pitch = 1.25; // energetic handler
      } else if (voicePitch === 'v9') {
        utterance.pitch = 0.9; // sleek AI bike companion
        utterance.rate = 1.15;
      } else if (voicePitch === 'guard') {
        utterance.pitch = 0.8;
      }
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore if speech is restricted by browser policy
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
  }
}

export const soundEngine = new SoundEngine();
