// ============================================================
// IMAHE — Photobooth with Frame Picker + Shot Count
// ============================================================

const video       = document.getElementById('camera-feed');
const canvas      = document.getElementById('canvas');
const ctx         = canvas.getContext('2d');
const captureBtn  = document.getElementById('capture-btn');
const btnLabel    = document.getElementById('btn-label');

const outputSingle      = document.getElementById('output-single');
const singleContainer   = document.getElementById('single-frame-container');
const retakeBtn         = document.getElementById('retake-btn');
const downloadBtn       = document.getElementById('download-btn');
const printBtn          = document.getElementById('print-btn');

const outputStrip       = document.getElementById('output-strip');
const stripContainer    = document.getElementById('strip-frame-container');
const stripRetakeBtn    = document.getElementById('strip-retake-btn');
const stripDownloadBtn  = document.getElementById('strip-download-btn');
const stripPrintBtn     = document.getElementById('strip-print-btn');

const countdownOverlay  = document.getElementById('countdown-overlay');
const countdownNumber   = document.getElementById('countdown-number');
const flashOverlay      = document.getElementById('flash-overlay');
const stripProgress     = document.getElementById('strip-progress');
const shotCountRow      = document.getElementById('shot-count-row');

let currentMode   = 'single';
let currentFilter = 'none';
let currentFrame  = 'polaroid';
let shotCount     = 3;           // 3 | 4 | 6
let stripImages   = [];
let lastSingleImg = null;
let isShooting    = false;
let progressDots  = [];

// ── Camera ──────────────────────────────────────────────────
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }
        });
        video.srcObject = stream;
    } catch (err) {
        alert('Please allow camera access to use Imahe.');
    }
}

// ── Build progress dots ──────────────────────────────────────
function buildDots(n) {
    stripProgress.innerHTML = '';
    progressDots = [];
    for (let i = 0; i < n; i++) {
        const d = document.createElement('span');
        d.className = 'dot';
        stripProgress.appendChild(d);
        progressDots.push(d);
    }
}

function resetDots() { progressDots.forEach(d => d.classList.remove('taken','current')); }
function updateDots(i) {
    progressDots.forEach((d,j) => {
        d.classList.remove('current');
        if (i === j) d.classList.add('current');
    });
}

// ── Mode ─────────────────────────────────────────────────────
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
        resetOutput();
        if (currentMode === 'strip') {
            btnLabel.textContent = 'Start Strip';
            stripProgress.style.display = 'flex';
            shotCountRow.style.display = 'flex';
            buildDots(shotCount);
        } else {
            btnLabel.textContent = 'Take Photo';
            stripProgress.style.display = 'none';
            shotCountRow.style.display = 'none';
        }
    });
});

// ── Shot Count ───────────────────────────────────────────────
document.querySelectorAll('.shot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (isShooting) return;
        document.querySelectorAll('.shot-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        shotCount = parseInt(btn.dataset.count);
        buildDots(shotCount);
        resetOutput();
    });
});

// ── Filter ───────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        video.className = currentFilter !== 'none' ? `filter-${currentFilter}` : '';
    });
});

// ── Frame Picker ─────────────────────────────────────────────
document.querySelectorAll('.frame-opt').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.frame-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFrame = btn.dataset.frame;
        if (lastSingleImg && outputSingle.style.display !== 'none') renderSingleFrame(lastSingleImg);
        if (stripImages.length === shotCount && outputStrip.style.display !== 'none') renderStripFrame(stripImages);
    });
});

// ── Capture ──────────────────────────────────────────────────
captureBtn.addEventListener('click', () => {
    if (isShooting) return;
    if (currentMode === 'single') shootSingle();
    else shootStrip();
});

