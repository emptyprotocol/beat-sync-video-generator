/**
 * Visualizer.js
 *
 * Provides six distinct, interactive, and audio-reactive 2D Canvas themes:
 * 1. Cosmic Pulse (pulsing glassmorphic spheres, rotating orbits, orbital particle trails)
 * 2. Cyber Grid & Spectrum (glowing frequency bars, perspective lines, floating neon waveform)
 * 3. Warp Tunnel (3D scrolling starfield/particle tunnel accelerating with beats)
 * 4. Aurora Flow (layered flowing aurora ribbons with drifting fireflies)
 * 5. Kaleido Bloom (mirrored kaleidoscope mandala of frequency petals)
 * 6. Matrix Rain (falling digital glyph columns racing with the music)
 */

class Visualizer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    if (!canvas) {
      throw new Error('Visualizer requires an HTMLCanvasElement');
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Selected theme: 'cosmic-pulse', 'cyber-grid', 'warp-tunnel',
    // 'aurora-flow', 'kaleido-bloom', 'matrix-rain'
    this.theme = 'cosmic-pulse';

    // Output aspect ratio (width / height). Drives the canvas drawing-buffer
    // dimensions and therefore the resolution/shape of the recorded video.
    // Defaults to 16:9.
    this.aspectRatio = 16 / 9;
    
    // Timing and animation state
    this.lastTime = performance.now();
    this.time = 0;
    this.beatPulse = 0; // Decays over time, jumps to 1 on beats
    
    // Theme-specific data initialization
    this.initCosmicPulse();
    this.initCyberGrid();
    this.initWarpTunnel();
    this.initAuroraFlow();
    this.initKaleidoBloom();
    this.initMatrixRain();
    
    // Set initial size and listen for resize events
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Sets the output aspect ratio (width / height) and re-fits the canvas.
   * The drawing buffer is sized to match this ratio, so recorded video keeps
   * the exact shape selected by the user (e.g. 16:9, 1:1, 4:3).
   * @param {number} ratio - width divided by height (e.g. 16/9, 1, 4/3).
   */
  setAspectRatio(ratio) {
    if (typeof ratio === 'number' && isFinite(ratio) && ratio > 0) {
      this.aspectRatio = ratio;
      this.resize();
    } else {
      console.warn(`Invalid aspect ratio requested: ${ratio}. Keeping current: ${this.aspectRatio}`);
    }
  }

  /**
   * Handles canvas size calculations, supporting retina/High-DPI displays.
   * The canvas is letterboxed inside its viewport so it always keeps the
   * selected output aspect ratio.
   */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const parent = this.canvas.parentElement;

    // Available space within the viewport container.
    let availW = parent ? parent.clientWidth : window.innerWidth;
    let availH = parent ? parent.clientHeight : window.innerHeight;

    // Fallback if the container has not been laid out yet.
    if (availW === 0 || availH === 0) {
      availW = window.innerWidth;
      availH = window.innerHeight;
    }

    // Fit a box of the chosen aspect ratio inside the available space (letterbox).
    const ar = this.aspectRatio || (availW / availH);
    let dispW = availW;
    let dispH = dispW / ar;
    if (dispH > availH) {
      dispH = availH;
      dispW = dispH * ar;
    }

    // Apply the computed display size to the element (CSS pixels).
    this.canvas.style.width = dispW + 'px';
    this.canvas.style.height = dispH + 'px';

    // Size the drawing buffer for High-DPI sharpness; this also defines the
    // recorded video resolution.
    this.canvas.width = Math.max(1, Math.round(dispW * dpr));
    this.canvas.height = Math.max(1, Math.round(dispH * dpr));

