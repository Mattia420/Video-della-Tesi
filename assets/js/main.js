document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();

  const isTouch = window.matchMedia('(max-width: 860px)').matches;

  /* =========================================================
     CUSTOM CURSOR — runs first and never touches GSAP, so a
     slow/blocked CDN script can't leave the page with no visible
     pointer at all (the OS cursor is only hidden once this
     actually succeeds — see the .custom-cursor-active CSS gate).
     ========================================================= */
  const cursor = document.getElementById('cursor');
  const cursorLabel = document.getElementById('cursorLabel');

  if (!isTouch && cursor) {
    document.body.classList.add('custom-cursor-active');

    let mx = 0, my = 0, cx = 0, cy = 0;
    let cursorRevealed = false;
    window.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      // Snap straight to the real position on the very first move instead of
      // lerping in from the (0,0) default — otherwise, until the mouse moves,
      // the dot sits stuck/invisible in the top-left corner.
      if (!cursorRevealed) {
        cx = mx; cy = my;
        cursorRevealed = true;
        cursor.classList.add('is-ready');
      }
    });

    (function tickCursor() {
      cx += (mx - cx) * 0.42;
      cy += (my - cy) * 0.42;
      cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(tickCursor);
    })();

    document.querySelectorAll('[data-cursor]').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        const type = el.getAttribute('data-cursor');
        cursor.classList.add(`is-${type}`);
        const label = el.getAttribute('data-cursor-label');
        // only show the label pill when there's real text — otherwise an
        // empty pill still renders next to the dot (reads as a magnifying
        // glass), even on plain buttons that never had a label to begin with
        if (label) {
          cursorLabel.textContent = label;
          cursor.classList.add('has-label');
        }
      });
      el.addEventListener('mouseleave', () => {
        const type = el.getAttribute('data-cursor');
        cursor.classList.remove(`is-${type}`);
        cursor.classList.remove('has-label');
        cursorLabel.textContent = '';
      });
    });
  }

  /* =========================================================
     MOBILE MENU — plain JS, no GSAP dependency
     ========================================================= */
  const navToggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  function closeMobileMenu() {
    mobileMenu.classList.remove('is-open');
    navToggle.classList.remove('is-active');
    document.body.classList.remove('menu-open');
    // Lenis intercepts wheel/touch scrolling itself, so overflow:hidden
    // on <body> alone doesn't stop it — pause it too while the full-
    // screen menu covers the page, or the page keeps scrolling behind it.
    if (window.lenis && typeof window.lenis.start === 'function') window.lenis.start();
  }
  navToggle.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('is-open');
    document.body.classList.toggle('menu-open', isOpen);
    if (window.lenis && typeof window.lenis.stop === 'function' && typeof window.lenis.start === 'function') {
      if (isOpen) window.lenis.stop(); else window.lenis.start();
    }
  });

  /* =========================================================
     CV LANGUAGE PICKER — "Scarica CV" opens a modal asking which
     language's PDF to download instead of linking straight to a file.
     Each option is a real <a download> link, so picking one downloads
     it natively; the modal just closes alongside it. Uses the same
     position:fixed body-freeze + Lenis resize-before-scrollTo dance as
     the project lightbox (morph-carousel.js) to survive being open
     longer than Lenis's debounced scroll-limit recalculation.
     ========================================================= */
  const cvTrigger = document.getElementById('cvDownloadTrigger');
  const cvPicker = document.getElementById('cvPicker');
  if (cvTrigger && cvPicker) {
    const cvPickerClose = document.getElementById('cvPickerClose');
    let cvSavedScrollY = 0;

    function openCvPicker() {
      cvPicker.classList.add('is-open');
      cvSavedScrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${cvSavedScrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      if (window.lenis && typeof window.lenis.stop === 'function') window.lenis.stop();
    }

    function closeCvPicker() {
      cvPicker.classList.remove('is-open');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (window.lenis && typeof window.lenis.resize === 'function') window.lenis.resize();
      if (window.lenis && typeof window.lenis.start === 'function') {
        window.lenis.start();
        if (typeof window.lenis.scrollTo === 'function') {
          window.lenis.scrollTo(cvSavedScrollY, { immediate: true, force: true });
        } else {
          window.scrollTo(0, cvSavedScrollY);
        }
      } else {
        window.scrollTo(0, cvSavedScrollY);
      }
    }

    cvTrigger.addEventListener('click', openCvPicker);
    if (cvPickerClose) cvPickerClose.addEventListener('click', closeCvPicker);
    // Picking a language link closes the modal alongside its native
    // download; clicking anywhere else inside the card (the heading)
    // does nothing; clicking the backdrop itself closes, same as the
    // lang picker / project lightbox.
    cvPicker.addEventListener('click', (e) => {
      if (e.target.closest('.cv-picker__btn')) { closeCvPicker(); return; }
      if (e.target.closest('.cv-picker__inner')) return;
      closeCvPicker();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && cvPicker.classList.contains('is-open')) closeCvPicker();
    });
  }

  /* =========================================================
     SKILLS ACCORDION — plain JS, no GSAP dependency
     ========================================================= */
  // Measured-height animation (0 <-> scrollHeight px, settling to 'auto'
  // once open) instead of the grid-template-rows: 0fr/1fr trick this used
  // to use. Both still reflow every frame — there's no CSS way around that
  // for an "auto height" animation that's also meant to push the items
  // below it down smoothly — but grid-template-rows additionally re-runs
  // CSS Grid's own track-sizing algorithm on every one of those frames,
  // which is measurably more expensive than interpolating a plain height
  // between two already-known pixel values. That showed up as this
  // specific panel's open/close animation visibly lagging.
  document.querySelectorAll('.skill-item__row').forEach((btn) => {
    const panel = btn.nextElementSibling;
    if (!panel || !panel.classList.contains('skill-item__panel')) return;
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        // Settled at height:auto from the last time this opened — snap to
        // the equivalent pixel value first (and force layout to register
        // it) so there's an actual starting point to animate down from,
        // instead of jumping straight from 'auto' to 0.
        panel.style.height = `${panel.scrollHeight}px`;
        panel.offsetHeight; // eslint-disable-line no-unused-expressions
        requestAnimationFrame(() => { panel.style.height = '0px'; });
      } else {
        panel.style.height = `${panel.scrollHeight}px`;
        panel.addEventListener('transitionend', function onDone(e) {
          if (e.propertyName !== 'height') return;
          panel.style.height = 'auto';
          panel.removeEventListener('transitionend', onDone);
        });
      }
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  /* =========================================================
     Everything below depends on GSAP/ScrollTrigger/Lenis having
     loaded from the CDN. Guard it so a blocked/slow CDN degrades
     to a static (but fully usable) layout instead of leaving
     reveal-up content, the preloader, etc. stuck forever.
     ========================================================= */
  if (typeof gsap === 'undefined') {
    console.warn('GSAP failed to load — animations disabled, static layout shown.');
    const preloaderEl = document.getElementById('preloader');
    if (preloaderEl) preloaderEl.style.display = 'none';
    document.body.classList.add('is-loaded');
    document.querySelectorAll('.reveal-up, .hero__portrait').forEach((el) => {
      el.style.opacity = 1;
      el.style.transform = 'none';
    });
    return;
  }

  /* =========================================================
     PRELOADER — deferred until a language is chosen (see i18n.js):
     the language picker sits over a blurred site first, and once a
     language is picked the site (hero photo + title included) must
     appear immediately, with no counting animation or fade-in delay.
     ========================================================= */
  const preloader = document.getElementById('preloader');
  let preloaderStarted = false;

  function startPreloader() {
    if (preloaderStarted) return;
    preloaderStarted = true;
    finishPreload();
  }

  if (document.documentElement.classList.contains('lang-ready')) {
    startPreloader();
  } else {
    document.addEventListener('site:lang-ready', startPreloader, { once: true });
  }

  function finishPreload() {
    preloader.style.display = 'none';
    document.body.classList.add('is-loaded');
    playHeroIntro();
  }

  /* =========================================================
     LENIS SMOOTH SCROLL + GSAP SCROLLTRIGGER SYNC
     ========================================================= */
  gsap.registerPlugin(ScrollTrigger);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lenis = null;

  if (!prefersReducedMotion && window.Lenis) {
    lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // gestureOrientation stays the default ('vertical') here on purpose:
      // it's a single setting for the whole page, and turning it on
      // globally so the work carousel could also read a horizontal swipe
      // meant any slightly diagonal wheel/trackpad wobble elsewhere (e.g.
      // reading through the skills list) could get misread as a
      // horizontal scroll instead of a vertical one, reading as the page
      // stuttering or refusing to scroll. The carousel gets its own
      // horizontal handling instead, scoped to just that section — see
      // morph-carousel.js.
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    window.lenis = lenis;
  }

  // smooth anchor navigation
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      closeMobileMenu();
      if (lenis) {
        lenis.scrollTo(target, { offset: 0, duration: 1.4 });
      } else {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  /* =========================================================
     MAGNETIC BUTTONS
     ========================================================= */
  if (!isTouch) {
    document.querySelectorAll('.btn--magnetic').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const relX = e.clientX - rect.left - rect.width / 2;
        const relY = e.clientY - rect.top - rect.height / 2;
        gsap.to(btn, { x: relX * 0.35, y: relY * 0.5, duration: 0.4, ease: 'power3.out' });
      });
      btn.addEventListener('mouseleave', () => {
        gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      });
    });
  }

  /* =========================================================
     NAV SHOW/HIDE ON SCROLL
     ========================================================= */
  const nav = document.getElementById('nav');
  let lastScroll = 0;

  const handleNavScroll = (scrollY) => {
    if (scrollY > 80) nav.classList.add('nav--scrolled'); else nav.classList.remove('nav--scrolled');
    if (scrollY > lastScroll && scrollY > 200) {
      nav.classList.add('nav--hidden');
    } else {
      nav.classList.remove('nav--hidden');
    }
    lastScroll = scrollY;
  };

  if (lenis) {
    lenis.on('scroll', ({ scroll }) => handleNavScroll(scroll));
  } else {
    window.addEventListener('scroll', () => handleNavScroll(window.scrollY));
  }

  /* =========================================================
     HERO INTRO ANIMATION (fires after preloader)
     ========================================================= */
  function playHeroIntro() {
    // Set directly to the final visible state — no fade/slide delay, the
    // portrait and title must be there the instant a language is picked.
    gsap.set('.hero__portrait', { opacity: 1 });
    gsap.set('.hero__title', { opacity: 1, y: 0 });
  }

  /* =========================================================
     SCROLL-TRIGGERED REVEALS
     ========================================================= */
  gsap.utils.toArray('.reveal-up').forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
      },
    });
  });

  /* =========================================================
     WORD-BY-WORD SCROLL REVEAL (site-wide text)
     Wraps each word in its own span, then scrubs opacity/blur across the
     whole run tied directly to scroll position (not time), so the text
     lights up progressively as it's scrolled through. Applied to every
     .word-reveal element (section tags/titles, About/globe paragraphs,
     skills list, contact heading) — not the hero title, which already
     has its own load-in entrance animation.

     Re-run on every 'site:lang-changed' (see i18n.js), not just once at
     load: i18n.js translates by writing el.textContent on data-i18n
     elements, which for anything under a .word-reveal wipes out the
     .word spans this effect depends on (and, before this listener
     existed, nothing ever rebuilt them) — so a language switch silently
     killed the effect for any text it touched. Re-splitting on every
     switch, after killing the previous tween/trigger, keeps it working
     no matter how many times the language changes.
     ========================================================= */
  function splitWords(node) {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (part === '') return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
          } else {
            const span = document.createElement('span');
            span.className = 'word';
            span.textContent = part;
            frag.appendChild(span);
          }
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        // Skips SVG content outright — the contact heading's handwriting-
        // style rotator word lives in an <svg>, and wrapping HTML spans
        // around its <text> content wouldn't render.
        if (child instanceof SVGElement) return;
        splitWords(child);
      }
    });
  }

  function setupWordReveal() {
    document.querySelectorAll('.word-reveal').forEach((el) => {
      if (el.__wordRevealTween) {
        el.__wordRevealTween.scrollTrigger && el.__wordRevealTween.scrollTrigger.kill();
        el.__wordRevealTween.kill();
        el.__wordRevealTween = null;
      }
      // Undo any previous .word wrapping before re-splitting — but only
      // the spans themselves, not the whole subtree: el.textContent = "
      // would also flatten real block structure inside el (e.g. the two
      // <p> children under .about__text, a flex column relying on each
      // <p> being its own flex item), turning every word into its own
      // flex item and stacking them one per line. Unwrapping just the
      // .word spans back to plain text nodes leaves <p>/<em>/etc. intact
      // for splitWords() to recurse into again below.
      el.querySelectorAll('.word').forEach((span) => {
        span.replaceWith(document.createTextNode(span.textContent));
      });
      el.normalize();
      splitWords(el);

      const words = el.querySelectorAll('.word');
      if (!words.length) return;
      gsap.set(words, { opacity: 0.25, filter: 'blur(4px)' });
      // On small screens there's much less scroll distance per section, so
      // a range tuned for desktop leaves text still mid-blur once it's
      // sitting in a comfortable reading position — start/finish the reveal
      // earlier (further down the viewport) so it's legible sooner.
      const isMobileViewport = window.matchMedia('(max-width: 760px)').matches;
      // The contact title sits inside an ~87svh closing section with almost
      // nothing scrollable below it (just a short footer) — there simply
      // isn't enough leftover page height for a scroll-scrubbed reveal (tied
      // to a start/end viewport range) to ever finish; it stayed stuck
      // mid-blur all the way to the bottom. Play it as a one-shot timed
      // tween instead, so it fully resolves shortly after the section comes
      // into view regardless of how much scroll room is left after it.
      // Once a word has actually finished revealing, drop the (by then
      // inert, always blur(0px)) filter inline style rather than leaving
      // it in place. Every browser tested promotes a filtered element to
      // its own compositing layer for as long as the property is set at
      // all, zero included — with ~200 of these words sitting permanently
      // revealed further up the page, that's ~200 layers the browser keeps
      // alive and has to recomposite on any nearby repaint, which is
      // exactly what made the skills accordion (just below this section,
      // itself reflowing every frame while it opens) visibly stutter.
      // Only on forward completion, not on reverse — clearing at the
      // hidden end would drop back to no-filter/full-opacity instead of
      // back to the pre-reveal blurred state.
      const isContactTitle = el.classList.contains('contact__title');
      if (isContactTitle) {
        el.__wordRevealTween = gsap.to(words, {
          opacity: 1,
          filter: 'blur(0px)',
          duration: 1,
          stagger: 0.04,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: isMobileViewport ? 'top 95%' : 'top 85%',
            toggleActions: 'play none none reverse',
          },
          onComplete: () => gsap.set(words, { clearProps: 'filter' }),
        });
      } else {
        el.__wordRevealTween = gsap.to(words, {
          opacity: 1,
          filter: 'blur(0px)',
          stagger: 0.05,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: isMobileViewport ? 'top 98%' : 'top 88%',
            end: isMobileViewport ? 'bottom 82%' : 'bottom 60%',
            scrub: 0.6,
          },
          onComplete: () => gsap.set(words, { clearProps: 'filter' }),
        });
      }
    });
  }

  setupWordReveal();
  document.addEventListener('site:lang-changed', setupWordReveal);
});

