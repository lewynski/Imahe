const video = document.getElementById('camera-feed');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const captureBtn = document.getElementById('capture-btn');
const printBtn = document.getElementById('print-btn');
const finalPhoto = document.getElementById('final-photo');

// 1. Start the Camera
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        video.srcObject = stream;
    } catch (err) {
        console.error("Camera access denied or unavailable: ", err);
        alert("Please enable camera access to use the photobooth.");
    }
}

// 2. Capture Image
captureBtn.addEventListener('click', () => {
    // Set canvas dimensions to match the video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Flip the canvas context horizontally to match the mirrored video feed
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    
    // Draw the video frame onto the canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas directly to an image URL
    const dataUrl = canvas.toDataURL('image/png');
    finalPhoto.src = dataUrl;
    
    // Show the output image and print button
    finalPhoto.style.display = 'block';
    printBtn.style.display = 'inline-block';
    
    // Smoothly scroll down to the result
    finalPhoto.scrollIntoView({ behavior: 'smooth' });
});

// 3. Trigger Print
printBtn.addEventListener('click', () => {
    window.print();
});

// Initialize
startCamera();