async function shootSingle() {
    isShooting = true;
    captureBtn.disabled = true;
    await countdown(3);
    const dataUrl = captureFrame();
    triggerFlash();
    lastSingleImg = dataUrl;
    renderSingleFrame(dataUrl);
    outputSingle.style.display = 'flex';
    outputStrip.style.display = 'none';
    setTimeout(() => outputSingle.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    captureBtn.disabled = false;
    isShooting = false;
}

async function shootStrip() {
    isShooting = true;
    captureBtn.disabled = true;
    stripImages = [];
    buildDots(shotCount);
    resetDots();

    for (let i = 0; i < shotCount; i++) {
        updateDots(i);
        await countdown(3);
        const dataUrl = captureFrame();
        triggerFlash();
        stripImages.push(dataUrl);
        progressDots[i].classList.remove('current');
        progressDots[i].classList.add('taken');
        if (i < shotCount - 1) await delay(600);
    }

    renderStripFrame(stripImages);
    outputStrip.style.display = 'flex';
    outputSingle.style.display = 'none';
    setTimeout(() => outputStrip.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    captureBtn.disabled = false;
    isShooting = false;
    btnLabel.textContent = 'Retake Strip';
}

// ── Single Frame Renderer ─────────────────────────────────────
function renderSingleFrame(src) {
    singleContainer.innerHTML = '';
    const date = formatDate();
    let html = '';
    if (currentFrame === 'none') {
        html = `<div class="frm-none"><img src="${src}" alt="photo"></div>`;
    } else if (currentFrame === 'polaroid') {
        html = `<div class="frm-polaroid"><img src="${src}" alt="photo"><div class="pol-caption"><span>${date}</span><em>imahe</em></div></div>`;
    } else if (currentFrame === 'minimal') {
        html = `<div class="frm-minimal"><img src="${src}" alt="photo"><div class="min-caption"><span>imahe</span><span>${date}</span></div></div>`;
    } else if (currentFrame === 'dark') {
        html = `<div class="frm-dark"><img src="${src}" alt="photo"><div class="dark-caption"><span>${date}</span><em>imahe</em></div></div>`;
    } else if (currentFrame === 'doodle') {
        html = `<div class="frm-doodle"><img src="${src}" alt="photo"><div class="doodle-caption"><em>imahe ✿</em><span class="doodle-stars">★★★</span></div></div>`;
    } else if (currentFrame === 'stamp') {
        html = `<div class="frm-stamp"><img src="${src}" alt="photo"><div class="stamp-footer"><span>${date}</span><span class="stamp-mark">imahe</span></div></div>`;
    } else if (currentFrame === 'vintage') {
        html = `<div class="frm-vintage"><div class="vintage-top"><span>✦ photobooth ✦</span><span class="vintage-logo">imahe</span></div><img src="${src}" alt="photo"><div class="vintage-bottom"><span>captured with love</span><span class="vintage-date-box">${date}</span></div></div>`;
    }
    singleContainer.innerHTML = html;
}

// ── Strip Frame Renderer ──────────────────────────────────────
function renderStripFrame(srcs) {
    stripContainer.innerHTML = '';
    const date = formatDate();
    const n = srcs.length;
    const countClass = n > 3 ? ` count-${n}` : '';
    const romannums = ['①','②','③','④','⑤','⑥'];
    const stampNums = ['No.1','No.2','No.3','No.4','No.5','No.6'];
    let html = '';

    if (currentFrame === 'none') {
        html = `<div class="strip-frm-none${countClass}">
            ${srcs.map(s=>`<img src="${s}" alt="photo">`).join('')}
        </div>`;

    } else if (currentFrame === 'polaroid') {
        // 3 = row, 4/6 = grid
        html = `<div class="strip-frm-polaroid${countClass}">
            ${srcs.map((s,i)=>`
            <div class="mini-pol">
                <img src="${s}" alt="photo ${i+1}">
                <div class="mini-pol-date">${date}</div>
                <div class="mini-pol-brand">imahe</div>
            </div>`).join('')}
        </div>`;

    } else if (currentFrame === 'minimal') {
        html = `<div class="strip-frm-minimal${countClass}">
            ${srcs.map((s,i)=>`<img src="${s}" alt="photo ${i+1}">${(n<=3 && i<n-1)?'<div class="min-divider"></div>':''}`).join('')}
            <div class="min-strip-footer"><span>imahe</span><span>${date}</span></div>
        </div>`;

    } else if (currentFrame === 'dark') {
        const holeCount = Math.max(6, n * 2);
        const holes = `<span></span>`.repeat(holeCount);
        html = `<div class="strip-frm-dark">
            <div class="s-holes">${holes}</div>
            <div class="s-frames">
                ${srcs.map(s=>`<div class="s-frame"><img src="${s}" alt="photo"></div>`).join('')}
            </div>
            <div class="s-film-label">imahe · ${date}</div>
            <div class="s-holes">${holes}</div>
        </div>`;

    } else if (currentFrame === 'doodle') {
        html = `<div class="strip-frm-doodle${countClass}">
            ${srcs.map((s,i)=>`
            <div class="doodle-item">
                <span class="doodle-num">${romannums[i]}</span>
                <img src="${s}" alt="photo ${i+1}">
            </div>`).join('')}
            <div class="doodle-caption doodle-footer"><em>imahe ✿</em><span class="doodle-stars">★★★</span></div>
        </div>`;

    } else if (currentFrame === 'stamp') {
        html = `<div class="strip-frm-stamp${countClass}">
            ${srcs.map((s,i)=>`
            <div>
                <div class="stamp-num">${stampNums[i]}</div>
                <img src="${s}" alt="photo ${i+1}">
            </div>`).join('')}
            <div class="stamp-strip-footer">
                <span>${date}</span><span class="stamp-mark">imahe</span>
            </div>
        </div>`;

    } else if (currentFrame === 'vintage') {
        html = `<div class="strip-frm-vintage${countClass}">
            <div class="vint-header"><span>✦ contact sheet ✦</span><span class="vintage-logo">imahe</span></div>
            ${srcs.map((s,i)=>`
            <div class="vint-img-wrap">
                <img src="${s}" alt="photo ${i+1}">
                <div class="vint-img-label">frame ${String(i+1).padStart(2,'0')}</div>
            </div>`).join('')}
            <div class="vint-footer"><span>captured with love</span><span class="vint-date-box">${date}</span></div>
        </div>`;
    }

    stripContainer.innerHTML = html;
}

// ── Core Utilities ────────────────────────────────────────────
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
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
        let r=d[i],g=d[i+1],b=d[i+2];
        if (currentFilter==='warm')  { r=Math.min(255,r*1.1+15); g=Math.min(255,g*1.02+5); b=Math.max(0,b*0.88); }
        else if (currentFilter==='cool') { r=Math.max(0,r*0.9); b=Math.min(255,b*1.15+10); }
        else if (currentFilter==='mono') { const gr=0.299*r+0.587*g+0.114*b; r=g=b=Math.min(255,gr*1.05); }
        else if (currentFilter==='fade') { r=r*0.75+50; g=g*0.75+50; b=b*0.75+55; }
        d[i]=r; d[i+1]=g; d[i+2]=b;
    }
    ctx.putImageData(id, 0, 0);
}

