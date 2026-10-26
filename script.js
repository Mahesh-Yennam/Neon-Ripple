/**
 * Neon Ripple • Next-Gen Interactive Tap & Ripple Engine
 * Multi-touch, GPU-accelerated CSS animations, Web Audio synthesis, and Glassmorphic HUD.
 */

(() => {
  'use strict';

  // --- DOM Elements ---
  const stage = document.getElementById('stage');
  const rippleLayer = document.getElementById('rippleLayer');
  const stampLayer = document.getElementById('stampLayer');
  const cursorGlow = document.getElementById('cursorGlow');
  const promptHint = document.getElementById('promptHint');
  const ambientGlow = document.getElementById('ambientGlow');

  // HUD Elements
  const valX = document.getElementById('valX');
  const valY = document.getElementById('valY');
  const coordPercent = document.getElementById('coordPercent');
  const colorSwatch = document.getElementById('colorSwatch');
  const colorValue = document.getElementById('colorValue');
  const rippleCountEl = document.getElementById('rippleCount');

  // Controls
  const modeBtns = document.querySelectorAll('.mode-btn');
  const audioToggleBtn = document.getElementById('audioToggleBtn');
  const audioIconOn = document.getElementById('audioIconOn');
  const audioIconOff = document.getElementById('audioIconOff');
  const clearBtn = document.getElementById('clearBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const fsEnterIcon = document.getElementById('fsEnterIcon');
  const fsExitIcon = document.getElementById('fsExitIcon');

  // --- State Configuration ---
  const state = {
    mode: 'ripple', // 'ripple' | 'particles' | 'stamp'
    audioEnabled: false,
    totalRipples: 0,
    currentHue: Math.floor(Math.random() * 360),
    maxActiveRipples: 45,
    isDragging: false,
    lastDragTime: 0,
    dragThrottleMs: 65,
    hasInteracted: false,
    stamps: []
  };

  // --- Web Audio Synthesizer ---
  let audioCtx = null;

  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Musical Pentatonic Frequencies mapped to screen height
  const pentatonicScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

  function playTone(normalizedY) {
    if (!state.audioEnabled) return;
    initAudioContext();
    if (!audioCtx) return;

    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      // Invert Y: tapping higher up produces higher pitched chime
      const noteIndex = Math.floor((1 - Math.max(0, Math.min(1, normalizedY))) * (pentatonicScale.length - 1));
      const freq = pentatonicScale[noteIndex] || 440;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      // Subtle bubble harmonic pitch drop
      osc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + 0.18);

      // Envelope: instant attack, smooth exponential decay
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // --- Dynamic Color Management ---
  function getNextColor() {
    // Golden ratio progression for vibrant harmonious neon palettes
    state.currentHue = (state.currentHue + 137.508) % 360;
    const hue = Math.round(state.currentHue);
    return {
      css: `hsl(${hue}, 95%, 65%)`,
      glow: `hsla(${hue}, 100%, 65%, 0.4)`,
      hue: hue
    };
  }

  // --- HUD Updates ---
  function updateHUD(x, y, color) {
    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    const pctX = Math.round((x / width) * 100);
    const pctY = Math.round((y / height) * 100);

    valX.textContent = Math.round(x);
    valY.textContent = Math.round(y);
    coordPercent.textContent = `(${pctX}%, ${pctY}%)`;

    colorSwatch.style.backgroundColor = color.css;
    colorSwatch.style.boxShadow = `0 0 10px ${color.glow}`;
    colorValue.textContent = color.css;

    rippleCountEl.textContent = state.totalRipples;

    // Ambient background subtle reactive tint
    if (ambientGlow) {
      ambientGlow.style.background = `
        radial-gradient(circle at ${pctX}% ${pctY}%, hsla(${color.hue}, 80%, 40%, 0.22) 0%, transparent 55%),
        radial-gradient(circle at 50% 20%, rgba(29, 38, 77, 0.35) 0%, transparent 60%),
        radial-gradient(circle at 80% 80%, rgba(55, 20, 80, 0.25) 0%, transparent 50%)
      `;
    }
  }

  // --- Spawn Effects ---

  // 1. Neon Ripple Shockwave (Mode 1)
  function createRipple(x, y, color) {
    const entity = document.createElement('div');
    entity.className = 'ripple-entity';
    entity.style.setProperty('--x', `${x}px`);
    entity.style.setProperty('--y', `${y}px`);

    // Randomized organic size
    const size = Math.floor(110 + Math.random() * 60);
    entity.style.setProperty('--size', `${size}px`);
    entity.style.setProperty('--color', color.css);
    entity.style.setProperty('--color-glow', color.glow);

    const ring = document.createElement('div');
    ring.className = 'ripple-ring';

    const core = document.createElement('div');
    core.className = 'ripple-core';

    entity.appendChild(ring);
    entity.appendChild(core);
    rippleLayer.appendChild(entity);

    // Garbage collection on animation finish
    ring.addEventListener('animationend', () => {
      entity.remove();
    }, { once: true });

    // Safeguard max active DOM elements
    cleanupMaxRipples();
  }

  // 2. Sparkle Particle Burst (Mode 2)
  function createParticles(x, y, color) {
    const entity = document.createElement('div');
    entity.className = 'ripple-entity';
    entity.style.setProperty('--x', `${x}px`);
    entity.style.setProperty('--y', `${y}px`);
    entity.style.setProperty('--color', color.css);
    entity.style.setProperty('--color-glow', color.glow);

    // Add a quick micro core
    const core = document.createElement('div');
    core.className = 'ripple-core';
    entity.style.setProperty('--size', '70px');
    entity.appendChild(core);

    const particleCount = 14;
    for (let i = 0; i < particleCount; i++) {
      const spark = document.createElement('div');
      spark.className = 'sparkle-particle';

      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() * 0.4 - 0.2);
      const distance = 45 + Math.random() * 85;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      const pSize = 4 + Math.random() * 6;

      spark.style.setProperty('--tx', `${tx}px`);
      spark.style.setProperty('--ty', `${ty}px`);
      spark.style.setProperty('--p-size', `${pSize}px`);
      spark.style.setProperty('--color', color.css);
      spark.style.setProperty('--color-glow', color.glow);

      entity.appendChild(spark);
    }

    rippleLayer.appendChild(entity);

    // Self cleanup after 0.8s
    setTimeout(() => {
      entity.remove();
    }, 800);

    cleanupMaxRipples();
  }

  // 3. Persistent Stamp Mode (Mode 3 - Enhanced Index 1)
  function createStamp(x, y, color) {
    const stamp = document.createElement('div');
    stamp.className = 'stamp-entity';
    const size = Math.floor(75 + Math.random() * 50);

    stamp.style.setProperty('--x', `${x}px`);
    stamp.style.setProperty('--y', `${y}px`);
    stamp.style.setProperty('--size', `${size}px`);
    stamp.style.setProperty('--color', color.css);
    stamp.style.setProperty('--color-glow', color.glow);

    stampLayer.appendChild(stamp);
    state.stamps.push(stamp);

    // Limit persistent stamps to prevent browser stutter
    if (state.stamps.length > 80) {
      const oldest = state.stamps.shift();
      if (oldest) {
        oldest.classList.add('fade-out');
        setTimeout(() => oldest.remove(), 400);
      }
    }
  }

  // Domestic Cleanup for Ripple Layer
  function cleanupMaxRipples() {
    while (rippleLayer.childElementCount > state.maxActiveRipples) {
      if (rippleLayer.firstElementChild) {
        rippleLayer.firstElementChild.remove();
      }
    }
  }

  // --- Interaction Dispatcher ---
  function triggerInteraction(x, y) {
    // Dismiss initial prompt
    if (!state.hasInteracted) {
      state.hasInteracted = true;
      if (promptHint) {
        promptHint.classList.add('dismissed');
      }
    }

    state.totalRipples++;
    const color = getNextColor();

    updateHUD(x, y, color);
    playTone(y / window.innerHeight);

    switch (state.mode) {
      case 'particles':
        createParticles(x, y, color);
        break;
      case 'stamp':
        createStamp(x, y, color);
        break;
      case 'ripple':
      default:
        createRipple(x, y, color);
        break;
    }
  }

  // --- Unified Pointer & Multi-Touch Handlers ---
  function handlePointerDown(e) {
    // Ignore clicks on controls or HUD
    if (e.target.closest('.dock-container') || e.target.closest('.hud-top')) {
      return;
    }

    state.isDragging = true;
    state.lastDragTime = performance.now();
    triggerInteraction(e.clientX, e.clientY);
  }

  function handlePointerMove(e) {
    // Update desktop cursor glow position
    if (cursorGlow) {
      cursorGlow.style.left = `${e.clientX}px`;
      cursorGlow.style.top = `${e.clientY}px`;
    }

    // Drag / Swipe trail effect
    if (state.isDragging && (e.buttons > 0 || e.pointerType === 'touch')) {
      const now = performance.now();
      if (now - state.lastDragTime >= state.dragThrottleMs) {
        state.lastDragTime = now;
        triggerInteraction(e.clientX, e.clientY);
      }
    }
  }

  function handlePointerUp() {
    state.isDragging = false;
  }

  // Multi-Touch Support for touch devices
  function handleTouchStart(e) {
    if (e.target.closest('.dock-container') || e.target.closest('.hud-top')) {
      return;
    }

    // Support simultaneous multiple touch points!
    if (e.changedTouches && e.changedTouches.length > 1) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        triggerInteraction(touch.clientX, touch.clientY);
      }
    }
  }

  // Attach Event Listeners to Stage
  stage.addEventListener('pointerdown', handlePointerDown, { passive: true });
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('pointerup', handlePointerUp, { passive: true });
  window.addEventListener('pointercancel', handlePointerUp, { passive: true });
  stage.addEventListener('touchstart', handleTouchStart, { passive: true });

  // --- Controls & Dock Listeners ---

  // Mode Selection
  modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetMode = btn.getAttribute('data-mode');
      if (!targetMode) return;

      modeBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });

      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      state.mode = targetMode;
    });
  });

  // Audio Toggle
  audioToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.audioEnabled = !state.audioEnabled;

    if (state.audioEnabled) {
      initAudioContext();
      audioIconOn.classList.remove('hidden');
      audioIconOff.classList.add('hidden');
      audioToggleBtn.classList.add('active');
      // Play a welcome confirmation chime
      playTone(0.5);
    } else {
      audioIconOn.classList.add('hidden');
      audioIconOff.classList.remove('hidden');
      audioToggleBtn.classList.remove('active');
    }
  });

  // Clear Canvas & Stamps
  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Fade out and remove all stamps
    state.stamps.forEach(stamp => {
      stamp.classList.add('fade-out');
    });
    setTimeout(() => {
      stampLayer.innerHTML = '';
      rippleLayer.innerHTML = '';
      state.stamps = [];
    }, 350);

    // Reset counter & HUD
    state.totalRipples = 0;
    rippleCountEl.textContent = '0';
  });

  // Fullscreen Toggle
  fullscreenBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        fsEnterIcon.classList.add('hidden');
        fsExitIcon.classList.remove('hidden');
        fullscreenBtn.classList.add('active');
      } else {
        await document.exitFullscreen();
        fsEnterIcon.classList.remove('hidden');
        fsExitIcon.classList.add('hidden');
        fullscreenBtn.classList.remove('active');
      }
    } catch {
      // Fullscreen not supported or blocked
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      fsEnterIcon.classList.remove('hidden');
      fsExitIcon.classList.add('hidden');
      fullscreenBtn.classList.remove('active');
    }
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') {
      clearBtn.click();
    } else if (e.key === 'm' || e.key === 'M') {
      audioToggleBtn.click();
    } else if (e.key === '1') {
      modeBtns[0]?.click();
    } else if (e.key === '2') {
      modeBtns[1]?.click();
    } else if (e.key === '3') {
      modeBtns[2]?.click();
    } else if (e.key === ' ' || e.code === 'Space') {
      // Trigger random ripple on spacebar
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;
      triggerInteraction(x, y);
    }
  });

  // Initial HUD Display
  updateHUD(Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2), {
    css: 'hsl(220, 95%, 65%)',
    glow: 'hsla(220, 100%, 65%, 0.4)',
    hue: 220
  });

})();
