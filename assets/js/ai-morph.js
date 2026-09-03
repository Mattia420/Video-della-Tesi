/*
 * Scroll-morph gallery for the "Contenuti AI" section.
 * Vanilla re-implementation of a scatter -> line -> circle -> arc
 * card-morph effect: intro plays once on first view, then scroll
 * through the section morphs the circle into a bottom arc and
 * "shuffles" it. No external dependencies.
 */
(() => {
  const section = document.getElementById('ai-content');
  const stage = document.getElementById('aiMorphStage');
  const introEl = document.getElementById('aiMorphIntro');
  const revealEl = document.getElementById('aiMorphReveal');
  if (!section || !stage) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CARD_COUNT = 14;
  const CARD_W = 60;
  const CARD_H = 85;

  const palette = ['#a600ff', '#8f1fe0', '#7a12d9', '#6a10c4', '#c96bff', '#5c1fa3'];

  const cards = [];
  for (let i = 0; i < CARD_COUNT; i++) {
    const card = document.createElement('div');
    card.className = 'morph-card';
    const inner = document.createElement('div');
    inner.className = 'morph-card__inner';
    const front = document.createElement('div');
    front.className = 'morph-card__front';
    front.style.background = `linear-gradient(155deg, ${palette[i % palette.length]}, #1c0033)`;
    front.textContent = String(i + 1).padStart(2, '0');
    const back = document.createElement('div');
    back.className = 'morph-card__back';
    back.textContent = 'AI';
    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);
    stage.appendChild(card);
    cards.push(card);
  }

  const scatterPositions = cards.map(() => ({
    x: (Math.random() - 0.5) * 900,
    y: (Math.random() - 0.5) * 600,
    rotation: (Math.random() - 0.5) * 180,
    scale: 0.6,
    opacity: 0,
  }));

  let phase = 'scatter'; // scatter -> line -> circle
  let stageSize = { width: 0, height: 0 };

  function measure() {
    stageSize = { width: stage.clientWidth, height: stage.clientHeight };
  }
  measure();
  window.addEventListener('resize', measure);

  let introStarted = false;
  function startIntro() {
    if (introStarted) return;
    introStarted = true;
    if (prefersReducedMotion) {
      phase = 'circle';
      return;
    }
    setTimeout(() => { phase = 'line'; }, 400);
    setTimeout(() => { phase = 'circle'; }, 2000);
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) startIntro(); });
  }, { threshold: 0.15 });
  io.observe(section);

  function lerp(a, b, t) { return a * (1 - t) + b * t; }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  let mouseX = 0;
  window.addEventListener('mousemove', (e) => {
    const rect = section.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    mouseX = (relX / Math.max(rect.width, 1)) * 2 - 1;
  });

  let morphSmooth = 0;
  let rotateSmooth = 0;
  let parallaxSmooth = 0;

  function scrollProgress() {
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    return clamp(-rect.top / total, 0, 1);
  }

  function frame() {
    const progress = scrollProgress();
    const morphTarget = clamp(progress / 0.22, 0, 1);
    const rotateTarget = clamp((progress - 0.22) / 0.78, 0, 1);
    const parallaxTarget = mouseX * 60;

    const smoothing = prefersReducedMotion ? 1 : 0.09;
    morphSmooth += (morphTarget - morphSmooth) * smoothing;
    rotateSmooth += (rotateTarget - rotateSmooth) * smoothing;
    parallaxSmooth += (parallaxTarget - parallaxSmooth) * smoothing;

    // intro/reveal copy crossfade
    if (introEl && revealEl) {
      const introOpacity = phase === 'circle' ? clamp(1 - morphSmooth * 2, 0, 1) : (phase === 'scatter' ? 0 : 1);
      introEl.style.opacity = String(introOpacity);
      const revealOpacity = clamp((morphSmooth - 0.75) / 0.25, 0, 1);
      revealEl.style.opacity = String(revealOpacity);
      revealEl.style.transform = `translateY(${(1 - revealOpacity) * 16}px)`;
    }

    const total = cards.length;
    const isMobile = stageSize.width < 640;
    const minDim = Math.min(stageSize.width, stageSize.height) || 1;

    cards.forEach((card, i) => {
      let x, y, rotation, scale, opacity;

      if (phase === 'scatter') {
        ({ x, y, rotation, scale, opacity } = scatterPositions[i]);
      } else if (phase === 'line') {
        const spacing = 70;
        const totalWidth = total * spacing;
        x = i * spacing - totalWidth / 2;
        y = 0; rotation = 0; scale = 1; opacity = 1;
      } else {
        const circleRadius = Math.min(minDim * 0.32, 220);
        const circleAngle = (i / total) * 360;
        const circleRad = (circleAngle * Math.PI) / 180;
        const circlePos = {
          x: Math.cos(circleRad) * circleRadius,
          y: Math.sin(circleRad) * circleRadius,
          rotation: circleAngle + 90,
        };

        const baseRadius = Math.min(stageSize.width, stageSize.height * 1.5) || 1;
        const arcRadius = baseRadius * (isMobile ? 1.35 : 1.05);
        const arcApexY = stageSize.height * (isMobile ? 0.32 : 0.22);
        const arcCenterY = arcApexY + arcRadius;
        const spreadAngle = isMobile ? 100 : 130;
        const startAngle = -90 - spreadAngle / 2;
        const step = spreadAngle / (total - 1);
        const maxRotation = spreadAngle * 0.45;
        const boundedRotation = -rotateSmooth * maxRotation;
        const currentArcAngle = startAngle + i * step + boundedRotation;
        const arcRad = (currentArcAngle * Math.PI) / 180;
        const arcPos = {
          x: Math.cos(arcRad) * arcRadius + parallaxSmooth,
          y: Math.sin(arcRad) * arcRadius + arcCenterY,
          rotation: currentArcAngle + 90,
          scale: isMobile ? 1.3 : 1.7,
        };

        x = lerp(circlePos.x, arcPos.x, morphSmooth);
        y = lerp(circlePos.y, arcPos.y, morphSmooth);
        rotation = lerp(circlePos.rotation, arcPos.rotation, morphSmooth);
        scale = lerp(1, arcPos.scale, morphSmooth);
        opacity = 1;
      }

      card.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
      card.style.opacity = String(opacity);
    });

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
