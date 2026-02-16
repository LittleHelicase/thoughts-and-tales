(function () {
    const canvas = document.getElementById('sky-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId = null;
    let startTime = Date.now();

    let backgroundCanvas = null;
    let sunCanvas = null;
    let sunRadius = 0;

    // Set canvas size
    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;

        const header = canvas.closest('header');
        if (header) {
            canvas.height = header.offsetHeight;
        } else {
            canvas.height = 300;
        }

        backgroundCanvas = null;
        sunCanvas = null;

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        animate();
    }

    function renderBackground() {
        if (backgroundCanvas && backgroundCanvas.width === canvas.width && backgroundCanvas.height === canvas.height) {
            return;
        }

        backgroundCanvas = document.createElement('canvas');
        backgroundCanvas.width = canvas.width;
        backgroundCanvas.height = canvas.height;
        const bgCtx = backgroundCanvas.getContext('2d');

        // Sun position for gradient reference (must match drawFrame)
        const sunRadiusForPos = Math.min(canvas.width, canvas.height) * 0.08;
        const sunX = canvas.width * 0.25;
        const sunY = canvas.height - sunRadiusForPos * 0.4;

        // Gradient logic refinement:
        // "no sorry that made it worse. The red needs to not go as far as it goes now"
        // Need to pull back the red stops but keep density low.

        const offset = canvas.height * 10; // Way, way lower
        const gradCenterY = sunY + offset;
        const radius = offset + canvas.height * 1.2;

        const skyGradient = bgCtx.createRadialGradient(sunX, gradCenterY, 0, sunX, gradCenterY, radius);

        // Helper to map linear 't' (0 to 1, where 0 is horizon/sunY) to radial stop
        // distance at horizon = offset
        // distance at top = offset + canvas.height
        // stop = distance / radius
        const getStop = (t) => (offset + t * canvas.height) / radius;

        // Stops refined for lighter transition:
        // 0.0 -> Red start
        skyGradient.addColorStop(getStop(0), 'rgba(210, 70, 40, 0.8)');

        // 0.1 -> Fading Red - Lighter/Brighter now
        skyGradient.addColorStop(getStop(0.1), 'rgba(200, 100, 80, 0.7)');

        // 0.25 -> Bridge - Much lighter now
        skyGradient.addColorStop(getStop(0.25), 'rgba(140, 140, 170, 0.6)');

        // 0.6 -> Blue
        skyGradient.addColorStop(getStop(0.6), 'rgb(85, 99, 113)');

        // 1.0 -> Top Light Blue
        skyGradient.addColorStop(getStop(1.0), 'rgb(70, 80, 100)');

        bgCtx.fillStyle = '#1a1a1a';
        bgCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);

        bgCtx.fillStyle = skyGradient;
        bgCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
    }

    function renderSun() {
        if (sunCanvas) return;

        sunRadius = Math.min(canvas.width, canvas.height) * 0.08;
        const glowRadius = sunRadius * 20; // "tiny bit bigger" than 15

        sunCanvas = document.createElement('canvas');
        sunCanvas.width = glowRadius * 2;
        sunCanvas.height = glowRadius * 2;
        const sCtx = sunCanvas.getContext('2d');

        const cx = sunCanvas.width / 2;
        const cy = sunCanvas.height / 2;

        // Intense glow
        const sunGlow = sCtx.createRadialGradient(cx, cy, sunRadius * 0.2, cx, cy, glowRadius);
        sunGlow.addColorStop(0, 'rgba(255, 255, 200, 0.95)'); // Almost white core glow
        sunGlow.addColorStop(0.1, 'rgba(255, 220, 100, 0.8)'); // Bright yellow
        sunGlow.addColorStop(0.25, 'rgba(255, 160, 60, 0.5)'); // Orange spreading
        sunGlow.addColorStop(0.6, 'rgba(227, 58, 16, 0.15)'); // Reddish faint
        sunGlow.addColorStop(1, 'rgba(227, 58, 16, 0)');

        sCtx.fillStyle = sunGlow;
        sCtx.beginPath();
        sCtx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        sCtx.fill();

        // Sun body - "almost full white"
        const sunBody = sCtx.createRadialGradient(cx, cy, 0, cx, cy, sunRadius);
        sunBody.addColorStop(0, '#FFFFFF'); // Pure White
        sunBody.addColorStop(0.6, '#FFFFF0'); // Off-white
        sunBody.addColorStop(0.85, '#FFFFAA'); // Very subtle yellow edge
        sunBody.addColorStop(1, '#FFCC88'); // Slight orange rim, very thin

        sCtx.fillStyle = sunBody;
        sCtx.beginPath();
        sCtx.arc(cx, cy, sunRadius, 0, Math.PI * 2);
        sCtx.fill();
    }

    function drawFrame() {
        renderBackground();
        renderSun();

        ctx.drawImage(backgroundCanvas, 0, 0);

        const time = (Date.now() - startTime) / 1000;

        // Position sun
        const sunX = canvas.width * 0.25;
        const sunY = canvas.height - sunRadius * 0.4;

        const cx = sunCanvas.width / 2;
        const cy = sunCanvas.height / 2;

        ctx.drawImage(sunCanvas, sunX - cx, sunY - cy);
    }

    function animate() {
        drawFrame();
        animationFrameId = requestAnimationFrame(animate);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
})();
