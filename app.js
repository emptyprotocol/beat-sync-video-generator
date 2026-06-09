/**
 * App.js
 * 
 * Main controller that instantiates the BeatSyncAudio, Visualizer, and VideoRecorder
 * classes and binds them to the HTML UI controls and event handlers.
 */

function startApp() {
  // 1. Get DOM elements
  const canvas = document.getElementById('visualizer-canvas');
  const playBtn = document.getElementById('play-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const stopBtn = document.getElementById('stop-btn');
  const trackProgress = document.getElementById('track-progress');
  const progressFill = document.getElementById('scrubber-progress-fill');
  const currentTimeLabel = document.getElementById('current-time');
  const totalTimeLabel = document.getElementById('total-time');
  const volumeSlider = document.getElementById('volume-slider');
  const muteBtn = document.getElementById('mute-btn');
  const volumeIcon = document.getElementById('volume-icon');
  
  const fileInput = document.getElementById('audio-input');
  const bpmDisplay = document.getElementById('bpm-display');
  const trackDuration = document.getElementById('track-duration');
  const trackSampleRate = document.getElementById('track-sample-rate');
  const trackBitrate = document.getElementById('track-bitrate');
  const systemStatus = document.getElementById('system-status-text');
  const canvasPlaceholder = document.getElementById('canvas-placeholder');
  
  const recordBtn = document.getElementById('record-btn');
  const stopRecordBtn = document.getElementById('stop-record-btn');
  const recordStatus = document.getElementById('record-status');
  const recordMessage = document.getElementById('record-message');
  const recordProgressFill = document.getElementById('record-progress');
  const progressPercentage = document.getElementById('progress-percentage');
  const frameCounter = document.getElementById('frame-counter');
  const downloadLink = document.getElementById('download-link');
  const pulseDot = document.querySelector('.id-pulse-dot');
  
  const themeSelect = document.getElementById('theme-select');
  const sensitivityControl = document.getElementById('sensitivity-control');
  const particleDensity = document.getElementById('particle-density');
  const bloomFx = document.getElementById('bloom-fx');
  const fpsVal = document.getElementById('fps-val');
  const hudTimeBadge = document.getElementById('hud-time-badge');
  
  // 2. Instantiate core classes
  const audio = new BeatSyncAudio();
  const visualizer = new Visualizer(canvas);
  
  // Create video recorder reference
  let recorder = null;
  
  // Animation loop variables
  let animId = null;
  let isDraggingProgress = false;
  let lastFpsUpdateTime = 0;
  let fpsFrameCount = 0;
  
  // Volume state
  let previousVolume = 0.8;
  let isMuted = false;
  
  // 3. Set up Visualizer parameters from UI controls
  function updateVisualizerSettings() {
    // Theme
    const theme = themeSelect.value;
    if (theme === 'cosmic') visualizer.setTheme('cosmic-pulse');
    else if (theme === 'cyber') visualizer.setTheme('cyber-grid');
    else if (theme === 'warp') visualizer.setTheme('warp-tunnel');
    
    // Density (particle counts)
    const density = parseInt(particleDensity.value, 10);
    if (visualizer.cosmicParticles) {
      while (visualizer.cosmicParticles.length < density) {
        visualizer.cosmicParticles.push({
          angle: Math.random() * Math.PI * 2,
          speed: 0.15 + Math.random() * 0.55,
          baseRadius: 60 + Math.random() * 220,
          size: 0.8 + Math.random() * 2.2,
          colorHue: 250 + Math.random() * 70,
          opacity: 0.3 + Math.random() * 0.6
        });
      }
      if (visualizer.cosmicParticles.length > density) {
        visualizer.cosmicParticles.length = density;
      }
    }
    if (visualizer.warpStars) {
      while (visualizer.warpStars.length < density) {
        visualizer.warpStars.push({
          x: (Math.random() - 0.5) * 750,
          y: (Math.random() - 0.5) * 750,
          z: Math.random() * visualizer.maxWarpDepth,
          prevZ: 0,
          colorHue: 180 + Math.random() * 60,
          angle: Math.random() * Math.PI * 2,
          spinSpeed: (Math.random() - 0.5) * 0.3
        });
      }
      if (visualizer.warpStars.length > density) {
        visualizer.warpStars.length = density;
      }
    }
    
    // Bloom filter
    if (bloomFx && bloomFx.checked) {
      canvas.style.filter = 'drop-shadow(0 0 10px rgba(160, 60, 255, 0.3))';
    } else {
      canvas.style.filter = 'none';
    }
  }
  
  // Initialize settings
  updateVisualizerSettings();
  
  // Listen for control input events
  themeSelect.addEventListener('change', updateVisualizerSettings);
  particleDensity.addEventListener('input', updateVisualizerSettings);
  if (bloomFx) {
    bloomFx.addEventListener('change', updateVisualizerSettings);
  }

  // 3.5. Output aspect ratio selector (16:9, 1:1, 4:3)
  function renderStaticFrame() {
    visualizer.render({
      frequencyData: new Uint8Array(128),
      waveformData: new Uint8Array(128),
      isBeat: false,
      beatIntensity: 0
    });
  }

  const aspectButtons = document.querySelectorAll('.aspect-btn');
  const resolutionBadge = document.getElementById('resolution-badge');
  function parseAspectRatio(str) {
    const parts = (str || '').split(':');
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1]);
    if (isFinite(w) && isFinite(h) && h > 0) return w / h;
    return null;
  }

  // Reflect the actual output resolution (canvas drawing buffer) in the HUD badge.
  function updateResolutionBadge() {
    if (resolutionBadge) {
      resolutionBadge.textContent = `${canvas.width}x${canvas.height}`;
    }
  }

  aspectButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const ratio = parseAspectRatio(btn.getAttribute('data-ar'));
      if (ratio === null) return;

      aspectButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      visualizer.setAspectRatio(ratio);
      updateResolutionBadge();

      // Redraw immediately so the new shape is visible even when paused/stopped.
      if (!audio.isPlaying) {
        renderStaticFrame();
      }
    });
  });

  // Apply the initially-selected aspect ratio (defaults to 16:9) once the
  // layout has settled, so the canvas buffer matches its viewport.
  const initialAspectBtn = document.querySelector('.aspect-btn.active');
  if (initialAspectBtn) {
    const initialRatio = parseAspectRatio(initialAspectBtn.getAttribute('data-ar'));
    if (initialRatio !== null) visualizer.setAspectRatio(initialRatio);
  }
  updateResolutionBadge();

  // Keep the resolution badge in sync when the window (and viewport) resizes.
  window.addEventListener('resize', updateResolutionBadge);
  
  // 4. Connect Audio engine callbacks
  audio.on('loadstart', () => {
    console.log('Audio load started.');
    systemStatus.textContent = 'LOADING AUDIO FILE...';
    systemStatus.parentElement.querySelector('.status-dot').className = 'status-dot';
    systemStatus.parentElement.querySelector('.status-dot').style.backgroundColor = 'var(--purple-neon)';
  });
  
  audio.on('analyzestart', () => {
    console.log('Audio analysis started (extracting transient peaks and tempo)...');
    systemStatus.textContent = 'ANALYZING BEATS & BPM...';
  });
  
  audio.on('ready', (info) => {
    console.log(`Audio analysis completed successfully. BPM: ${info.bpm}, Duration: ${info.duration.toFixed(2)}s, Beats: ${info.beatCount}`);
    systemStatus.textContent = 'SYSTEM ACTIVE';
    const dot = systemStatus.parentElement.querySelector('.status-dot');
    dot.className = 'status-dot online';
    dot.style.backgroundColor = ''; // Reset custom color, use class neon-cyan
    
    // Hide placeholder overlay
    canvasPlaceholder.style.display = 'none';
    
    // Fill in stats
    bpmDisplay.textContent = info.bpm;
    trackDuration.textContent = formatTime(info.duration);
    totalTimeLabel.textContent = formatTime(info.duration);
    
    const sampleText = audio.audioBuffer ? `${audio.audioBuffer.sampleRate} Hz` : '-- Hz';
    trackSampleRate.textContent = sampleText;
    trackBitrate.textContent = '320 kbps'; // Est / standard mp3 export
    
    trackProgress.max = Math.floor(info.duration);
    trackProgress.value = 0;
    progressFill.style.width = '0%';
    
    // Reset buttons and link states
    downloadLink.classList.add('disabled');
    downloadLink.href = '#';
    downloadLink.style.animation = 'none';
    
    // Re-bind volume
    audio.setVolume(parseFloat(volumeSlider.value));
    
    // Initialize VideoRecorder for recording output
    recorder = new VideoRecorder(canvas, {
      audioContext: audio.audioCtx,
      audioNode: audio.analyser, // Capture output of analyzer
      autoDownload: false,
      onStart: () => {
        isRecordingState(true);
      },
      onStop: (blob) => {
        isRecordingState(false);
        const url = URL.createObjectURL(blob);
        downloadLink.href = url;
        downloadLink.classList.remove('disabled');
        downloadLink.style.animation = 'pulse-glow 1.8s infinite';
      },
      onProgress: (elapsed) => {
        updateRecordingProgress(elapsed);
      }
    });
  });
  
  audio.on('play', () => {
    playBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    startRenderLoop();
  });
  
  audio.on('pause', () => {
    playBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
  });
  
  audio.on('stop', () => {
    playBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
    trackProgress.value = 0;
    progressFill.style.width = '0%';
    currentTimeLabel.textContent = '0:00';
    hudTimeBadge.textContent = '00:00.00';
    
    // Redraw static empty background canvas frame
    visualizer.render({
      frequencyData: new Uint8Array(128),
      waveformData: new Uint8Array(128),
      isBeat: false,
      beatIntensity: 0
    });
  });
  
  audio.on('ended', () => {
    playBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
    
    if (recorder && recorder.isRecording) {
      recorder.stop();
    }
  });
  
  // 5. Main Canvas animation drawing loop
  function startRenderLoop() {
    if (animId) cancelAnimationFrame(animId);
    
    function tick(now) {
      if (!audio.isPlaying) {
        animId = null;
        return;
      }
      
      // Update audio BPM timers
      audio.update();
      
      // Collect frequency information
      const audioData = {
        frequencyData: audio.getFrequencyData(),
        waveformData: audio.getWaveformData(),
        isBeat: audio.isOnBeat,
        beatIntensity: audio.getBeatIntensity()
      };
      
      // Apply sensitivity scaling
      const sens = parseFloat(sensitivityControl.value);
      if (sens !== 1.0) {
        for (let i = 0; i < audioData.frequencyData.length; i++) {
          audioData.frequencyData[i] = Math.min(255, audioData.frequencyData[i] * sens);
        }
      }
      
      // Draw graphics
      visualizer.render(audioData);
      
      // FPS calculator
      fpsFrameCount++;
      if (now - lastFpsUpdateTime > 1000) {
        const fps = Math.round((fpsFrameCount * 1000) / (now - lastFpsUpdateTime));
        fpsVal.textContent = fps;
        fpsFrameCount = 0;
        lastFpsUpdateTime = now;
      }
      
      // Update playback slider
      if (!isDraggingProgress) {
        const curTime = audio.getCurrentTime();
        trackProgress.value = curTime;
        const percent = (curTime / audio.getAudioDuration()) * 100;
        progressFill.style.width = percent + '%';
        currentTimeLabel.textContent = formatTime(curTime);
        
        // Update overlay badge
        const min = Math.floor(curTime / 60).toString().padStart(2, '0');
        const sec = Math.floor(curTime % 60).toString().padStart(2, '0');
        const ms = Math.floor((curTime % 1) * 100).toString().padStart(2, '0');
        hudTimeBadge.textContent = `${min}:${sec}.${ms}`;
      }
      
      animId = requestAnimationFrame(tick);
    }
    
    lastFpsUpdateTime = performance.now();
    fpsFrameCount = 0;
    animId = requestAnimationFrame(tick);
  }
  
  // 6. Playback UI controller binding
  playBtn.addEventListener('click', () => {
    if (audio.audioBuffer) {
      audio.play();
    } else {
      // Prompt selection
      fileInput.click();
    }
  });
  
  pauseBtn.addEventListener('click', () => {
    audio.pause();
  });
  
  stopBtn.addEventListener('click', () => {
    audio.stop();
  });
  
  // Scrubbers
  trackProgress.addEventListener('input', () => {
    isDraggingProgress = true;
    const seekTime = parseFloat(trackProgress.value);
    const percent = (seekTime / audio.getAudioDuration()) * 100;
    progressFill.style.width = percent + '%';
    currentTimeLabel.textContent = formatTime(seekTime);
  });
  
  trackProgress.addEventListener('change', () => {
    isDraggingProgress = false;
    const seekTime = parseFloat(trackProgress.value);
    audio.seek(seekTime);
  });
  
  // Volume controller
  volumeSlider.addEventListener('input', () => {
    const val = parseFloat(volumeSlider.value);
    audio.setVolume(val);
    
    isMuted = val === 0;
    updateVolumeIcon(val);
  });
  
  muteBtn.addEventListener('click', () => {
    if (isMuted) {
      // Unmute
      isMuted = false;
      volumeSlider.value = previousVolume;
      audio.setVolume(previousVolume);
      updateVolumeIcon(previousVolume);
    } else {
      // Mute
      isMuted = true;
      previousVolume = parseFloat(volumeSlider.value);
      volumeSlider.value = 0;
      audio.setVolume(0);
      updateVolumeIcon(0);
    }
  });
  
  function updateVolumeIcon(val) {
    volumeIcon.className = 'fa-solid';
    if (val === 0) {
      volumeIcon.classList.add('fa-volume-xmark');
    } else if (val < 0.4) {
      volumeIcon.classList.add('fa-volume-low');
    } else {
      volumeIcon.classList.add('fa-volume-high');
    }
  }

  // 6.5. File Upload and Drag-and-Drop Binding
  fileInput.addEventListener('change', async () => {
    if (fileInput.files.length > 0) {
      console.log('File selection changed. Loading file:', fileInput.files[0].name);
      try {
        await audio.loadAudioFile(fileInput.files[0]);
      } catch (err) {
        console.error('Error loading audio file:', err);
        systemStatus.textContent = 'ERROR LOADING FILE';
        systemStatus.parentElement.querySelector('.status-dot').className = 'status-dot error';
        alert('Could not decode audio file. Please try another format.');
      }
    }
  });
  
  const dropZone = document.getElementById('drop-zone');
  if (dropZone) {
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        console.log('File dropped onto drop zone:', e.dataTransfer.files[0].name);
        try {
          await audio.loadAudioFile(e.dataTransfer.files[0]);
        } catch (err) {
          console.error('Error loading dropped file:', err);
          systemStatus.textContent = 'ERROR LOADING FILE';
          systemStatus.parentElement.querySelector('.status-dot').className = 'status-dot error';
          alert('Could not decode audio file. Please try another format.');
        }
      }
    });
  }
  
  // 7. Video Recording events binding
  recordBtn.addEventListener('click', () => {
    if (!audio.audioBuffer) {
      alert('Please upload an audio file first.');
      return;
    }
    if (!recorder) return;
    
    // Stop any active playbacks
    audio.stop();
    
    // Couple source to recorder and start
    recorder.setAudioSource(audio.analyser, audio.audioCtx);
    recorder.start();
    
    // Begin playback
    audio.play();
  });
  
  stopRecordBtn.addEventListener('click', () => {
    if (recorder && recorder.isRecording) {
      recorder.stop();
      audio.pause();
    }
  });
  
  function isRecordingState(recording) {
    if (recording) {
      recordBtn.style.display = 'none';
      stopRecordBtn.style.display = 'inline-block';
      recordStatus.textContent = 'EXPORT ACTIVE';
      recordStatus.style.color = 'var(--pink-neon)';
      recordMessage.textContent = 'Encoding video frames and mixing raw audio waveforms...';
      if (pulseDot) pulseDot.style.display = 'inline-block';
      
      downloadLink.classList.add('disabled');
      downloadLink.style.animation = 'none';
    } else {
      recordBtn.style.display = 'inline-block';
      stopRecordBtn.style.display = 'none';
      recordStatus.textContent = 'INACTIVE';
      recordStatus.style.color = '';
      recordMessage.textContent = 'Video rendering completed. Ready to export.';
      if (pulseDot) pulseDot.style.display = 'none';
    }
  }
  
  function updateRecordingProgress(elapsed) {
    const duration = audio.getAudioDuration();
    if (duration <= 0) return;
    
    const percent = Math.min(100, (elapsed / duration) * 100);
    recordProgressFill.style.width = percent + '%';
    progressPercentage.textContent = Math.round(percent) + '%';
    
    // Frames
    frameCounter.textContent = Math.round(elapsed * 60);
    
    // Remaining ETA calculation
    const remaining = Math.max(0, duration - elapsed);
    const min = Math.floor(remaining / 60).toString().padStart(2, '0');
    const sec = Math.floor(remaining % 60).toString().padStart(2, '0');
    document.getElementById('record-eta').textContent = `${min}:${sec}`;
  }
  
  // Utility: Format seconds to mm:ss
  function formatTime(secs) {
    if (isNaN(secs) || secs === Infinity) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
  
  console.log('App initialized successfully.');
}

// Robust DOM load initializer
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