    // Reset transform before scaling to avoid accumulating scale
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    this.width = dispW;
    this.height = dispH;
  }

  /**
   * Switches the visualizer theme.
   * @param {string} themeName - 'cosmic-pulse', 'cyber-grid', 'warp-tunnel',
   *   'aurora-flow', 'kaleido-bloom', or 'matrix-rain'
   */
  setTheme(themeName) {
    const validThemes = [
      'cosmic-pulse', 'cyber-grid', 'warp-tunnel',
      'aurora-flow', 'kaleido-bloom', 'matrix-rain'
    ];
    if (validThemes.includes(themeName)) {
      this.theme = themeName;
    } else {
      console.warn(`Invalid theme requested: ${themeName}. Keeping current theme: ${this.theme}`);
    }
  }

  /**
   * Update and render the visualization frame.
   * @param {Object} audioData - Real-time analysis parameters from audio.js
   * @param {Uint8Array} audioData.frequencyData - Frequency magnitude values (0-255)
   * @param {Uint8Array} audioData.waveformData - Time domain waveform values (0-255)
   * @param {boolean} audioData.isBeat - True if a beat was detected in the current frame
   * @param {number} [audioData.beatIntensity] - Optional beat intensity coefficient (0 to 1)
   */
  render(audioData = {}) {
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    
    // Clamp delta time to avoid huge jumps if window tab was inactive
    const clampedDt = Math.min(dt, 0.1);
    this.time += clampedDt;
    
    // Standardize input arrays
    const freq = audioData.frequencyData || new Uint8Array(128);
    const wave = audioData.waveformData || new Uint8Array(128);
    const isBeat = audioData.isBeat || false;
    
    // Smooth out the beat detection response for physics calculations
    if (isBeat) {
      this.beatPulse = 1.0;
    } else {
      // Linear decay toward 0
      this.beatPulse -= clampedDt * 5.0; // fully decays in 200ms
      if (this.beatPulse < 0) this.beatPulse = 0;
    }
    
    // Render backgrounds with custom properties per theme
    this.ctx.save();
    
    if (this.theme === 'warp-tunnel') {
      // Use semi-transparent dark purple fill for starfield trails
      this.ctx.fillStyle = 'rgba(6, 4, 15, 0.18)';
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else if (this.theme === 'cosmic-pulse') {
      // Semi-transparent deep indigo background for particle orbital trails
      this.ctx.fillStyle = 'rgba(8, 6, 18, 0.16)';
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else if (this.theme === 'aurora-flow') {
      // Deep teal night sky with soft fade for ribbon afterglow
      this.ctx.fillStyle = 'rgba(2, 9, 16, 0.2)';
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else if (this.theme === 'kaleido-bloom') {
      // Dark violet fade leaves short mandala trails
      this.ctx.fillStyle = 'rgba(6, 3, 14, 0.2)';
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else if (this.theme === 'matrix-rain') {
      // Near-black green fade produces the classic glyph trails
      this.ctx.fillStyle = 'rgba(2, 10, 5, 0.16)';
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else {
      // Solid clean space black/blue for Cyber Grid
      this.ctx.fillStyle = '#030209';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Draw the active theme visual elements
    switch (this.theme) {
      case 'cosmic-pulse':
        this.drawCosmicPulse(freq, wave, this.beatPulse, clampedDt);
        break;
      case 'cyber-grid':
        this.drawCyberGrid(freq, wave, this.beatPulse, clampedDt);
        break;
      case 'warp-tunnel':
        this.drawWarpTunnel(freq, wave, this.beatPulse, clampedDt);
        break;
      case 'aurora-flow':
        this.drawAuroraFlow(freq, wave, this.beatPulse, clampedDt);
        break;
      case 'kaleido-bloom':
        this.drawKaleidoBloom(freq, wave, this.beatPulse, clampedDt);
        break;
      case 'matrix-rain':
        this.drawMatrixRain(freq, wave, this.beatPulse, clampedDt);
        break;
    }
    
    this.ctx.restore();
  }

  /* =========================================================================
   * THEME 1: COSMIC PULSE
   * ========================================================================= */
  
  initCosmicPulse() {
    this.cosmicParticles = [];
    const particleCount = 100;

    for (let i = 0; i < particleCount; i++) {
      this.cosmicParticles.push(this.spawnCosmicParticle());
    }
  }

  spawnCosmicParticle() {
    return {
      angle: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.55,
      baseRadius: 60 + Math.random() * 220,
      size: 0.8 + Math.random() * 2.2,
      colorHue: 250 + Math.random() * 70, // Blueish purple to magenta
      opacity: 0.3 + Math.random() * 0.6
    };
  }
  
  drawCosmicPulse(freq, wave, beat, dt) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    
    // Calculate low (bass) and mid-range average frequency values
    let lowSum = 0;
    let midSum = 0;
    const lowBoundary = Math.floor(freq.length * 0.12);
    const midBoundary = Math.floor(freq.length * 0.45);
    
    for (let i = 0; i < lowBoundary; i++) lowSum += freq[i];
    for (let i = lowBoundary; i < midBoundary; i++) midSum += freq[i];
    
    const lowAvg = lowBoundary > 0 ? (lowSum / lowBoundary) / 255 : 0;
    const midAvg = (midBoundary - lowBoundary) > 0 ? (midSum / (midBoundary - lowBoundary)) / 255 : 0;
    
    // Render static tiny distant background stars
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 25; i++) {
      const x = (Math.sin(i * 357.19) * 0.5 + 0.5) * this.width;
      const y = (Math.cos(i * 892.43) * 0.5 + 0.5) * this.height;
      const r = (Math.sin(i * 124.56 + this.time * 2.0) * 0.5 + 0.5) * 1.2;
      this.ctx.beginPath();
      this.ctx.arc(x, y, r, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    // Base parameters driven by low frequencies and beats
    const baseCoreRadius = Math.min(this.width, this.height) * 0.14;
    const pulseFactor = lowAvg * 45 + beat * 35;
    const coreRadius = Math.max(10, baseCoreRadius + pulseFactor);
    
    // 1. Draw glowing orb rings at tilted perspective
    const numRings = 3;
    for (let r = 0; r < numRings; r++) {
      const ringTiltY = 0.3 + r * 0.12;
      const ringRotation = (r * Math.PI / 3.5) + this.time * 0.08;
      const ringRadius = coreRadius * (1.5 + r * 0.35);
      
      this.ctx.save();
      this.ctx.translate(cx, cy);
      this.ctx.rotate(ringRotation);
      this.ctx.scale(1, ringTiltY);
      
      const ringGrad = this.ctx.createRadialGradient(0, 0, ringRadius - 6, 0, 0, ringRadius + 6);
      ringGrad.addColorStop(0, 'rgba(0, 255, 255, 0)');
      ringGrad.addColorStop(0.5, `rgba(160, 60, 255, ${0.15 + beat * 0.25})`);
      ringGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
      
      this.ctx.strokeStyle = ringGrad;
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = 'rgba(160, 60, 255, 0.4)';
      this.ctx.lineWidth = 2.5;
      
      this.ctx.beginPath();
      this.ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
    
    // 2. Draw orbiting cosmic particles
    this.cosmicParticles.forEach(p => {
      // Speed scales up with beats and mid range energies
      const speedMultiplier = 1.0 + beat * 3.0 + midAvg * 1.5;
      p.angle += p.speed * speedMultiplier * dt;
      
      // Radius expands slightly with low/bass frequencies
      const currentRadius = p.baseRadius + lowAvg * 35;
      const px = cx + Math.cos(p.angle) * currentRadius;
      const py = cy + Math.sin(p.angle) * currentRadius * 0.55; // Elongated orbital projection
      
      const particleScale = 1.0 + beat * 1.0;
      
      this.ctx.fillStyle = `hsla(${p.colorHue}, 90%, 75%, ${p.opacity})`;
      this.ctx.shadowBlur = p.size * 2.5;
      this.ctx.shadowColor = `hsl(${p.colorHue}, 90%, 75%)`;
      
      this.ctx.beginPath();
      this.ctx.arc(px, py, p.size * particleScale, 0, Math.PI * 2);
      this.ctx.fill();
    });
    
    // 3. Central Glassmorphic Pulsing Sphere
    // Glow backdrop
    this.ctx.shadowBlur = 35 + beat * 25;
    this.ctx.shadowColor = 'rgba(0, 220, 255, 0.7)';
    
    // Inner glass gradient
    const coreGradient = this.ctx.createRadialGradient(
      cx - coreRadius * 0.35, 
      cy - coreRadius * 0.35, 
      coreRadius * 0.05, 
      cx, 
      cy, 
      coreRadius
    );
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(0.18, '#cd43f2');
    coreGradient.addColorStop(0.55, '#5c64f7');
    coreGradient.addColorStop(0.9, '#12052b');
    coreGradient.addColorStop(1.0, '#000000');
    
    this.ctx.fillStyle = coreGradient;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Outer glass shine ring
    this.ctx.shadowBlur = 0;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Glass highlight reflection overlay
    const highlightGrad = this.ctx.createLinearGradient(
      cx - coreRadius, 
      cy - coreRadius, 
      cx + coreRadius, 
      cy + coreRadius
    );
    highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    highlightGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.03)');
    highlightGrad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    
    this.ctx.fillStyle = highlightGrad;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, coreRadius - 1.5, Math.PI * 1.2, Math.PI * 1.8);
    this.ctx.arc(cx, cy, coreRadius - 12, Math.PI * 1.8, Math.PI * 1.2, true);
    this.ctx.closePath();
    this.ctx.fill();
  }

  /* =========================================================================
   * THEME 2: CYBER GRID & SPECTRUM
   * ========================================================================= */

  initCyberGrid() {
    this.cyberGridYOffset = 0;
  }
  
  drawCyberGrid(freq, wave, beat, dt) {
    const horizon = this.height * 0.52;
    
    // Background neon sky glow
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.height);
    skyGrad.addColorStop(0, '#020108');
    skyGrad.addColorStop(0.5, '#07021c');
    skyGrad.addColorStop(0.7, '#1b0230');
    skyGrad.addColorStop(1, '#3b004a');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // 1. Draw Perspective Grid floor
    const scrollSpeed = (35 + beat * 110) * dt;
    this.cyberGridYOffset = (this.cyberGridYOffset + scrollSpeed) % 45;
    
    this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.32)';
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = 'rgba(0, 255, 255, 0.4)';
    this.ctx.lineWidth = 1.0;
    
    // Draw vertical grid lines spreading from a vanishing point above horizon
    const lineCount = 20;
    const vanishPointX = this.width / 2;
    const vanishPointY = horizon - 25;
    
    for (let i = 0; i <= lineCount; i++) {
      const ratio = i / lineCount;
      const xBottom = this.width * (1.6 * ratio - 0.3); // Extends past left & right edges at bottom
      
      this.ctx.beginPath();
      this.ctx.moveTo(vanishPointX, vanishPointY);
      this.ctx.lineTo(xBottom, this.height);
      this.ctx.stroke();
    }
    
    // Draw horizontal grid lines spaced logarithmically for 3D effect
    const horizontalCount = 14;
    for (let i = 0; i < horizontalCount; i++) {
      const baseRatio = (i + (this.cyberGridYOffset / 45)) / horizontalCount;
      const y = horizon + Math.pow(baseRatio, 2.6) * (this.height - horizon);
      
      const opacity = Math.pow(baseRatio, 1.8) * 0.65;
      this.ctx.strokeStyle = `rgba(255, 0, 150, ${opacity})`;
      this.ctx.shadowColor = `rgba(255, 0, 150, ${opacity})`;
      this.ctx.lineWidth = 0.8 + baseRatio * 1.5;
      
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }
    
    // Draw horizontal dividing bar
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = '#00ffff';
    this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.75)';
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();
    this.ctx.moveTo(0, horizon);
    this.ctx.lineTo(this.width, horizon);
    this.ctx.stroke();
    
    // 2. Frequency Bars (Symmetric, coming up from the bottom)
    this.ctx.shadowBlur = 12;
    const maxBars = Math.min(freq.length, 50);
    const barWidth = (this.width / 2) / maxBars;
    
    for (let i = 0; i < maxBars; i++) {
      const freqVal = freq[i] / 255;
      const barHeightBase = Math.pow(freqVal, 1.4) * (this.height - horizon) * 0.8;
      const finalHeight = Math.max(barHeightBase, beat * 12 * (1 - i / maxBars));
      
      const xRight = (this.width / 2) + i * barWidth;
      const xLeft = (this.width / 2) - (i + 1) * barWidth;
      const y = this.height - finalHeight;
      
      // Gradient fill (cyan to magenta)
      const gradient = this.ctx.createLinearGradient(0, this.height, 0, y);
      gradient.addColorStop(0, '#00ffcc');
      gradient.addColorStop(0.5, '#b01ee3');
      gradient.addColorStop(1, '#ff0066');
      
      this.ctx.fillStyle = gradient;
      this.ctx.shadowColor = '#ff0066';
      
      this.ctx.fillRect(xRight + 0.8, y, barWidth - 1.6, finalHeight);
      this.ctx.fillRect(xLeft + 0.8, y, barWidth - 1.6, finalHeight);
    }
    
    // 3. Floating Neon Waveform overlay
    this.ctx.shadowBlur = 16;
    this.ctx.shadowColor = '#00ffaa';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2.5 + beat * 1.5;
    this.ctx.beginPath();
    
    const samplesCount = wave.length;
    for (let i = 0; i < samplesCount; i++) {
      const sample = (wave[i] - 128) / 128; // Normalize to [-1.0, 1.0]
      const wx = (i / (samplesCount - 1)) * this.width;
      const wy = (horizon - 70) + sample * (60 + beat * 40);
      
      if (i === 0) {
        this.ctx.moveTo(wx, wy);
      } else {
        const prevWx = ((i - 1) / (samplesCount - 1)) * this.width;
        const prevWy = (horizon - 70) + ((wave[i - 1] - 128) / 128) * (60 + beat * 40);
        const xc = (wx + prevWx) / 2;
        const yc = (wy + prevWy) / 2;
        this.ctx.quadraticCurveTo(prevWx, prevWy, xc, yc);
      }
    }
    this.ctx.stroke();
  }

  /* =========================================================================
   * THEME 3: WARP TUNNEL
   * ========================================================================= */

  initWarpTunnel() {
    this.warpStars = [];
    this.maxWarpDepth = 1000;
    this.warpFov = 280;
    const starCount = 200;

    for (let i = 0; i < starCount; i++) {
      this.warpStars.push(this.spawnWarpStar());
    }
  }

  spawnWarpStar() {
    return {
      x: (Math.random() - 0.5) * 750,
      y: (Math.random() - 0.5) * 750,
      z: Math.random() * this.maxWarpDepth,
      prevZ: 0,
      colorHue: 180 + Math.random() * 60, // Cyan to blue hues
      angle: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() - 0.5) * 0.3
    };
  }
  
  drawWarpTunnel(freq, wave, beat, dt) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    
    // Average overall volume intensity
    let totalVol = 0;
    for (let i = 0; i < freq.length; i++) totalVol += freq[i];
    const avgVol = freq.length > 0 ? (totalVol / freq.length) / 255 : 0;
    
    // Draw background central core tunnel bloom
    const coreGlow = this.ctx.createRadialGradient(cx, cy, 3, cx, cy, 90 + beat * 130);
    coreGlow.addColorStop(0, `rgba(255, 0, 180, ${0.18 + beat * 0.22})`);
    coreGlow.addColorStop(0.4, `rgba(0, 240, 255, ${0.06 + beat * 0.1})`);
    coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = coreGlow;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Calculate warp speed. Jumps aggressively on beats.
    const standardSpeed = 160;
    const speed = standardSpeed + (beat * 850) + (avgVol * 300);
    
    this.warpStars.forEach(star => {
      star.prevZ = star.z;
      star.z -= speed * dt;
      
      // Star rotational spin increases on beat
      const rotationSpeed = star.spinSpeed * (1.0 + beat * 2.5);
      star.angle += rotationSpeed * dt;
      
      const cosA = Math.cos(rotationSpeed * dt);
      const sinA = Math.sin(rotationSpeed * dt);
      const rx = star.x * cosA - star.y * sinA;
      const ry = star.x * sinA + star.y * cosA;
      star.x = rx;
      star.y = ry;
      
      // Reset star depth if it flies past the camera (near plane)
      if (star.z <= 0) {
        star.z = this.maxWarpDepth;
        star.prevZ = star.z;
        
        // Spawn stars in a circular frame ring
        const radius = 60 + Math.random() * 300;
        const angle = Math.random() * Math.PI * 2;
        star.x = Math.cos(angle) * radius;
        star.y = Math.sin(angle) * radius;
        
        // Change colors to neon hot pinks during beat events
        if (beat > 0.45) {
          star.colorHue = 310 + Math.random() * 45; // Magenta/Hot Pink
        } else {
          star.colorHue = 180 + Math.random() * 50; // Cyan/Blue
        }
      }
      
      // Map 3D coordinates to 2D projected screen coordinates
      const px = (star.x / star.z) * this.warpFov + cx;
      const py = (star.y / star.z) * this.warpFov + cy;
      
      const prevPx = (star.x / star.prevZ) * this.warpFov + cx;
      const prevPy = (star.y / star.prevZ) * this.warpFov + cy;
      
      // Render star streak line if within screen space
      if (px >= 0 && px <= this.width && py >= 0 && py <= this.height) {
        const zRatio = 1 - (star.z / this.maxWarpDepth);
        const thickness = 1.0 + zRatio * 3.5 * (1.0 + beat * 1.5);
        
        this.ctx.strokeStyle = `hsl(${star.colorHue}, 95%, 75%)`;
        this.ctx.lineWidth = thickness;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(prevPx, prevPy);
        this.ctx.lineTo(px, py);
        this.ctx.stroke();
      }
    });
    
    // Floating center warp point
    const coreSize = 2.0 + beat * 5.0;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, coreSize, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /* =========================================================================
   * THEME 4: AURORA FLOW
   * ========================================================================= */

  initAuroraFlow() {
    this.auroraRibbons = [];
    const ribbonCount = 5;

    for (let i = 0; i < ribbonCount; i++) {
      this.auroraRibbons.push({
        baseY: 0.26 + (i / (ribbonCount - 1)) * 0.34, // Vertical anchor (fraction of height)
        hue: 132 + i * 26,                            // Green through cyan to violet
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.35,
        amplitude: 0.05 + Math.random() * 0.06        // Wave height (fraction of height)
      });
    }

    this.auroraFireflies = [];
    const fireflyCount = 60;
    for (let i = 0; i < fireflyCount; i++) {
      this.auroraFireflies.push(this.spawnAuroraFirefly());
    }
  }

  spawnAuroraFirefly() {
    // Positions and velocities are normalized (0-1) so resizing is safe
    return {
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.04,
      vy: -(0.02 + Math.random() * 0.06),
      size: 0.7 + Math.random() * 1.8,
      hue: 120 + Math.random() * 160, // Green through cyan to violet
      opacity: 0.25 + Math.random() * 0.5,
      flicker: Math.random() * Math.PI * 2
    };
  }

  drawAuroraFlow(freq, wave, beat, dt) {
    // Split the spectrum into low/mid/high band averages
    let lowSum = 0;
    let midSum = 0;
    let highSum = 0;
    const lowBoundary = Math.floor(freq.length * 0.12);
    const midBoundary = Math.floor(freq.length * 0.5);

    for (let i = 0; i < lowBoundary; i++) lowSum += freq[i];
    for (let i = lowBoundary; i < midBoundary; i++) midSum += freq[i];
    for (let i = midBoundary; i < freq.length; i++) highSum += freq[i];

    const lowAvg = lowBoundary > 0 ? (lowSum / lowBoundary) / 255 : 0;
    const midAvg = (midBoundary - lowBoundary) > 0 ? (midSum / (midBoundary - lowBoundary)) / 255 : 0;
    const highAvg = (freq.length - midBoundary) > 0 ? (highSum / (freq.length - midBoundary)) / 255 : 0;

    // Distant twinkling stars in the upper sky
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let i = 0; i < 30; i++) {
      const x = (Math.sin(i * 411.7) * 0.5 + 0.5) * this.width;
      const y = (Math.cos(i * 733.1) * 0.5 + 0.5) * this.height * 0.7;
      const r = (Math.sin(i * 97.3 + this.time * 1.6) * 0.5 + 0.5) * 1.1;
      this.ctx.beginPath();
      this.ctx.arc(x, y, r, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Ribbons blend additively so overlaps glow
    this.ctx.globalCompositeOperation = 'lighter';

    const steps = 48;
    this.auroraRibbons.forEach((ribbon, idx) => {
      // Lower ribbons follow bass, middle follow mids, upper follow highs
      const energy = idx < 2 ? lowAvg : (idx < 4 ? midAvg : highAvg);
      const amp = ribbon.amplitude * this.height * (0.6 + energy * 2.2 + beat * 0.9);
      const thickness = this.height * 0.07 * (0.7 + energy * 1.6 + beat * 0.8);
      const baseY = ribbon.baseY * this.height;
      const hue = ribbon.hue + Math.sin(this.time * 0.3 + ribbon.phase) * 18 + beat * 20;

      // Centerline of the curtain: two stacked sine octaves
      const points = [];
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const yWave =
          Math.sin(t * Math.PI * 3 + this.time * ribbon.speed * 2.0 + ribbon.phase) * amp +
          Math.sin(t * Math.PI * 7 - this.time * ribbon.speed * 1.3 + ribbon.phase * 2) * amp * 0.35;
        points.push({ x: t * this.width, y: baseY + yWave });
      }

      const grad = this.ctx.createLinearGradient(0, baseY - thickness, 0, baseY + thickness);
      grad.addColorStop(0, `hsla(${hue}, 90%, 60%, 0)`);
      grad.addColorStop(0.5, `hsla(${hue}, 90%, 62%, ${0.16 + energy * 0.3 + beat * 0.18})`);
      grad.addColorStop(1, `hsla(${hue + 30}, 90%, 55%, 0)`);

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) this.ctx.moveTo(p.x, p.y - thickness);
        else this.ctx.lineTo(p.x, p.y - thickness);
      });
      for (let s = steps; s >= 0; s--) {
        this.ctx.lineTo(points[s].x, points[s].y + thickness);
      }
      this.ctx.closePath();
      this.ctx.fill();
    });

    // Drifting fireflies rise faster with the highs and flicker softly
    this.auroraFireflies.forEach(p => {
      p.x += p.vx * dt * (1 + beat);
      p.y += p.vy * dt * (1 + highAvg * 2 + beat * 1.5);
      p.flicker += dt * 4;

      if (p.x < -0.05) p.x = 1.05;
      if (p.x > 1.05) p.x = -0.05;
      if (p.y < -0.05) {
        Object.assign(p, this.spawnAuroraFirefly());
        p.y = 1.05; // Re-enter from the bottom
      }

      const twinkle = Math.sin(p.flicker) * 0.5 + 0.5;
      this.ctx.fillStyle = `hsla(${p.hue}, 90%, 75%, ${p.opacity * (0.4 + twinkle * 0.6)})`;
      this.ctx.shadowBlur = 6;
      this.ctx.shadowColor = `hsl(${p.hue}, 90%, 70%)`;
      this.ctx.beginPath();
      this.ctx.arc(p.x * this.width, p.y * this.height, p.size * (1 + beat * 0.8), 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.shadowBlur = 0;
    this.ctx.globalCompositeOperation = 'source-over';

    // Soft glowing ground reflection at the bottom
    const groundGrad = this.ctx.createLinearGradient(0, this.height * 0.82, 0, this.height);
    groundGrad.addColorStop(0, 'rgba(40, 120, 110, 0)');
    groundGrad.addColorStop(1, `rgba(60, 170, 150, ${0.08 + lowAvg * 0.12 + beat * 0.1})`);
    this.ctx.fillStyle = groundGrad;
    this.ctx.fillRect(0, this.height * 0.82, this.width, this.height * 0.18);
  }

  /* =========================================================================
   * THEME 5: KALEIDO BLOOM
   * ========================================================================= */

  initKaleidoBloom() {
    this.kaleidoRotation = 0;
    this.kaleidoSegments = 8;
    this.kaleidoSparks = [];
    const sparkCount = 60;

    for (let i = 0; i < sparkCount; i++) {
      this.kaleidoSparks.push(this.spawnKaleidoSpark());
    }
  }

  spawnKaleidoSpark() {
    return {
      dist: 0.1 + Math.random() * 0.85,   // Normalized fraction of the mandala radius
      angle: Math.random() * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.7,
      drift: 0.02 + Math.random() * 0.06, // Outward spiral speed
      size: 0.8 + Math.random() * 1.6,
      hueOffset: Math.random() * 90,
      opacity: 0.25 + Math.random() * 0.5
    };
  }

  drawKaleidoBloom(freq, wave, beat, dt) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const maxR = Math.min(this.width, this.height) * 0.46;

    let lowSum = 0;
    const lowBoundary = Math.floor(freq.length * 0.12);
    for (let i = 0; i < lowBoundary; i++) lowSum += freq[i];
    const lowAvg = lowBoundary > 0 ? (lowSum / lowBoundary) / 255 : 0;

    // The mandala spins slowly; beats kick the rotation forward
    this.kaleidoRotation += dt * (0.12 + beat * 1.1 + lowAvg * 0.35);
    const hueBase = (this.time * 18) % 360;

    const segments = this.kaleidoSegments;
    const segAngle = (Math.PI * 2) / segments;
    const petalSteps = 22;
    const innerR = maxR * (0.08 + beat * 0.05);

    // Advance orbiting sparks once per frame (drawn mirrored in every wedge)
    this.kaleidoSparks.forEach(p => {
      p.angle += p.speed * dt * (1 + beat * 2.0);
      p.dist += p.drift * dt * (1 + beat * 3.0);
      if (p.dist > 1.0) {
        Object.assign(p, this.spawnKaleidoSpark());
        p.dist = 0.08;
      }
    });

    this.ctx.globalCompositeOperation = 'lighter';

    for (let s = 0; s < segments; s++) {
      this.ctx.save();
      this.ctx.translate(cx, cy);
      this.ctx.rotate(s * segAngle + this.kaleidoRotation);
      if (s % 2 === 1) this.ctx.scale(1, -1); // Mirror alternate wedges for the kaleidoscope seam

      // Frequency petal: radius traces the spectrum across the wedge.
      // A gentle idle wave keeps the mandala breathing during silence.
      this.ctx.beginPath();
      for (let j = 0; j <= petalSteps; j++) {
        const t = j / petalSteps;
        const freqIdx = Math.floor(t * Math.min(freq.length - 1, 56));
        const f = Math.pow(freq[freqIdx] / 255, 1.35);
        const idle = 0.5 + 0.5 * Math.sin(this.time * 1.5 + t * Math.PI * 2);
        const reach = f * 0.85 + idle * 0.15;
        const r = innerR + reach * (maxR - innerR) * (0.55 + beat * 0.45);
        const a = (t - 0.5) * segAngle;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (j === 0) this.ctx.moveTo(px, py);
        else this.ctx.lineTo(px, py);
      }
      this.ctx.closePath();

      const hue = (hueBase + s * (360 / segments) * 0.25) % 360;
      this.ctx.fillStyle = `hsla(${hue}, 85%, 55%, ${0.07 + beat * 0.08})`;
      this.ctx.strokeStyle = `hsla(${hue}, 95%, 68%, ${0.5 + beat * 0.4})`;
      this.ctx.lineWidth = 1.4 + beat * 1.2;
      this.ctx.shadowBlur = 10 + beat * 14;
      this.ctx.shadowColor = `hsl(${hue}, 95%, 60%)`;
      this.ctx.fill();
      this.ctx.stroke();

      // Sparks drawn per wedge so they mirror kaleidoscopically (no glow: cheap)
      this.ctx.shadowBlur = 0;
      this.kaleidoSparks.forEach(p => {
        const px = Math.cos(p.angle) * p.dist * maxR;
        const py = Math.sin(p.angle) * p.dist * maxR;
        this.ctx.fillStyle = `hsla(${(hueBase + p.hueOffset) % 360}, 90%, 72%, ${p.opacity})`;
        this.ctx.beginPath();
        this.ctx.arc(px, py, p.size * (1 + beat * 0.6), 0, Math.PI * 2);
        this.ctx.fill();
      });

      this.ctx.restore();
    }

    // Expanding shockwave ring on each beat
    if (beat > 0.01) {
      const ringR = innerR + (1 - beat) * maxR;
      this.ctx.strokeStyle = `hsla(${hueBase}, 90%, 75%, ${beat * 0.55})`;
      this.ctx.lineWidth = 2 + beat * 3;
      this.ctx.shadowBlur = 18;
      this.ctx.shadowColor = `hsla(${hueBase}, 90%, 70%, ${beat})`;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // Bright central jewel
    const coreR = Math.max(3, innerR * 0.7) + beat * 6;
    const coreGrad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.5);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    coreGrad.addColorStop(0.35, `hsla(${hueBase}, 95%, 70%, 0.5)`);
    coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = coreGrad;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, coreR * 2.5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.globalCompositeOperation = 'source-over';
  }

  /* =========================================================================
   * THEME 6: MATRIX RAIN
   * ========================================================================= */

  initMatrixRain() {
    this.matrixGlyphs = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ0123456789ABCDEFXZ$#%*+-<>';
    this.matrixFontSize = 16;
    this.matrixColumns = [];
  }

  spawnMatrixColumn() {
    return {
      head: -Math.random() * 40,     // Row index of the bright head (starts above the screen)
      speed: 6 + Math.random() * 14, // Rows per second at neutral volume
      glyphSeed: Math.floor(Math.random() * 1000)
    };
  }

  rebuildMatrixColumns(colCount) {
    this.matrixColumns = [];
    for (let i = 0; i < colCount; i++) {
      this.matrixColumns.push(this.spawnMatrixColumn());
    }
  }

  drawMatrixRain(freq, wave, beat, dt) {
    // Font scales with canvas size; columns rebuild lazily on resize
    const fontSize = Math.max(12, Math.round(Math.min(this.width, this.height) / 42));
    this.matrixFontSize = fontSize;
    const colCount = Math.ceil(this.width / fontSize);
    if (this.matrixColumns.length !== colCount) {
      this.rebuildMatrixColumns(colCount);
    }

    let totalVol = 0;
    for (let i = 0; i < freq.length; i++) totalVol += freq[i];
    const avgVol = freq.length > 0 ? (totalVol / freq.length) / 255 : 0;

    const rows = this.height / fontSize;
    this.ctx.font = `${fontSize}px "Courier New", monospace`;
    this.ctx.textBaseline = 'top';

    this.matrixColumns.forEach((col, i) => {
      // Column speed surges with overall volume and beats
      const speedMult = 0.6 + avgVol * 2.2 + beat * 2.6;
      col.head += col.speed * speedMult * dt;

      // Brightness of this column follows its own frequency bin
      const freqIdx = Math.floor((i / colCount) * (freq.length - 1));
      const f = freq[freqIdx] / 255;

      const x = i * fontSize;
      const headRow = Math.floor(col.head);
      const y = headRow * fontSize;

      if (y > -fontSize && y < this.height) {
        // Pseudo-random glyph that changes as the head advances
        const glyphIdx = Math.abs(col.glyphSeed + headRow * 31 + i * 7) % this.matrixGlyphs.length;
        const glyph = this.matrixGlyphs[glyphIdx];

        // Head glyph: white-hot cyan on beats, otherwise bright green
        if (beat > 0.5) {
          this.ctx.fillStyle = `hsla(${160 + f * 40}, 100%, ${80 + beat * 15}%, 0.95)`;
        } else {
          this.ctx.fillStyle = `hsla(130, 95%, ${55 + f * 35}%, ${0.7 + f * 0.3})`;
        }
        this.ctx.shadowBlur = 6 + beat * 8;
        this.ctx.shadowColor = 'rgba(0, 255, 140, 0.8)';
        this.ctx.fillText(glyph, x, y);

        // One dimmer trailing glyph reinforces the fade trail
        const trailIdx = Math.abs(col.glyphSeed + (headRow - 1) * 31 + i * 7) % this.matrixGlyphs.length;
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = `hsla(130, 90%, 45%, ${0.35 + f * 0.3})`;
        this.ctx.fillText(this.matrixGlyphs[trailIdx], x, y - fontSize);
      }

      // Recycle the column once it has fully fallen below the canvas
      if (col.head > rows + 6) {
        Object.assign(col, this.spawnMatrixColumn());
      }
    });

    this.ctx.shadowBlur = 0;

    // Subtle full-field flash on beats
    if (beat > 0.01) {
      const flashGrad = this.ctx.createLinearGradient(0, 0, 0, this.height);
      flashGrad.addColorStop(0, 'rgba(120, 255, 190, 0)');
      flashGrad.addColorStop(0.5, `rgba(120, 255, 190, ${beat * 0.06})`);
      flashGrad.addColorStop(1, 'rgba(120, 255, 190, 0)');
      this.ctx.fillStyle = flashGrad;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  /**
   * Adjusts how many particles each particle-based theme uses.
   * Applies to Cosmic Pulse orbiters, Warp Tunnel stars, Aurora fireflies,
   * and Kaleido sparks. (Cyber Grid and Matrix Rain are layout-driven.)
   * @param {number} density - Target particle count.
   */
  setParticleDensity(density) {
    if (!Number.isFinite(density) || density < 1) return;
    const fit = (arr, spawn) => {
      while (arr.length < density) arr.push(spawn());
      if (arr.length > density) arr.length = density;
    };
    fit(this.cosmicParticles, () => this.spawnCosmicParticle());
    fit(this.warpStars, () => this.spawnWarpStar());
    fit(this.auroraFireflies, () => this.spawnAuroraFirefly());
    fit(this.kaleidoSparks, () => this.spawnKaleidoSpark());
  }
}

// Global exposure
if (typeof window !== 'undefined') {
  window.Visualizer = Visualizer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Visualizer;
}
