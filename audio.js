/**
 * BeatSyncAudio - Audio analysis and playback engine for Beat-Sync Video Generator.
 * 
 * This module manages:
 * 1. Web Audio API `AudioContext` and `AnalyserNode` for real-time playback and visualization.
 * 2. File loading and decoding (File, Blob, or URL).
 * 3. Offline analysis using `OfflineAudioContext` for precise BPM (tempo) estimation and beat (peak) tracking.
 * 4. Pre-calculating amplitude envelope and implementing an offline Cooley-Tukey FFT
 *    to support frame-perfect offline video rendering.
 * 5. Event dispatching for beat triggers and playback controls.
 */
class BeatSyncAudio {
  constructor() {
    this.audioCtx = null;
    this.analyser = null;
    this.gainNode = null;
    this.audioBuffer = null;
    this.volume = 0.8;
    
    // Playback SourceNode
    this.source = null;
    
    // Playback state
    this.isPlaying = false;
    this.startTime = 0;
    this.pauseOffset = 0;
    
    // Beat & BPM Analysis results
    this.bpm = 0;
    this.beatTimes = []; // Beat timestamps in seconds
    this.amplitudeEnvelope = []; // Pre-calculated RMS values (100Hz resolution)
    
    // Real-time update state variables
    this.lastCheckedTime = 0;
    this.lastFrameTime = 0;
    this.beatIntensity = 0;
    this.isOnBeat = false;
    this._loopRunning = false;
    
    // Event Callbacks
    this.callbacks = {
      loadstart: [],
      analyzestart: [],
      ready: [],
      play: [],
      pause: [],
      stop: [],
      seek: [],
      ended: [],
      beat: []
    };
  }

  /**
   * Initializes the AudioContext and AnalyserNode.
   * Must be called in response to a user gesture to satisfy browser policies.
   */
  initContext() {
    if (this.audioCtx) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API is not supported in this browser environment.');
    }