/* =========================================================
   CONTACT HEADING — handwriting-style rotating word ("...Parliamone
   e [creiamo/ideiamo/...] insieme."). Each word is "drawn" as an SVG
   stroke (stroke-dasharray reveal), then fills solid white, holds,
   fades out, and the next word draws in its place. The wrapper's
   width is measured per word and transitioned so the trailing
   "insieme." reflows smoothly instead of jumping.
   ========================================================= */
(() => {
  const wrap = document.getElementById('contactRotator');
  const svg = document.getElementById('contactRotatorSvg');
  const textEl = document.getElementById('contactRotatorText');
  const srEl = document.getElementById('contactRotatorSr');
  if (!wrap || !svg || !textEl) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // .slice() — t() for Italian returns the live IT source array (not a
  // copy), so mutating `words` in place below would corrupt it permanently
  // the moment Italian is (re-)selected.
  const words = ((window.i18n ? window.i18n.t('contact.rotatorWords') : null) || ['creiamo', 'ideiamo', 'pensiamo', 'organizziamo', 'generiamo']).slice();
  let i = 0;

  function sizeToText() {
    const bbox = textEl.getBBox();
    wrap.style.width = Math.ceil(bbox.x + bbox.width) + 6 + 'px';
  }

  function draw() {
    textEl.textContent = words[i];
    if (srEl) srEl.textContent = words[i];
    textEl.classList.remove('is-filled');
    textEl.style.transition = 'none';
    textEl.style.strokeDasharray = '0';
    textEl.style.strokeDashoffset = '0';
    sizeToText();

    // Cursive glyph outlines run noticeably longer than the plain advance
    // width getComputedTextLength() reports (loops, connecting strokes),
    // so pad generously to make sure the trace fully covers every letter.
    const len = (textEl.getComputedTextLength ? textEl.getComputedTextLength() : 200) * 1.6 + 40;
    textEl.style.strokeDasharray = String(len);
    textEl.style.strokeDashoffset = String(len);
    // Force layout so the browser registers the reset above before the
    // transition below is asked to animate away from it.
    void textEl.getBoundingClientRect();
    textEl.style.transition = 'stroke-dashoffset 1.1s ease-out, fill .4s ease .9s';
    requestAnimationFrame(() => {
      textEl.style.strokeDashoffset = '0';
      textEl.classList.add('is-filled');
    });
  }

  draw();
  setInterval(() => {
    wrap.classList.add('is-hidden');
    setTimeout(() => {
      i = (i + 1) % words.length;
      draw();
      wrap.classList.remove('is-hidden');
    }, 250);
  }, 2900);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(sizeToText, 150);
  });

  // Swap in the new language's words and restart the rotation from the
  // first one — mutating the array in place keeps the closures above valid.
  document.addEventListener('site:lang-changed', () => {
    const next = window.i18n ? window.i18n.t('contact.rotatorWords') : null;
    if (!next) return;
    words.length = 0;
    next.forEach((w) => words.push(w));
    i = 0;
    draw();
  });
})();
