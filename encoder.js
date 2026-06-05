/**
 * Encoder.js
 * 
 * Sets up a video and audio recording system using the MediaRecorder API.
 * Captures the HTML5 Canvas at high quality (60 FPS) and combines it with
 * the audio stream extracted from Web Audio API nodes in audio.js.
 */

class VideoRecorder {
  /**
   * @param {HTMLCanvasElement} canvas - The visualizer canvas to capture.
   * @param {Object} [options] - Configuration options.
   * @param {AudioContext} [options.audioContext] - The Web Audio API context.
   * @param {AudioNode} [options.audioNode] - The output AudioNode to record audio from.
   * @param {number} [options.fps=60] - Video frame rate.
   * @param {number} [options.videoBitsPerSecond=5000000] - Video bitrate (default 5 Mbps for high quality).
   * @param {number} [options.audioBitsPerSecond=192000] - Audio bitrate (default 192 Kbps for high quality).
   * @param {boolean} [options.autoDownload=true] - Whether to trigger download automatically upon stopping.
   * @param {Function} [options.onStart] - Callback when recording starts.
   * @param {Function} [options.onStop] - Callback when recording stops. Receives the recorded Blob.
   * @param {Function} [options.onProgress] - Callback periodically receiving elapsed recording time in seconds.
   */
  constructor(canvas, options = {}) {
    if (!canvas) {
      throw new Error('VideoRecorder requires an HTMLCanvasElement');
    }
    this.canvas = canvas;
    
    // Recording configuration
    this.audioContext = options.audioContext || null;
    this.audioNode = options.audioNode || null;
    this.fps = options.fps || 60;
    this.videoBitsPerSecond = options.videoBitsPerSecond || 5000000;
    this.audioBitsPerSecond = options.audioBitsPerSecond || 192000;
    this.autoDownload = options.autoDownload !== false;
    
    // Callbacks
    this.onStart = options.onStart || null;
    this.onStop = options.onStop || null;
    this.onProgress = options.onProgress || null;
    
    // Internal state
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.startTime = 0;
    this.progressInterval = null;
    
    // Web Audio destination node for capturing
    this.destAudioNode = null;
    this.recordedBlob = null;
  }

  /**
   * Bind/update the audio source nodes after initialization.
   * @param {AudioNode} audioNode - The audio node to record from.
   * @param {AudioContext} audioContext - The audio context.
   */
  setAudioSource(audioNode, audioContext) {
    this.audioNode = audioNode;
    this.audioContext = audioContext;
  }

  /**
   * Starts the recording process.
   */
  start() {
    if (this.isRecording) {
      console.warn('Recording is already in progress.');
      return;
    }
    
    this.recordedChunks = [];
    this.recordedBlob = null;
    
    // 1. Capture the canvas stream at specified FPS (60 FPS default)
    const videoStream = this.canvas.captureStream(this.fps);
    const tracks = [];
    
    // Get video track
    videoStream.getVideoTracks().forEach(track => tracks.push(track));
    
    // 2. Capture and mix the audio stream using MediaStreamAudioDestinationNode
    if (this.audioContext && this.audioNode) {
      try {
        // Create destination node in context
        this.destAudioNode = this.audioContext.createMediaStreamDestination();
        
        // Connect our source node to the destination node.
        // It remains connected to the main speakers (audioContext.destination) as well,
        // allowing simultaneous playback and recording.
        this.audioNode.connect(this.destAudioNode);
        
        const audioStream = this.destAudioNode.stream;
        audioStream.getAudioTracks().forEach(track => tracks.push(track));
        console.log('Successfully coupled canvas stream with audio node stream.');
      } catch (e) {
        console.error('Failed to capture Web Audio stream, recording video only:', e);
      }
    } else {
      console.warn('No audio source node set. Recording video without sound.');
    }
    
    // Combine video and audio tracks
    const combinedStream = new MediaStream(tracks);
    
    // 3. Find the best supported codec/mimeType for WebM recording
    let selectedMimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(selectedMimeType)) {
      selectedMimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(selectedMimeType)) {
        selectedMimeType = 'video/webm;codecs=h264,opus';
        if (!MediaRecorder.isTypeSupported(selectedMimeType)) {
          selectedMimeType = 'video/webm';
        }
      }
    }
    
    const recordingOptions = {
      mimeType: selectedMimeType,
      videoBitsPerSecond: this.videoBitsPerSecond,
      audioBitsPerSecond: this.audioBitsPerSecond
    };
    
    console.log(`Starting MediaRecorder with format: ${selectedMimeType} at ${this.fps} FPS`);
    
    try {
      this.mediaRecorder = new MediaRecorder(combinedStream, recordingOptions);
    } catch (e) {
      console.warn('MediaRecorder failed to initialize with custom options, falling back to browser defaults:', e);
      this.mediaRecorder = new MediaRecorder(combinedStream);
    }
    
    // Save recorded data slices
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };
    
    // When recording is stopped
    this.mediaRecorder.onstop = () => {
      // Disconnect destination node to avoid audio rendering overhead / memory leaks
      if (this.audioNode && this.destAudioNode) {
        try {
          this.audioNode.disconnect(this.destAudioNode);
        } catch (e) {
          console.warn('Error disconnecting Web Audio nodes:', e);
        }
      }
      
      clearInterval(this.progressInterval);
      this.isRecording = false;
      
      // Compile chunks into a single WebM Blob
      const mime = this.mediaRecorder.mimeType || 'video/webm';
      this.recordedBlob = new Blob(this.recordedChunks, { type: mime });
      console.log(`Recording complete. Final size: ${(this.recordedBlob.size / (1024 * 1024)).toFixed(2)} MB`);
      
      if (this.onStop) {
        this.onStop(this.recordedBlob);
      }
      
      if (this.autoDownload) {
        this.download();
      }
    };
    
    // Start recording. Collect slices of 1000ms.
    this.mediaRecorder.start(1000);
    this.isRecording = true;
    this.startTime = performance.now();
    
    if (this.onStart) {
      this.onStart();
    }
    
    // Handle status / progress callbacks
    this.progressInterval = setInterval(() => {
      if (this.onProgress && this.isRecording) {
        const elapsedSeconds = (performance.now() - this.startTime) / 1000;
        this.onProgress(elapsedSeconds);
      }
    }, 250);
  }

  /**
   * Stops the active recording process.
   */
  stop() {
    if (!this.isRecording || !this.mediaRecorder) {
      console.warn('Stop requested, but no active recording was found.');
      return;
    }
    this.mediaRecorder.stop();
  }

  /**
   * Triggers a manual browser download of the recorded WebM file.
   */
  download() {
    if (!this.recordedBlob) {
      console.warn('Download triggered, but no recorded video blob is available. Ensure recording has run and stopped first.');
      return;
    }
    
    const url = URL.createObjectURL(this.recordedBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    // Format descriptive date timestamp for download filename
    const dateStamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `beat-sync-video-${dateStamp}.webm`;
    
    document.body.appendChild(a);
    a.click();
    
    // Clean up link and revoke ObjectURL in background
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  }
}

// Global exposure
if (typeof window !== 'undefined') {
  window.VideoRecorder = VideoRecorder;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VideoRecorder;
}
