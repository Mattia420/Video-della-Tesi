/*
 * Scroll-morph gallery engine, generalised from the original "Contenuti AI"
 * carousel so it can drive multiple independent sections (and, for the
 * merged-circle variant, show a category label that updates live as the
 * wheel rotates). Cards start arranged in a circle; scrolling through the
 * section morphs the circle into a rotating bottom arc. Clicking a card
 * opens a shared lightbox (video, image, or an interactive Figma embed).
 * No external dependencies.
 */
(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PALETTE = ['#a600ff', '#8f1fe0', '#7a12d9', '#6a10c4', '#c96bff', '#5c1fa3'];

  function lerp(a, b, t) { return a * (1 - t) + b * t; }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  /* ---------- shared lightbox (one instance serves every carousel) ---------- */
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
    mediaEl.className = 'ai-lightbox__media';
    lightbox.classList.toggle('is-wide', data.type === 'figma');

    if (data.type === 'figma' && data.figmaUrl) {
      mediaEl.classList.add('ai-lightbox__media--figma');
      const iframe = document.createElement('iframe');
      iframe.src = data.figmaUrl;
      iframe.setAttribute('allowfullscreen', '');
      iframe.title = data.title;
      mediaEl.appendChild(iframe);
    } else if (data.type === 'image' && data.image) {
      mediaEl.classList.add('ai-lightbox__media--image');
      const img = document.createElement('img');
      img.src = data.image;
      img.alt = data.title;
      mediaEl.appendChild(img);
    } else if (data.video && data.video.includes('vimeo.com')) {
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
      const labels = { figma: 'Prototipo in arrivo', image: 'Grafica in arrivo' };
      placeholder.textContent = labels[data.type] || 'Video in arrivo';
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
    if (iframe) iframe.src = iframe.src; // stops Vimeo/Figma playback on close
  }

  closeBtn.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  /* ---------- one rotating-arc carousel instance ---------- */
  function createCarousel({ section, stage, introEl, revealEl, categoryEl, items }) {
    if (!section || !stage) return;

    const cards = [];
    items.forEach((data, i) => {
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
        front.style.background = `linear-gradient(155deg, ${PALETTE[i % PALETTE.length]}, #1c0033)`;
        front.textContent = String(i + 1).padStart(2, '0');
      }
      const back = document.createElement('div');
      back.className = 'morph-card__back';
      back.textContent = data.badge || 'AI';
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

    // Extra breathing room between category groups in the arc: each item's
    // "effective position" is its index plus any gap accumulated so far,
    // so a category boundary reads as a pause in the arc rather than an
    // arbitrary cut — the category heading above changes right as that
    // pause crosses center.
    const GROUP_GAP = 1.5;
    const effectivePos = [];
    let gapAccum = 0;
    items.forEach((data, i) => {
      if (i > 0 && data.category !== items[i - 1].category) gapAccum += GROUP_GAP;
      effectivePos.push(i + gapAccum);
    });
    const totalSpan = effectivePos.length ? effectivePos[effectivePos.length - 1] : 0;

    let stageSize = { width: 0, height: 0 };
    function measure() { stageSize = { width: stage.clientWidth, height: stage.clientHeight }; }
    measure();
    window.addEventListener('resize', measure);

    // Scroll distance scales with item count so every card keeps the same
    // on-screen dwell time regardless of how many items the section holds
    // (tuned from the original 10-item carousel: 380vh desktop / 320vh mobile).
    function applyHeight() {
      const perItem = window.innerWidth < 640 ? 32 : 38;
      section.style.height = `${items.length * perItem}vh`;
    }
    applyHeight();
    window.addEventListener('resize', applyHeight);

    let morphSmooth = 0;
    let wobbleSmooth = 0;
    let lastCategory = null;

    function scrollProgress() {
      const rect = section.getBoundingClientRect();
      const total = section.offsetHeight - window.innerHeight;
      if (total <= 0) return 0;
      return clamp(-rect.top / total, 0, 1);
    }

    // Arc geometry shared between the render loop and the click-to-scroll
    // helper below, so both agree on where each item sits in the window.
    function computeLayout() {
      const total = cards.length;
      const isMobile = stageSize.width < 640;
      const visibleCount = isMobile ? 4 : 6;
      const spreadDeg = isMobile ? 68 : 80;
      const halfSpreadDeg = spreadDeg / 2;
      const anglePerCard = spreadDeg / Math.max(1, visibleCount - 1);
      const fadeRangeDeg = anglePerCard;
      const fadeMarginDeg = anglePerCard * 0.75;
      const fadeHalfSpreadDeg = halfSpreadDeg + fadeMarginDeg;
      const maxOffset = Math.max(0, totalSpan - (visibleCount - 1) / 2 + (fadeHalfSpreadDeg + fadeRangeDeg) / anglePerCard);
      return { total, isMobile, visibleCount, spreadDeg, halfSpreadDeg, anglePerCard, fadeRangeDeg, fadeMarginDeg, fadeHalfSpreadDeg, maxOffset };
    }

    function scrollToCategory(category) {
      const idxs = [];
      items.forEach((it, i) => { if (it.category === category) idxs.push(i); });
      if (!idxs.length) return;
      const centerIdx = idxs[Math.floor(idxs.length / 2)];

      const { visibleCount, maxOffset } = computeLayout();
      const windowOffset = clamp(effectivePos[centerIdx] - (visibleCount - 1) / 2, 0, maxOffset);
      const wobbleTarget = maxOffset > 0 ? windowOffset / maxOffset : 0;
      const progress = clamp(0.3 + wobbleTarget * 0.7, 0, 1);

      const scrollRange = section.offsetHeight - window.innerHeight;
      const targetY = section.offsetTop + progress * scrollRange;

      if (window.lenis && typeof window.lenis.scrollTo === 'function') {
        window.lenis.scrollTo(targetY, { duration: 1.8 });
      } else {
        window.scrollTo({ top: targetY, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      }
    }
    if (categoryEl) section.scrollToCategory = scrollToCategory;

    function frame() {
      const progress = scrollProgress();
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

      const minDim = Math.min(stageSize.width, stageSize.height) || 1;
      const { total, isMobile, visibleCount, halfSpreadDeg, anglePerCard, fadeRangeDeg, fadeHalfSpreadDeg, maxOffset } = computeLayout();
      const windowOffset = wobbleSmooth * maxOffset;
      const centerIndex = windowOffset + (visibleCount - 1) / 2;

      if (categoryEl) {
        let nearestIndex = 0, nearestDist = Infinity;
        for (let k = 0; k < total; k++) {
          const d = Math.abs(effectivePos[k] - centerIndex);
          if (d < nearestDist) { nearestDist = d; nearestIndex = k; }
        }
        const cat = items[nearestIndex].category || '';
        if (cat !== lastCategory) {
          lastCategory = cat;
          categoryEl.textContent = cat;
        }
      }

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

        const thetaDeg = (effectivePos[i] - windowOffset - (visibleCount - 1) / 2) * anglePerCard;
        const thetaRad = (thetaDeg * Math.PI) / 180;

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

        const arcVisibility = clamp(1 - (Math.abs(thetaDeg) - fadeHalfSpreadDeg) / fadeRangeDeg, 0, 1);

        x = lerp(circlePos.x, arcPos.x, morphSmooth);
        y = lerp(circlePos.y, arcPos.y, morphSmooth);
        rotation = lerp(circlePos.rotation, arcPos.rotation, morphSmooth);
        scale = lerp(1, arcScale, morphSmooth);
        opacity = lerp(1, arcVisibility, morphSmooth);

        const baseZ = Math.round(100 - Math.abs(effectivePos[i] - centerIndex));
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
  }

  /* ---------- content data ---------- */
  const AI_DESCS = [
    'Post per campagna social generato con l\'AI.',
    'Creatività per ads a pagamento.',
    'Contenuto video sviluppato con l\'intelligenza artificiale.',
    'Visual per il lancio di un prodotto.',
  ];

  const AI_OVERRIDES = {
    0: {
      title: 'Telemea Solomon — Spot',
      desc: 'Spot pubblicitario generato con l\'intelligenza artificiale per Telemea Solomon, azienda casearia rumena, realizzato durante un periodo di lavoro in Romania.',
      video: 'assets/video/telemea-solomon-spot.mp4',
      cover: 'assets/img/telemea-solomon-cover.webp',
    },
    1: {
      title: 'Lunca Ilvei — Spot',
      desc: 'Spot pubblicitario generato con l\'intelligenza artificiale per Lunca Ilvei, azienda casearia rumena, realizzato durante un periodo di lavoro in Romania.',
      video: 'assets/video/lunca-ilvei-cheese.mp4',
      cover: 'assets/img/lunca-ilvei-cover.webp',
    },
    2: {
      title: 'Black & White',
      desc: 'Contenuto visivo generato con l\'intelligenza artificiale.',
      video: 'assets/video/black-and-white.mp4',
      cover: 'assets/img/black-and-white-cover.webp',
    },
    3: {
      title: 'Deserto di Sale',
      desc: 'Contenuto visivo generato con l\'intelligenza artificiale.',
      video: 'assets/video/deserto-di-sale.mp4',
      cover: 'assets/img/deserto-di-sale-cover.webp',
    },
    4: {
      title: 'Lunca Ilvei — Raclette',
      desc: 'Spot pubblicitario generato con l\'intelligenza artificiale per la linea Raclette di Lunca Ilvei, azienda casearia rumena, realizzato durante un periodo di lavoro in Romania.',
      video: 'assets/video/raclette-cheese.mp4',
      cover: 'assets/img/raclette-cheese-cover.webp',
    },
    5: {
      title: 'Red Bull Green Edition — Spot',
      desc: 'Concept di spot pubblicitario generato con l\'intelligenza artificiale.',
      video: 'assets/video/redbull-spot.mp4',
      cover: 'assets/img/redbull-spot-cover.webp',
    },
  };

  const AI_ITEMS = Array.from({ length: 10 }, (_, i) => ({
    title: `Contenuto AI ${String(i + 1).padStart(2, '0')}`,
    desc: AI_DESCS[i % AI_DESCS.length],
    video: '',
    cover: '',
    type: 'video',
    category: 'Contenuti AI',
    badge: 'AI',
    ...AI_OVERRIDES[i],
  }));

  // Placeholder items for work not yet uploaded — swap video/image/figmaUrl
  // in as real files/links come in, same pattern as the AI overrides above.
  const OTHER_ITEMS = [
    { title: 'Video Animato 01', desc: 'Motion design in arrivo.', type: 'video', category: 'Motion Design', badge: 'VID', video: '', cover: '' },
    { title: 'Video Animato 02', desc: 'Motion design in arrivo.', type: 'video', category: 'Motion Design', badge: 'VID', video: '', cover: '' },
    { title: 'Flyer 01', desc: 'Grafica in arrivo.', type: 'image', category: 'Graphic Design', badge: 'GD', image: '', cover: '' },
    { title: 'Flyer 02', desc: 'Grafica in arrivo.', type: 'image', category: 'Graphic Design', badge: 'GD', image: '', cover: '' },
    { title: 'Flyer 03', desc: 'Grafica in arrivo.', type: 'image', category: 'Graphic Design', badge: 'GD', image: '', cover: '' },
    { title: 'Prototipo 01', desc: 'Prototipo Figma in arrivo.', type: 'figma', category: 'UI/UX Design', badge: 'UX', figmaUrl: '', cover: '' },
    { title: 'Prototipo 02', desc: 'Prototipo Figma in arrivo.', type: 'figma', category: 'UI/UX Design', badge: 'UX', figmaUrl: '', cover: '' },
    { title: 'Prototipo 03', desc: 'Prototipo Figma in arrivo.', type: 'figma', category: 'UI/UX Design', badge: 'UX', figmaUrl: '', cover: '' },
  ];

  /* ---------- one merged carousel: AI content + everything else, category label swaps live ---------- */
  createCarousel({
    section: document.getElementById('work-carousel'),
    stage: document.getElementById('workCarouselStage'),
    introEl: document.getElementById('workCarouselIntro'),
    revealEl: document.getElementById('workCarouselReveal'),
    categoryEl: document.getElementById('workCarouselCategory'),
    items: [...AI_ITEMS, ...OTHER_ITEMS],
  });

  /* ---------- click-to-scroll: stack cards jump to their category, playing through the arc ---------- */
  document.querySelectorAll('[data-scroll-category]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const section = document.getElementById('work-carousel');
      if (!section || typeof section.scrollToCategory !== 'function') return;
      e.preventDefault();
      e.stopImmediatePropagation(); // pre-empt main.js's generic anchor handler, which would jump straight to the section top
      section.scrollToCategory(el.getAttribute('data-scroll-category'));
    });
  });
})();
