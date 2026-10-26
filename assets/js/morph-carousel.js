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

  const panelEl = lightbox.querySelector('.ai-lightbox__panel');
  const mediaEl = lightbox.querySelector('#aiLightboxMedia');
  const titleEl = lightbox.querySelector('#aiLightboxTitle');
  const descEl = lightbox.querySelector('#aiLightboxDesc');
  const loadingEl = lightbox.querySelector('#aiLightboxLoading');
  const galleryEl = lightbox.querySelector('#aiLightboxGallery');
  const closeBtn = lightbox.querySelector('.ai-lightbox__close');

  // The page's scroll position when the lightbox opened, restored on close.
  let savedScrollY = 0;

  // Shared by the Figma prototype view (mobile only) and the Touch of
  // Beauty slide deck (every screen size): lets the open media take over
  // the whole screen edge-to-edge. CSS-only, not the Fullscreen API —
  // iOS Safari's support for requestFullscreen() on anything but a
  // <video> is unreliable, where this works the same everywhere.
  function createFullscreenButton() {
    const fsBtn = document.createElement('button');
    fsBtn.type = 'button';
    fsBtn.className = 'ai-lightbox__fullscreen-btn';
    fsBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    fsBtn.setAttribute('aria-label', (window.i18n && window.i18n.t('lightbox.fullscreen')) || 'Schermo intero');
    fsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // .ai-lightbox__panel has its own transform (the open/close scale
      // animation), which makes it the containing block for any
      // position:fixed descendant — "fixed" would resolve against the
      // panel instead of the real viewport. Dropping the panel's
      // transform for as long as the media is fullscreen fixes that
      // without moving the media element itself in the DOM — reparenting
      // an iframe would reload it and throw away wherever the person had
      // navigated to inside the prototype.
      const entering = !mediaEl.classList.contains('is-fullscreen');
      panelEl.classList.toggle('ai-lightbox__panel--media-fullscreen', entering);
      mediaEl.classList.toggle('is-fullscreen', entering);
    });
    return fsBtn;
  }

  function openLightbox(data) {
    // Re-entrant call while already open (a stray click reaching a card
    // underneath, a doubled event, two triggers firing back to back) would
    // read window.scrollY as 0 below — the body is already locked via
    // position:fixed from the first open, which is what makes it read 0 —
    // and stomp savedScrollY with that, so closing later snaps to the top
    // of the page instead of back where the person actually was.
    if (lightbox.classList.contains('is-open')) return;
    closeBtn.setAttribute('aria-label', (window.i18n && window.i18n.t('lightbox.close')) || 'Chiudi');
    titleEl.textContent = data.title;
    descEl.textContent = data.desc;
    mediaEl.innerHTML = '';
    mediaEl.className = 'ai-lightbox__media';
    // A many-slide presentation needs most of the panel's own width for
    // itself — stack it above the text instead of squeezing both into the
    // same row.
    panelEl.classList.toggle('ai-lightbox__panel--stacked', data.type === 'slides');
    galleryEl.innerHTML = '';
    loadingEl.hidden = true;

    if (data.type === 'slides' && data.slidesCount) {
      mediaEl.classList.add('ai-lightbox__media--slides');
      let current = 0;
      const img = document.createElement('img');
      img.alt = data.title;
      const counter = document.createElement('div');
      counter.className = 'ai-lightbox__slide-counter';
      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'ai-lightbox__slide-nav ai-lightbox__slide-nav--prev';
      prevBtn.innerHTML = '&#8249;';
      prevBtn.setAttribute('aria-label', (window.i18n && window.i18n.t('lightbox.prevSlide')) || 'Slide precedente');
      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'ai-lightbox__slide-nav ai-lightbox__slide-nav--next';
      nextBtn.innerHTML = '&#8250;';
      nextBtn.setAttribute('aria-label', (window.i18n && window.i18n.t('lightbox.nextSlide')) || 'Slide successiva');

      const renderSlide = () => {
        img.src = `${data.slidesPrefix}${String(current + 1).padStart(2, '0')}.webp`;
        counter.textContent = `${current + 1} / ${data.slidesCount}`;
        prevBtn.disabled = current === 0;
        nextBtn.disabled = current === data.slidesCount - 1;
      };
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (current > 0) { current--; renderSlide(); }
      });
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (current < data.slidesCount - 1) { current++; renderSlide(); }
      });
      renderSlide();

      mediaEl.appendChild(img);
      mediaEl.appendChild(prevBtn);
      mediaEl.appendChild(nextBtn);
      mediaEl.appendChild(counter);
      // Offered on every screen size, not just mobile — a presentation
      // benefits from a proper fullscreen look regardless of device.
      const slidesFsBtn = createFullscreenButton();
      slidesFsBtn.classList.add('ai-lightbox__fullscreen-btn--always');
      mediaEl.appendChild(slidesFsBtn);
    } else if (data.type === 'figma' && data.figmaUrl) {
      // Figma's own embed is slow to boot (it's loading its full canvas
      // runtime, not just a static page), so every figma embed gets the
      // "loading" indicator, not just the interactive UI/UX prototypes.
      mediaEl.classList.add('ai-lightbox__media--figma');

      loadingEl.textContent = (window.i18n && window.i18n.t('lightbox.loading')) || 'Caricamento del prototipo… può richiedere alcuni secondi.';
      loadingEl.hidden = false;
      const spinner = document.createElement('div');
      spinner.className = 'ai-lightbox__spinner';
      spinner.setAttribute('aria-hidden', 'true');
      mediaEl.appendChild(spinner);

      const iframe = document.createElement('iframe');
      iframe.className = 'is-loading';
      iframe.src = data.figmaUrl;
      iframe.setAttribute('allowfullscreen', '');
      iframe.title = data.title;
      iframe.addEventListener('load', () => {
        iframe.classList.remove('is-loading');
        spinner.remove();
        loadingEl.hidden = true;
      });
      mediaEl.appendChild(iframe);
      if (!data.noFullscreen) {
        // On a phone, the boxed preview is still small next to a real app —
        // let it take over the whole screen instead, so navigating the
        // prototype feels like using the actual app rather than peering at
        // it inside a card. Offered on mobile only (see the fullscreen
        // button's default display:none, overridden there) — on desktop
        // the box is already roomy.
        mediaEl.appendChild(createFullscreenButton());
      }
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
      video.play().catch(() => { /* autoplay with sound can be blocked — controls are there to start it manually */ });
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'ai-lightbox__placeholder';
      const i18nKey = data.type === 'figma' ? 'lightbox.placeholderFigma' : data.type === 'image' ? 'lightbox.placeholderImage' : 'lightbox.placeholderVideo';
      const labels = { figma: 'Prototipo in arrivo', image: 'Grafica in arrivo' };
      placeholder.textContent = (window.i18n && window.i18n.t(i18nKey)) || labels[data.type] || 'Video in arrivo';
      mediaEl.appendChild(placeholder);
    }
    lightbox.classList.add('is-open');
    // `body { overflow: hidden }` alone doesn't reliably block touch-driven
    // scrolling on mobile (a long-standing iOS Safari gap, inconsistent
    // elsewhere too) — the page could still be dragged underneath the open
    // lightbox, landing far from where it was once closed. Freezing the
    // body in place with position: fixed genuinely can't scroll, since
    // it's taken out of the document's own scrollable flow; the negative
    // top offset keeps it visually exactly where it was, and closeLightbox
    // restores both the styles and the real scroll position afterwards.
    savedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    // Lenis intercepts wheel/touch scrolling on the whole page, which would
    // otherwise swallow scroll input meant for .ai-lightbox's own
    // overflow-y (needed when a long description or a gallery pushes the
    // panel taller than the viewport) — suspend it while the lightbox is
    // open, same as the mobile menu does.
    if (window.lenis && typeof window.lenis.stop === 'function') window.lenis.stop();
  }

  function closeLightbox() {
    // Already closed — bail before a second/duplicate call (overlapping
    // triggers, a doubled event) redundantly re-runs the scroll restore
    // below against whatever the page has scrolled to since the first
    // call actually closed it.
    if (!lightbox.classList.contains('is-open')) return;
    lightbox.classList.remove('is-open');
    mediaEl.classList.remove('is-fullscreen');
    panelEl.classList.remove('ai-lightbox__panel--media-fullscreen');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    // Freezing the body with position: fixed takes it out of the document's
    // normal flow, so document.documentElement.scrollHeight collapses to
    // roughly one viewport height for as long as the lightbox stays open.
    // Lenis watches that height with a (debounced, ~250ms) ResizeObserver
    // to know how far down the page can scroll — if the lightbox is open
    // longer than that debounce, which it normally is, Lenis recomputes
    // its scroll limit against the collapsed height and clamps any
    // scrollTo to roughly zero. Calling resize() here, now that the real
    // layout is back, forces it to recompute against the correct height
    // before the scrollTo below runs.
    if (window.lenis && typeof window.lenis.resize === 'function') window.lenis.resize();
    // Restoring the native scroll directly (window.scrollTo) and separately
    // telling Lenis about it (lenis.scrollTo) raced: window.scrollTo fires
    // its own native 'scroll' event asynchronously, which Lenis's own
    // listener can pick up and use to resync — stepping on whichever of
    // the two calls happened to land last. Lenis's own scrollTo does both
    // atomically (it sets the native position itself via the same call
    // that updates its internal tracked value), so it's the only call
    // needed; only fall back to a plain native scrollTo if Lenis isn't on
    // this page at all.
    if (window.lenis && typeof window.lenis.start === 'function') {
      window.lenis.start();
      if (typeof window.lenis.scrollTo === 'function') {
        window.lenis.scrollTo(savedScrollY, { immediate: true, force: true });
      } else {
        window.scrollTo(0, savedScrollY);
      }
    } else {
      window.scrollTo(0, savedScrollY);
    }
    const video = mediaEl.querySelector('video');
    if (video) video.pause();
    const iframe = mediaEl.querySelector('iframe');
    if (iframe) iframe.src = iframe.src; // stops Vimeo/Figma playback on close
  }

  // Without stopPropagation this click also bubbles to the lightbox's own
  // "click outside media" listener below (the close button isn't inside
  // mediaEl/galleryEl, so that handler doesn't skip it) — closeLightbox()
  // ran twice per click, harmlessly before it only reset a couple of CSS
  // properties, but now races the scroll-position restore below against
  // itself.
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeLightbox(); });
  // Close on any click that isn't on the media itself (video/iframe/image)
  // or the gallery thumbnails (which swap the image instead of closing) —
  // clicking the title, description, or anywhere else in/around the panel
  // goes back, so the X isn't the only way out.
  lightbox.addEventListener('click', (e) => {
    if (mediaEl.contains(e.target) || galleryEl.contains(e.target)) return;
    closeLightbox();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Step back out of fullscreen first — Escape closing the whole
      // lightbox from there would skip past the view the person was
      // actually just looking at.
      if (mediaEl.classList.contains('is-fullscreen')) {
        panelEl.classList.remove('ai-lightbox__panel--media-fullscreen');
        mediaEl.classList.remove('is-fullscreen');
        return;
      }
      closeLightbox();
      return;
    }
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'ArrowRight') mediaEl.querySelector('.ai-lightbox__slide-nav--next')?.click();
    else if (e.key === 'ArrowLeft') mediaEl.querySelector('.ai-lightbox__slide-nav--prev')?.click();
  });

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
      // Hover doesn't move the scroll position, so it needs its own wake
      // call — the settled loop below only listens for scroll by default.
      card.addEventListener('mouseenter', () => { card.style.zIndex = '999'; card.__hover = true; wake(); });
      card.addEventListener('mouseleave', () => { card.__hover = false; card.style.zIndex = ''; card.__baseZ && (card.style.zIndex = card.__baseZ); wake(); });
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

    // The fan is driven entirely by vertical page scroll progress through
    // this (very tall) section — a horizontal wheel/trackpad swipe or
    // finger swipe across it does nothing by default, so both are
    // redirected into that same vertical scroll by hand. Scoped to this
    // section specifically (not a sitewide Lenis setting) — turning it on
    // for the whole page meant a slightly diagonal wheel/trackpad wobble
    // anywhere else (e.g. reading through the skills list) could get
    // misread as a horizontal scroll instead of a vertical one, reading as
    // the page stuttering or refusing to scroll there.
    function scrollBy(delta) {
      if (!delta) return;
      // The lightbox sits above this section and is meant to own every
      // wheel/touch gesture while it's open (see openLightbox/closeLightbox)
      // — but pointer-events on it flips back to none the instant it
      // closes, mid-transition and possibly mid-gesture. A touch that
      // started on a card, or a wheel/trackpad flick still landing right as
      // the lightbox closes, could otherwise reach this handler and jump
      // the page by whatever stale delta it computes, reading as the page
      // "resetting" right after closing a prototype.
      if (lightbox.classList.contains('is-open')) return;
      if (window.lenis && typeof window.lenis.scrollTo === 'function') {
        window.lenis.scrollTo(window.lenis.scroll + delta, { immediate: true });
      } else {
        window.scrollTo(0, window.scrollY + delta);
      }
    }
    section.addEventListener('wheel', (e) => {
      // Only hijack when the gesture is mostly horizontal — a normal
      // vertical wheel/trackpad scroll (deltaX ~ 0) is left untouched so
      // Lenis keeps handling it exactly as before.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      scrollBy(e.deltaX);
    }, { passive: false });
    let touchStartX = 0, touchStartY = 0, touchLastX = 0, touchActive = false, touchDecided = false, touchIsHorizontal = false;
    section.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      touchStartX = touchLastX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchActive = true;
      touchDecided = false;
    }, { passive: true });
    section.addEventListener('touchmove', (e) => {
      if (!touchActive || e.touches.length !== 1) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      if (!touchDecided) {
        // Decide the gesture's axis on its very first move, however small —
        // a browser that's let even one native touchmove through has
        // already committed to its own (vertical) scroll for the rest of
        // the gesture, so there's no "wait and see" window to use here.
        touchIsHorizontal = Math.abs(x - touchStartX) >= Math.abs(y - touchStartY);
        touchDecided = true;
        if (!touchIsHorizontal) { touchActive = false; return; }
      }
      e.preventDefault();
      // Swiping left (finger moves toward lower x) advances the fan, same
      // direction a natural-scrolling trackpad swipe does.
      scrollBy(touchLastX - x);
      touchLastX = x;
    }, { passive: false });
    section.addEventListener('touchend', () => { touchActive = false; }, { passive: true });

    let morphSmooth = 0;
    let wobbleSmooth = 0;
    let lastCategory = null;
    let lastFrameTime = 0;

    // frame() below used to call requestAnimationFrame(frame) unconditionally,
    // forever — meaning its per-frame work (scrollProgress()'s
    // getBoundingClientRect call, a trig pass over every card) kept running
    // at a full 60fps even with this section scrolled far out of view, e.g.
    // while the person was down in Skills. getBoundingClientRect forces a
    // synchronous layout read, and Skills' own accordion is *also* animating
    // height every frame while open — two independent per-frame layout-
    // forcing loops compounding is exactly what read as stutter specifically
    // when opening a skill, and sustained enough main-thread pressure is a
    // known way mobile Safari decides a tab is unresponsive and kills it.
    // Pausing the loop (not rescheduling itself) whenever the section is
    // nowhere near the viewport, and waking it back up via this observer
    // when it next approaches, removes that cost entirely while it can't
    // matter to anyone anyway.
    let isNearViewport = true;
    const visibilityObserver = new IntersectionObserver((entries) => {
      const wasNear = isNearViewport;
      isNearViewport = entries[entries.length - 1].isIntersecting;
      if (isNearViewport && !wasNear) wake();
    }, { rootMargin: '50% 0px 50% 0px' });
    visibilityObserver.observe(section);

    // The visibility check above only covers being scrolled far away — this
    // section is tall enough (it's the whole fan) that its tail end is
    // still literally on screen while reading Skills right below it, so
    // isNearViewport stays true there and the loop above kept running at a
    // full, pointless 60fps: morphSmooth/wobbleSmooth had long since reached
    // their target (nothing left to ease toward while scroll position isn't
    // changing), yet every single frame still re-ran scrollProgress()'s
    // forced layout read plus a full pass over every card. That's exactly
    // the kind of background cost that, stacked on top of Skills' own
    // accordion work, read as stutter right where the user is actually
    // interacting. Stopping the loop once it's provably converged — and
    // only a real scroll event (not a timer) waking it back up — removes
    // that cost while nothing is actually moving, with no visible effect
    // since there was nothing left to animate anyway.
    let rafActive = true;
    function wake() {
      if (rafActive || !isNearViewport) return;
      rafActive = true;
      requestAnimationFrame(frame);
    }
    window.addEventListener('scroll', wake, { passive: true });

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
      const now = performance.now();
      // Clamp dt so a dropped/backgrounded tab (dt could be seconds) doesn't
      // make the very next frame jump straight to its target instead of
      // easing — the carousel just resumes mid-ease when the tab returns.
      const dt = lastFrameTime ? Math.min(now - lastFrameTime, 100) : 1000 / 60;
      lastFrameTime = now;
      // Set by the per-card loop below if any card's hover scale is still
      // easing toward its target — those don't move the scroll position,
      // so the overall morph/wobble settle check further down can't see
      // them on its own.
      let anyHoverEasing = false;

      const progress = scrollProgress();
      const morphTarget = clamp(progress / 0.3, 0, 1);
      const wobbleTarget = clamp((progress - 0.3) / 0.7, 0, 1);

      // The 0.09/frame figure below was tuned by eye at a steady 60fps. On a
      // phone under load that rate dips and swings (45fps one tick, 20fps
      // the next), and a fixed per-frame factor tracks the target faster or
      // slower with every such swing — which reads as the fan snapping
      // forward in uneven bursts rather than gliding. Re-deriving the
      // factor from the actual elapsed time keeps the eased motion's real
      // (wall-clock) speed constant no matter how choppy the frame rate is.
      const perFrameSmoothing = 0.09;
      const smoothing = prefersReducedMotion ? 1 : 1 - Math.pow(1 - perFrameSmoothing, dt / (1000 / 60));
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

      // People reached straight for a card the instant the fan was on
      // screen, before ever scrolling — a static "scroll to explore" line
      // wasn't a strong enough signal once there was something clickable-
      // looking to grab instead. Blurring the whole stage up front removes
      // that temptation (a blurred card doesn't read as "ready to click"),
      // and clearing the blur fast — well before the circle has visibly
      // started morphing into the fan — rewards the very first bit of
      // scroll with an immediate, legible payoff instead of a slow reveal.
      const blurProgress = clamp(morphSmooth / 0.06, 0, 1);
      const blurPx = (1 - blurProgress) * 14;
      stage.style.filter = blurPx > 0.05 ? `blur(${blurPx}px)` : '';

      if (introEl && revealEl) {
        const introOpacity = 1 - blurProgress;
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
        // The circle's centre sits at a fixed fraction of the stage's own
        // height (38% on mobile, 50% on desktop) — on a short viewport
        // (a real phone with its address bar/toolbar visible eats a lot
        // of the "100svh" this is based on) that fraction lands close
        // enough to the top edge that the topmost card's blur, which
        // needs clear space on every side to fade instead of stopping
        // dead, gets clipped by .ai-morph__sticky's overflow: hidden —
        // a visible hard edge instead of a soft one. Shrinking the
        // radius to whatever vertical room is actually available (never
        // below 40px, so it never collapses to nothing) fixes that on
        // short viewports without changing anything on normal ones,
        // where this never ends up smaller than the existing cap below.
        const anchorY = stageSize.height * (isMobile ? 0.38 : 0.5);
        const tallestCardHalfHeight = isMobile ? 61 : 48;
        const blurClearance = 34;
        const maxRadiusByHeight = Math.min(anchorY, stageSize.height - anchorY) - tallestCardHalfHeight - blurClearance;
        const circleRadius = Math.min(minDim * (isMobile ? 0.44 : 0.32), 220, Math.max(maxRadiusByHeight, 40));
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
        // Shifted up from the title's own position (not down from it) —
        // the arc used to settle noticeably below the category label, with
        // a wide empty gap between the two. The previous pass pushed this
        // too far the other way and started overlapping the title on some
        // categories; backed off to a value checked against the minimum
        // gap across all four categories (Contenuti AI/Graphic/Motion/
        // UI-UX Design) on both breakpoints, not just one scroll depth.
        const baseY = stageSize.height * (isMobile ? 0.05 : -0.105);

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
        // Per-item size multiplier (e.g. Genesis at 1.1) — applied on top of
        // the shared circle/arc scale so one card can read larger than the
        // rest without a whole separate size system.
        //
        // The card's own CSS box is sized to the arc's (largest) on-screen
        // footprint directly (see .morph-card in style.css) — scaling goes
        // from a fraction of that up to exactly 1, never beyond it. A card
        // that's native-sized at its biggest and only ever shrinks reads
        // sharp at every point in between; one that starts small and gets
        // stretched up to 3x, the previous approach, spends the whole
        // animation visibly softer than its own source image actually is.
        scale = lerp(1 / arcScale, 1, morphSmooth) * (items[i].scale || 1);
        opacity = lerp(1, arcVisibility, morphSmooth);

        const baseZ = Math.round(100 - Math.abs(effectivePos[i] - centerIndex));
        card.__baseZ = String(baseZ);
        if (document.activeElement !== card) card.style.zIndex = card.style.zIndex === '999' ? '999' : String(baseZ);

        const hoverTarget = card.__hover ? 1.12 : 1;
        const hoverSmoothing = prefersReducedMotion ? 1 : 1 - Math.pow(1 - 0.2, dt / (1000 / 60));
        card.__hoverSmooth += (hoverTarget - card.__hoverSmooth) * hoverSmoothing;
        if (Math.abs(hoverTarget - card.__hoverSmooth) < 0.0005) card.__hoverSmooth = hoverTarget;
        else anyHoverEasing = true;

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
        // Still visibly blurred means still "not ready" — block clicks so
        // an impatient click before the blur clears does nothing instead
        // of confusingly opening whatever happened to be under the cursor.
        card.style.pointerEvents = (opacity < 0.05 || blurPx > 0.5) ? 'none' : '';
      });

      const settled = morphSmooth === morphTarget && wobbleSmooth === wobbleTarget && !anyHoverEasing;
      if (isNearViewport && !settled) {
        requestAnimationFrame(frame);
      } else {
        rafActive = false;
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- content data ---------- */
  const AI_ITEMS = [
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
      id: 'genesis',
      title: 'Installazione Genesis',
      desc: 'Avatar creato tramite intelligenza artificiale che canta una canzone reale, utilizzato in un\'installazione chiamata Genesis, a Barcellona.',
      video: 'assets/video/corolla.mp4',
      cover: 'assets/img/corolla-cover.webp',
      type: 'video',
      category: 'Contenuti AI',
      categoryId: 'contenutiAi',
      badge: 'AI',
      // Bumped up 10% relative to every other card, at the user's request.
      scale: 1.1,
    },
    {
      id: 'hopy',
      title: 'Hopy',
      desc: 'Spot pubblicitario generato con l\'intelligenza artificiale per Hopy, linea cosmetica a base di canapa di TiliLab, pensato per il pubblico rumeno — da qui la voce fuori campo in rumeno.',
      video: 'assets/video/hopy-spot.mp4',
      cover: 'assets/img/hopy-spot-cover.webp',
      type: 'video',
      category: 'Contenuti AI',
      categoryId: 'contenutiAi',
      badge: 'AI',
    },
    {
      id: 'black-white',
      title: 'Black & White',
      desc: 'Contenuto visivo generato con l\'intelligenza artificiale, creato per pubblicizzare una canzone.',
      video: 'assets/video/black-and-white.mp4',
      cover: 'assets/img/black-and-white-cover.webp?v=2',
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
      cover: 'assets/img/open-decks-cover.webp?v=3',
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
      cover: 'assets/img/elektronik-summerfest-cover.webp?v=3',
    },
    {
      id: 'touch-of-beauty',
      title: 'Touch of Beauty — Presentazione',
      desc: 'Rebranding realizzato per il salone di questa parrucchiera, presentato slide per slide.',
      // Rendered to a set of static webp slides instead of embedding the
      // Figma deck — loads instantly, costs ~1.4MB for all 56 slides
      // combined (vs. booting Figma's whole canvas runtime just to look
      // at a presentation), and gets real prev/next paging.
      type: 'slides',
      slidesPrefix: 'assets/img/touch-of-beauty/slide-',
      slidesCount: 37,
      category: 'Graphic Design',
      categoryId: 'graphicDesign',
      badge: 'GD',
      // Same card size as the other Graphic Design posters/flyers.
      poster: true,
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
      noFullscreen: true,
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
  // The UI/UX prototypes are heavy Figma embeds (full canvas runtime inside
  // an iframe) — on phones they've caused occasional lag and page reloads
  // under memory pressure, so they're left out of the mobile carousel
  // entirely rather than just skipping the iframe load on tap.
  const isMobileViewport = window.matchMedia('(max-width: 760px)').matches;
  const ALL_ITEMS = [
    ...OTHER_ITEMS.filter((d) => d.category !== 'UI/UX Design'),
    ...AI_ITEMS,
    ...(isMobileViewport ? [] : OTHER_ITEMS.filter((d) => d.category === 'UI/UX Design')),
  ];

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
    items: ALL_ITEMS,
  });
})();
