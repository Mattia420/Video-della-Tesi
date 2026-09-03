document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();

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
     CUSTOM CURSOR
     ========================================================= */
  const cursor = document.getElementById('cursor');
  const cursorLabel = document.getElementById('cursorLabel');
  const isTouch = window.matchMedia('(max-width: 860px)').matches;

  if (!isTouch) {
    let mx = 0, my = 0, cx = 0, cy = 0;
    window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });

    gsap.ticker.add(() => {
      cx += (mx - cx) * 0.18;
      cy += (my - cy) * 0.18;
      gsap.set(cursor, { x: cx, y: cy });
    });

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
     MOBILE MENU
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
     HERO INTRO ANIMATION (fires after preloader)
     ========================================================= */
  function playHeroIntro() {
    gsap.timeline({ defaults: { ease: 'power4.out' } })
      .to('.hero .reveal-line > span', {
        yPercent: 0,
        duration: 1.1,
        stagger: 0.08,
      })
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

  // stagger the work items and skills list a touch
  gsap.utils.toArray('.work__item').forEach((el, i) => {
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
