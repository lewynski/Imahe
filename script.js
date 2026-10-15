const video = document.getElementById('video');
const stripCanvas = document.getElementById('stripCanvas');
const ctx = stripCanvas.getContext('2d');

const startBtn = document.getElementById('startBtn');
const retakeBtn = document.getElementById('retakeBtn');
const downloadBtn = document.getElementById('downloadBtn');
const mirrorBtn = document.getElementById('mirrorBtn');
const gridBtn = document.getElementById('gridBtn');
const gridOverlay = document.getElementById('gridOverlay');

const countdownOverlay = document.getElementById('countdownOverlay');
const countdownNumber = document.getElementById('countdownNumber');
const flashOverlay = document.getElementById('flashOverlay');
const sessionStatus = document.getElementById('sessionStatus');
const shotCounter = document.getElementById('shotCounter');
const activeFilterName = document.getElementById('activeFilterName');
const captionInput = document.getElementById('captionInput');
const dateToggle = document.getElementById('dateToggle');

// State
const COUNTDOWN_SECONDS = 8;
let targetShots = 4;
let capturedFrames = [];
let isMirrored = true;
let isCapturing = false;
let currentFilter = 'natural';
let currentFrame = 'white';
let studioSoftness = true;

// Studio Optical Filters
const FILTERS = {
  natural: {
    name: 'Natural Studio',
    css: 'contrast(1.06) saturate(1.05) brightness(1.02)'
  },
  bw: {
    name: 'Classic Noir',
    css: 'grayscale(1) contrast(1.22) brightness(1.03)'
  },
  warm: {
    name: 'Golden Analog',
    css: 'sepia(0.22) contrast(1.08) saturate(1.18) brightness(1.03)'
  },
  cool: {
    name: 'Cinema Cool',
    css: 'contrast(1.12) saturate(0.92) hue-rotate(8deg) brightness(1.02)'
  },
  rose: {
    name: 'Soft Rose',
    css: 'contrast(1.04) saturate(1.15) sepia(0.12) hue-rotate(-10deg) brightness(1.05)'
  },
  vintage: {
    name: '90s Retro',
    css: 'sepia(0.35) contrast(1.1) brightness(0.98) saturate(0.88)'
  },
  dramatic: {
    name: 'High Contrast',
    css: 'contrast(1.32) saturate(1.12) brightness(0.98)'
  },
  fade: {
    name: 'Matte Editorial',
    css: 'contrast(0.92) brightness(1.08) saturate(0.85)'
  }
};

// Studio Frame Themes
const FRAMES = {
  white: { bg: '#ffffff', text: '#111113', sub: '#71717a', border: '#e4e4e7' },
  obsidian: { bg: '#121215', text: '#f4f4f6', sub: '#a1a1aa', border: '#27272a' },
  cream: { bg: '#f4efe6', text: '#27241d', sub: '#78716c', border: '#e7e0d3' },
  blush: { bg: '#f9e2e6', text: '#4c1d24', sub: '#9f5864', border: '#f2ccd3' },
  matcha: { bg: '#e2ece4', text: '#1c3124', sub: '#53705e', border: '#cce0d0' },
  cobalt: { bg: '#172554', text: '#f8fafc', sub: '#93c5fd', border: '#1e3a8a' },
  film: { bg: '#141417', text: '#f4f4f6', sub: '#a1a1aa', border: '#27272a', sprockets: true }
};

// Web Audio Synthesizer for clean studio countdown beeps & shutter click
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq = 880, duration = 0.07, type = 'sine', gainVal = 0.08) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playShutterSound() {
  playTone(1320, 0.05, 'triangle', 0.15);
  setTimeout(() => playTone(660, 0.08, 'sine', 0.12), 45);
}

// Initialize High-Resolution Camera
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1440 },
        facingMode: 'user'
      },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    applyLiveVideoFilter();
    renderPhotostrip();
  } catch (err) {
    sessionStatus.textContent = 'CAMERA ACCESS REQUIRED';
    console.error('Camera initialization error:', err);
  }
}

function applyLiveVideoFilter() {
  const baseFilter = FILTERS[currentFilter].css;
  video.style.filter = baseFilter;
}

