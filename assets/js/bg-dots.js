/*
 * Canvas dot-grid background: dots sit on a fixed grid and ease away
 * from the cursor when it comes near, glowing brighter the closer it
 * gets. Vanilla rebuild of the "dots repel from mouse" pattern, no
 * external dependencies.
 */
(() => {
  const canvas = document.getElementById('bgDots');
  if (!canvas) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(max-width: 860px)').matches;
  if (prefersReducedMotion || isTouch) return;

  const ctx = canvas.getContext('2d');
  const SPACING = 34;
  const DOT_RADIUS = 1.4;
  const REPEL_RADIUS = 110;
  const REPEL_STRENGTH = 22;
  const EASE = 0.14;
  const GLOW_RADIUS = REPEL_RADIUS * 1.3;

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0, height = 0;
  let dots = [];
  let mouseX = -9999, mouseY = -9999;
  let mouseActive = false;

  function buildDots() {
    dots = [];
    const cols = Math.ceil(width / SPACING);
    const rows = Math.ceil(height / SPACING);
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const bx = c * SPACING;
        const by = r * SPACING;
        dots.push({
          bx, by, x: bx, y: by,
          baseOpacity: 0.16 + ((r + c) % 3) * 0.08,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildDots();
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX; mouseY = e.clientY; mouseActive = true;
    canvas.classList.add('is-ready');
  });
  window.addEventListener('mouseleave', () => { mouseActive = false; });

  let t = 0;
  function frame() {
    t += 0.016;
    ctx.clearRect(0, 0, width, height);

    for (const d of dots) {
      let targetX = d.bx;
      let targetY = d.by;

      if (mouseActive) {
        const dx = d.bx - mouseX;
        const dy = d.by - mouseY;
        const dist = Math.hypot(dx, dy);
        if (dist < REPEL_RADIUS && dist > 0.01) {
          const force = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH;
          targetX = d.bx + (dx / dist) * force;
          targetY = d.by + (dy / dist) * force;
        }
      }

      d.x += (targetX - d.x) * EASE;
      d.y += (targetY - d.y) * EASE;

      const pulse = 0.5 + 0.5 * Math.sin(t * 1.1 + d.phase);
      let opacity = d.baseOpacity * (0.6 + pulse * 0.6);

      if (mouseActive) {
        const dist = Math.hypot(d.bx - mouseX, d.by - mouseY);
        if (dist < GLOW_RADIUS) {
          opacity = Math.min(1, opacity + (1 - dist / GLOW_RADIUS) * 0.65);
        }
      }

      ctx.beginPath();
      ctx.arc(d.x, d.y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(166, 0, 255, ${opacity.toFixed(3)})`;
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
