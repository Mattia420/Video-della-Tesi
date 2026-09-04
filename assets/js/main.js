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
        if (label) cursorLabel.textContent = label;
      });
      el.addEventListener('mouseleave', () => {
        const type = el.getAttribute('data-cursor');
        cursor.classList.remove(`is-${type}`);
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
    document.querySelectorAll('.reveal-up, .hero__portrait, .hero__scroll').forEach((el) => {
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
      }, 0.1)
      .to('.hero__scroll', { opacity: 1, duration: 0.6 }, '-=0.4');
  }
  gsap.set('.hero__scroll', { opacity: 0 });

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

  // stagger the stacked category cards a touch
  gsap.utils.toArray('.stack__card').forEach((el, i) => {
    gsap.from(el, {
      opacity: 0,
      y: 30,
      duration: 0.8,
      delay: i * 0.05,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 92%' },
    });
  });
});
