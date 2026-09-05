/*
 * Scroll-morph gallery for the "Contenuti AI" section.
 * Cards start already arranged in a circle (no scatter/line intro), and
 * scrolling through the section morphs the circle into a rotating bottom
 * arc. Clicking a card opens a lightbox with title, description and
 * video. No external dependencies.
 */
(() => {
  const section = document.getElementById('ai-content');
  const stage = document.getElementById('aiMorphStage');
  const introEl = document.getElementById('aiMorphIntro');
  const revealEl = document.getElementById('aiMorphReveal');
  if (!section || !stage) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CARD_COUNT = 10;
  const palette = ['#a600ff', '#8f1fe0', '#7a12d9', '#6a10c4', '#c96bff', '#5c1fa3'];
  const DESCS = [
    'Post per campagna social generato con l\'AI.',
    'Creatività per ads a pagamento.',
    'Contenuto video sviluppato con l\'intelligenza artificiale.',
    'Visual per il lancio di un prodotto.',
  ];

  // Per-card overrides for real content as it comes in.
  const VIDEO_OVERRIDES = {
    0: {
      title: 'Telemea Solomon — Spot',
      desc: 'Spot pubblicitario generato con l\'intelligenza artificiale.',
      video: 'assets/video/telemea-solomon-spot.mp4',
      cover: 'assets/img/telemea-solomon-cover.webp',
    },
  };

  const CONTENT = Array.from({ length: CARD_COUNT }, (_, i) => ({
    title: `Contenuto AI ${String(i + 1).padStart(2, '0')}`,
    desc: DESCS[i % DESCS.length],
    video: '', // set to a real video URL/path when available
    cover: '', // set to the video's first-frame thumbnail when available
    ...VIDEO_OVERRIDES[i],
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
    if (data.cover) {
      front.style.backgroundImage = `url('${data.cover}')`;
      front.style.backgroundSize = 'cover';
      front.style.backgroundPosition = 'center';
    } else {
      front.style.background = `linear-gradient(155deg, ${palette[i % palette.length]}, #1c0033)`;
      front.textContent = String(i + 1).padStart(2, '0');
    }
    const back = document.createElement('div');
    back.className = 'morph-card__back';
    back.textContent = 'AI';
    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);

    card.__hover = false;
    card.__hoverSmooth = 1;
    card.addEventListener('mouseenter', () => { card.style.zIndex = '999'; card.__hover = true; });
    card.addEventListener('mouseleave', () => { card.__hover = false; card.style.zIndex = ''; card.__baseZ && (card.style.zIndex = card.__baseZ); });
    card.addEventListener('click', () => openLightbox(data));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(data); } });

    stage.appendChild(card);
    cards.push(card);
  });

  let stageSize = { width: 0, height: 0 };
  function measure() { stageSize = { width: stage.clientWidth, height: stage.clientHeight }; }
  measure();
  window.addEventListener('resize', measure);

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
    // Two sequential phases across the section's scroll range: form the
    // arc, then keep rotating the same circular wheel — the window slides
    // far enough that even the last cards swing off past the arc's left
    // edge and fade out, all through the one rotation (no separate slide).
    const morphTarget = clamp(progress / 0.3, 0, 1);
    const wobbleTarget = clamp((progress - 0.3) / 0.7, 0, 1);

    const smoothing = prefersReducedMotion ? 1 : 0.09;
    morphSmooth += (morphTarget - morphSmooth) * smoothing;
    wobbleSmooth += (wobbleTarget - wobbleSmooth) * smoothing;

    if (introEl && revealEl) {
      const introOpacity = clamp(1 - morphSmooth * 2, 0, 1);
      introEl.style.opacity = String(introOpacity);
      const revealOpacity = clamp((morphSmooth - 0.75) / 0.25, 0, 1) * clamp(1 - (wobbleSmooth - 0.7) / 0.3, 0, 1);
      revealEl.style.opacity = String(revealOpacity);
      revealEl.style.transform = `translateY(${(1 - revealOpacity) * 16}px)`;
    }

    const total = cards.length;
    const isMobile = stageSize.width < 640;
    const minDim = Math.min(stageSize.width, stageSize.height) || 1;

    // Windowed rotating carousel: only VISIBLE_COUNT cards sit inside the
    // visible arc spread at a time. Continued scroll (wobbleSmooth) slides
    // the window across the full card set, rotating new cards in from the
    // right and out to the left — counter-clockwise along the arc.
    const visibleCount = isMobile ? 4 : 6;
    // Narrower spread than the visual arc looks (40/34deg half-spread) so
    // that a single circle radius can drive both x and y — equal angle
    // steps then give exactly equal spacing between every card, unlike an
    // ellipse where x and y use different radii.
    const spreadDeg = isMobile ? 68 : 80;
    const halfSpreadDeg = spreadDeg / 2;
    const anglePerCard = spreadDeg / Math.max(1, visibleCount - 1);
    // Keep rotating past the point where the last window is centered, far
    // enough that the final cards swing beyond the fade-out edge too — the
    // whole set exits through the same circular motion, not a bolted-on
    // slide.
    const fadeRangeDeg = anglePerCard;
    // The resting window's edge cards (i=0 and i=visibleCount-1) sit exactly
    // at +/-halfSpreadDeg, right on the fade boundary — push the boundary
    // out by an extra margin so they stay fully opaque at rest instead of
    // clipping the instant the arc forms.
    const fadeMarginDeg = anglePerCard * 0.75;
    const fadeHalfSpreadDeg = halfSpreadDeg + fadeMarginDeg;
    const maxOffset = Math.max(0, (total - 1) - (visibleCount - 1) / 2 + (fadeHalfSpreadDeg + fadeRangeDeg) / anglePerCard);
    const windowOffset = wobbleSmooth * maxOffset;

    cards.forEach((card, i) => {
      let x, y, rotation, scale, opacity;

      const circleRadius = Math.min(minDim * 0.32, 220);
      const circleAngle = (i / total) * 360;
      const circleRad = (circleAngle * Math.PI) / 180;
      const circlePos = {
        x: Math.cos(circleRad) * circleRadius,
        y: Math.sin(circleRad) * circleRadius,
        rotation: circleAngle + 90,
      };

      // Position on the rotating arc: each card gets a slot angle based on
      // its index and the current window offset, so the whole set reads
      // as a wheel of cards passing behind a fixed visible window.
      const thetaDeg = (i - windowOffset - (visibleCount - 1) / 2) * anglePerCard;
      const thetaRad = (thetaDeg * Math.PI) / 180;

      // Single true-circle radius drives both axes: x = R sin(theta),
      // y = baseY + R (1 - cos(theta)). Equal angular steps then land at
      // exactly equal chord distances, so card spacing never varies.
      const fullSpan = stageSize.width * (isMobile ? 0.92 : 0.86);
      const halfSpreadRad = (halfSpreadDeg * Math.PI) / 180;
      const radius = fullSpan / (2 * Math.sin(halfSpreadRad));
      const baseY = stageSize.height * (isMobile ? 0.1 : 0.06);

      const arcPos = {
        x: radius * Math.sin(thetaRad),
        y: baseY + radius * (1 - Math.cos(thetaRad)),
        rotation: thetaDeg * 0.55,
      };
      const arcScale = isMobile ? 2.1 : 3.1;

      // Cards outside the visible spread fade out instead of piling up
      // off-screen, keeping only ~visibleCount cards on view at once.
      const arcVisibility = clamp(1 - (Math.abs(thetaDeg) - fadeHalfSpreadDeg) / fadeRangeDeg, 0, 1);

      x = lerp(circlePos.x, arcPos.x, morphSmooth);
      y = lerp(circlePos.y, arcPos.y, morphSmooth);
      rotation = lerp(circlePos.rotation, arcPos.rotation, morphSmooth);
      scale = lerp(1, arcScale, morphSmooth);
      opacity = lerp(1, arcVisibility, morphSmooth);

      const centerIndex = windowOffset + (visibleCount - 1) / 2;
      const baseZ = Math.round(100 - Math.abs(i - centerIndex));
      card.__baseZ = String(baseZ);
      if (document.activeElement !== card) card.style.zIndex = card.style.zIndex === '999' ? '999' : String(baseZ);

      const hoverTarget = card.__hover ? 1.12 : 1;
      card.__hoverSmooth += (hoverTarget - card.__hoverSmooth) * (prefersReducedMotion ? 1 : 0.2);

      card.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale * card.__hoverSmooth})`;
      card.style.opacity = String(opacity);
      card.style.pointerEvents = opacity < 0.05 ? 'none' : '';
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
    if (data.video && data.video.includes('vimeo.com')) {
      const iframe = document.createElement('iframe');
      iframe.src = data.video;
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share');
      iframe.setAttribute('allowfullscreen', '');
      iframe.title = data.title;
      mediaEl.appendChild(iframe);
    } else if (data.video) {
      const video = document.createElement('video');
      video.src = data.video;
      video.autoplay = true;
      video.muted = false;
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
    const iframe = mediaEl.querySelector('iframe');
    if (iframe) iframe.src = iframe.src; // stops Vimeo playback on close
  }

  closeBtn.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
})();
