(() => {
  const canvas = document.getElementById('bgShader');
  if (!canvas) return;

  const glOpts = { preserveDrawingBuffer: true, antialias: false };
  const gl = canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts);
  if (!gl) return; // no WebGL support: the plain --bg color underneath still holds up fine

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const VERTEX_SRC = `
    attribute vec2 a_position;
    varying vec2 vUv;
    void main() {
      vUv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // Simplex noise (Ashima Arts / Stefan Gustavson, MIT) + a small fbm on top,
  // used to paint a slow, flowing plasma rather than hard geometric shapes.
  const FRAGMENT_SRC = `
    precision highp float;
    varying vec2 vUv;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_scroll;
    uniform float u_velocity;

    vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
    vec2 mod289(vec2 x){return x - floor(x * (1.0/289.0)) * 289.0;}
    vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    float fbm(vec2 p) {
      float sum = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 5; i++) {
        sum += amp * snoise(p);
        p *= 2.0;
        amp *= 0.5;
      }
      return sum * 0.5 + 0.5;
    }

    void main() {
      vec2 p = vUv * vec2(u_resolution.x / u_resolution.y, 1.0) * 2.4;
      float t = u_time * (0.045 + u_velocity * 0.35);

      vec2 warp = vec2(fbm(p * 1.5 + t), fbm(p * 1.5 - t + 4.2));
      float n = fbm(p * 1.8 + warp * 0.8 + vec2(0.0, u_scroll * 1.6 - t * 0.15));
      n = smoothstep(0.32, 0.94, n);

      vec3 deep = vec3(0.006, 0.02, 0.013);
      vec3 mid  = vec3(0.028, 0.1, 0.055);
      vec3 bright = vec3(0.79, 1.0, 0.25);

      vec3 col = mix(deep, mid, n);
      col = mix(col, bright, pow(n, 10.0) * (0.3 + u_velocity * 0.35));

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertexShader = compile(gl.VERTEX_SHADER, VERTEX_SRC);
  const fragmentShader = compile(gl.FRAGMENT_SHADER, FRAGMENT_SRC);
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

  // Full-viewport triangle (covers clip space, avoids a quad + index buffer).
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const u_resolution = gl.getUniformLocation(program, 'u_resolution');
  const u_time = gl.getUniformLocation(program, 'u_time');
  const u_scroll = gl.getUniformLocation(program, 'u_scroll');
  const u_velocity = gl.getUniformLocation(program, 'u_velocity');

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  function resize() {
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  resize();
  window.addEventListener('resize', resize);

  let lastScrollY = window.scrollY;
  let velocity = 0;
  let scrollProgress = 0;

  function readScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    const delta = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    // smoothed, clamped scroll speed drives how turbulent the flow looks
    const target = Math.min(1, Math.abs(delta) / 60);
    velocity += (target - velocity) * 0.15;
  }
  window.addEventListener('scroll', readScroll, { passive: true });

  let start = null;
  function frame(now) {
    if (start === null) start = now;
    const elapsed = (now - start) / 1000;

    // decay velocity when the user stops scrolling
    velocity *= 0.96;

    gl.uniform2f(u_resolution, canvas.width, canvas.height);
    gl.uniform1f(u_time, prefersReducedMotion ? elapsed * 0.15 : elapsed);
    gl.uniform1f(u_scroll, scrollProgress);
    gl.uniform1f(u_velocity, prefersReducedMotion ? 0 : velocity);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
