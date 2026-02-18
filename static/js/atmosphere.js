(function () {
    const canvas = document.getElementById('sky-canvas');
    if (!canvas) {
        console.error("Canvas #sky-canvas not found!");
        return;
    }

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        console.warn('WebGL not supported');
        return;
    }

    // Vertex Shader: Fullscreen Quad
    const vsSource = `
        attribute vec2 position;
        varying vec2 v_uv;
        void main() {
            v_uv = position;
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

    // Fragment Shader: Atmospheric Scattering
    const fsSource = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif

        uniform vec2 u_resolution;
        uniform float u_time;
        uniform vec2 u_sun_pos;
        varying vec2 v_uv;

        // Normalized Constants (R = 1.0)
        const float EARTH_RADIUS = 1.0;
        const float ATMOSPHERE_RADIUS = 1.025; // ~160km atmosphere for better visuals
        
        // Coefficients scaled by 6371000
        const vec3 RAYLEIGH_COEFF = vec3(35.0, 82.8, 142.7); 
        const float MIE_COEFF = 133.8;
        
        const float RAYLEIGH_SCALE_HEIGHT = 0.0125; // 8km / 6371km * 10? No. 8/6371 = 0.00125. Let's stick to simple
        // Actually, if we scaled R to 1, scale height is 8/6371 = 0.001255.
        // Let's use 0.0015 for slightly thicker atmosphere look
        const float H_R = 0.0015;
        const float H_M = 0.0003; // 1.2km / 6371km ~ 0.0002

        const float G = 0.76; 

        const int STEPS = 12; // Increased steps slightly for quality

        // Ray-Sphere intersection
        vec2 raySphere(vec3 ro, vec3 rd, float r) {
            float b = dot(ro, rd);
            float c = dot(ro, ro) - r * r;
            float h = b * b - c;
            if (h < 0.0) return vec2(-1.0);
            h = sqrt(h);
            return vec2(-b - h, -b + h);
        }

        void main() {
            vec2 uv = gl_FragCoord.xy / u_resolution.xy;
            float aspect = u_resolution.x / u_resolution.y;
            vec2 p = v_uv; 
            p.x *= aspect;

            // Camera setup
            // Viewer at 1.0001 (approx 600m above ground, safer for float precision than 1m)
            vec3 ro = vec3(0.0, 1.0001, 0.0); 
            vec3 rd = normalize(vec3(p.x, p.y + 0.5, -1.0)); 

            // Sun Direction
            vec3 sunDir = normalize(vec3(u_sun_pos, -1.0)); 

            // Check intersection with Earth (Occlusion)
            vec2 earthHit = raySphere(ro, rd, EARTH_RADIUS);
            bool isEarth = earthHit.x > 0.0;

            // Check intersection with atmosphere
            vec2 hit = raySphere(ro, rd, ATMOSPHERE_RADIUS);
            
            // Default to black/space
            vec3 color = vec3(0.0);
            
            if (!isEarth && hit.y > 0.0) {
                float rayLen = hit.y; 

                // Ray march (only if looking at sky)
                vec3 totalRayleigh = vec3(0.0);
                vec3 totalMie = vec3(0.0);
                float opticalDepthR = 0.0;
                float opticalDepthM = 0.0;

                float stepSize = rayLen / float(STEPS);
                vec3 currentPos = ro;

                for (int i = 0; i < STEPS; i++) {
                    vec3 samplePos = currentPos + rd * (stepSize * 0.5);
                    float height = length(samplePos) - EARTH_RADIUS;
                    
                    if (height < 0.0) break; 

                    float hr = exp(-height / H_R) * stepSize;
                    float hm = exp(-height / H_M) * stepSize;

                    opticalDepthR += hr;
                    opticalDepthM += hm;

                    // Secondary ray to sun
                    float sunRayLen = raySphere(samplePos, sunDir, ATMOSPHERE_RADIUS).y;
                    float sHeight = height; 
                    float sOpticalDepthR = exp(-sHeight / H_R) * sunRayLen;
                    float sOpticalDepthM = exp(-sHeight / H_M) * sunRayLen;

                    vec3 tau = RAYLEIGH_COEFF * (opticalDepthR + sOpticalDepthR) + MIE_COEFF * 1.1 * (opticalDepthM + sOpticalDepthM);
                    vec3 attenuation = exp(-tau);

                    totalRayleigh += hr * attenuation;
                    totalMie += hm * attenuation;

                    currentPos += rd * stepSize;
                }

                // Phase functions
                float mu = dot(rd, sunDir);
                float phaseR = 3.0 / (16.0 * 3.14159) * (1.0 + mu * mu);
                float phaseM = 3.0 / (8.0 * 3.14159) * ((1.0 - G * G) * (1.0 + mu * mu)) / ((2.0 + G * G) * pow(1.0 + G * G - 2.0 * G * mu, 1.5));

                color = (totalRayleigh * phaseR * RAYLEIGH_COEFF + totalMie * phaseM * MIE_COEFF) * 80.0; 
            }
            
            // Draw Sun Disk (Screen Space)
            // Clamp sun Y to be at least at the horizon (-0.5) for glow calculation
            // This ensures the glow seems to come from the boundary when sun is low
            
            float horizonY = -0.5; // Approx horizon in screen space with current camera offset
            float sunY = u_sun_pos.y - 0.5;
            
            // The sun disk itself is drawn at actual position
            vec2 sunScreenPos = vec2(u_sun_pos.x, sunY); 
            float sunDist = length(p - sunScreenPos);
            float sunCore = smoothstep(0.04, 0.02, sunDist);
            
            // If earth hit, sun disk is occluded (0 core)
            if (isEarth) sunCore = 0.0;
            
            // 1. Circular bloom around the sun disk (keeps it round)
            vec2 sunDiff = p - sunScreenPos;
            float sunDistBloom = length(sunDiff);
            float sunBloom = exp(-sunDistBloom * 20.0) * 0.5; // Tighter, circular glow
            
            // Dim sun disk and bloom when near horizon (user request)
            // Sun sets at -0.5. Start dimming at 0.0 down to -0.5
            float diskDimming = smoothstep(-0.6, 0.2, u_sun_pos.y);
            sunCore *= diskDimming;
            sunBloom *= diskDimming;
            
            // 2. Anisotropic glare at the horizon boundary (sunset bleed)
            vec2 horizonGlowPos = vec2(u_sun_pos.x, max(sunY, horizonY));
            vec2 horizonGlowDiff = p - horizonGlowPos;
            horizonGlowDiff.y *= 3.0; // Flatten vertically
            float horizonGlowDist = length(horizonGlowDiff);
            
            // Glare intensity: fades out when sun is high, strong when sun is low
            float horizonGlowIntensity = clamp(1.0 - (u_sun_pos.y + 0.5) * 2.0, 0.0, 1.0); 
            // Also fade out if sun is too deep below
            float deepFade = clamp((u_sun_pos.y + 0.65) * 3.0, 0.0, 1.0);
            horizonGlowIntensity *= deepFade;

            float horizonGlare = exp(-horizonGlowDist * 4.0) * 0.8 * horizonGlowIntensity;
            
            // Combine components
            float sunIntensity = sunCore + sunBloom + horizonGlare;
            
            // Calc sun color (extinction)
            // Need accurate optical depth for sun 
            float sunRayLenCamera = raySphere(ro, sunDir, ATMOSPHERE_RADIUS).y;
            float odR = 0.0;
            float odM = 0.0;
            float dStep = sunRayLenCamera / 8.0;
            vec3 dPos = ro;
            for(int j=0; j<8; j++) {
                 vec3 sp = dPos + sunDir * (dStep * 0.5);
                 float h = length(sp) - EARTH_RADIUS;
                 odR += exp(-h / H_R) * dStep;
                 odM += exp(-h / H_M) * dStep;
                 dPos += sunDir * dStep;
            }
            
            vec3 sunExtinction = exp(-(RAYLEIGH_COEFF * odR + MIE_COEFF * 1.1 * odM));
            // Boost red channel slightly for the glow to make it look warmer
            vec3 sunColor = vec3(40.0) * sunExtinction; 
            
            color += sunColor * sunIntensity;

            // Tone mapping
            color = vec3(1.0) - exp(-color * 3.0);

            gl_FragColor = vec4(color, 1.0);
        }
    `;

    function compileShader(gl, source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vertexShader = compileShader(gl, vsSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return;
    }
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
        -1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
        -1.0, 1.0, 1.0, -1.0, 1.0, 1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const resolutionLoc = gl.getUniformLocation(program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const sunPosLoc = gl.getUniformLocation(program, 'u_sun_pos');

    let startTime = Date.now();

    // Get sun config from data attributes (Target Position)
    let targetSunX = parseFloat(canvas.dataset.sunX || "0.0");
    let targetSunY = parseFloat(canvas.dataset.sunY || "0.05");

    console.log("Sun Animation Debug:");
    console.log("Target Sun:", targetSunX, targetSunY);

    // Current Sun Position (starts at target by default)
    let currentSunX = targetSunX;
    let currentSunY = targetSunY;

    // Try to load previous position from sessionStorage
    try {
        const stored = sessionStorage.getItem('tales_sun_pos');
        if (stored) {
            const parts = stored.split(',');
            if (parts.length === 2) {
                currentSunX = parseFloat(parts[0]);
                currentSunY = parseFloat(parts[1]);
                console.log("Animation start pos loaded:", currentSunX, currentSunY);
            }
        }
    } catch (e) {
        console.warn("Error reading sessionStorage:", e);
    }

    // Save current position on unload
    function saveState() {
        sessionStorage.setItem('tales_sun_pos', `${currentSunX},${currentSunY}`);
    }
    window.addEventListener('beforeunload', saveState);
    if (document.visibilityState === 'hidden') saveState();

    // Interaction Logic (Touch & Mouse)
    let isDragging = false;

    function handleInput(x, y) {
        const rect = canvas.getBoundingClientRect();
        const u = (x - rect.left) / rect.width;
        const v = (y - rect.top) / rect.height;

        // Convert to Normalized Device Coordinates (-1 to 1)
        // Y is flipped (Canvas 0 at top, GL 0 at bottom)
        const ndcX = u * 2.0 - 1.0;
        const ndcY = (1.0 - v) * 2.0 - 1.0;

        // Account for Aspect Ratio on X
        const aspect = canvas.width / canvas.height;

        // Shader Expectation:
        // sunScreenPos = vec2(u_sun_pos.x, u_sun_pos.y - 0.5);
        // p.x *= aspect;

        // So targetX should be ndcX * aspect
        // targetY - 0.5 = ndcY  => targetY = ndcY + 0.5

        targetSunX = ndcX * aspect;
        targetSunY = ndcY + 0.5;

        // Instant update while dragging for responsiveness
        currentSunX = targetSunX;
        currentSunY = targetSunY;
    }

    function onMouseDown(e) {
        // Ignore clicks on links or buttons
        if (e.target.tagName === 'A' || e.target.closest('a') || e.target.tagName === 'BUTTON') return;

        isDragging = true;
        handleInput(e.clientX, e.clientY);
        canvas.style.cursor = 'grabbing';
    }

    function onMouseMove(e) {
        if (!isDragging) return;
        handleInput(e.clientX, e.clientY);
    }

    function onMouseUp() {
        if (isDragging) { } // Removed console.log
        isDragging = false;
        canvas.style.cursor = 'default';
    }

    function onTouchStart(e) {
        // Ignore touches on links
        if (e.target.tagName === 'A' || e.target.closest('a') || e.target.tagName === 'BUTTON') return;

        const touch = e.touches[0];
        isDragging = true;
        handleInput(touch.clientX, touch.clientY);

        // Prevent default to stop scrolling while dragging sun
        // But only if we successfully started dragging (not on a link)
        if (e.cancelable) e.preventDefault();
    }

    function onTouchMove(e) {
        if (!isDragging) return;
        const touch = e.touches[0];
        handleInput(touch.clientX, touch.clientY);
        if (e.cancelable) e.preventDefault();
    }

    function onTouchEnd() {
        isDragging = false;
    }

    // Attach listeners to the parent header to capture events bubbling up
    // even if they hit the text content above the canvas
    const headerElement = canvas.parentElement;

    if (headerElement) {
        // Mouse
        headerElement.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        // Touch - Use non-passive to allow preventDefault
        headerElement.addEventListener('touchstart', onTouchStart, { passive: false });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd);
    } else {
        console.warn("Header element not found for interaction binding");
    }


    function resize() {
        const header = canvas.closest('header');
        const width = canvas.offsetWidth;
        const height = header ? header.offsetHeight : 300;

        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
    }
    window.addEventListener('resize', resize);
    resize();

    // Text interference calculation
    // We want to know if the sun is behind text to darken the text shadow
    function updateTextShadow() {
        const header = canvas.parentElement;
        if (!header) return;

        const title = header.querySelector('h1');
        const intro = header.querySelector('.intro-text');

        // Sun Screen Position (Pixels relative to canvas top-left)
        // Inverse of handleInput logic
        const aspect = canvas.width / canvas.height;
        const ndcX = currentSunX / aspect;
        const ndcY = currentSunY - 0.5;

        // ndcX = u * 2 - 1  => u = (ndcX + 1) / 2
        // ndcY = (1 - v) * 2 - 1 => v = 1 - (ndcY + 1) / 2

        const u = (ndcX + 1.0) * 0.5;
        const v = 1.0 - (ndcY + 1.0) * 0.5;

        const sunPxX = u * canvas.width;
        const sunPxY = v * canvas.height;

        let minDist = 10000.0;

        // Helper to get distance to rect
        function distToRect(rect, x, y) {
            // Rect is relative to viewport, so we need to offset by canvas position if canvas isn't at 0,0 locally?
            // Canvas and text are both in header. Let's use getBoundingClientRect for both and compare.
            const canvasRect = canvas.getBoundingClientRect();
            const sunGlobalX = canvasRect.left + x;
            const sunGlobalY = canvasRect.top + y;

            // Find closest point in rect to sun
            const clampedX = Math.max(rect.left, Math.min(sunGlobalX, rect.right));
            const clampedY = Math.max(rect.top, Math.min(sunGlobalY, rect.bottom));

            const dx = sunGlobalX - clampedX;
            const dy = sunGlobalY - clampedY;
            return Math.sqrt(dx * dx + dy * dy);
        }

        if (title) minDist = Math.min(minDist, distToRect(title.getBoundingClientRect(), sunPxX, sunPxY));
        if (intro) minDist = Math.min(minDist, distToRect(intro.getBoundingClientRect(), sunPxX, sunPxY));

        // Normalize: 0px = 1.0 (full shadow), 250px = 0.0 (no extra shadow)
        const threshold = 250.0;
        const prox = Math.max(0.0, 1.0 - minDist / threshold);

        header.style.setProperty('--sun-prox', prox.toFixed(3));
    }

    function render() {
        const time = (Date.now() - startTime) / 1000;

        // Lerp towards target (if not dragging)
        if (!isDragging) {
            const lerpSpeed = 0.02;
            currentSunX += (targetSunX - currentSunX) * lerpSpeed;
            currentSunY += (targetSunY - currentSunY) * lerpSpeed;
        }

        gl.uniform1f(timeLoc, time);
        gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
        gl.uniform2f(sunPosLoc, currentSunX, currentSunY);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Update text shadow every frame
        updateTextShadow();

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

})();
