// ============================================================
// IMAHE — Enhanced Photobooth Script
// ============================================================

const video       = document.getElementById('camera-feed');
const canvas      = document.getElementById('canvas');
const ctx         = canvas.getContext('2d');
const captureBtn  = document.getElementById('capture-btn');
const btnLabel    = document.getElementById('btn-label');

// Single photo outputs
const outputSingle = document.getElementById('output-single');
const finalPhoto   = document.getElementById('final-photo');
const photoDate    = document.getElementById('photo-date');
const retakeBtn    = document.getElementById('retake-btn');
const downloadBtn  = document.getElementById('download-btn');
const printBtn     = document.getElementById('print-btn');

// Strip outputs
const outputStrip     = document.getElementById('output-strip');
const stripFrames     = document.getElementById('strip-frames');
const stripRetakeBtn  = document.getElementById('strip-retake-btn');
const stripDownloadBtn= document.getElementById('strip-download-btn');
const stripPrintBtn   = document.getElementById('strip-print-btn');

// Overlays
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber  = document.getElementById('countdown-number');
const flashOverlay     = document.getElementById('flash-overlay');
const stripProgress    = document.getElementById('strip-progress');
const dots             = [document.getElementById('dot-0'), document.getElementById('dot-1'), document.getElementById('dot-2')];

// Mode & filter
let currentMode   = 'single';   // 'single' | 'strip'
let currentFilter = 'none';
let stripImages   = [];
let isShooting    = false;

// ── Camera Start ────────────────────────────────────────────
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } } });
        video.srcObject = stream;
    } catch (err) {
        console.error('Camera error:', err);
        alert('Please allow camera access to use Imahe.');
    }
}

// ── Mode Switcher ────────────────────────────────────────────
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
        resetOutput();

        if (currentMode === 'strip') {
            btnLabel.textContent = 'Start Strip';
            stripProgress.style.display = 'flex';
            resetDots();
        } else {
            btnLabel.textContent = 'Take Photo';
            stripProgress.style.display = 'none';
        }
    });
});

// ── Filter Switcher ──────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        video.className = currentFilter !== 'none' ? `filter-${currentFilter}` : '';
    });
});

// ── Capture Main Button ──────────────────────────────────────
captureBtn.addEventListener('click', () => {
    if (isShooting) return;
    if (currentMode === 'single') shootSingle();
    else shootStrip();
});

// ── Single Photo ─────────────────────────────────────────────
async function shootSingle() {
    isShooting = true;
    captureBtn.disabled = true;

    await countdown(3);
    const dataUrl = captureFrame();
    triggerFlash();

    photoDate.textContent = formatDate();
    finalPhoto.src = dataUrl;
    finalPhoto.style.filter = getCSSFilter();

    outputSingle.style.display = 'flex';
    outputStrip.style.display = 'none';
    setTimeout(() => outputSingle.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);

    captureBtn.disabled = false;
    isShooting = false;
}

// ── Film Strip ────────────────────────────────────────────────
async function shootStrip() {
    isShooting = true;
    captureBtn.disabled = true;
    stripImages = [];
    resetDots();

    for (let i = 0; i < 3; i++) {
        updateDots(i);
        await countdown(3);
        const dataUrl = captureFrame();
        triggerFlash();
        stripImages.push(dataUrl);
        dots[i].classList.remove('current');
        dots[i].classList.add('taken');
        await delay(600);
    }

    renderStrip();
    outputStrip.style.display = 'flex';
    outputSingle.style.display = 'none';
    setTimeout(() => outputStrip.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);

    captureBtn.disabled = false;
    isShooting = false;
    btnLabel.textContent = 'Retake Strip';
}

function renderStrip() {
    stripFrames.innerHTML = '';
    stripImages.forEach((src, i) => {
        const frame = document.createElement('div');
        frame.className = 'strip-frame';
        const img = document.createElement('img');
        img.src = src;
        img.style.filter = getCSSFilter();
        img.alt = `Photo ${i + 1}`;
        frame.appendChild(img);
        stripFrames.appendChild(frame);
    });
}

// ── Helpers ──────────────────────────────────────────────────
function captureFrame() {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    applyCanvasFilter();
    return canvas.toDataURL('image/jpeg', 0.92);
}

