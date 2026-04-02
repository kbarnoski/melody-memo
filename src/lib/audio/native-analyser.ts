/**
 * NativeAnalyserNode — drop-in shim for Web Audio's AnalyserNode.
 *
 * In desktop mode, the Rust FFT thread streams frequency bins via Tauri Channel.
 * This class stores those bins and exposes the same `getByteFrequencyData()` API
 * so shaders work identically without any code changes.
 */
export class NativeAnalyserNode {
  readonly frequencyBinCount = 128;
  readonly fftSize = 256;
  readonly smoothingTimeConstant = 0.8;
  readonly minDecibels = -100;
  readonly maxDecibels = -30;

  private _bins: Uint8Array;

  constructor() {
    this._bins = new Uint8Array(this.frequencyBinCount);
  }

  /** Called by the Tauri Channel callback with data from the Rust FFT thread. */
  updateFromNative(bins: number[]): void {
    const len = Math.min(bins.length, this.frequencyBinCount);
    for (let i = 0; i < len; i++) {
      this._bins[i] = bins[i];
    }
  }

  /** Same signature as AnalyserNode.getByteFrequencyData() */
  getByteFrequencyData(array: Uint8Array): void {
    const len = Math.min(array.length, this._bins.length);
    for (let i = 0; i < len; i++) {
      array[i] = this._bins[i];
    }
  }

  /** Stub — not needed for native, but matches AnalyserNode interface */
  getByteTimeDomainData(array: Uint8Array): void {
    array.fill(128); // silence = 128 in time domain
  }

  getFloatFrequencyData(array: Float32Array): void {
    for (let i = 0; i < Math.min(array.length, this._bins.length); i++) {
      // Reverse the byte→dB conversion
      array[i] = (this._bins[i] / 255) * 70 + this.minDecibels;
    }
  }

  getFloatTimeDomainData(array: Float32Array): void {
    array.fill(0);
  }
}
