/**
 * Visualizer.js
 * 
 * Provides three distinct, interactive, and audio-reactive 2D Canvas themes:
 * 1. Cosmic Pulse (pulsing glassmorphic spheres, rotating orbits, orbital particle trails)
 * 2. Cyber Grid & Spectrum (glowing frequency bars, perspective lines, floating neon waveform)
 * 3. Warp Tunnel (3D scrolling starfield/particle tunnel accelerating with beats)
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
    
    // Selected theme: 'cosmic-pulse', 'cyber-grid', 'warp-tunnel'
    this.theme = 'cosmic-pulse';
    
    // Timing and animation state
    this.lastTime = performance.now();
    this.time = 0;
    this.beatPulse = 0; // Decays over time, jumps to 1 on beats
    
    // Theme-specific data initialization
    this.initCosmicPulse();
    this.initCyberGrid();
    this.initWarpTunnel();
    
    // Set initial size and listen for resize events
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Handles canvas size calculations, supporting retina/High-DPI displays.
   */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    let width = this.canvas.clientWidth;
    let height = this.canvas.clientHeight;
    
    // Fallback if clientWidth/Height are not yet set
    if (width === 0 || height === 0) {
      width = this.canvas.parentElement ? this.canvas.parentElement.clientWidth : window.innerWidth;
      height = this.canvas.parentElement ? this.canvas.parentElement.clientHeight : window.innerHeight;
    }
    
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    
    // Reset transform before scaling to avoid accumulating scale
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    
    this.width = width;
    this.height = height;
  }

  /**
   * Switches the visualizer theme.
   * @param {string} themeName - 'cosmic-pulse', 'cyber-grid', or 'warp-tunnel'
   */
  setTheme(themeName) {
    const validThemes = ['cosmic-pulse', 'cyber-grid', 'warp-tunnel'];
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
      this.cosmicParticles.push({
        angle: Math.random() * Math.PI * 2,
        speed: 0.15 + Math.random() * 0.55,
        baseRadius: 60 + Math.random() * 220,
        size: 0.8 + Math.random() * 2.2,
        colorHue: 250 + Math.random() * 70, // Blueish purple to magenta
        opacity: 0.3 + Math.random() * 0.6
      });
    }
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
      this.warpStars.push({
        x: (Math.random() - 0.5) * 750,
        y: (Math.random() - 0.5) * 750,
        z: Math.random() * this.maxWarpDepth,
        prevZ: 0,
        colorHue: 180 + Math.random() * 60, // Cyan to blue hues
        angle: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 0.3
      });
    }
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
}

// Global exposure
if (typeof window !== 'undefined') {
  window.Visualizer = Visualizer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Visualizer;
}