// Capture a high-res 4:3 frame off the video feed
function captureSingleFrame() {
  const offscreen = document.createElement('canvas');
  const outWidth = 1200;
  const outHeight = 900; // 4:3 Studio Ratio
  offscreen.width = outWidth;
  offscreen.height = outHeight;
  const oCtx = offscreen.getContext('2d');

  oCtx.imageSmoothingEnabled = true;
  oCtx.imageSmoothingQuality = 'high';

  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const targetAspect = outWidth / outHeight;
  const videoAspect = vw / vh;

  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (videoAspect > targetAspect) {
    sw = vh * targetAspect;
    sx = (vw - sw) / 2;
  } else {
    sh = vw / targetAspect;
    sy = (vh - sh) / 2;
  }

  oCtx.save();
  oCtx.filter = FILTERS[currentFilter].css;
  if (isMirrored) {
    oCtx.translate(outWidth, 0);
    oCtx.scale(-1, 1);
  }
  oCtx.drawImage(video, sx, sy, sw, sh, 0, 0, outWidth, outHeight);

  // Subtle Studio Skin Softening & Highlight Bloom
  if (studioSoftness) {
    oCtx.globalAlpha = 0.16;
    oCtx.filter = `${FILTERS[currentFilter].css} blur(6px) brightness(1.05)`;
    oCtx.drawImage(video, sx, sy, sw, sh, 0, 0, outWidth, outHeight);
    oCtx.globalAlpha = 1.0;
  }
  oCtx.restore();

  // Subtle Vignette for real photobooth lens depth
  const grad = oCtx.createRadialGradient(
    outWidth / 2, outHeight / 2, outWidth * 0.3,
    outWidth / 2, outHeight / 2, outWidth * 0.72
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  oCtx.fillStyle = grad;
  oCtx.fillRect(0, 0, outWidth, outHeight);

  return offscreen;
}

// Render the full photostrip to the preview canvas
function renderPhotostrip() {
  const theme = FRAMES[currentFrame];
  const photoW = 880;
  const photoH = 660;
  const padX = theme.sprockets ? 95 : 64;
  const padTop = 64;
  const gap = 36;
  const footerH = 220;

  const totalW = photoW + padX * 2;
  const totalH = padTop + (photoH * targetShots) + (gap * (targetShots - 1)) + footerH;

  stripCanvas.width = totalW;
  stripCanvas.height = totalH;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Background
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, totalW, totalH);

  // 35mm Film Sprockets if selected
  if (theme.sprockets) {
    ctx.fillStyle = '#27272a';
    const holeW = 28;
    const holeH = 42;
    const step = 76;
    for (let y = 48; y < totalH - 48; y += step) {
      ctx.beginPath();
      ctx.roundRect(26, y, holeW, holeH, 6);
      ctx.roundRect(totalW - 26 - holeW, y, holeW, holeH, 6);
      ctx.fill();
    }
  }

  // Draw Each Photo Slot
  for (let i = 0; i < targetShots; i++) {
    const x = padX;
    const y = padTop + i * (photoH + gap);

    if (capturedFrames[i]) {
      ctx.drawImage(capturedFrames[i], x, y, photoW, photoH);
    } else {
      // Placeholder Slot
      ctx.fillStyle = theme.border;
      ctx.fillRect(x, y, photoW, photoH);
      ctx.fillStyle = theme.sub;
      ctx.font = '500 28px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`POSE 0${i + 1}`, x + photoW / 2, y + photoH / 2 + 10);
    }

    // Subtle Inner Border
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, photoW, photoH);
  }

  // Footer Typography
  const footerCenterY = totalH - footerH / 2;
  const customTitle = (captionInput.value || 'IMAHE STUDIO').trim();

  ctx.fillStyle = theme.text;
  ctx.font = '600 42px "Playfair Display", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(customTitle, totalW / 2, footerCenterY - 8);

  if (dateToggle.checked) {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).toUpperCase();

    ctx.fillStyle = theme.sub;
    ctx.font = '400 22px "Space Mono", monospace';
    ctx.fillText(formattedDate, totalW / 2, footerCenterY + 38);
  }
}

