/**
 * SabanOS Native Web Audio API Synth
 * Generates tones locally for system feedback
 */

class AudioService {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.1) {
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  public playSent() {
    // Ding short (880Hz-1200Hz)
    this.playTone(1000, 0.15, 'sine', 0.05);
  }

  public playReceived() {
    // Double gentle tone (659Hz and 784Hz)
    this.playTone(659, 0.1, 'sine', 0.05);
    setTimeout(() => this.playTone(784, 0.12, 'sine', 0.05), 80);
  }

  public playGpsPing() {
    // Pulsing urgent alert
    const interval = setInterval(() => {
      this.playTone(1200, 0.3, 'square', 0.03);
    }, 500);
    
    // Returns a stopper function
    return () => clearInterval(interval);
  }
}

export const audioService = new AudioService();