function countdown(seconds) {
    return new Promise(resolve => {
        let n = seconds;
        countdownOverlay.classList.add('active');
        const tick = () => {
            countdownNumber.textContent = n;
            countdownNumber.style.animation = 'none';
            countdownNumber.offsetHeight;
            countdownNumber.style.animation = 'countPulse 1s ease-out forwards';
            if (n <= 0) { countdownOverlay.classList.remove('active'); resolve(); return; }
            n--;
            setTimeout(tick, 1000);
        };
        tick();
    });
}

function triggerFlash() {
    flashOverlay.classList.remove('flash');
    flashOverlay.offsetHeight;
    flashOverlay.classList.add('flash');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function formatDate() {
    return new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function resetOutput() {
    outputSingle.style.display = 'none';
    outputStrip.style.display  = 'none';
    singleContainer.innerHTML  = '';
    stripContainer.innerHTML   = '';
    stripImages  = [];
    lastSingleImg = null;
    if (currentMode === 'strip') {
        btnLabel.textContent = 'Start Strip';
        buildDots(shotCount);
        resetDots();
    } else {
        btnLabel.textContent = 'Take Photo';
    }
}

// ── Actions ───────────────────────────────────────────────────
retakeBtn.addEventListener('click', resetOutput);
stripRetakeBtn.addEventListener('click', () => { resetOutput(); });

downloadBtn.addEventListener('click', () => {
    if (!lastSingleImg) return;
    const a = document.createElement('a');
    a.href = lastSingleImg;
    a.download = `imahe-${Date.now()}.jpg`;
    a.click();
});

downloadBtn.addEventListener('click', async () => {
    if (!lastSingleImg) return;

    const framedPhoto = singleContainer.firstElementChild;
    const exportCanvas = await html2canvas(framedPhoto, {
        backgroundColor: null,
        scale: 3
    });

    const a = document.createElement('a');
    a.href = exportCanvas.toDataURL('image/jpeg', 0.92);
    a.download = `imahe-${Date.now()}.jpg`;
    a.click();
});
    }

    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const oc = off.getContext('2d');

    // Background
    oc.fillStyle = '#1C1611';
    oc.fillRect(0, 0, W, H);

    // Sprocket holes
    oc.fillStyle = '#0C0806';
    const holeRows = Math.max(n+3, 6);
    for (const side of [hp/2-6, W-hp/2-6]) {
        for (let j = 1; j <= holeRows; j++) {
            const hy = j * (H/(holeRows+1));
            oc.beginPath();
            if (oc.roundRect) oc.roundRect(side, hy-7, 12, 14, 2);
            else oc.rect(side, hy-7, 12, 14);
            oc.fill();
        }
    }

    // Draw images
    for (let i = 0; i < n; i++) {
        const img = new Image();
        img.src = stripImages[i];
        await new Promise(r => { img.onload = r; });
        const p = positions[i];
        oc.drawImage(img, p.x, p.y, p.w, p.h);
    }

    // Watermark label
    oc.save();
    oc.translate(W - hp/2 + 2, H/2);
    oc.rotate(-Math.PI/2);
    oc.fillStyle = '#4A3A2E';
    oc.font = 'bold 11px sans-serif';
    oc.letterSpacing = '3px';
    oc.textAlign = 'center';
    oc.fillText(`IMAHE · ${formatDate()}`, 0, 0);
    oc.restore();

    const a = document.createElement('a');
    a.href = off.toDataURL('image/jpeg', 0.92);
    a.download = `imahe-strip-${n}shot-${Date.now()}.jpg`;
    a.click();
});

printBtn.addEventListener('click', () => window.print());
stripPrintBtn.addEventListener('click', () => window.print());

// ── Init ──────────────────────────────────────────────────────
startCamera();
