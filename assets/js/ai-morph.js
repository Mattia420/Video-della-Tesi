/*
 * Scroll-morph gallery for the "Contenuti AI" section.
 * Vanilla re-implementation of a scatter -> line -> circle -> arc
 * card-morph effect: intro plays once on first view, then scroll
 * through the section morphs the circle into a bottom arc (laid out
 * across the visible width so it always starts on-screen from the
 * first card). Clicking a card opens a lightbox with title,
 * description and video. No external dependencies.
 */
(() => {
  const section = document.getElementById('ai-content');
  const stage = document.getElementById('aiMorphStage');
  const introEl = document.getElementById('aiMorphIntro');
  const revealEl = document.getElementById('aiMorphReveal');
  if (!section || !stage) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CARD_COUNT = 14;
  const palette = ['#a600ff', '#8f1fe0', '#7a12d9', '#6a10c4', '#c96bff', '#5c1fa3'];
  const DESCS = [
    'Post per campagna social generato con l\'AI.',
    'Creatività per ads a pagamento.',
    'Contenuto video sviluppato con l\'intelligenza artificiale.',
    'Visual per il lancio di un prodotto.',
  ];

  const CONTENT = Array.from({ length: CARD_COUNT }, (_, i) => ({
    title: `Contenuto AI ${String(i + 1).padStart(2, '0')}`,
    desc: DESCS[i % DESCS.length],
    video: '', // set to a real video URL/path when available
  }));

  const cards = [];
  CONTENT.forEach((data, i) => {
    const card = document.createElement('div');
    card.className = 'morph-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', data.title);

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

    card.addEventListener('mouseenter', () => { card.style.zIndex = '999'; });
    card.addEventListener('mouseleave', () => { card.style.zIndex = ''; card.__baseZ && (card.style.zIndex = card.__baseZ); });
    card.addEventListener('click', () => openLightbox(data));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(data); } });

    stage.appendChild(card);
    cards.push(card);
  });

  const scatterPositions = cards.map(() => ({
    x: (Math.random() - 0.5) * 900,
    y: (Math.random() - 0.5) * 600,
    rotation: (Math.random() - 0.5) * 180,
    scale: 0.6,
    opacity: 0,
  }));

  let phase = 'scatter'; // scatter -> line -> circle
  let stageSize = { width: 0, height: 0 };
  function measure() { stageSize = { width: stage.clientWidth, height: stage.clientHeight }; }
  measure();
  window.addEventListener('resize', measure);

  let introStarted = false;
  function startIntro() {
    if (introStarted) return;
    introStarted = true;
    if (prefersReducedMotion) { phase = 'circle'; return; }
    setTimeout(() => { phase = 'line'; }, 400);
    setTimeout(() => { phase = 'circle'; }, 2000);
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) startIntro(); });
  }, { threshold: 0.15 });
  io.observe(section);

  function lerp(a, b, t) { return a * (1 - t) + b * t; }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  let morphSmooth = 0;
  let wobbleSmooth = 0;

  function scrollProgress() {
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    return clamp(-rect.top / total, 0, 1);
  }

  function frame() {
    const progress = scrollProgress();
    const morphTarget = clamp(progress / 0.4, 0, 1);
    const wobbleTarget = clamp((progress - 0.4) / 0.6, 0, 1);

    const smoothing = prefersReducedMotion ? 1 : 0.09;
    morphSmooth += (morphTarget - morphSmooth) * smoothing;
    wobbleSmooth += (wobbleTarget - wobbleSmooth) * smoothing;

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

    // gentle bounded wobble once the arc has formed — never enough to push
    // a card off the visible width, unlike the old radius-based shuffle.
    const wobble = Math.sin(wobbleSmooth * Math.PI * 1.6) * (stageSize.width * 0.025);

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

        // Arc laid out directly across the visible stage width, so card 0
        // always starts at the left edge on-screen instead of being
        // positioned by a huge off-screen radius.
        const t = total > 1 ? i / (total - 1) : 0.5;
        const fullSpan = stageSize.width * (isMobile ? 0.92 : 0.86);
        const archHeight = stageSize.height * (isMobile ? 0.14 : 0.22);
        const baseY = stageSize.height * (isMobile ? 0.38 : 0.3);
        const arcPos = {
          x: -fullSpan / 2 + t * fullSpan + wobble,
          y: baseY - archHeight * Math.sin(Math.PI * t),
          rotation: (t - 0.5) * (isMobile ? 24 : 32),
        };
        const arcScale = isMobile ? 2.1 : 3.1;

        x = lerp(circlePos.x, arcPos.x, morphSmooth);
        y = lerp(circlePos.y, arcPos.y, morphSmooth);
        rotation = lerp(circlePos.rotation, arcPos.rotation, morphSmooth);
        scale = lerp(1, arcScale, morphSmooth);
        opacity = 1;
      }

      const baseZ = Math.round(100 - Math.abs(i - (total - 1) / 2));
      card.__baseZ = String(baseZ);
      if (document.activeElement !== card) card.style.zIndex = card.style.zIndex === '999' ? '999' : String(baseZ);
      card.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
      card.style.opacity = String(opacity);
    });

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- lightbox ---------- */
  const lightbox = document.createElement('div');
  lightbox.className = 'ai-lightbox';
  lightbox.innerHTML = `
    <button class="ai-lightbox__close" type="button" aria-label="Chiudi">&times;</button>
    <div class="ai-lightbox__panel">
      <div class="ai-lightbox__media" id="aiLightboxMedia"></div>
      <div class="ai-lightbox__info">
        <h3 id="aiLightboxTitle"></h3>
        <p id="aiLightboxDesc"></p>
      </div>
    </div>
  `;
  document.body.appendChild(lightbox);

  const mediaEl = lightbox.querySelector('#aiLightboxMedia');
  const titleEl = lightbox.querySelector('#aiLightboxTitle');
  const descEl = lightbox.querySelector('#aiLightboxDesc');
  const closeBtn = lightbox.querySelector('.ai-lightbox__close');

  function openLightbox(data) {
    titleEl.textContent = data.title;
    descEl.textContent = data.desc;
    mediaEl.innerHTML = '';
    if (data.video) {
      const video = document.createElement('video');
      video.src = data.video;
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = true;
      mediaEl.appendChild(video);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'ai-lightbox__placeholder';
      placeholder.textContent = 'Video in arrivo';
      mediaEl.appendChild(placeholder);
    }
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
    const video = mediaEl.querySelector('video');
    if (video) video.pause();
  }

  closeBtn.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
})();
