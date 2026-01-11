(function() {
    const canvas = document.getElementById('sky-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let animationFrameId = null;
    let startTime = Date.now();
    
    let backgroundCanvas = null;
    let moonCanvas = null;
    let glowCanvas = null;
    let moonRadius = 0;
    let moonCenterX = 0;
    let moonCenterY = 0;
    
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
        moonCanvas = null;
        glowCanvas = null;
        
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
        
        bgCtx.fillStyle = '#0a0a0a';
        bgCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
        
        const dawnCenterX = -backgroundCanvas.height * 0.518;
        const dawnCenterY = backgroundCanvas.height * 36.65;
        const dawnRadius = backgroundCanvas.height * 40;
        
        const dawnGradient = bgCtx.createRadialGradient(
            dawnCenterX, dawnCenterY, 0,
            dawnCenterX, dawnCenterY, dawnRadius
        );
        dawnGradient.addColorStop(0, 'rgba(227, 58, 16, 0.66)');
        dawnGradient.addColorStop(0.89, 'rgba(227, 58, 16, 0.66)');
        dawnGradient.addColorStop(0.894, 'rgba(121, 97, 37, 0.53)');
        dawnGradient.addColorStop(0.8993, 'rgba(60, 70, 90, 0.16)');
        dawnGradient.addColorStop(0.9495, 'rgba(10, 10, 10, 0.03)');
        dawnGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        bgCtx.fillStyle = dawnGradient;
        bgCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);

        const img = bgCtx.getImageData(0, 0, backgroundCanvas.width, backgroundCanvas.height);
        for (let i = 0; i < img.data.length; i += 4) {
            const n = (Math.random() - 0.5) * 10;
            img.data[i]   += n;
            img.data[i+1] += n;
            img.data[i+2] += n;
        }
        bgCtx.putImageData(img, 0, 0);
        
        const stars = [
            { x: 0.15, y: 0.25, size: 2, brightness: 1 },
            { x: 0.35, y: 0.40, size: 1.5, brightness: 0.8 },
            { x: 0.55, y: 0.20, size: 2.5, brightness: 1 },
            { x: 0.75, y: 0.50, size: 1.5, brightness: 0.9 },
            { x: 0.20, y: 0.65, size: 2, brightness: 0.7 },
            { x: 0.50, y: 0.60, size: 1.5, brightness: 0.8 },
            { x: 0.70, y: 0.30, size: 2, brightness: 1 },
            { x: 0.30, y: 0.45, size: 1.5, brightness: 0.9 }
        ];
        
        stars.forEach(star => {
            const x = star.x * backgroundCanvas.width;
            const y = star.y * backgroundCanvas.height;
            bgCtx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
            bgCtx.beginPath();
            bgCtx.arc(x, y, star.size, 0, Math.PI * 2);
            bgCtx.fill();
        });
    }
    
    function renderMoon() {
        if (moonCanvas && moonRadius === Math.min(canvas.width, canvas.height) * 0.08) {
            return;
        }
        
        moonRadius = Math.min(canvas.width, canvas.height) * 0.08;
        
        const lightDir = { x: -0.6, y: -0.3, z: 0.74 };
        const lightLen = Math.sqrt(lightDir.x * lightDir.x + lightDir.y * lightDir.y + lightDir.z * lightDir.z);
        lightDir.x /= lightLen;
        lightDir.y /= lightLen;
        lightDir.z /= lightLen;
        
        const moonBaseColor = { r: 255, g: 255, b: 240 };
        const ambient = 0.1;
        
        let seed = 12345;
        function seededRandom() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        }
        
        function noise(x, y) {
            const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            return n - Math.floor(n);
        }
        
        function smoothNoise(x, y) {
            const fx = Math.floor(x);
            const fy = Math.floor(y);
            const cx = fx + 1;
            const cy = fy + 1;
            
            const a = noise(fx, fy);
            const b = noise(cx, fy);
            const c = noise(fx, cy);
            const d = noise(cx, cy);
            
            const wx = x - fx;
            const wy = y - fy;
            const ux = wx * wx * (3 - 2 * wx);
            const uy = wy * wy * (3 - 2 * wy);
            
            return a * (1 - ux) * (1 - uy) +
                   b * ux * (1 - uy) +
                   c * (1 - ux) * uy +
                   d * ux * uy;
        }
        
        const numCraters = 200;
        const craters = [];
        for (let i = 0; i < numCraters; i++) {
            const theta = seededRandom() * Math.PI * 2;
            const phi = Math.acos(2 * seededRandom() - 1);
            const cx = moonRadius * Math.sin(phi) * Math.cos(theta);
            const cy = moonRadius * Math.sin(phi) * Math.sin(theta);
            const cz = moonRadius * Math.cos(phi);
            const sizeRand = seededRandom();
            const size = moonRadius * (0.05 + sizeRand * sizeRand * 0.82);
            const depth = size * (0.12 + seededRandom() * 0.10);
            craters.push({
                x: cx,
                y: cy,
                z: cz,
                size: size,
                depth: depth
            });
        }
        
        const glowOuter = moonRadius * 2.5;
        const canvasPadding = 20;
        moonCanvas = document.createElement('canvas');
        moonCanvas.width = Math.ceil(glowOuter * 2) + canvasPadding * 2;
        moonCanvas.height = Math.ceil(glowOuter * 2) + canvasPadding * 2;
        const moonCtx = moonCanvas.getContext('2d');
        const moonImageData = moonCtx.createImageData(moonCanvas.width, moonCanvas.height);
        const moonData = moonImageData.data;
        
        moonCenterX = moonCanvas.width / 2;
        moonCenterY = moonCanvas.height / 2;
        const glowK = moonRadius * 0.4;
        
        for (let y = 0; y < moonCanvas.height; y++) {
            for (let x = 0; x < moonCanvas.width; x++) {
                const dx = x - moonCenterX;
                const dy = y - moonCenterY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                const sdf = dist - moonRadius;
                
                const mask = sdf <= 0 ? 1 : 0;
                const smoothMask = sdf <= 0 ? 
                    (sdf >= -1 ? 0.5 + 0.5 * (1 - sdf) : 1) : 
                    (sdf <= 1 ? 0.5 - 0.5 * sdf : 0);
                
                if (smoothMask > 0) {
                    const r2 = moonRadius * moonRadius;
                    const xy2 = dx * dx + dy * dy;
                    
                    if (xy2 <= r2) {
                        const z = Math.sqrt(r2 - xy2);
                        const normalLen = moonRadius;
                        const nx = dx / normalLen;
                        const ny = dy / normalLen;
                        const nz = z / normalLen;
                        
                        let dot = nx * lightDir.x + ny * lightDir.y + nz * lightDir.z;
                        let brightness = Math.max(0, dot);
                        
                        let craterModifier = 0;
                        for (const crater of craters) {
                            const dx3d = dx - crater.x;
                            const dy3d = dy - crater.y;
                            const dz3d = z - crater.z;
                            const dist3d = Math.sqrt(dx3d * dx3d + dy3d * dy3d + dz3d * dz3d);
                            
                            if (dist3d < crater.size) {
                                const craterFactor = 1 - (dist3d / crater.size);
                                
                                const rimDist = Math.abs(dist3d - crater.size * 0.88);
                                if (rimDist < crater.size * 0.12) {
                                    const rimFactor = 1 - (rimDist / (crater.size * 0.12));
                                    craterModifier += 0.02 * rimFactor * brightness;
                                } else {
                                    const shadowFactor = craterFactor * craterFactor * craterFactor;
                                    craterModifier -= crater.depth * shadowFactor * (0.03 + 0.03 * brightness);
                                }
                            }
                        }
                        
                        const noiseScale = 0.02;
                        const noiseValue = smoothNoise(dx * noiseScale, dy * noiseScale);
                        const noiseModifier = (noiseValue - 0.5) * 0.08;
                        
                        brightness = Math.max(0, Math.min(1, brightness + craterModifier + noiseModifier));
                        const finalBrightness = ambient + brightness * (1 - ambient);
                        
                        const idx = (y * moonCanvas.width + x) * 4;
                        moonData[idx] = moonBaseColor.r * finalBrightness;
                        moonData[idx + 1] = moonBaseColor.g * finalBrightness;
                        moonData[idx + 2] = moonBaseColor.b * finalBrightness;
                        moonData[idx + 3] = smoothMask * 255;
                    }
                }
            }
        }
        
        moonCtx.putImageData(moonImageData, 0, 0);

        glowCanvas = document.createElement('canvas');
        glowCanvas.width = moonCanvas.width;
        glowCanvas.height = moonCanvas.height;
        const glowCtx = glowCanvas.getContext('2d');
        const glowImageData = glowCtx.createImageData(glowCanvas.width, glowCanvas.height);
        const glowData = glowImageData.data;
        
        for (let y = 0; y < glowCanvas.height; y++) {
            for (let x = 0; x < glowCanvas.width; x++) {
                const dx = x - moonCenterX;
                const dy = y - moonCenterY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const sdf = dist - moonRadius;
                
                if (sdf > 0 && dist < glowOuter) {
                    const glowAmount = Math.exp(-sdf / glowK);
                    
                    const angle = Math.atan2(dy, dx);
                    const edgeNormalX = Math.cos(angle);
                    const edgeNormalY = Math.sin(angle);
                    const edgeDot = edgeNormalX * lightDir.x + edgeNormalY * lightDir.y;
                    const litFactor = 0.7 + 0.3 * Math.max(0, edgeDot);
                    
                    const idx = (y * glowCanvas.width + x) * 4;
                    const glowIntensity = glowAmount * litFactor * 0.15;
                    glowData[idx] = moonBaseColor.r * glowIntensity;
                    glowData[idx + 1] = moonBaseColor.g * glowIntensity;
                    glowData[idx + 2] = moonBaseColor.b * glowIntensity;
                    glowData[idx + 3] = glowIntensity * 255;
                }
            }
        }
        
        glowCtx.putImageData(glowImageData, 0, 0);
    }

    function drawFrame() {
        renderBackground();
        renderMoon();
        
        ctx.drawImage(backgroundCanvas, 0, 0);
        
        const time = (Date.now() - startTime) / 1000;
        const speed = 0.008;
        
        const arcProgress = (Math.sin(time * speed) + 1) / 2;
        const baseX = canvas.width * 0.6;
        const baseY = canvas.height * 0.12;
        const arcHeight = canvas.height * 0.08;
        const arcWidth = canvas.width * 0.25;
        
        const moonX = baseX + arcProgress * arcWidth;
        const moonY = baseY + 4 * arcProgress * (1 - arcProgress) * arcHeight;
        
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(glowCanvas, moonX - moonCenterX, moonY - moonCenterY);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(moonCanvas, moonX - moonCenterX, moonY - moonCenterY);
        ctx.globalCompositeOperation = 'source-over';
    }
    
    function animate() {
        drawFrame();
        animationFrameId = requestAnimationFrame(animate);
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
})();

