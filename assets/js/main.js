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
  }
  navToggle.addEventListener('click', () => {
    mobileMenu.classList.toggle('is-open');
  });

  /* =========================================================
     SKILLS ACCORDION — plain JS, no GSAP dependency
     ========================================================= */
  document.querySelectorAll('.skill-item__row').forEach((btn) => {
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
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
     PRELOADER
     ========================================================= */
  const preloader = document.getElementById('preloader');
  const countEl = document.getElementById('preloaderCount');
  let count = 0;
  const counter = setInterval(() => {
    count += Math.ceil(Math.random() * 12);
    if (count >= 100) {
      count = 100;
      clearInterval(counter);
      countEl.textContent = count;
      setTimeout(finishPreload, 350);
    } else {
      countEl.textContent = count;
    }
  }, 90);

  function finishPreload() {
    gsap.to(preloader, {
      yPercent: -100,
      duration: 0.9,
      ease: 'power4.inOut',
      onComplete: () => {
        preloader.style.display = 'none';
        document.body.classList.add('is-loaded');
        playHeroIntro();
      }
    });
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
    // .from() sets the hidden starting state via JS only once this runs, so
    // if GSAP ever fails to fire the hero text is never stuck invisible —
    // it just sits at its normal, visible CSS state instead.
    gsap.timeline({ defaults: { ease: 'power4.out' } })
      .to('.hero__portrait', { opacity: 1, duration: 1.4, ease: 'power2.out' }, 0)
      .from('.hero__title', {
        opacity: 0,
        y: 24,
        duration: 1,
      }, 0.1);
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
     ========================================================= */
  document.querySelectorAll('.word-reveal').forEach((el) => {
    // Split text nodes into per-word spans, recursing into child elements
    // (e.g. <em>, the skills list's number spans) so words inside them get
    // wrapped too without disturbing that element's own styling. Skips SVG
    // content outright — the contact heading's handwriting-style rotator
    // word lives in an <svg>, and wrapping HTML spans around its <text>
    // content wouldn't render.
    const splitWords = (node) => {
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
          if (child instanceof SVGElement) return;
          splitWords(child);
        }
      });
    };
    splitWords(el);

    const words = el.querySelectorAll('.word');
    if (!words.length) return;
    gsap.set(words, { opacity: 0.25, filter: 'blur(4px)' });
    // On small screens there's much less scroll distance per section, so
    // a range tuned for desktop leaves text still mid-blur once it's
    // sitting in a comfortable reading position — start/finish the reveal
    // earlier (further down the viewport) so it's legible sooner.
    const isMobileViewport = window.matchMedia('(max-width: 760px)').matches;
    gsap.to(words, {
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
    });
  });
});

/* =========================================================
   SCROLL POSITION MEMORY (reload/back within the same tab)
   Browsers' native scroll restoration is unreliable here since the
   carousel sections' height is computed by JS, so the page isn't at its
   final height yet when a reload tries to restore. We track it ourselves
   in sessionStorage instead: cleared when the tab closes, so a genuinely
   new visit still lands on the hero, but refreshing/reopening the same
   tab returns to where you were. Kept independent of GSAP/Lenis so it
   still works if the CDN scripts fail to load.
   ========================================================= */
(() => {
  const KEY = 'scrollY';
  let saveTimer = null;
  try {
    window.addEventListener('scroll', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try { sessionStorage.setItem(KEY, String(window.scrollY)); } catch (e) { /* ignore */ }
      }, 150);
    }, { passive: true });
    window.addEventListener('beforeunload', () => {
      try { sessionStorage.setItem(KEY, String(window.scrollY)); } catch (e) { /* ignore */ }
    });

    window.addEventListener('load', () => {
      const saved = parseInt(sessionStorage.getItem(KEY), 10);
      if (!saved) return;
      // Wait a frame for the dynamic carousel heights (set at script-parse
      // time, before `load`) to have actually painted before jumping.
      requestAnimationFrame(() => {
        if (window.lenis && typeof window.lenis.scrollTo === 'function') {
          window.lenis.scrollTo(saved, { immediate: true });
        } else {
          window.scrollTo(0, saved);
        }
      });
    });
  } catch (e) { /* sessionStorage unavailable (private mode, etc.) — just skip */ }
})();

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

  const words = ['creiamo', 'ideiamo', 'pensiamo', 'organizziamo', 'generiamo'];
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
})();