// Helper sleep function
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Run Automated 8-Second Countdown Photobooth Session
async function startBoothSession() {
  if (isCapturing) return;
  isCapturing = true;
  capturedFrames = [];
  startBtn.disabled = true;
  retakeBtn.disabled = true;
  downloadBtn.disabled = true;
  renderPhotostrip();

  for (let shot = 1; shot <= targetShots; shot++) {
    shotCounter.textContent = `${shot} / ${targetShots} SHOTS`;
    sessionStatus.textContent = `POSE ${shot} — GET READY`;
    countdownOverlay.classList.add('active');

    for (let sec = COUNTDOWN_SECONDS; sec >= 1; sec--) {
      countdownNumber.textContent = sec;
      countdownNumber.style.transform = 'scale(1.18)';
      setTimeout(() => {
        countdownNumber.style.transform = 'scale(1)';
      }, 150);

      // Audio feedback on last 3 seconds
      if (sec <= 3) {
        playTone(980, 0.08, 'sine', 0.1);
      } else {
        playTone(580, 0.04, 'sine', 0.04);
      }
      await sleep(1000);
    }

    countdownOverlay.classList.remove('active');

    // Trigger Flash & Shutter
    flashOverlay.classList.add('trigger');
    playShutterSound();
    const frame = captureSingleFrame();
    capturedFrames.push(frame);
    renderPhotostrip();

    setTimeout(() => {
      flashOverlay.classList.remove('trigger');
    }, 90);

    if (shot < targetShots) {
      sessionStatus.textContent = 'GREAT SHOT — NEXT POSE';
      await sleep(1200);
    }
  }

  sessionStatus.textContent = 'SESSION COMPLETE';
  shotCounter.textContent = `${targetShots} / ${targetShots} SHOTS`;
  startBtn.disabled = false;
  retakeBtn.disabled = false;
  downloadBtn.disabled = false;
  isCapturing = false;
}

// Event Listeners
startBtn.addEventListener('click', startBoothSession);

retakeBtn.addEventListener('click', () => {
  if (isCapturing) return;
  capturedFrames = [];
  shotCounter.textContent = `0 / ${targetShots} SHOTS`;
  sessionStatus.textContent = 'READY TO CAPTURE';
  retakeBtn.disabled = true;
  downloadBtn.disabled = true;
  renderPhotostrip();
});

downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 10);
  link.download = `IMAHE-STUDIO-${timestamp}.png`;
  link.href = stripCanvas.toDataURL('image/png', 1.0);
  link.click();
});

mirrorBtn.addEventListener('click', () => {
  isMirrored = !isMirrored;
  mirrorBtn.classList.toggle('active', isMirrored);
  video.classList.toggle('unmirrored', !isMirrored);
});

gridBtn.addEventListener('click', () => {
  gridBtn.classList.toggle('active');
  gridOverlay.classList.toggle('visible');
});

// Shot Count Selector
document.getElementById('shotCountSelect').addEventListener('click', (e) => {
  const btn = e.target.closest('.seg-btn');
  if (!btn || isCapturing) return;
  document.querySelectorAll('#shotCountSelect .seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  targetShots = parseInt(btn.dataset.shots, 10);
  capturedFrames = [];
  shotCounter.textContent = `0 / ${targetShots} SHOTS`;
  retakeBtn.disabled = true;
  downloadBtn.disabled = true;
  renderPhotostrip();
});

// Studio Softness Selector
document.getElementById('softnessSelect').addEventListener('click', (e) => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  document.querySelectorAll('#softnessSelect .seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  studioSoftness = btn.dataset.soft === '1';
});

// Filter Selection
document.getElementById('filterList').addEventListener('click', (e) => {
  const btn = e.target.closest('.pill-btn');
  if (!btn) return;
  document.querySelectorAll('#filterList .pill-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.filter;
  activeFilterName.textContent = FILTERS[currentFilter].name;
  applyLiveVideoFilter();
});

// Frame Selection
document.getElementById('frameList').addEventListener('click', (e) => {
  const btn = e.target.closest('.swatch-btn');
  if (!btn) return;
  document.querySelectorAll('#frameList .swatch-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFrame = btn.dataset.frame;
  renderPhotostrip();
});

captionInput.addEventListener('input', renderPhotostrip);
dateToggle.addEventListener('change', renderPhotostrip);

// Start Camera on Load
window.addEventListener('DOMContentLoaded', initCamera);
