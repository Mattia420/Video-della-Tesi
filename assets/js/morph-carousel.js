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
        <p class="ai-lightbox__loading" id="aiLightboxLoading" hidden></p>
        <div class="ai-lightbox__gallery" id="aiLightboxGallery"></div>
      </div>
    </div>
  `;
  document.body.appendChild(lightbox);

  const mediaEl = lightbox.querySelector('#aiLightboxMedia');
  const titleEl = lightbox.querySelector('#aiLightboxTitle');
  const descEl = lightbox.querySelector('#aiLightboxDesc');
  const loadingEl = lightbox.querySelector('#aiLightboxLoading');
  const galleryEl = lightbox.querySelector('#aiLightboxGallery');
  const closeBtn = lightbox.querySelector('.ai-lightbox__close');

  function openLightbox(data) {
    closeBtn.setAttribute('aria-label', (window.i18n && window.i18n.t('lightbox.close')) || 'Chiudi');
    titleEl.textContent = data.title;
    descEl.textContent = data.desc;
    mediaEl.innerHTML = '';
    mediaEl.className = 'ai-lightbox__media';
    galleryEl.innerHTML = '';
    loadingEl.hidden = true;

    if (data.type === 'figma' && data.figmaUrl) {
      const isDeck = data.figmaKind === 'deck';
      // Only the interactive UI/UX prototypes get the "loading, may take a
      // few seconds" indicator — a presentation deck (Graphic Design) just
      // fades the iframe in without it.
      const showLoadingUI = data.category === 'UI/UX Design';
      mediaEl.classList.add(isDeck ? 'ai-lightbox__media--deck' : 'ai-lightbox__media--figma');
      // Decks play back landscape, like the widescreen video frame.
      if (isDeck) mediaEl.classList.add('ai-lightbox__media--wide-video');

      let spinner = null;
      if (showLoadingUI) {
        loadingEl.textContent = (window.i18n && window.i18n.t('lightbox.loading')) || 'Caricamento del prototipo… può richiedere alcuni secondi.';
        loadingEl.hidden = false;
        spinner = document.createElement('div');
        spinner.className = 'ai-lightbox__spinner';
        spinner.setAttribute('aria-hidden', 'true');
        mediaEl.appendChild(spinner);
      }

      const iframe = document.createElement('iframe');
      iframe.className = 'is-loading';
      iframe.src = data.figmaUrl;
      iframe.setAttribute('allowfullscreen', '');
      iframe.title = data.title;
      iframe.addEventListener('load', () => {
        iframe.classList.remove('is-loading');
        if (spinner) spinner.remove();
        loadingEl.hidden = true;
      });
      mediaEl.appendChild(iframe);
    } else if (data.type === 'image' && data.image) {
      mediaEl.classList.add('ai-lightbox__media--image');
      const img = document.createElement('img');
      img.src = data.image;
      img.alt = data.title;
      mediaEl.appendChild(img);

      // Extra views of the same project (e.g. colour variants) — a small
      // thumbnail strip that swaps the main image in place, so the card
      // above only has to represent the project once.
      if (data.gallery && data.gallery.length > 1) {
        data.gallery.forEach((variant) => {
          const thumb = document.createElement('button');
          thumb.type = 'button';
          thumb.className = 'ai-lightbox__gallery-thumb';
          thumb.style.backgroundImage = `url('${variant.cover || variant.image}')`;
          thumb.setAttribute('aria-label', variant.label || data.title);
          if (variant.image === data.image) thumb.classList.add('is-active');
          thumb.addEventListener('click', () => {
            img.src = variant.image;
            galleryEl.querySelectorAll('.ai-lightbox__gallery-thumb').forEach((t) => t.classList.remove('is-active'));
            thumb.classList.add('is-active');
          });
          galleryEl.appendChild(thumb);
        });
      }
    } else if (data.video && data.video.includes('vimeo.com')) {
      const iframe = document.createElement('iframe');
      iframe.src = data.video;
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share');
      iframe.setAttribute('allowfullscreen', '');
      iframe.title = data.title;
      mediaEl.appendChild(iframe);
    } else if (data.video) {
      if (data.wide) mediaEl.classList.add('ai-lightbox__media--wide-video');
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
      const i18nKey = data.type === 'figma' ? 'lightbox.placeholderFigma' : data.type === 'image' ? 'lightbox.placeholderImage' : 'lightbox.placeholderVideo';
      const labels = { figma: 'Prototipo in arrivo', image: 'Grafica in arrivo' };
      placeholder.textContent = (window.i18n && window.i18n.t(i18nKey)) || labels[data.type] || 'Video in arrivo';
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
  // Close on any click that isn't on the media itself (video/iframe/image)
  // or the gallery thumbnails (which swap the image instead of closing) —
  // clicking the title, description, or anywhere else in/around the panel
  // goes back, so the X isn't the only way out.
  lightbox.addEventListener('click', (e) => {
    if (mediaEl.contains(e.target) || galleryEl.contains(e.target)) return;
    closeLightbox();
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  /* ---------- project text translation, keyed by each item's stable id ---------- */
  function translateItems(items) {
    if (!window.i18n) return;
    items.forEach((data) => {
      if (data.id) {
        const tr = window.i18n.project(data.id);
        if (tr) {
          data.title = tr.title;
          data.desc = tr.desc;
        }
      }
      if (data.categoryId) {
        const cat = window.i18n.category(data.categoryId);
        if (cat) data.category = cat;
      }
      if (data.gallery) {
        data.gallery.forEach((variant) => {
          if (!variant.key) return;
          const label = window.i18n.galleryLabel(data.id, variant.key);
          if (label) variant.label = label;
        });
      }
    });
  }

  /* ---------- one rotating-arc carousel instance ---------- */
  function createCarousel({ section, stage, introEl, revealEl, categoryEl, items }) {
    if (!section || !stage) return;

    // Translate up front so first paint (including a saved non-Italian
    // language) and the category-grouping pass below both see the final
    // text — cards/lightbox read data.title/desc/category live, so this
    // is the only place a fresh load needs to touch.
    translateItems(items);

    const cards = [];
    items.forEach((data, i) => {
      const card = document.createElement('div');
      card.className = 'morph-card';
      // Posters/flyers come in whatever ratio the design was made at, so
      // they get a taller box and "contain" fit instead of the video/AI
      // cards' fixed ratio + cover crop — otherwise most of the artwork
      // (titles, logos near the edges) gets cut off.
      if (data.type === 'image' || data.poster) card.classList.add('morph-card--poster');
      // Motion design pieces are shot/edited widescreen, so their cards get
      // a landscape box instead of the default portrait one.
      if (data.wide) card.classList.add('morph-card--wide');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', data.title);

      const inner = document.createElement('div');
      inner.className = 'morph-card__inner';
      const front = document.createElement('div');
      front.className = 'morph-card__front';
      if (data.cover) {
        // Some figma covers (the UI/UX phone mockups) are much narrower
        // than the card box — "cover" would crop the phone at top and
        // bottom, so they opt into the same "contain" + fill-color
        // treatment used for posters instead.
        const useContain = data.type === 'image' || data.coverContain;
        front.style.backgroundImage = `url('${data.cover}')`;
        front.style.backgroundSize = useContain ? 'contain' : 'cover';
        front.style.backgroundColor = useContain ? (data.cardBg || '#15121c') : '';
        front.style.backgroundRepeat = 'no-repeat';
        front.style.backgroundPosition = 'center';
        // Cards start tiny (60-96px) and scale up to ~3x in the arc; browsers
        // sometimes decode a background-image at the small on-screen size
        // first and only sharpen it up later, which reads as "low quality
        // until you interact with it". Decoding the full-resolution bitmap
        // off-DOM up front means it's already cached at full quality by the
        // time the card scales into focus.
        const warm = new Image();
        warm.decoding = 'async';
        warm.src = data.cover;
        if (warm.decode) warm.decode().catch(() => {});
      } else {
        front.style.background = `linear-gradient(155deg, ${PALETTE[i % PALETTE.length]}, #1c0033)`;
        front.textContent = String(i + 1).padStart(2, '0');
      }
      inner.appendChild(front);
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
    // Wide (landscape) cards are noticeably bigger than the default portrait
    // card box, so two of them back-to-back at the default 1-unit spacing
    // read as sitting closer together than any other pair — nudge them
    // apart a bit extra to match. Only needed within the same category:
    // a wide card next to a category change already gets the bigger
    // GROUP_GAP above.
    const WIDE_GAP = 0.45;
    const effectivePos = [];
    let gapAccum = 0;
    items.forEach((data, i) => {
      if (i > 0) {
        if (data.category !== items[i - 1].category) gapAccum += GROUP_GAP;
        else if (data.wide && items[i - 1].wide) gapAccum += WIDE_GAP;
      }
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

    // Re-translate already-built items/cards on a language switch. The
    // arc geometry (effectivePos, grouping) never depends on the text
    // itself, so this only needs to touch the DOM text and force the
    // floating category label to repaint on the next animation frame.
    document.addEventListener('site:lang-changed', () => {
      translateItems(items);
      cards.forEach((card, i) => { card.setAttribute('aria-label', items[i].title); });
      lastCategory = null;
    });

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

    function frame() {
      const progress = scrollProgress();
      const morphTarget = clamp(progress / 0.3, 0, 1);
      const wobbleTarget = clamp((progress - 0.3) / 0.7, 0, 1);

      const smoothing = prefersReducedMotion ? 1 : 0.09;
      morphSmooth += (morphTarget - morphSmooth) * smoothing;
      wobbleSmooth += (wobbleTarget - wobbleSmooth) * smoothing;
      // Snap fully to the target once the gap is imperceptible — otherwise
      // this exponential smoothing keeps nudging by fractions of a pixel
      // forever, which means card.style.transform below never repeats the
      // exact same string and the card never settles as "not animating".
      // A GPU compositor caches a lower-res raster for anything it treats
      // as still in motion (stretching it to size instead of re-drawing
      // the source bitmap at full resolution), which reads as "blurry
      // until you interact with it" — settling lets it re-rasterize sharp.
      if (Math.abs(morphTarget - morphSmooth) < 0.0005) morphSmooth = morphTarget;
      if (Math.abs(wobbleTarget - wobbleSmooth) < 0.0005) wobbleSmooth = wobbleTarget;

      if (introEl && revealEl) {
        const introOpacity = clamp(1 - morphSmooth * 2, 0, 1);
        introEl.style.opacity = String(introOpacity);
        const revealOpacity = clamp((morphSmooth - 0.75) / 0.25, 0, 1) * clamp(1 - (wobbleSmooth - 0.7) / 0.3, 0, 1);
        revealEl.style.opacity = String(revealOpacity);
        // Keep the CSS class's own -50% horizontal centering — this inline
        // style otherwise replaces it outright, leaving the label anchored
        // at its un-shifted left:50% position and overflowing the viewport.
        revealEl.style.transform = `translate(-50%, ${(1 - revealOpacity) * 16}px)`;
      }

      const minDim = Math.min(stageSize.width, stageSize.height) || 1;
      const { total, isMobile, visibleCount, halfSpreadDeg, anglePerCard, fadeRangeDeg, fadeHalfSpreadDeg, maxOffset } = computeLayout();
      // Start the window one card-slot short of centred on the very first
      // item — otherwise, the instant the arc finishes forming (wobble
      // still at 0), card 0 already sits right at the fade/viewport edge
      // with no room to its left, so it's cut off before the user has any
      // time to click it. Padding only the start (not maxOffset itself)
      // leaves the end of the scroll — the last cards — unchanged.
      const startPad = 2;
      const windowOffset = -startPad + wobbleSmooth * (maxOffset + startPad);
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

        // Mobile cards are proportionally bigger relative to the narrow
        // stage width, so the same 0.32 radius used on desktop leaves them
        // crowding in over the centred intro text — give them more room.
        const circleRadius = Math.min(minDim * (isMobile ? 0.44 : 0.32), 220);
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
        if (Math.abs(hoverTarget - card.__hoverSmooth) < 0.0005) card.__hoverSmooth = hoverTarget;

        // Skip the DOM write entirely once a card has settled (same string
        // as last frame) — see the smoothing snap above for why this is
        // what actually lets the browser rasterize it at full quality.
        const nextTransform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale * card.__hoverSmooth})`;
        if (nextTransform !== card.__lastTransform) {
          card.style.transform = nextTransform;
          card.__lastTransform = nextTransform;
        }
        const nextOpacity = String(opacity);
        if (nextOpacity !== card.__lastOpacity) {
          card.style.opacity = nextOpacity;
          card.__lastOpacity = nextOpacity;
        }
        card.style.pointerEvents = opacity < 0.05 ? 'none' : '';
      });

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- content data ---------- */
  const AI_ITEMS = [
    {
      id: 'telemea',
      title: 'Telemea — Solomonescu',
      desc: 'Spot pubblicitario generato con l\'intelligenza artificiale per il Telemea di Solomonescu, azienda casearia rumena, realizzato durante un periodo di lavoro in Romania.',
      video: 'assets/video/telemea-solomon-spot.mp4',
      cover: 'assets/img/telemea-solomon-cover.webp?v=2',
      type: 'video',
      category: 'Contenuti AI',
      categoryId: 'contenutiAi',
      badge: 'AI',
    },
    {
      id: 'black-white',
      title: 'Black & White',
      desc: 'Contenuto visivo generato con l\'intelligenza artificiale.',
      video: 'assets/video/black-and-white.mp4',
      cover: 'assets/img/black-and-white-cover.webp?v=2',
      type: 'video',
      category: 'Contenuti AI',
      categoryId: 'contenutiAi',
      badge: 'AI',
    },
    {
      id: 'genesis',
      title: 'Installazione Genesis',
      desc: 'Avatar creato tramite intelligenza artificiale che canta una canzone reale, utilizzato in un\'installazione chiamata Genesis, a Barcellona.',
      video: 'assets/video/corolla.mp4',
      cover: 'assets/img/corolla-cover.webp',
      type: 'video',
      category: 'Contenuti AI',
      categoryId: 'contenutiAi',
      badge: 'AI',
    },
    {
      id: 'redbull',
      title: 'Red Bull Green Edition — Spot',
      desc: 'Concept di spot pubblicitario generato con l\'intelligenza artificiale.',
      video: 'assets/video/redbull-spot.mp4',
      cover: 'assets/img/redbull-spot-cover.webp?v=2',
      type: 'video',
      category: 'Contenuti AI',
      categoryId: 'contenutiAi',
      badge: 'AI',
    },
    {
      id: 'hopy',
      title: 'Hopy',
      desc: 'Spot pubblicitario generato con l\'intelligenza artificiale per Hopy, linea cosmetica a base di canapa di TiliLab.',
      video: 'assets/video/hopy-spot.mp4',
      cover: 'assets/img/hopy-spot-cover.webp',
      type: 'video',
      category: 'Contenuti AI',
      categoryId: 'contenutiAi',
      badge: 'AI',
    },
  ];

  // Placeholder items for work not yet uploaded — swap video/image/figmaUrl
  // in as real files/links come in, same pattern as the AI overrides above.
  const OTHER_ITEMS = [
    {
      id: 'zoona-vinyl',
      title: 'Zoona Vinyl — Open Decks',
      desc: 'Locandina per una serata open decks in vinile, disegnata su misura per il brand dell\'evento.',
      type: 'image',
      category: 'Graphic Design',
      categoryId: 'graphicDesign',
      badge: 'GD',
      image: 'assets/img/open-decks.webp',
      cover: 'assets/img/open-decks-cover.webp?v=2',
    },
    {
      id: 'elektronik-summerfest',
      title: 'Elektronik Summerfest',
      desc: 'Locandina per un evento tekno con musica live, disegnata su misura per il brand della serata.',
      type: 'image',
      category: 'Graphic Design',
      categoryId: 'graphicDesign',
      badge: 'GD',
      image: 'assets/img/elektronik-summerfest.webp',
      cover: 'assets/img/elektronik-summerfest-cover.webp?v=2',
    },
    {
      id: 'touch-of-beauty',
      title: 'Touch of Beauty — Presentazione',
      desc: 'Presentazione del brand Touch of Beauty, navigabile slide per slide.',
      type: 'figma',
      category: 'Graphic Design',
      categoryId: 'graphicDesign',
      badge: 'GD',
      // Same card size as the other Graphic Design posters/flyers, even
      // though this one opens as a figma deck rather than a plain image.
      poster: true,
      figmaUrl: 'https://embed.figma.com/deck/7g65MmoCigEi0K7Vzhi4ty/Touch-of-Beauty-%7C-Presentation--Copy-?node-id=1-559&t=Qc40Qai1cRm8ujqa-1&embed-host=share',
      figmaKind: 'deck',
      cover: 'assets/img/touch-of-beauty-cover.webp',
    },
    {
      id: 'smart-home',
      title: 'Smart Home — App Design',
      desc: 'Prototipo interattivo di un\'app per la gestione della smart home, navigabile schermata per schermata.',
      type: 'figma',
      category: 'UI/UX Design',
      categoryId: 'uiuxDesign',
      badge: 'UX',
      figmaUrl: 'https://embed.figma.com/proto/qsAKaRUSjtsC116hsVKzkx/Smart-Home---Esame-App-Design-colorato-super?node-id=423-1823&t=SZbr9mx5Bmd2BxqS-1&starting-point-node-id=423%3A1823&embed-host=share&hide-ui=1',
      coverContain: true,
      cardBg: '#000000',
      cover: 'assets/img/smart-home-cover.webp',
    },
    {
      id: 'underground',
      title: 'Underground — Website',
      desc: 'Prototipo interattivo, navigabile schermata per schermata.',
      type: 'figma',
      category: 'UI/UX Design',
      categoryId: 'uiuxDesign',
      badge: 'UX',
      figmaUrl: 'https://embed.figma.com/proto/x33ltOsDcfo6juWomFtQRL/Untitled?node-id=3-452&p=f&t=13H4pYlpdgXzjNJg-0&page-id=0%3A1&embed-host=share&hide-ui=1',
      coverContain: true,
      cardBg: '#000000',
      cover: 'assets/img/underground-cover.webp',
    },
    {
      id: 'festillu',
      title: 'Festillu — Website',
      desc: 'Prototipo interattivo del sito di Festillu, un festival immaginario, navigabile pagina per pagina.',
      type: 'figma',
      category: 'UI/UX Design',
      categoryId: 'uiuxDesign',
      badge: 'UX',
      figmaUrl: 'https://embed.figma.com/proto/cGf7mdGIqd6ll97oSJkmuT/FESTILLU-%7C-Website?node-id=137-37&p=f&page-id=69%3A2&starting-point-node-id=137%3A37&embed-host=share&hide-ui=1',
      coverContain: true,
      cardBg: '#000000',
      cover: 'assets/img/festillu-cover.webp',
    },
    {
      id: 'motion-studio',
      title: 'Motion Studio Production',
      desc: 'Motion design per la promozione di uno studio di produzione video, tra editing, montaggio e sound design.',
      type: 'video',
      category: 'Motion Design',
      categoryId: 'motionDesign',
      badge: 'VID',
      wide: true,
      video: 'assets/video/motion-studio-production.mp4',
      cover: 'assets/img/motion-studio-cover.webp',
    },
    {
      id: 'accademia-impresa',
      title: 'Accademia di Impresa',
      desc: 'Video animato esplicativo per Accademia di Impresa, su forme giuridiche e scelte societarie.',
      type: 'video',
      category: 'Motion Design',
      categoryId: 'motionDesign',
      badge: 'VID',
      wide: true,
      video: 'assets/video/accademia-di-impresa.mp4',
      cover: 'assets/img/accademia-di-impresa-cover.webp',
    },
  ];

  /* ---------- one merged carousel: AI content + everything else, category label swaps live ---------- */
  createCarousel({
    section: document.getElementById('work-carousel'),
    stage: document.getElementById('workCarouselStage'),
    introEl: document.getElementById('workCarouselIntro'),
    revealEl: document.getElementById('workCarouselReveal'),
    categoryEl: document.getElementById('workCarouselCategory'),
    // Category order: Graphic Design, Motion Design, Contenuti AI, UI/UX
    // Design. OTHER_ITEMS is already Graphic-then-UIUX-then-Motion, so
    // filtering out UI/UX and appending it after AI reorders without
    // touching the item data itself.
    items: [
      ...OTHER_ITEMS.filter((d) => d.category !== 'UI/UX Design'),
      ...AI_ITEMS,
      ...OTHER_ITEMS.filter((d) => d.category === 'UI/UX Design'),
    ],
  });
})();