    this.audioCtx = new AudioContextClass();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048; // Default FFT size
    
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.value = this.volume;
  }

  /**
   * Sets the playback volume.
   * @param {number} value - Volume level from 0.0 to 1.0.
   */
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  /**
   * Registers an event callback.
   * @param {string} eventName - Name of the event.
   * @param {function} callback - Callback function.
   */
  on(eventName, callback) {
    if (this.callbacks[eventName]) {
      this.callbacks[eventName].push(callback);
    }
  }

  /**
   * Unregisters an event callback.
   * @param {string} eventName - Name of the event.
   * @param {function} callback - Callback function.
   */
  off(eventName, callback) {
    if (this.callbacks[eventName]) {
      this.callbacks[eventName] = this.callbacks[eventName].filter(cb => cb !== callback);
    }
  }

  /**
   * Dispatches an event to registered callbacks.
   */
  _triggerEvent(eventName, data) {
    if (this.callbacks[eventName]) {
      this.callbacks[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in callback for event "${eventName}":`, err);
        }
      });
    }
  }

  /**
   * Loads and decodes an audio file.
   * @param {File|Blob|string} fileOrUrl - User-uploaded File/Blob or URL string.
   */
  async loadAudioFile(fileOrUrl) {
    this._triggerEvent('loadstart');
    
    let arrayBuffer;
    
    try {
      if (typeof fileOrUrl === 'string') {
        // Fetch URL
        const response = await fetch(fileOrUrl);
        arrayBuffer = await response.arrayBuffer();
      } else if (fileOrUrl instanceof Blob) {
        // Read File/Blob
        arrayBuffer = await this._readBlobAsArrayBuffer(fileOrUrl);
      } else {
        throw new Error('Unsupported audio source type. Must be File, Blob, or URL string.');
      }

      this.initContext();

      // Decode audio data
      const decodedBuffer = await new Promise((resolve, reject) => {
        this.audioCtx.decodeAudioData(arrayBuffer, resolve, reject);
      });

      this.audioBuffer = decodedBuffer;

      // Start offline beat tracking & BPM analysis
      this._triggerEvent('analyzestart');
      const analysis = await this._analyzeAudio(decodedBuffer);
      
      this.bpm = analysis.bpm;
      this.beatTimes = analysis.beatTimes;
      this._calculateAmplitudeEnvelope(decodedBuffer);

      this.pauseOffset = 0;
      this.lastCheckedTime = 0;
      
      this._triggerEvent('ready', {
        bpm: this.bpm,
        duration: this.audioBuffer.duration,
        beatCount: this.beatTimes.length
      });
      
    } catch (error) {
      console.error('Failed to load or analyze audio:', error);
      throw error;
    }
  }

  /**
   * Promisified FileReader to read Blob as ArrayBuffer.
   */
  _readBlobAsArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * Offline audio analysis for BPM and beat detection.
   * Uses OfflineAudioContext to apply a 150Hz low-pass filter and detects peaks using a dynamic threshold.
   */
  async _analyzeAudio(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    
    // 1. Create OfflineAudioContext (mono)
    const offlineCtx = new OfflineAudioContext(1, length, sampleRate);
    
    // 2. Set up Source Node
    const offlineSource = offlineCtx.createBufferSource();
    offlineSource.buffer = audioBuffer;
    
    // 3. Set up low-pass filter to capture kick/bass beat energy (60Hz to 150Hz range)
    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150;
    filter.Q.value = 1.0;
    
    // 4. Connect source -> filter -> destination
    offlineSource.connect(filter);
    filter.connect(offlineCtx.destination);
    
    // Start playback offline
    offlineSource.start(0);
    
    // 5. Render buffer
    const renderedBuffer = await offlineCtx.startRendering();
    const channelData = renderedBuffer.getChannelData(0);
    
    // 6. Find maximum amplitude to calibrate thresholding
    let maxVal = 0;
    for (let i = 0; i < channelData.length; i++) {
      const val = Math.abs(channelData[i]);
      if (val > maxVal) maxVal = val;
    }
    
    if (maxVal === 0) {
      return { bpm: 0, beatTimes: [] };
    }
    
    // 7. Dynamic threshold peak detection
    const floorThreshold = maxVal * 0.08; // Floor at 8% of max amplitude
    let threshold = maxVal * 0.3; // Starting threshold
    const minPeakDistance = Math.round(sampleRate * 0.28); // ~280ms blanking period (max 214 BPM)
    const peaks = [];
    
    let lastPeakIndex = -minPeakDistance;
    let i = 0;
    
    while (i < channelData.length) {
      const val = Math.abs(channelData[i]);
      
      // Decay threshold exponentially towards the floor threshold
      threshold = floorThreshold + (threshold - floorThreshold) * Math.pow(0.3, 1 / sampleRate);
      
      if (val > threshold && (i - lastPeakIndex) > minPeakDistance) {
        // Search local maximum in a 50ms window to pinpoint the exact transient peak
        const searchWindow = Math.round(sampleRate * 0.05);
        let localMaxVal = val;
        let localMaxIndex = i;
        const limit = Math.min(i + searchWindow, channelData.length);
        
        for (let j = i; j < limit; j++) {
          const v = Math.abs(channelData[j]);
          if (v > localMaxVal) {
            localMaxVal = v;
            localMaxIndex = j;
          }
        }
        
        peaks.push(localMaxIndex);
        lastPeakIndex = localMaxIndex;
        threshold = localMaxVal * 0.7; // Raise threshold after detecting a peak
        i = localMaxIndex + minPeakDistance; // Skip the blanking period
      } else {
        i++;
      }
    }
    
    // Convert peak sample indices to seconds
    const beatTimes = peaks.map(p => p / sampleRate);
    
    // Estimate BPM using interval histogram
    const bpm = this._getBPMFromPeaks(peaks, sampleRate);
    
    return { bpm, beatTimes };
  }

  /**
   * Helper to estimate BPM from detected peak sample intervals.
   */
  _getBPMFromPeaks(peaks, sampleRate) {
    if (peaks.length < 2) return 120; // Fallback
    
    const intervals = [];
    // Compile differences between peaks and subsequent peaks
    for (let i = 0; i < peaks.length; i++) {
      for (let j = i + 1; j < Math.min(peaks.length, i + 8); j++) {
        const interval = peaks[j] - peaks[i];
        intervals.push(interval);
      }
    }
    
    // Map intervals to BPMs, normalizing to the standard range [60, 180]
    const bpms = intervals.map(interval => {
      const duration = interval / sampleRate;
      let bpm = 60 / duration;
      
      while (bpm < 60) bpm *= 2;
      while (bpm > 180) bpm /= 2;
      
      return Math.round(bpm);
    });
    
    // Group and find the most frequent BPM
    const counts = {};
    bpms.forEach(bpm => {
      counts[bpm] = (counts[bpm] || 0) + 1;
    });
    
    let maxCount = 0;
    let bestBPM = 120;
    for (const bpm in counts) {
      if (counts[bpm] > maxCount) {
        maxCount = counts[bpm];
        bestBPM = parseInt(bpm, 10);
      }
    }
    
    return bestBPM;
  }

  /**
   * Calculates the overall amplitude (RMS envelope) downsampled to 100Hz (10ms steps).
   * This is extremely useful for offline or frame-by-frame visual scaling.
   */
  _calculateAmplitudeEnvelope(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);
    const step = Math.round(sampleRate * 0.01); // 10ms steps
    const windowSize = Math.round(sampleRate * 0.03); // 30ms RMS sliding window
    
    const envelope = new Float32Array(Math.ceil(channelData.length / step));
    let envIdx = 0;
    
    for (let i = 0; i < channelData.length; i += step) {
      let sum = 0;
      let count = 0;
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(channelData.length, i + Math.ceil(windowSize / 2));
      
      for (let j = start; j < end; j++) {
        sum += channelData[j] * channelData[j];
        count++;
      }
      
      envelope[envIdx++] = count > 0 ? Math.sqrt(sum / count) : 0;
    }
    
    this.amplitudeEnvelope = envelope;
  }

  /**
   * Plays the audio from the current position.
   */
  play() {
    if (this.isPlaying) return;
    if (!this.audioBuffer) return;
    
    this.initContext();
    
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    
    this.source = this.audioCtx.createBufferSource();
    this.source.buffer = this.audioBuffer;
    
    // Connect Source -> Analyser -> Gain -> Output Destination
    this.source.connect(this.analyser);
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.audioCtx.destination);
    
    this.source.onended = () => {
      if (this.isPlaying) {
        const elapsed = this.audioCtx.currentTime - this.startTime;
        this.pauseOffset += elapsed;
        if (this.pauseOffset >= this.audioBuffer.duration) {
          this.isPlaying = false;
          this.pauseOffset = 0;
          this._triggerEvent('ended');
        }
      }
    };
    
    this.startTime = this.audioCtx.currentTime;
    this.lastCheckedTime = this.pauseOffset;
    this.lastFrameTime = performance.now();
    this.source.start(0, this.pauseOffset);
    this.isPlaying = true;
    
    this._startInternalLoop();
    this._triggerEvent('play');
  }

  /**
   * Pauses the audio.
   */
  pause() {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    const elapsed = this.audioCtx.currentTime - this.startTime;
    this.pauseOffset += elapsed;
    
    if (this.source) {
      this.source.onended = null;
      this.source.stop();
      this.source = null;
    }
    
    this._triggerEvent('pause');
  }

  /**
   * Stops the audio and resets position.
   */
  stop() {
    this.isPlaying = false;
    this.pauseOffset = 0;
    this.lastCheckedTime = 0;
    
    if (this.source) {
      this.source.onended = null;
      this.source.stop();
      this.source = null;
    }
    
    this._triggerEvent('stop');
  }

  /**
   * Seeks to a specific timestamp in the song.
   * @param {number} time - Position in seconds.
   */
  seek(time) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    
    this.pauseOffset = Math.max(0, Math.min(time, this.getAudioDuration()));
    this.lastCheckedTime = this.pauseOffset;
    
    if (wasPlaying) {
      this.play();
    }
    
    this._triggerEvent('seek', this.pauseOffset);
  }

  /**
   * Returns current playback duration of the song in seconds.
   */
  getAudioDuration() {
    return this.audioBuffer ? this.audioBuffer.duration : 0;
  }

  /**
   * Returns current playback position in seconds.
   */
  getCurrentTime() {
    if (!this.isPlaying) {
      return this.pauseOffset;
    }
    return this.pauseOffset + (this.audioCtx.currentTime - this.startTime);
  }

  /**
   * Internal loop to update beat detection variables and trigger real-time callbacks.
   */
  _startInternalLoop() {
    if (this._loopRunning) return;
    this._loopRunning = true;
    
    const tick = () => {
      if (!this.isPlaying) {
        this._loopRunning = false;
        return;
      }
      this.update();
      requestAnimationFrame(tick);
    };
    
    requestAnimationFrame(tick);
  }

  /**
   * Triggers beat events and decays visual beat envelope values.
   * Can be run inside an internal requestAnimationFrame loop, or driven
   * directly by the visualizer's main animation loop.
   */
  update() {
    const now = performance.now();
    // Cap delta time to prevent massive jumps when switching tabs
    const delta = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    if (!this.isPlaying || !this.audioBuffer) {
      // Decay beat intensity even when paused
      this.beatIntensity = Math.max(0, this.beatIntensity - delta * 4.0);
      this.isOnBeat = this.beatIntensity > 0.5;
      return;
    }

    const currentTime = this.getCurrentTime();
    let beatTriggered = false;
    const triggeredBeats = [];

    // Find any beats that have occurred since our last loop check
    for (let j = 0; j < this.beatTimes.length; j++) {
      const beatTime = this.beatTimes[j];
      if (beatTime > this.lastCheckedTime && beatTime <= currentTime) {
        beatTriggered = true;
        triggeredBeats.push(beatTime);
      }
    }

    this.lastCheckedTime = currentTime;

    if (beatTriggered) {
      this.beatIntensity = 1.0;
      this.isOnBeat = true;
      triggeredBeats.forEach(time => {
        this._triggerEvent('beat', { time, bpm: this.bpm });
      });
    } else {
      // Exponentially decay intensity (reaches 0 in 250ms with 4.0 decay coefficient)
      this.beatIntensity = Math.max(0, this.beatIntensity - delta * 4.0);
      this.isOnBeat = this.beatIntensity > 0.5;
    }
  }

  /**
   * Returns a real-time byte array of frequency bin amplitudes.
   */
  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * Returns a real-time byte array of time-domain waveform amplitudes.
   */
  getWaveformData() {
    if (!this.analyser) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  /**
   * Returns the beat intensity value (0 to 1) for the current playback time.
   */
  getBeatIntensity() {
    return this.beatIntensity;
  }

  /**
   * Connects a MediaStreamAudioDestinationNode to record/capture audio stream output.
   */
  createMediaStreamDestination() {
    this.initContext();
    const dest = this.audioCtx.createMediaStreamDestination();
    this.analyser.connect(dest);
    return dest;
  }

  /**
   * Returns pre-calculated RMS amplitude at a specific time.
   * Crucial for frame-by-frame offline rendering.
   */
  getAmplitudeAtTime(time) {
    if (this.amplitudeEnvelope.length === 0) return 0;
    const idx = Math.floor(time * 100); // Sampled at 100Hz (10ms steps)
    if (idx < 0 || idx >= this.amplitudeEnvelope.length) return 0;
    return this.amplitudeEnvelope[idx];
  }

  /**
   * Returns beat intensity (0 to 1) decaying at a specific time.
   * Crucial for frame-by-frame offline rendering.
   */
  getBeatIntensityAtTime(time) {
    if (this.beatTimes.length === 0) return 0;
    
    // Find the latest beat that occurred before or at 'time' (Binary Search)
    let low = 0;
    let high = this.beatTimes.length - 1;
    let lastBeatIdx = -1;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.beatTimes[mid] <= time) {
        lastBeatIdx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    
    if (lastBeatIdx === -1) return 0;
    
    const lastBeatTime = this.beatTimes[lastBeatIdx];
    const dt = time - lastBeatTime;
    
    // Decay visual beats exponentially (1.0 peak, decays to 0 over 250ms)
    return Math.max(0, 1.0 - dt * 4.0);
  }

  /**
   * Returns if a beat is active at a specific time (intensity > 0.5).
   */
  isOnBeatAtTime(time) {
    return this.getBeatIntensityAtTime(time) > 0.5;
  }

  /**
   * Returns the estimated FFT frequency bins for a given timestamp.
   * Crucial for frame-by-frame offline video renderings.
   */
  getFrequencyDataAtTime(time, fftSize = 1024, minDecibels = -100, maxDecibels = -30) {
    if (!this.audioBuffer) return new Uint8Array(fftSize / 2);
    
    const sampleRate = this.audioBuffer.sampleRate;
    const startSample = Math.floor(time * sampleRate);
    const channelData = this.audioBuffer.getChannelData(0);
    
    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);
    
    for (let k = 0; k < fftSize; k++) {
      const idx = startSample + k;
      if (idx >= 0 && idx < channelData.length) {
        // Apply Hann window to minimize spectral leakage
        const windowValue = 0.5 * (1 - Math.cos((2 * Math.PI * k) / (fftSize - 1)));
        re[k] = channelData[idx] * windowValue;
      } else {
        re[k] = 0;
      }
      im[k] = 0;
    }
    
    // Execute Cooley-Tukey FFT
    this._fft(re, im);
    
    const halfSize = fftSize / 2;
    const result = new Uint8Array(halfSize);
    const scale = 2.0 / fftSize;
    
    for (let k = 0; k < halfSize; k++) {
      const magnitude = Math.sqrt(re[k] * re[k] + im[k] * im[k]) * scale;
      const db = 20 * Math.log10(magnitude + 1e-8);
      
      let val = Math.round((255 * (db - minDecibels)) / (maxDecibels - minDecibels));
      if (val < 0) val = 0;
      if (val > 255) val = 255;
      
      result[k] = val;
    }
    
    return result;
  }

  /**
   * Returns waveform samples for a given timestamp.
   * Crucial for frame-by-frame offline video renderings.
   */
  getWaveformDataAtTime(time, length = 1024) {
    if (!this.audioBuffer) return new Uint8Array(length).fill(128);
    
    const sampleRate = this.audioBuffer.sampleRate;
    const startSample = Math.floor(time * sampleRate);
    const channelData = this.audioBuffer.getChannelData(0);
    const result = new Uint8Array(length);
    
    for (let i = 0; i < length; i++) {
      const idx = startSample + i;
      let sample = 0;
      if (idx >= 0 && idx < channelData.length) {
        sample = channelData[idx];
      }
      
      let val = Math.round((sample + 1.0) * 127.5);
      if (val < 0) val = 0;
      if (val > 255) val = 255;
      result[i] = val;
    }
    
    return result;
  }

  /**
   * Standard Cooley-Tukey iterative radix-2 FFT in-place implementation.
   * Replaces re and im arrays with frequency-domain values.
   */
  _fft(re, im) {
    const n = re.length;
    
    // 1. Bit-reversal permutation
    let j = 0;
    for (let i = 0; i < n; i++) {
      if (i < j) {
        let temp = re[i]; re[i] = re[j]; re[j] = temp;
        temp = im[i]; im[i] = im[j]; im[j] = temp;
      }
      let bit = n >> 1;
      while (j & bit) {
        j ^= bit;
        bit >>= 1;
      }
      j ^= bit;
    }
    
    // 2. Cooley-Tukey decimation-in-time computation
    for (let len = 2; len <= n; len <<= 1) {
      const wlenRe = Math.cos(-2 * Math.PI / len);
      const wlenIm = Math.sin(-2 * Math.PI / len);
      
      for (let i = 0; i < n; i += len) {
        let wRe = 1.0;
        let wIm = 0.0;
        const halfLen = len >> 1;
        
        for (let k = 0; k < halfLen; k++) {
          const targetIdx = i + k + halfLen;
          const vRe = re[targetIdx] * wRe - im[targetIdx] * wIm;
          const vIm = re[targetIdx] * wIm + im[targetIdx] * wRe;
          
          const uRe = re[i + k];
          const uIm = im[i + k];
          
          re[i + k] = uRe + vRe;
          im[i + k] = uIm + vIm;
          
          re[targetIdx] = uRe - vRe;
          im[targetIdx] = uIm - vIm;
          
          const nextWRe = wRe * wlenRe - wIm * wlenIm;
          const nextWIm = wRe * wlenIm + wIm * wlenRe;
          wRe = nextWRe;
          wIm = nextWIm;
        }
      }
    }
  }
}

// Expose globally for browser usage when imported without ES module binders
if (typeof window !== 'undefined') {
  window.BeatSyncAudio = BeatSyncAudio;
}