function applyCanvasFilter() {
    if (currentFilter === 'none') return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;

    for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i+1], b = d[i+2];

        if (currentFilter === 'warm') {
            r = Math.min(255, r * 1.1 + 15);
            g = Math.min(255, g * 1.02 + 5);
            b = Math.max(0, b * 0.88);
        } else if (currentFilter === 'cool') {
            r = Math.max(0, r * 0.9);
            b = Math.min(255, b * 1.15 + 10);
        } else if (currentFilter === 'mono') {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = g = b = Math.min(255, gray * 1.05);
        } else if (currentFilter === 'fade') {
            r = r * 0.75 + 50;
            g = g * 0.75 + 50;
            b = b * 0.75 + 55;
        }

        d[i] = r; d[i+1] = g; d[i+2] = b;
    }
    ctx.putImageData(imageData, 0, 0);
}

function getCSSFilter() {
    const map = {
        none: '',
        warm: 'saturate(1.2) sepia(0.25) brightness(1.05)',
        cool: 'saturate(0.9) hue-rotate(20deg) brightness(1.05)',
        mono: 'grayscale(1) contrast(1.05)',
        fade: 'saturate(0.6) brightness(1.1) contrast(0.85)',
    };
    return map[currentFilter] || '';
}

function countdown(seconds) {
    return new Promise(resolve => {
        let n = seconds;
        countdownOverlay.classList.add('active');

        const tick = () => {
            countdownNumber.textContent = n;
            // Re-trigger animation
            countdownNumber.style.animation = 'none';
            countdownNumber.offsetHeight; // reflow
            countdownNumber.style.animation = 'countPulse 1s ease-out forwards';

            if (n <= 0) {
                countdownOverlay.classList.remove('active');
                resolve();
                return;
            }
            n--;
            setTimeout(tick, 1000);
        };
        tick();
    });
}

function triggerFlash() {
    flashOverlay.classList.remove('flash');
    flashOverlay.offsetHeight; // reflow
    flashOverlay.classList.add('flash');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatDate() {
    const d = new Date();
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function resetDots() {
    dots.forEach(d => { d.classList.remove('taken', 'current'); });
}

function updateDots(activeIndex) {
    dots.forEach((d, i) => {
        d.classList.remove('current');
        if (i === activeIndex) d.classList.add('current');
    });
}

function resetOutput() {
    outputSingle.style.display = 'none';
    outputStrip.style.display = 'none';
    stripImages = [];
    stripFrames.innerHTML = '';
    finalPhoto.src = '';
    btnLabel.textContent = 'Take Photo';
}

// ── Retake ────────────────────────────────────────────────────
retakeBtn.addEventListener('click', resetOutput);
stripRetakeBtn.addEventListener('click', () => {
    resetOutput();
    resetDots();
    btnLabel.textContent = 'Start Strip';
});

// ── Download Single ───────────────────────────────────────────
downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = finalPhoto.src;
    a.download = `imahe-${Date.now()}.jpg`;
    a.click();
});

// ── Download Strip ────────────────────────────────────────────
stripDownloadBtn.addEventListener('click', async () => {
    if (stripImages.length < 3) return;

    // Composite the three frames into a vertical strip
    const fw = 400, fh = 300, pad = 10, holePad = 26;
    const totalW = fw + (holePad * 2) + (pad * 2);
    const totalH = (fh * 3) + (pad * 4);

    const offscreen = document.createElement('canvas');
    offscreen.width = totalW;
    offscreen.height = totalH;
    const oc = offscreen.getContext('2d');

    // Background
    oc.fillStyle = '#1C1611';
    oc.fillRect(0, 0, totalW, totalH);

    // Holes
    oc.fillStyle = '#0C0806';
    const holeCount = 6;
    const holeGap = totalH / (holeCount + 1);
    for (let side of [holePad / 2 - 5, totalW - holePad / 2 - 5]) {
        for (let j = 1; j <= holeCount; j++) {
            const hy = j * holeGap;
            roundRect(oc, side, hy - 7, 12, 14, 2);
        }
    }

    // Frames
    for (let i = 0; i < 3; i++) {
        const img = new Image();
        img.src = stripImages[i];
        await new Promise(r => { img.onload = r; });
        const fy = pad + i * (fh + pad);
        oc.drawImage(img, holePad + pad, fy, fw, fh);
    }

    const a = document.createElement('a');
    a.href = offscreen.toDataURL('image/jpeg', 0.92);
    a.download = `imahe-strip-${Date.now()}.jpg`;
    a.click();
});

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fill();
}

// ── Print ─────────────────────────────────────────────────────
printBtn.addEventListener('click', () => window.print());
stripPrintBtn.addEventListener('click', () => window.print());

// ── Init ──────────────────────────────────────────────────────
startCamera();
