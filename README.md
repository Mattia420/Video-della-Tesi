# Portfolio Personale — Mattia Pedron

Sito portfolio one-page in HTML/CSS/JS puro (nessuna build necessaria), ispirato allo stile
dei portfolio premium tipo quelli in vetrina su siteinspire.com: preloader animato, cursore
custom, smooth scroll, reveal del testo allo scroll, hover magnetici sui bottoni, marquee e
transizioni fluide (GSAP + ScrollTrigger + Lenis).

## Come vederlo in locale

Basta aprire `index.html` in un browser, oppure per evitare problemi con alcuni browser
sui percorsi relativi, avviare un piccolo server statico:

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```

## Struttura

```
index.html               markup e contenuti
assets/css/style.css     stile e layout
assets/js/main.js        preloader, cursore custom, smooth scroll, animazioni GSAP
```

## Cosa personalizzare

- **Nome, ruolo e testi**: cerca in `index.html` le sezioni Hero, Chi sono, Contatti.
- **Colore accento**: variabile `--accent` in cima a `assets/css/style.css`.
- **Font**: cambia il link Google Fonts nell'`<head>` e le variabili font-family nel CSS.
- **Progetti**: nella sezione `#work`, duplica un `.work__item` per ogni progetto e sostituisci
  immagine (`background-image`), titolo e tag.
- **Contatti/social**: aggiorna l'indirizzo email e i link social nella sezione `#contact`.
- **Immagini progetti**: al momento usano placeholder da Unsplash — sostituiscile con le tue
  screenshot/foto reali in `assets/img/` e aggiorna i percorsi.

## Deploy

Il sito è statico: puoi pubblicarlo gratis su GitHub Pages, Netlify o Vercel semplicemente
collegando il repository, senza alcun passaggio di build.
