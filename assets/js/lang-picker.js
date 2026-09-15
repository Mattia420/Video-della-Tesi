/*
 * IT/EN language choice — shared by index.html and en/index.html.
 * - If the visitor already picked a language (localStorage), a tiny
 *   synchronous script in each page's <head> (before this file loads)
 *   redirects instantly to the matching page, so there's no flash of
 *   the "wrong" language.
 * - On a first visit (nothing stored yet) this shows a small prompt,
 *   once the preloader is done, letting the visitor pick IT or EN.
 *   Picking the language already on screen just dismisses it; picking
 *   the other one saves the choice and navigates there.
 * - The existing EN/IT nav links also save the choice when clicked,
 *   so a manual switch is remembered too.
 */
(() => {
  const STORAGE_KEY = 'site-lang';
  const isEN = document.documentElement.lang === 'en';
  const otherUrl = isEN ? '../index.html' : 'en/index.html';

  function getSaved() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function save(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* private mode, etc. */ }
  }

  // Manual switch via the nav/mobile-menu language link should stick too.
  document.querySelectorAll(`a[href="${otherUrl}"]`).forEach((a) => {
    a.addEventListener('click', () => save(isEN ? 'it' : 'en'));
  });

  if (getSaved()) return;

  function showPrompt() {
    const prompt = document.createElement('div');
    prompt.className = 'lang-prompt';
    prompt.innerHTML = `
      <p class="lang-prompt__text">Scegli la lingua del sito / Choose the site language</p>
      <div class="lang-prompt__actions">
        <button type="button" data-lang="it">Italiano</button>
        <button type="button" data-lang="en">English</button>
      </div>
      <button type="button" class="lang-prompt__close" aria-label="Chiudi / Close">&times;</button>
    `;
    document.body.appendChild(prompt);
    requestAnimationFrame(() => prompt.classList.add('is-visible'));

    function dismiss(lang) {
      save(lang);
      prompt.classList.remove('is-visible');
      setTimeout(() => prompt.remove(), 450);
    }

    prompt.querySelectorAll('button[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        const wantsCurrentPage = (lang === 'en') === isEN;
        dismiss(lang);
        if (!wantsCurrentPage) location.href = otherUrl;
      });
    });
    // Closing without choosing keeps the current page's language, so the
    // prompt won't come back nagging on the next visit either.
    prompt.querySelector('.lang-prompt__close').addEventListener('click', () => dismiss(isEN ? 'en' : 'it'));
  }

  // Wait for the preloader to finish (main.js adds body.is-loaded) before
  // showing the prompt, so it doesn't fight with the intro animation — but
  // don't wait forever if that class never lands for some reason.
  if (document.body.classList.contains('is-loaded')) {
    showPrompt();
    return;
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    clearTimeout(fallback);
    showPrompt();
  };
  const observer = new MutationObserver(() => {
    if (document.body.classList.contains('is-loaded')) finish();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const fallback = setTimeout(finish, 4000);
})();
