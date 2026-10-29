import { GameSettings } from '../types/game';

class SoundController {
  private ctx: AudioContext | null = null;
  private musicVolume = 0.45;
  private sfxVolume = 0.75;
  private ambientVolume = 0.4;
  private muted = false;
  private musicInterval: number | null = null;
  private isPlayingMenuMusic = false;
  private lastFootstepTime = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          return null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public applySettings(settings: GameSettings) {
    const master =
      typeof settings.masterVolume === 'number' ? settings.masterVolume : 1.0;
    this.musicVolume = settings.musicVolume * master;
    this.sfxVolume = settings.sfxVolume * master;
    this.ambientVolume = settings.ambientVolume * master;
    this.muted = settings.muted || master <= 0;
    if (this.muted && this.musicInterval) {
      this.stopMenuMusic();
    }
  }

  public playClick() {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.065);
      gain.gain.setValueAtTime(0.18 * this.sfxVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.065);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } catch {
      // ignore
    }
  }

  public playPickup() {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    try {
      const now = ctx.currentTime;
      [587.33, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.055);
        gain.gain.setValueAtTime(0.2 * this.sfxVolume, now + idx * 0.055);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.055);
        osc.stop(now + idx * 0.055 + 0.13);
      });
    } catch {
      // ignore
    }
  }

  public playFootstep(sprint = false) {
    const nowMs = performance.now();
    const minInterval = sprint ? 240 : 340;
    if (nowMs - this.lastFootstepTime < minInterval) return;
    this.lastFootstepTime = nowMs;

    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(sprint ? 125 : 95, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(42, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.09 * this.sfxVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.055);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      // ignore
    }
  }

  public playWeaponFire(equipmentId: string) {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (equipmentId === 'precision_caster') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.22);
        gain.gain.setValueAtTime(0.26 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.23);
      } else if (equipmentId === 'charged_arc') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);
        gain.gain.setValueAtTime(0.24 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.19);
      } else if (equipmentId === 'close_scatter') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.15);
        gain.gain.setValueAtTime(0.28 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(680, now);
        osc.frequency.exponentialRampToValueAtTime(190, now + 0.09);
        gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      }
    } catch {
      // ignore
    }
  }

  public playHitMarker(isElimination = false) {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isElimination ? 1040 : 760, now);
      osc.frequency.exponentialRampToValueAtTime(isElimination ? 1480 : 480, now + 0.09);
      gain.gain.setValueAtTime(0.24 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // ignore
    }
  }

  public playCoverDeploy() {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);
      gain.gain.setValueAtTime(0.22 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // ignore
    }
  }

  public playZoneWarning() {
    const ctx = this.ensureContext();
    if (!ctx || this.ambientVolume <= 0) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.14);
      gain.gain.setValueAtTime(0.16 * this.ambientVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.34);
    } catch {
      // ignore
    }
  }

  public unlockAudio() {
    this.ensureContext();
  }

  public playReload() {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    try {
      const now = ctx.currentTime;
      [320, 480, 690].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.16 * this.sfxVolume, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.1);
      });
    } catch {
      // ignore
    }
  }

  public playJump() {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.11);
      gain.gain.setValueAtTime(0.14 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // ignore
    }
  }

  public playLand() {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(115, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.09);
      gain.gain.setValueAtTime(0.18 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    } catch {
      // ignore
    }
  }

  public playTakingDamage() {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.12);
      gain.gain.setValueAtTime(0.22 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
      // ignore
    }
  }

  public playSurfaceImpact(surface: 'flesh' | 'shield' | 'wall') {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = surface === 'shield' ? 'sine' : 'triangle';
      const startFreq =
        surface === 'shield' ? 920 : surface === 'flesh' ? 320 : 210;
      const endFreq =
        surface === 'shield' ? 540 : surface === 'flesh' ? 120 : 85;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.06);
      gain.gain.setValueAtTime(0.14 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // ignore
    }
  }

  public playVehicleEnginePulse(speedRatio: number) {
    const nowMs = performance.now();
    if (nowMs - this.lastFootstepTime < 140) return;
    this.lastFootstepTime = nowMs;

    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const freq = 58 + Math.min(1.2, Math.abs(speedRatio)) * 95;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.065 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
      // ignore
    }
  }

  public playMatchResult(victory: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    try {
      const now = ctx.currentTime;
      const notes = victory
        ? [523.25, 659.25, 783.99, 1046.5]
        : [392.0, 349.23, 311.13, 261.63];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.13);
        gain.gain.setValueAtTime(0.22 * this.sfxVolume, now + idx * 0.13);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          now + idx * 0.13 + 0.28
        );
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.13);
        osc.stop(now + idx * 0.13 + 0.3);
      });
    } catch {
      // ignore
    }
  }

  public startMenuMusic() {
    if (this.isPlayingMenuMusic || this.muted || this.musicVolume <= 0) return;
    this.isPlayingMenuMusic = true;
    const chordProgression = [
      [261.63, 329.63, 392.0],
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [196.0, 246.94, 293.66],
    ];
    let step = 0;
    this.musicInterval = window.setInterval(() => {
      if (this.muted || this.musicVolume <= 0 || document.hidden) return;
      const ctx = this.ensureContext();
      if (!ctx) return;
      const chord = chordProgression[step % chordProgression.length];
      step++;
      const now = ctx.currentTime;
      chord.forEach((freq) => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.035 * this.musicVolume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 1.45);
        } catch {
          // ignore
        }
      });
    }, 1600);
  }

  public stopMenuMusic() {
    this.isPlayingMenuMusic = false;
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

export const soundEngine = new SoundController();
