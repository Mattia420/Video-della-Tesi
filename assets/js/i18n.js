/*
 * Site translations + the language picker, shown on every visit (not just
 * the first — by design the choice is never persisted, so a fresh page
 * load always starts from the picker rather than remembering a past pick).
 * Plain JS, no build step: one big data object (Italian as the base,
 * per-language "overrides" deep-merged on top of it so project titles
 * and any string a language doesn't override just fall back to Italian)
 * plus the DOM wiring that applies it.
 *
 * Flow: this script (loaded at the end of body, before main.js) builds
 * the translations table and renders the picker grid, then waits for a
 * click. Picking a language applies translations and dispatches
 * `site:lang-ready` (once per page load, consumed by main.js to start
 * the preloader) and `site:lang-changed` (every time, consumed here and
 * by morph-carousel.js to re-translate already-built project cards/
 * lightbox without rebuilding the carousel geometry) — the nav's flag
 * button re-opens the picker the same way, for switching mid-session.
 */
(() => {
  const LANGUAGES = [
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'ro', name: 'Română', flag: '🇷🇴' },
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
  ];
  const SUPPORTED = LANGUAGES.map((l) => l.code);

  /* ---------- Italian source (also the fallback for missing keys) ---------- */
  const IT = {
    nav: { chiSono: "Chi sono", percorso: "Percorso", progetti: "Progetti", competenze: "Competenze", software: "Software", contatti: "Contatti", toggleAria: "Apri menu" },
    preloader: { label: "Caricamento portfolio" },
    hero: {
      greeting: "Ciao, sono Mattia.",
      titlePrefix: "Vuoi scoprire cosa",
      titleAccent: "creo",
      titleSuffix: "?",
      cta: "Guarda i progetti",
    },
    about: {
      tag: "Chi sono",
      title: "Poche righe su di me, ancora più importanti dei miei progetti.",
      p1: "Mi occupo di comunicazione visiva a 360°: graphic design, animazioni, video editing e video mapping sono le competenze su cui ho costruito il mio percorso, tra studio tecnico e progetti concreti.",
      p2: "Negli ultimi anni ho affiancato questi strumenti con l'intelligenza artificiale, che uso per velocizzare il workflow e ampliare le possibilità creative, mantenendo sempre la direzione creativa e il controllo sul risultato finale.",
      p2Em: "Non scelgo tra tecnica e AI: li combino.",
    },
    education: {
      tag: "Percorso di studi",
      title: "Da dove parto.",
      school1Detail: "Indirizzo Informatico — Bolzano",
      school2Detail: "Corso di Grafica Multicanale",
    },
    work: { tag: "Progetti", title: "Una selezione di lavori recenti." },
    carousel: {
      scorri: "Scorri per esplorare",
      revealLine1: "Scorri verso il basso per esplorare",
      revealLine2: "Clicca un progetto per maggiori informazioni",
    },
    skills: {
      tag: "Competenze",
      title: "Di cosa mi occupo.",
      label01: "Graphic Design",
      desc01: "Creo locandine per eventi, elementi grafici, mockup e grafiche su misura, lavorando principalmente con Illustrator e InDesign — dalla brand identity di una serata al materiale promozionale di un festival.",
      label02: "Video Editing + Motion Design",
      desc02: "Monto videoclip per ambiti diversi — musicali, documentaristici o semplici interviste — con Premiere Pro, e animo composizioni motion con After Effects.",
      label03: "AI generativa (immagini & video)",
      desc03: "Uso l'intelligenza artificiale per creare spot pubblicitari per la promozione di prodotti reali, videoclip musicali, oppure per dare un tocco di creatività in più a foto e video già esistenti.",
      label04: "UI/UX Design",
      desc04: "Progetto prototipi interattivi di app e siti web, dall'architettura delle informazioni ai flussi utente, lavorando principalmente con Figma — da una singola schermata di un'app alla navigazione completa di un sito.",
      label05: "Video Mapping",
      desc05: "Realizzo proiezioni video mapping su superfici ed edifici per eventi e installazioni, sincronizzando immagini e animazioni con lo spazio fisico per creare esperienze visive immersive.",
      label06: "Contenuti social & pubblicitari",
      desc06: "Creo contenuti per social media e campagne pubblicitarie — post, grafiche e video pensati per comunicare in modo efficace su ogni piattaforma.",
    },
    software: {
      tag: "Software",
      title: "Gli strumenti che uso ogni giorno.",
    },
    globe: {
      tag: "Esperienze all'estero",
      title: "Dove ho lavorato.",
      introPart1: "Penso che le esperienze all'estero siano incredibilmente utili per la crescita personale: trovarsi in un nuovo ambiente porta nuove sfide e nuove possibilità, che aiutano a far crescere e maturare l'individuo, oltre alle sue competenze.",
      introPart2: "Per questo ho scelto di vivere diverse esperienze lavorative fuori dall'Italia.",
      city1: "Boston, USA", city2: "Valencia, Spagna", city3: "Oradea, Romania",
      city4: "Tilburg, Paesi Bassi", city5: "Trento, Italia", city6: "Bolzano, Italia",
    },
    contact: {
      tag: "Contatti",
      question: "Hai un progetto in mente?",
      line1: "Parliamone e",
      line2: "insieme.",
      cta: "Scrivimi",
      rotatorWords: ["creiamo", "ideiamo", "pensiamo", "organizziamo", "generiamo"],
    },
    footer: { rights: "Tutti i diritti riservati.", top: "Torna su", ariaEmail: "Email" },
    langSwitch: { ariaLabel: "Cambia lingua" },
    langPicker: { heading: "Scegli la lingua · Choose your language" },
    categories: {
      contenutiAi: "Contenuti AI", graphicDesign: "Graphic Design",
      uiuxDesign: "UI/UX Design", motionDesign: "Motion Design",
    },
    lightbox: {
      close: "Chiudi",
      loading: "Caricamento del prototipo… può richiedere alcuni secondi.",
      placeholderFigma: "Prototipo in arrivo",
      placeholderImage: "Grafica in arrivo",
      placeholderVideo: "Video in arrivo",
    },
    projects: {
      telemea: { title: "Telemea — Solomonescu", desc: "Spot pubblicitario generato con l'intelligenza artificiale per il Telemea di Solomonescu, azienda casearia rumena, realizzato durante un periodo di lavoro in Romania." },
      "lunca-cascaval": { title: "Lunca Ilvei — Cascaval Dalia", desc: "Spot pubblicitario generato con l'intelligenza artificiale per il Cascaval Dalia, formaggio di Lunca Ilvei, azienda casearia rumena, realizzato durante un periodo di lavoro in Romania." },
      "black-white": { title: "Black & White", desc: "Contenuto visivo generato con l'intelligenza artificiale, creato per pubblicizzare una canzone." },
      genesis: { title: "Installazione Genesis", desc: "Avatar creato tramite intelligenza artificiale che canta una canzone reale, utilizzato in un'installazione chiamata Genesis, a Barcellona." },
      "deserto-sale": { title: "Deserto di Sale", desc: "Contenuto visivo generato con l'intelligenza artificiale." },
      "lunca-raclette": { title: "Lunca Ilvei — Raclette", desc: "Spot pubblicitario generato con l'intelligenza artificiale per la linea Raclette di Lunca Ilvei, azienda casearia rumena, realizzato durante un periodo di lavoro in Romania." },
      redbull: { title: "Red Bull Green Edition — Spot", desc: "Concept di spot pubblicitario generato con l'intelligenza artificiale." },
      glitch: { title: "Glitch", desc: "Contenuto visivo generato con l'intelligenza artificiale." },
      hopy: { title: "Hopy", desc: "Spot pubblicitario generato con l'intelligenza artificiale per Hopy, linea cosmetica a base di canapa di TiliLab, pensato per il pubblico rumeno — da qui la voce fuori campo in rumeno." },
      "zoona-vinyl": { title: "Zoona Vinyl — Open Decks", desc: "Locandina per una serata open decks in vinile, disegnata su misura per il brand dell'evento." },
      "elektronik-summerfest": { title: "Elektronik Summerfest", desc: "Locandina per un evento tekno con musica live, disegnata su misura per il brand della serata." },
      "touch-of-beauty": { title: "Touch of Beauty — Presentazione", desc: "Presentazione del brand Touch of Beauty, navigabile slide per slide." },
      "energic-swirl": { title: "Energic Swirl", desc: "Copertina vinile in due varianti colore, verde e viola.", gallery: { viola: "Viola", verde: "Verde" } },
      "smart-home": { title: "Smart Home — App Design", desc: "Prototipo interattivo di un'app per la gestione della smart home, navigabile schermata per schermata." },
      underground: { title: "Underground — Website", desc: "Prototipo interattivo, navigabile schermata per schermata." },
      festillu: { title: "Festillu — Website", desc: "Prototipo interattivo del sito di Festillu, un festival immaginario, navigabile pagina per pagina." },
      "motion-studio": { title: "Motion Studio Production", desc: "Motion design per la promozione di uno studio di produzione video, tra editing, montaggio e sound design." },
      "accademia-impresa": { title: "Accademia di Impresa", desc: "Video animato esplicativo per Accademia di Impresa, su forme giuridiche e scelte societarie." },
    },
  };

  /* ---------- overrides for every other language (titles omitted = same as Italian) ---------- */
  const OVERRIDES = {
    en: {
      nav: { chiSono: "About", percorso: "Education", progetti: "Work", competenze: "Skills", software: "Software", contatti: "Contact", toggleAria: "Open menu" },
      preloader: { label: "Loading portfolio" },
      hero: { greeting: "Hi, I'm Mattia.", titlePrefix: "Want to see what I", titleAccent: "create", titleSuffix: "?", cta: "See the projects" },
      about: {
        tag: "About", title: "A few lines about me, still more important than my projects.",
        p1: "I work in visual communication across the board: graphic design, animation, video editing and video mapping are the skills I've built my path on, between technical study and real projects.",
        p2: "In recent years I've paired these tools with artificial intelligence, which I use to speed up the workflow and expand creative possibilities, always keeping creative direction and control over the final result.",
        p2Em: "I don't choose between craft and AI: I combine them.",
      },
      education: {
        tag: "Education",
        title: "Where I started.",
        school1Detail: "IT specialization — Bolzano",
        school2Detail: "Multichannel Graphic Design course",
      },
      work: { tag: "Work", title: "A selection of recent work." },
      carousel: { scorri: "Scroll to explore", revealLine1: "Scroll down to explore", revealLine2: "Click a project for more info" },
      skills: {
        tag: "Skills", title: "What I do.",
        label01: "Graphic Design", desc01: "I design event posters, graphic elements, mockups and custom artwork, working mainly with Illustrator and InDesign — from a night's brand identity to a festival's promotional material.",
        label02: "Video Editing + Motion Design", desc02: "I edit video clips across different fields — music, documentary or simple interviews — with Premiere Pro, and animate motion compositions with After Effects.",
        label03: "Generative AI (images & video)", desc03: "I use artificial intelligence to create ads promoting real products, music videos, or to add an extra touch of creativity to existing photos and videos.",
        label04: "UI/UX Design", desc04: "I design interactive prototypes for apps and websites, from information architecture to user flows, working mainly with Figma — from a single app screen to a website's full navigation.",
        label05: "Video Mapping", desc05: "I create video mapping projections onto surfaces and buildings for events and installations, syncing visuals and animation with physical space to build immersive experiences.",
        label06: "Social & Advertising Content", desc06: "I create content for social media and advertising campaigns — posts, graphics and videos designed to communicate effectively on every platform.",
      },
      software: { tag: "Software", title: "The tools I use every day." },
      globe: {
        tag: "Experience abroad", title: "Where I've worked.",
        introPart1: "I think experiences abroad are incredibly useful for personal growth: being in a new environment brings new challenges and new possibilities, which help you grow and mature as an individual, as well as your skills.",
        introPart2: "That's why I've chosen to live several work experiences outside Italy.",
        city1: "Boston, USA", city2: "Valencia, Spain", city3: "Oradea, Romania", city4: "Tilburg, Netherlands", city5: "Trento, Italy", city6: "Bolzano, Italy",
      },
      contact: {
        tag: "Contact", question: "Have a project in mind?", line1: "Let's talk and", line2: "together.", cta: "Write to me",
        rotatorWords: ["create", "design", "think", "organize", "generate"],
      },
      footer: { rights: "All rights reserved.", top: "Back to top", ariaEmail: "Email" },
      langSwitch: { ariaLabel: "Change language" },
      categories: { contenutiAi: "AI Content", graphicDesign: "Graphic Design", uiuxDesign: "UI/UX Design", motionDesign: "Motion Design" },
      lightbox: { close: "Close", loading: "Loading the prototype… it may take a few seconds.", placeholderFigma: "Prototype coming soon", placeholderImage: "Artwork coming soon", placeholderVideo: "Video coming soon" },
      projects: {
        telemea: { desc: "AI-generated ad for Solomonescu's Telemea, a Romanian dairy company, made during a work period in Romania." },
        "lunca-cascaval": { desc: "AI-generated ad for Cascaval Dalia, a Lunca Ilvei cheese, Romanian dairy company, made during a work period in Romania." },
        "black-white": { desc: "Visual content generated with artificial intelligence, created to advertise a song." },
        genesis: { desc: "AI-created avatar singing a real song, used in an installation called Genesis, in Barcelona." },
        "deserto-sale": { desc: "Visual content generated with artificial intelligence." },
        "lunca-raclette": { desc: "AI-generated ad for the Raclette line by Lunca Ilvei, a Romanian dairy company, made during a work period in Romania." },
        redbull: { desc: "AI-generated ad concept." },
        glitch: { desc: "Visual content generated with artificial intelligence." },
        hopy: { desc: "AI-generated ad for Hopy, a hemp-based cosmetic line by TiliLab, made for a Romanian audience — hence the Romanian voiceover." },
        "zoona-vinyl": { desc: "Poster for a vinyl open-decks night, custom-designed for the event's brand." },
        "elektronik-summerfest": { desc: "Poster for a techno event with live music, custom-designed for the night's brand." },
        "touch-of-beauty": { desc: "Presentation of the Touch of Beauty brand, browsable slide by slide." },
        "energic-swirl": { desc: "Vinyl cover in two colour variants, green and purple.", gallery: { viola: "Purple", verde: "Green" } },
        "smart-home": { desc: "Interactive prototype of a smart home management app, browsable screen by screen." },
        underground: { desc: "Interactive prototype, browsable screen by screen." },
        festillu: { desc: "Interactive prototype of the Festillu website, an imaginary festival, browsable page by page." },
        "motion-studio": { desc: "Motion design for promoting a video production studio, spanning editing, cutting and sound design." },
        "accademia-impresa": { desc: "Animated explainer video for Accademia di Impresa, about legal business forms and corporate choices." },
      },
    },

    de: {
      nav: { chiSono: "Über mich", percorso: "Ausbildung", progetti: "Projekte", competenze: "Kompetenzen", software: "Software", contatti: "Kontakt", toggleAria: "Menü öffnen" },
      preloader: { label: "Portfolio wird geladen" },
      hero: { greeting: "Hallo, ich bin Mattia.", titlePrefix: "Willst du sehen, was ich", titleAccent: "erschaffe", titleSuffix: "?", cta: "Projekte ansehen" },
      about: {
        tag: "Über mich", title: "Ein paar Zeilen über mich, noch wichtiger als meine Projekte.",
        p1: "Ich beschäftige mich mit visueller Kommunikation in ihrer ganzen Bandbreite: Grafikdesign, Animation, Videoschnitt und Video Mapping sind die Kompetenzen, auf denen ich meinen Weg aufgebaut habe, zwischen technischem Studium und konkreten Projekten.",
        p2: "In den letzten Jahren habe ich diese Werkzeuge mit künstlicher Intelligenz kombiniert, die ich nutze, um den Workflow zu beschleunigen und die kreativen Möglichkeiten zu erweitern — die kreative Leitung und die Kontrolle über das Endergebnis behalte ich dabei immer.",
        p2Em: "Ich entscheide mich nicht zwischen Technik und KI: Ich verbinde beides.",
      },
      education: {
        tag: "Ausbildung",
        title: "Wo ich angefangen habe.",
        school1Detail: "Fachrichtung Informatik — Bozen",
        school2Detail: "Studiengang Multichannel-Grafikdesign",
      },
      work: { tag: "Projekte", title: "Eine Auswahl aktueller Arbeiten." },
      carousel: { scorri: "Scrollen zum Entdecken", revealLine1: "Nach unten scrollen zum Entdecken", revealLine2: "Für mehr Infos auf ein Projekt klicken" },
      skills: {
        tag: "Kompetenzen", title: "Womit ich mich beschäftige.",
        label01: "Grafikdesign", desc01: "Ich gestalte Eventplakate, Grafikelemente, Mockups und maßgeschneiderte Grafiken, hauptsächlich mit Illustrator und InDesign — von der Brand Identity einer Veranstaltung bis zum Werbematerial eines Festivals.",
        label02: "Videoschnitt + Motion Design", desc02: "Ich schneide Videoclips für verschiedene Bereiche — Musik, Dokumentation oder einfache Interviews — mit Premiere Pro und animiere Motion-Compositions mit After Effects.",
        label03: "Generative KI (Bilder & Video)", desc03: "Ich nutze künstliche Intelligenz, um Werbespots für reale Produkte und Musikvideos zu erstellen, oder um bestehenden Fotos und Videos eine zusätzliche kreative Note zu verleihen.",
        label04: "UI/UX Design", desc04: "Ich gestalte interaktive Prototypen für Apps und Websites, von der Informationsarchitektur bis zu den User Flows, hauptsächlich mit Figma — von einem einzelnen App-Screen bis zur kompletten Navigation einer Website.",
        label05: "Video Mapping", desc05: "Ich realisiere Video-Mapping-Projektionen auf Oberflächen und Gebäuden für Events und Installationen und synchronisiere Bilder und Animation mit dem physischen Raum, um immersive Erlebnisse zu schaffen.",
        label06: "Social- & Werbeinhalte", desc06: "Ich erstelle Inhalte für Social Media und Werbekampagnen — Posts, Grafiken und Videos, die auf jeder Plattform wirkungsvoll kommunizieren.",
      },
      software: { tag: "Software", title: "Die Werkzeuge, die ich täglich nutze." },
      globe: {
        tag: "Auslandserfahrungen", title: "Wo ich gearbeitet habe.",
        introPart1: "Ich finde, Auslandserfahrungen sind unglaublich wertvoll für die persönliche Entwicklung: In einer neuen Umgebung zu sein bringt neue Herausforderungen und neue Möglichkeiten mit sich, die einem helfen, als Mensch und in den eigenen Kompetenzen zu wachsen und zu reifen.",
        introPart2: "Deshalb habe ich mich entschieden, mehrere Arbeitserfahrungen außerhalb Italiens zu sammeln.",
        city1: "Boston, USA", city2: "Valencia, Spanien", city3: "Oradea, Rumänien", city4: "Tilburg, Niederlande", city5: "Trient, Italien", city6: "Bozen, Italien",
      },
      contact: {
        tag: "Kontakt", question: "Hast du ein Projekt im Kopf?", line1: "Lass uns reden und gemeinsam", line2: ".", cta: "Schreib mir",
        rotatorWords: ["erschaffen", "gestalten", "denken", "organisieren", "entwickeln"],
      },
      footer: { rights: "Alle Rechte vorbehalten.", top: "Nach oben", ariaEmail: "E-Mail" },
      langSwitch: { ariaLabel: "Sprache ändern" },
      categories: { contenutiAi: "KI-Inhalte", graphicDesign: "Grafikdesign", uiuxDesign: "UI/UX Design", motionDesign: "Motion Design" },
      lightbox: { close: "Schließen", loading: "Prototyp wird geladen… kann einige Sekunden dauern.", placeholderFigma: "Prototyp folgt in Kürze", placeholderImage: "Grafik folgt in Kürze", placeholderVideo: "Video folgt in Kürze" },
      projects: {
        telemea: { desc: "KI-generierter Werbespot für den Telemea von Solomonescu, einem rumänischen Molkereiunternehmen, entstanden während einer Arbeitsphase in Rumänien." },
        "lunca-cascaval": { desc: "KI-generierter Werbespot für den Cascaval Dalia, einen Käse von Lunca Ilvei, rumänisches Molkereiunternehmen, entstanden während einer Arbeitsphase in Rumänien." },
        "black-white": { desc: "Mit künstlicher Intelligenz erzeugter visueller Inhalt, erstellt zur Bewerbung eines Songs." },
        genesis: { desc: "Mit künstlicher Intelligenz erschaffener Avatar, der einen echten Song singt, verwendet in einer Installation namens Genesis, in Barcelona." },
        "deserto-sale": { desc: "Mit künstlicher Intelligenz erzeugter visueller Inhalt." },
        "lunca-raclette": { desc: "KI-generierter Werbespot für die Raclette-Linie von Lunca Ilvei, rumänisches Molkereiunternehmen, entstanden während einer Arbeitsphase in Rumänien." },
        redbull: { desc: "KI-generiertes Konzept für einen Werbespot." },
        glitch: { desc: "Mit künstlicher Intelligenz erzeugter visueller Inhalt." },
        hopy: { desc: "KI-generierter Werbespot für Hopy, eine Kosmetiklinie auf Hanfbasis von TiliLab, für ein rumänisches Publikum konzipiert — daher die rumänische Voiceover-Stimme." },
        "zoona-vinyl": { desc: "Plakat für einen Vinyl-Open-Decks-Abend, individuell für die Marke der Veranstaltung gestaltet." },
        "elektronik-summerfest": { desc: "Plakat für ein Techno-Event mit Live-Musik, individuell für die Marke des Abends gestaltet." },
        "touch-of-beauty": { desc: "Präsentation der Marke Touch of Beauty, Folie für Folie navigierbar." },
        "energic-swirl": { desc: "Vinyl-Cover in zwei Farbvarianten, Grün und Violett.", gallery: { viola: "Violett", verde: "Grün" } },
        "smart-home": { desc: "Interaktiver Prototyp einer App zur Steuerung des Smart Home, Bildschirm für Bildschirm navigierbar." },
        underground: { desc: "Interaktiver Prototyp, Bildschirm für Bildschirm navigierbar." },
        festillu: { desc: "Interaktiver Prototyp der Website von Festillu, einem imaginären Festival, Seite für Seite navigierbar." },
        "motion-studio": { desc: "Motion Design zur Promotion eines Videoproduktionsstudios, zwischen Editing, Schnitt und Sounddesign." },
        "accademia-impresa": { desc: "Animiertes Erklärvideo für Accademia di Impresa zu Rechtsformen und unternehmerischen Entscheidungen." },
      },
    },

    es: {
      nav: { chiSono: "Sobre mí", percorso: "Formación", progetti: "Proyectos", competenze: "Habilidades", software: "Software", contatti: "Contacto", toggleAria: "Abrir menú" },
      preloader: { label: "Cargando portfolio" },
      hero: { greeting: "Hola, soy Mattia.", titlePrefix: "¿Quieres descubrir qué", titleAccent: "creo", titleSuffix: "?", cta: "Ver los proyectos" },
      about: {
        tag: "Sobre mí", title: "Unas pocas líneas sobre mí, aún más importantes que mis proyectos.",
        p1: "Me dedico a la comunicación visual en todos sus aspectos: diseño gráfico, animación, edición de vídeo y video mapping son las habilidades sobre las que he construido mi trayectoria, entre estudio técnico y proyectos concretos.",
        p2: "En los últimos años he combinado estas herramientas con la inteligencia artificial, que uso para acelerar el flujo de trabajo y ampliar las posibilidades creativas, manteniendo siempre la dirección creativa y el control sobre el resultado final.",
        p2Em: "No elijo entre técnica e IA: las combino.",
      },
      education: {
        tag: "Formación",
        title: "De dónde parto.",
        school1Detail: "Especialidad en Informática — Bolzano",
        school2Detail: "Curso de Diseño Gráfico Multicanal",
      },
      work: { tag: "Proyectos", title: "Una selección de trabajos recientes." },
      carousel: { scorri: "Desliza para explorar", revealLine1: "Desliza hacia abajo para explorar", revealLine2: "Haz clic en un proyecto para más información" },
      skills: {
        tag: "Habilidades", title: "A qué me dedico.",
        label01: "Diseño Gráfico", desc01: "Creo carteles para eventos, elementos gráficos, mockups y gráficas a medida, trabajando principalmente con Illustrator e InDesign — desde la identidad de marca de una noche hasta el material promocional de un festival.",
        label02: "Edición de Vídeo + Motion Design", desc02: "Edito videoclips para ámbitos distintos — musicales, documentales o simples entrevistas — con Premiere Pro, y animo composiciones motion con After Effects.",
        label03: "IA generativa (imágenes y vídeo)", desc03: "Uso la inteligencia artificial para crear spots publicitarios que promocionan productos reales, videoclips musicales, o para dar un toque extra de creatividad a fotos y vídeos ya existentes.",
        label04: "Diseño UI/UX", desc04: "Diseño prototipos interactivos de apps y sitios web, desde la arquitectura de la información hasta los flujos de usuario, trabajando principalmente con Figma — desde una pantalla de app hasta la navegación completa de un sitio.",
        label05: "Video Mapping", desc05: "Realizo proyecciones de video mapping sobre superficies y edificios para eventos e instalaciones, sincronizando imágenes y animación con el espacio físico para crear experiencias visuales inmersivas.",
        label06: "Contenidos sociales y publicitarios", desc06: "Creo contenidos para redes sociales y campañas publicitarias — publicaciones, gráficas y vídeos pensados para comunicar de forma eficaz en cada plataforma.",
      },
      software: { tag: "Software", title: "Las herramientas que uso cada día." },
      globe: {
        tag: "Experiencias en el extranjero", title: "Dónde he trabajado.",
        introPart1: "Creo que las experiencias en el extranjero son increíblemente útiles para el crecimiento personal: estar en un entorno nuevo trae nuevos retos y nuevas posibilidades, que ayudan a crecer y madurar como persona, además de en las propias habilidades.",
        introPart2: "Por eso he elegido vivir varias experiencias laborales fuera de Italia.",
        city1: "Boston, EE. UU.", city2: "Valencia, España", city3: "Oradea, Rumanía", city4: "Tilburg, Países Bajos", city5: "Trento, Italia", city6: "Bolzano, Italia",
      },
      contact: {
        tag: "Contacto", question: "¿Tienes un proyecto en mente?", line1: "Hablemos y", line2: "juntos.", cta: "Escríbeme",
        rotatorWords: ["creamos", "ideamos", "pensamos", "organizamos", "generamos"],
      },
      footer: { rights: "Todos los derechos reservados.", top: "Volver arriba", ariaEmail: "Correo" },
      langSwitch: { ariaLabel: "Cambiar idioma" },
      categories: { contenutiAi: "Contenido IA", graphicDesign: "Diseño Gráfico", uiuxDesign: "Diseño UI/UX", motionDesign: "Motion Design" },
      lightbox: { close: "Cerrar", loading: "Cargando el prototipo… puede tardar unos segundos.", placeholderFigma: "Prototipo próximamente", placeholderImage: "Gráfica próximamente", placeholderVideo: "Vídeo próximamente" },
      projects: {
        telemea: { desc: "Spot publicitario generado con inteligencia artificial para el Telemea de Solomonescu, empresa láctea rumana, realizado durante un periodo de trabajo en Rumanía." },
        "lunca-cascaval": { desc: "Spot publicitario generado con inteligencia artificial para el Cascaval Dalia, queso de Lunca Ilvei, empresa láctea rumana, realizado durante un periodo de trabajo en Rumanía." },
        "black-white": { desc: "Contenido visual generado con inteligencia artificial, creado para promocionar una canción." },
        genesis: { desc: "Avatar creado con inteligencia artificial que canta una canción real, utilizado en una instalación llamada Genesis, en Barcelona." },
        "deserto-sale": { desc: "Contenido visual generado con inteligencia artificial." },
        "lunca-raclette": { desc: "Spot publicitario generado con inteligencia artificial para la línea Raclette de Lunca Ilvei, empresa láctea rumana, realizado durante un periodo de trabajo en Rumanía." },
        redbull: { desc: "Concepto de spot publicitario generado con inteligencia artificial." },
        glitch: { desc: "Contenido visual generado con inteligencia artificial." },
        hopy: { desc: "Spot publicitario generado con inteligencia artificial para Hopy, línea cosmética a base de cáñamo de TiliLab, pensado para el público rumano — de ahí la voz en off en rumano." },
        "zoona-vinyl": { desc: "Cartel para una noche de open decks en vinilo, diseñado a medida para la marca del evento." },
        "elektronik-summerfest": { desc: "Cartel para un evento tekno con música en directo, diseñado a medida para la marca de la noche." },
        "touch-of-beauty": { desc: "Presentación de la marca Touch of Beauty, navegable diapositiva a diapositiva." },
        "energic-swirl": { desc: "Portada de vinilo en dos variantes de color, verde y morado.", gallery: { viola: "Morado", verde: "Verde" } },
        "smart-home": { desc: "Prototipo interactivo de una app para la gestión del smart home, navegable pantalla a pantalla." },
        underground: { desc: "Prototipo interactivo, navegable pantalla a pantalla." },
        festillu: { desc: "Prototipo interactivo del sitio web de Festillu, un festival imaginario, navegable página a página." },
        "motion-studio": { desc: "Motion design para la promoción de un estudio de producción de vídeo, entre edición, montaje y diseño de sonido." },
        "accademia-impresa": { desc: "Vídeo animado explicativo para Accademia di Impresa, sobre formas jurídicas y decisiones societarias." },
      },
    },

    fr: {
      nav: { chiSono: "À propos", percorso: "Formation", progetti: "Projets", competenze: "Compétences", software: "Logiciels", contatti: "Contact", toggleAria: "Ouvrir le menu" },
      preloader: { label: "Chargement du portfolio" },
      hero: { greeting: "Salut, je suis Mattia.", titlePrefix: "Envie de découvrir ce que je", titleAccent: "crée", titleSuffix: " ?", cta: "Voir les projets" },
      about: {
        tag: "À propos", title: "Quelques lignes sur moi, encore plus importantes que mes projets.",
        p1: "Je m'occupe de communication visuelle à 360° : graphisme, animation, montage vidéo et video mapping sont les compétences sur lesquelles j'ai construit mon parcours, entre études techniques et projets concrets.",
        p2: "Ces dernières années, j'ai associé ces outils à l'intelligence artificielle, que j'utilise pour accélérer le flux de travail et élargir les possibilités créatives, tout en gardant toujours la direction créative et le contrôle sur le résultat final.",
        p2Em: "Je ne choisis pas entre technique et IA : je les combine.",
      },
      education: {
        tag: "Formation",
        title: "D'où je pars.",
        school1Detail: "Filière Informatique — Bolzano",
        school2Detail: "Formation en Design Graphique Multicanal",
      },
      work: { tag: "Projets", title: "Une sélection de travaux récents." },
      carousel: { scorri: "Faites défiler pour explorer", revealLine1: "Faites défiler vers le bas pour explorer", revealLine2: "Cliquez sur un projet pour en savoir plus" },
      skills: {
        tag: "Compétences", title: "Ce dont je m'occupe.",
        label01: "Graphisme", desc01: "Je crée des affiches pour événements, des éléments graphiques, des mockups et des visuels sur mesure, en travaillant principalement avec Illustrator et InDesign — de l'identité de marque d'une soirée au matériel promotionnel d'un festival.",
        label02: "Montage Vidéo + Motion Design", desc02: "Je monte des clips vidéo pour différents domaines — musicaux, documentaires ou simples interviews — avec Premiere Pro, et j'anime des compositions motion avec After Effects.",
        label03: "IA générative (images & vidéo)", desc03: "J'utilise l'intelligence artificielle pour créer des spots publicitaires pour la promotion de produits réels, des clips musicaux, ou encore pour apporter une touche de créativité supplémentaire à des photos et vidéos déjà existantes.",
        label04: "UI/UX Design", desc04: "Je conçois des prototypes interactifs d'applications et de sites web, de l'architecture de l'information aux parcours utilisateurs, en travaillant principalement avec Figma — d'un simple écran d'application à la navigation complète d'un site.",
        label05: "Video Mapping", desc05: "Je réalise des projections de video mapping sur des surfaces et des bâtiments pour des événements et des installations, en synchronisant images et animation avec l'espace physique pour créer des expériences visuelles immersives.",
        label06: "Contenus social & publicitaires", desc06: "Je crée des contenus pour les réseaux sociaux et les campagnes publicitaires — posts, visuels et vidéos pensés pour communiquer efficacement sur chaque plateforme.",
      },
      software: { tag: "Logiciels", title: "Les outils que j'utilise au quotidien." },
      globe: {
        tag: "Expériences à l'étranger", title: "Où j'ai travaillé.",
        introPart1: "Je pense que les expériences à l'étranger sont incroyablement utiles pour l'épanouissement personnel : se retrouver dans un nouvel environnement apporte de nouveaux défis et de nouvelles possibilités, qui aident à grandir et à mûrir en tant qu'individu, ainsi que ses compétences.",
        introPart2: "C'est pourquoi j'ai choisi de vivre plusieurs expériences professionnelles hors d'Italie.",
        city1: "Boston, États-Unis", city2: "Valence, Espagne", city3: "Oradea, Roumanie", city4: "Tilburg, Pays-Bas", city5: "Trente, Italie", city6: "Bolzano, Italie",
      },
      contact: {
        tag: "Contact", question: "Un projet en tête ?", line1: "Parlons-en et", line2: "ensemble.", cta: "Écrivez-moi",
        rotatorWords: ["créons", "imaginons", "pensons", "organisons", "générons"],
      },
      footer: { rights: "Tous droits réservés.", top: "Retour en haut", ariaEmail: "E-mail" },
      langSwitch: { ariaLabel: "Changer de langue" },
      categories: { contenutiAi: "Contenus IA", graphicDesign: "Graphisme", uiuxDesign: "UI/UX Design", motionDesign: "Motion Design" },
      lightbox: { close: "Fermer", loading: "Chargement du prototype… cela peut prendre quelques secondes.", placeholderFigma: "Prototype à venir", placeholderImage: "Visuel à venir", placeholderVideo: "Vidéo à venir" },
      projects: {
        telemea: { desc: "Spot publicitaire généré par intelligence artificielle pour le Telemea de Solomonescu, entreprise laitière roumaine, réalisé lors d'une période de travail en Roumanie." },
        "lunca-cascaval": { desc: "Spot publicitaire généré par intelligence artificielle pour le Cascaval Dalia, fromage de Lunca Ilvei, entreprise laitière roumaine, réalisé lors d'une période de travail en Roumanie." },
        "black-white": { desc: "Contenu visuel généré par intelligence artificielle, créé pour promouvoir une chanson." },
        genesis: { desc: "Avatar créé par intelligence artificielle chantant une chanson réelle, utilisé dans une installation appelée Genesis, à Barcelone." },
        "deserto-sale": { desc: "Contenu visuel généré par intelligence artificielle." },
        "lunca-raclette": { desc: "Spot publicitaire généré par intelligence artificielle pour la gamme Raclette de Lunca Ilvei, entreprise laitière roumaine, réalisé lors d'une période de travail en Roumanie." },
        redbull: { desc: "Concept de spot publicitaire généré par intelligence artificielle." },
        glitch: { desc: "Contenu visuel généré par intelligence artificielle." },
        hopy: { desc: "Spot publicitaire généré par intelligence artificielle pour Hopy, gamme cosmétique à base de chanvre de TiliLab, pensé pour le public roumain — d'où la voix off en roumain." },
        "zoona-vinyl": { desc: "Affiche pour une soirée open decks vinyle, conçue sur mesure pour la marque de l'événement." },
        "elektronik-summerfest": { desc: "Affiche pour un événement tekno avec musique live, conçue sur mesure pour la marque de la soirée." },
        "touch-of-beauty": { desc: "Présentation de la marque Touch of Beauty, consultable diapositive par diapositive." },
        "energic-swirl": { desc: "Pochette vinyle en deux variantes de couleur, vert et violet.", gallery: { viola: "Violet", verde: "Vert" } },
        "smart-home": { desc: "Prototype interactif d'une application de gestion de maison connectée, consultable écran par écran." },
        underground: { desc: "Prototype interactif, consultable écran par écran." },
        festillu: { desc: "Prototype interactif du site de Festillu, un festival imaginaire, consultable page par page." },
        "motion-studio": { desc: "Motion design pour la promotion d'un studio de production vidéo, entre montage, editing et sound design." },
        "accademia-impresa": { desc: "Vidéo animée explicative pour Accademia di Impresa, sur les formes juridiques et les choix d'entreprise." },
      },
    },

    pt: {
      nav: { chiSono: "Sobre mim", percorso: "Formação", progetti: "Projetos", competenze: "Competências", software: "Software", contatti: "Contacto", toggleAria: "Abrir menu" },
      preloader: { label: "A carregar portfólio" },
      hero: { greeting: "Olá, sou o Mattia.", titlePrefix: "Queres descobrir o que", titleAccent: "crio", titleSuffix: "?", cta: "Ver os projetos" },
      about: {
        tag: "Sobre mim", title: "Umas linhas sobre mim, ainda mais importantes do que os meus projetos.",
        p1: "Dedico-me à comunicação visual a 360°: design gráfico, animação, edição de vídeo e video mapping são as competências sobre as quais construí o meu percurso, entre estudo técnico e projetos concretos.",
        p2: "Nos últimos anos tenho aliado estas ferramentas à inteligência artificial, que uso para acelerar o fluxo de trabalho e ampliar as possibilidades criativas, mantendo sempre a direção criativa e o controlo sobre o resultado final.",
        p2Em: "Não escolho entre técnica e IA: combino as duas.",
      },
      education: {
        tag: "Formação",
        title: "De onde parto.",
        school1Detail: "Especialização em Informática — Bolzano",
        school2Detail: "Curso de Design Gráfico Multicanal",
      },
      work: { tag: "Projetos", title: "Uma seleção de trabalhos recentes." },
      carousel: { scorri: "Desliza para explorar", revealLine1: "Desliza para baixo para explorar", revealLine2: "Clica num projeto para mais informações" },
      skills: {
        tag: "Competências", title: "Do que me ocupo.",
        label01: "Design Gráfico", desc01: "Crio cartazes para eventos, elementos gráficos, mockups e grafismos personalizados, trabalhando principalmente com Illustrator e InDesign — desde a identidade de marca de uma noite até ao material promocional de um festival.",
        label02: "Edição de Vídeo + Motion Design", desc02: "Edito videoclipes para áreas diferentes — musicais, documentais ou simples entrevistas — com o Premiere Pro, e animo composições motion com o After Effects.",
        label03: "IA generativa (imagens e vídeo)", desc03: "Uso a inteligência artificial para criar anúncios de promoção de produtos reais, videoclipes musicais, ou para dar um toque extra de criatividade a fotos e vídeos já existentes.",
        label04: "Design UI/UX", desc04: "Desenho protótipos interativos de apps e websites, desde a arquitetura de informação até aos fluxos de utilizador, trabalhando principalmente com o Figma — de um único ecrã de app até à navegação completa de um site.",
        label05: "Video Mapping", desc05: "Realizo projeções de video mapping em superfícies e edifícios para eventos e instalações, sincronizando imagens e animação com o espaço físico para criar experiências visuais imersivas.",
        label06: "Conteúdos sociais e publicitários", desc06: "Crio conteúdos para redes sociais e campanhas publicitárias — publicações, grafismos e vídeos pensados para comunicar de forma eficaz em cada plataforma.",
      },
      software: { tag: "Software", title: "As ferramentas que uso todos os dias." },
      globe: {
        tag: "Experiências no estrangeiro", title: "Onde trabalhei.",
        introPart1: "Penso que as experiências no estrangeiro são incrivelmente úteis para o crescimento pessoal: estar num ambiente novo traz novos desafios e novas possibilidades, que ajudam a crescer e amadurecer como pessoa, além das próprias competências.",
        introPart2: "Por isso escolhi viver várias experiências profissionais fora de Itália.",
        city1: "Boston, EUA", city2: "Valência, Espanha", city3: "Oradea, Roménia", city4: "Tilburg, Países Baixos", city5: "Trento, Itália", city6: "Bolzano, Itália",
      },
      contact: {
        tag: "Contacto", question: "Tens um projeto em mente?", line1: "Vamos falar e", line2: "juntos.", cta: "Escreve-me",
        rotatorWords: ["criamos", "idealizamos", "pensamos", "organizamos", "geramos"],
      },
      footer: { rights: "Todos os direitos reservados.", top: "Voltar ao topo", ariaEmail: "E-mail" },
      langSwitch: { ariaLabel: "Mudar idioma" },
      categories: { contenutiAi: "Conteúdos IA", graphicDesign: "Design Gráfico", uiuxDesign: "Design UI/UX", motionDesign: "Motion Design" },
      lightbox: { close: "Fechar", loading: "A carregar o protótipo… pode demorar alguns segundos.", placeholderFigma: "Protótipo brevemente", placeholderImage: "Grafismo brevemente", placeholderVideo: "Vídeo brevemente" },
      projects: {
        telemea: { desc: "Anúncio gerado com inteligência artificial para o Telemea da Solomonescu, empresa láctea romena, realizado durante um período de trabalho na Roménia." },
        "lunca-cascaval": { desc: "Anúncio gerado com inteligência artificial para o Cascaval Dalia, queijo da Lunca Ilvei, empresa láctea romena, realizado durante um período de trabalho na Roménia." },
        "black-white": { desc: "Conteúdo visual gerado com inteligência artificial, criado para promover uma música." },
        genesis: { desc: "Avatar criado com inteligência artificial que canta uma música real, utilizado numa instalação chamada Genesis, em Barcelona." },
        "deserto-sale": { desc: "Conteúdo visual gerado com inteligência artificial." },
        "lunca-raclette": { desc: "Anúncio gerado com inteligência artificial para a linha Raclette da Lunca Ilvei, empresa láctea romena, realizado durante um período de trabalho na Roménia." },
        redbull: { desc: "Conceito de anúncio gerado com inteligência artificial." },
        glitch: { desc: "Conteúdo visual gerado com inteligência artificial." },
        hopy: { desc: "Anúncio gerado com inteligência artificial para a Hopy, linha cosmética à base de cânhamo da TiliLab, pensado para o público romeno — daí a voz off em romeno." },
        "zoona-vinyl": { desc: "Cartaz para uma noite de open decks em vinil, desenhado à medida para a marca do evento." },
        "elektronik-summerfest": { desc: "Cartaz para um evento tekno com música ao vivo, desenhado à medida para a marca da noite." },
        "touch-of-beauty": { desc: "Apresentação da marca Touch of Beauty, navegável slide a slide." },
        "energic-swirl": { desc: "Capa de vinil em duas variantes de cor, verde e roxo.", gallery: { viola: "Roxo", verde: "Verde" } },
        "smart-home": { desc: "Protótipo interativo de uma app de gestão de casa inteligente, navegável ecrã a ecrã." },
        underground: { desc: "Protótipo interativo, navegável ecrã a ecrã." },
        festillu: { desc: "Protótipo interativo do site do Festillu, um festival imaginário, navegável página a página." },
        "motion-studio": { desc: "Motion design para a promoção de um estúdio de produção de vídeo, entre edição, montagem e sound design." },
        "accademia-impresa": { desc: "Vídeo animado explicativo para a Accademia di Impresa, sobre formas jurídicas e escolhas societárias." },
      },
    },

    ro: {
      nav: { chiSono: "Despre mine", percorso: "Studii", progetti: "Proiecte", competenze: "Competențe", software: "Software", contatti: "Contact", toggleAria: "Deschide meniul" },
      preloader: { label: "Se încarcă portofoliul" },
      hero: { greeting: "Salut, sunt Mattia.", titlePrefix: "Vrei să descoperi ce", titleAccent: "creez", titleSuffix: "?", cta: "Vezi proiectele" },
      about: {
        tag: "Despre mine", title: "Câteva rânduri despre mine, mai importante chiar decât proiectele mele.",
        p1: "Mă ocup de comunicare vizuală în toate formele ei: design grafic, animație, montaj video și video mapping sunt competențele pe care mi-am construit parcursul, între studiu tehnic și proiecte concrete.",
        p2: "În ultimii ani am combinat aceste instrumente cu inteligența artificială, pe care o folosesc pentru a accelera fluxul de lucru și a extinde posibilitățile creative, păstrând mereu direcția creativă și controlul asupra rezultatului final.",
        p2Em: "Nu aleg între tehnică și AI: le combin.",
      },
      education: {
        tag: "Studii",
        title: "De unde am pornit.",
        school1Detail: "Specializare Informatică — Bolzano",
        school2Detail: "Curs de Design Grafic Multicanal",
      },
      work: { tag: "Proiecte", title: "O selecție de lucrări recente." },
      carousel: { scorri: "Derulează pentru a explora", revealLine1: "Derulează în jos pentru a explora", revealLine2: "Dă clic pe un proiect pentru mai multe informații" },
      skills: {
        tag: "Competențe", title: "Cu ce mă ocup.",
        label01: "Design Grafic", desc01: "Creez afișe pentru evenimente, elemente grafice, mockup-uri și grafică personalizată, lucrând în principal cu Illustrator și InDesign — de la identitatea vizuală a unei seri până la materialele promoționale ale unui festival.",
        label02: "Montaj Video + Motion Design", desc02: "Montez videoclipuri pentru domenii diferite — muzicale, documentare sau interviuri simple — cu Premiere Pro, și animez compoziții motion cu After Effects.",
        label03: "AI generativă (imagini și video)", desc03: "Folosesc inteligența artificială pentru a crea reclame pentru promovarea unor produse reale, videoclipuri muzicale, sau pentru a adăuga un plus de creativitate unor fotografii și materiale video deja existente.",
        label04: "UI/UX Design", desc04: "Proiectez prototipuri interactive pentru aplicații și site-uri web, de la arhitectura informației până la fluxurile utilizatorului, lucrând în principal cu Figma — de la un singur ecran de aplicație până la navigarea completă a unui site.",
        label05: "Video Mapping", desc05: "Realizez proiecții video mapping pe suprafețe și clădiri pentru evenimente și instalații, sincronizând imaginile și animația cu spațiul fizic pentru a crea experiențe vizuale captivante.",
        label06: "Conținut social și publicitar", desc06: "Creez conținut pentru rețelele sociale și campanii publicitare — postări, materiale grafice și video gândite să comunice eficient pe fiecare platformă.",
      },
      software: { tag: "Software", title: "Instrumentele pe care le folosesc zilnic." },
      globe: {
        tag: "Experiențe în străinătate", title: "Unde am lucrat.",
        introPart1: "Cred că experiențele în străinătate sunt extrem de utile pentru dezvoltarea personală: aflarea într-un mediu nou aduce noi provocări și noi posibilități, care ajută la creșterea și maturizarea individului, precum și a competențelor sale.",
        introPart2: "De aceea am ales să trăiesc mai multe experiențe de lucru în afara Italiei.",
        city1: "Boston, SUA", city2: "Valencia, Spania", city3: "Oradea, România", city4: "Tilburg, Țările de Jos", city5: "Trento, Italia", city6: "Bolzano, Italia",
      },
      contact: {
        tag: "Contact", question: "Ai un proiect în minte?", line1: "Hai să vorbim și", line2: "împreună.", cta: "Scrie-mi",
        rotatorWords: ["creăm", "concepem", "gândim", "organizăm", "generăm"],
      },
      footer: { rights: "Toate drepturile rezervate.", top: "Înapoi sus", ariaEmail: "E-mail" },
      langSwitch: { ariaLabel: "Schimbă limba" },
      categories: { contenutiAi: "Conținut AI", graphicDesign: "Design Grafic", uiuxDesign: "UI/UX Design", motionDesign: "Motion Design" },
      lightbox: { close: "Închide", loading: "Se încarcă prototipul… poate dura câteva secunde.", placeholderFigma: "Prototip în curând", placeholderImage: "Grafică în curând", placeholderVideo: "Video în curând" },
      projects: {
        telemea: { desc: "Reclamă generată cu inteligență artificială pentru Telemea Solomonescu, companie românească de lactate, realizată în timpul unei perioade de lucru în România." },
        "lunca-cascaval": { desc: "Reclamă generată cu inteligență artificială pentru Cașcaval Dalia, brânză de la Lunca Ilvei, companie românească de lactate, realizată în timpul unei perioade de lucru în România." },
        "black-white": { desc: "Conținut vizual generat cu inteligență artificială, creat pentru a promova o melodie." },
        genesis: { desc: "Avatar creat cu inteligență artificială care cântă o melodie reală, folosit într-o instalație numită Genesis, la Barcelona." },
        "deserto-sale": { desc: "Conținut vizual generat cu inteligență artificială." },
        "lunca-raclette": { desc: "Reclamă generată cu inteligență artificială pentru linia Raclette de la Lunca Ilvei, companie românească de lactate, realizată în timpul unei perioade de lucru în România." },
        redbull: { desc: "Concept de reclamă generat cu inteligență artificială." },
        glitch: { desc: "Conținut vizual generat cu inteligență artificială." },
        hopy: { desc: "Reclamă generată cu inteligență artificială pentru Hopy, linie cosmetică pe bază de cânepă de la TiliLab, realizată pentru publicul românesc — de aici vocea off în limba română." },
        "zoona-vinyl": { desc: "Afiș pentru o seară open decks pe vinil, creat special pentru brandul evenimentului." },
        "elektronik-summerfest": { desc: "Afiș pentru un eveniment tekno cu muzică live, creat special pentru brandul serii." },
        "touch-of-beauty": { desc: "Prezentare a brandului Touch of Beauty, navigabilă slide cu slide." },
        "energic-swirl": { desc: "Copertă de vinil în două variante de culoare, verde și mov.", gallery: { viola: "Mov", verde: "Verde" } },
        "smart-home": { desc: "Prototip interactiv al unei aplicații pentru gestionarea casei inteligente, navigabil ecran cu ecran." },
        underground: { desc: "Prototip interactiv, navigabil ecran cu ecran." },
        festillu: { desc: "Prototip interactiv al site-ului Festillu, un festival imaginar, navigabil pagină cu pagină." },
        "motion-studio": { desc: "Motion design pentru promovarea unui studio de producție video, între editare, montaj și sound design." },
        "accademia-impresa": { desc: "Videoclip animat explicativ pentru Accademia di Impresa, despre forme juridice și decizii de afaceri." },
      },
    },

    nl: {
      nav: { chiSono: "Over mij", percorso: "Opleiding", progetti: "Projecten", competenze: "Vaardigheden", software: "Software", contatti: "Contact", toggleAria: "Menu openen" },
      preloader: { label: "Portfolio wordt geladen" },
      hero: { greeting: "Hoi, ik ben Mattia.", titlePrefix: "Wil je ontdekken wat ik", titleAccent: "creëer", titleSuffix: "?", cta: "Bekijk de projecten" },
      about: {
        tag: "Over mij", title: "Een paar regels over mij, nog belangrijker dan mijn projecten.",
        p1: "Ik houd me bezig met visuele communicatie in de volle breedte: grafisch ontwerp, animatie, video-editing en video mapping zijn de vaardigheden waarop ik mijn pad heb gebouwd, tussen technische studie en concrete projecten.",
        p2: "De afgelopen jaren heb ik deze tools gecombineerd met kunstmatige intelligentie, die ik gebruik om de workflow te versnellen en de creatieve mogelijkheden te vergroten, waarbij ik altijd de creatieve regie en controle over het eindresultaat behoud.",
        p2Em: "Ik kies niet tussen vakmanschap en AI: ik combineer ze.",
      },
      education: {
        tag: "Opleiding",
        title: "Waar ik begonnen ben.",
        school1Detail: "Richting Informatica — Bolzano",
        school2Detail: "Opleiding Multichannel Grafisch Ontwerp",
      },
      work: { tag: "Projecten", title: "Een selectie van recent werk." },
      carousel: { scorri: "Scroll om te ontdekken", revealLine1: "Scroll naar beneden om te ontdekken", revealLine2: "Klik op een project voor meer info" },
      skills: {
        tag: "Vaardigheden", title: "Waar ik me mee bezighoud.",
        label01: "Grafisch Ontwerp", desc01: "Ik ontwerp evenementenposters, grafische elementen, mockups en maatwerkgrafiek, voornamelijk met Illustrator en InDesign — van de merkidentiteit van een avond tot het promotiemateriaal van een festival.",
        label02: "Video-editing + Motion Design", desc02: "Ik monteer videoclips voor verschillende domeinen — muziek, documentaire of eenvoudige interviews — met Premiere Pro, en animeer motion-composities met After Effects.",
        label03: "Generatieve AI (beeld & video)", desc03: "Ik gebruik kunstmatige intelligentie om reclamespots te maken voor de promotie van echte producten en muziekvideo's, of om bestaande foto's en video's een extra creatieve touch te geven.",
        label04: "UI/UX Design", desc04: "Ik ontwerp interactieve prototypes voor apps en websites, van informatiearchitectuur tot user flows, voornamelijk met Figma — van één enkel app-scherm tot de volledige navigatie van een website.",
        label05: "Video Mapping", desc05: "Ik maak video mapping-projecties op oppervlakken en gebouwen voor evenementen en installaties, waarbij ik beeld en animatie synchroniseer met de fysieke ruimte om meeslepende ervaringen te creëren.",
        label06: "Social & reclame-content", desc06: "Ik maak content voor social media en reclamecampagnes — posts, grafisch materiaal en video's die op elk platform effectief communiceren.",
      },
      software: { tag: "Software", title: "De tools die ik dagelijks gebruik." },
      globe: {
        tag: "Ervaringen in het buitenland", title: "Waar ik heb gewerkt.",
        introPart1: "Ik denk dat ervaringen in het buitenland ongelooflijk nuttig zijn voor persoonlijke groei: in een nieuwe omgeving zitten brengt nieuwe uitdagingen en nieuwe mogelijkheden met zich mee, die helpen om als individu te groeien en te rijpen, naast je vaardigheden.",
        introPart2: "Daarom heb ik ervoor gekozen om meerdere werkervaringen buiten Italië op te doen.",
        city1: "Boston, VS", city2: "Valencia, Spanje", city3: "Oradea, Roemenië", city4: "Tilburg, Nederland", city5: "Trento, Italië", city6: "Bolzano, Italië",
      },
      contact: {
        tag: "Contact", question: "Heb je een project in gedachten?", line1: "Laten we praten en samen", line2: ".", cta: "Schrijf me",
        rotatorWords: ["creëren", "bedenken", "denken", "organiseren", "genereren"],
      },
      footer: { rights: "Alle rechten voorbehouden.", top: "Terug naar boven", ariaEmail: "E-mail" },
      langSwitch: { ariaLabel: "Taal wijzigen" },
      categories: { contenutiAi: "AI-content", graphicDesign: "Grafisch Ontwerp", uiuxDesign: "UI/UX Design", motionDesign: "Motion Design" },
      lightbox: { close: "Sluiten", loading: "Prototype wordt geladen… kan een paar seconden duren.", placeholderFigma: "Prototype volgt binnenkort", placeholderImage: "Grafiek volgt binnenkort", placeholderVideo: "Video volgt binnenkort" },
      projects: {
        telemea: { desc: "AI-gegenereerde reclame voor de Telemea van Solomonescu, een Roemeens zuivelbedrijf, gemaakt tijdens een werkperiode in Roemenië." },
        "lunca-cascaval": { desc: "AI-gegenereerde reclame voor de Cascaval Dalia, een kaas van Lunca Ilvei, Roemeens zuivelbedrijf, gemaakt tijdens een werkperiode in Roemenië." },
        "black-white": { desc: "Visuele content gegenereerd met kunstmatige intelligentie, gemaakt om een nummer te promoten." },
        genesis: { desc: "Met kunstmatige intelligentie gecreëerde avatar die een echt nummer zingt, gebruikt in een installatie genaamd Genesis, in Barcelona." },
        "deserto-sale": { desc: "Visuele content gegenereerd met kunstmatige intelligentie." },
        "lunca-raclette": { desc: "AI-gegenereerde reclame voor de Raclette-lijn van Lunca Ilvei, Roemeens zuivelbedrijf, gemaakt tijdens een werkperiode in Roemenië." },
        redbull: { desc: "AI-gegenereerd concept voor een reclamespot." },
        glitch: { desc: "Visuele content gegenereerd met kunstmatige intelligentie." },
        hopy: { desc: "AI-gegenereerde reclame voor Hopy, een cosmeticalijn op hennepbasis van TiliLab, gemaakt voor een Roemeens publiek — vandaar de Roemeense voice-over." },
        "zoona-vinyl": { desc: "Poster voor een vinyl open-decks avond, op maat ontworpen voor het merk van het evenement." },
        "elektronik-summerfest": { desc: "Poster voor een techno-evenement met live muziek, op maat ontworpen voor het merk van de avond." },
        "touch-of-beauty": { desc: "Presentatie van het merk Touch of Beauty, dia voor dia te doorbladeren." },
        "energic-swirl": { desc: "Vinylhoes in twee kleurvarianten, groen en paars.", gallery: { viola: "Paars", verde: "Groen" } },
        "smart-home": { desc: "Interactief prototype van een app voor het beheren van het smart home, scherm voor scherm te doorlopen." },
        underground: { desc: "Interactief prototype, scherm voor scherm te doorlopen." },
        festillu: { desc: "Interactief prototype van de website van Festillu, een denkbeeldig festival, pagina voor pagina te doorlopen." },
        "motion-studio": { desc: "Motion design voor de promotie van een videoproductiestudio, tussen editing, montage en sounddesign." },
        "accademia-impresa": { desc: "Geanimeerde uitlegvideo voor Accademia di Impresa, over rechtsvormen en ondernemingskeuzes." },
      },
    },

    zh: {
      nav: { chiSono: "关于我", percorso: "教育背景", progetti: "项目", competenze: "技能", software: "软件", contatti: "联系方式", toggleAria: "打开菜单" },
      preloader: { label: "作品集加载中" },
      hero: { greeting: "你好，我是 Mattia。", titlePrefix: "想知道我", titleAccent: "创造", titleSuffix: "了什么吗？", cta: "查看项目" },
      about: {
        tag: "关于我", title: "关于我的几行字，甚至比我的项目更重要。",
        p1: "我从事全方位的视觉传达工作：平面设计、动画、视频剪辑和投影映射（video mapping）是我一路走来所积累的技能，兼顾技术学习与实际项目。",
        p2: "近年来，我将这些工具与人工智能结合使用，用它来加快工作流程、拓展创意可能性，同时始终保持创意主导权和对最终成果的把控。",
        p2Em: "我不在技术和 AI 之间做选择：我把两者结合起来。",
      },
      education: {
        tag: "教育背景",
        title: "我的起点。",
        school1Detail: "信息技术专业 — 博尔扎诺",
        school2Detail: "多渠道平面设计课程",
      },
      work: { tag: "项目", title: "近期作品精选。" },
      carousel: { scorri: "向下滚动探索", revealLine1: "向下滚动探索", revealLine2: "点击项目查看更多信息" },
      skills: {
        tag: "技能", title: "我的专长。",
        label01: "平面设计", desc01: "我主要使用 Illustrator 和 InDesign 制作活动海报、图形元素、样机和定制图形——从一场活动的品牌形象到音乐节的宣传物料。",
        label02: "视频剪辑 + 动态设计", desc02: "我使用 Premiere Pro 剪辑音乐、纪录片或简单访谈等不同领域的视频，并用 After Effects 制作动态设计合成。",
        label03: "生成式 AI（图像与视频）", desc03: "我使用人工智能为真实产品制作宣传广告、音乐视频，或为已有的照片和视频增添一份创意。",
        label04: "UI/UX 设计", desc04: "我设计应用和网站的交互原型，从信息架构到用户流程，主要使用 Figma 完成——从单个应用界面到网站的完整导航体验。",
        label05: "投影映射（Video Mapping）", desc05: "我为活动和装置艺术制作投影映射，将画面与动画同步到实体空间中，营造沉浸式视觉体验。",
        label06: "社交与广告内容", desc06: "我为社交媒体和广告活动制作内容——帖子、图形和视频，力求在每个平台上都能有效传达信息。",
      },
      software: { tag: "软件", title: "我每天使用的工具。" },
      globe: {
        tag: "海外经历", title: "我曾工作过的地方。",
        introPart1: "我认为海外经历对个人成长非常有帮助：置身于全新的环境会带来新的挑战和新的可能性，这有助于个人的成长与成熟，也能提升自身技能。",
        introPart2: "因此，我选择了在意大利以外积累多段工作经历。",
        city1: "波士顿，美国", city2: "瓦伦西亚，西班牙", city3: "奥拉迪亚，罗马尼亚", city4: "蒂尔堡，荷兰", city5: "特伦托，意大利", city6: "博尔扎诺，意大利",
      },
      contact: {
        tag: "联系方式", question: "有项目想法吗？", line1: "一起聊聊，一起", line2: "吧。", cta: "给我写信",
        rotatorWords: ["创造", "构思", "思考", "组织", "生成"],
      },
      footer: { rights: "版权所有。", top: "返回顶部", ariaEmail: "邮箱" },
      langSwitch: { ariaLabel: "更改语言" },
      categories: { contenutiAi: "AI 内容", graphicDesign: "平面设计", uiuxDesign: "UI/UX 设计", motionDesign: "动态设计" },
      lightbox: { close: "关闭", loading: "原型加载中……可能需要几秒钟。", placeholderFigma: "原型即将上线", placeholderImage: "图稿即将上线", placeholderVideo: "视频即将上线" },
      projects: {
        telemea: { desc: "为罗马尼亚乳制品公司 Solomonescu 的 Telemea 奶酪制作的 AI 生成广告，创作于在罗马尼亚工作期间。" },
        "lunca-cascaval": { desc: "为罗马尼亚乳制品公司 Lunca Ilvei 的 Cascaval Dalia 奶酪制作的 AI 生成广告，创作于在罗马尼亚工作期间。" },
        "black-white": { desc: "由人工智能生成的视觉内容，用于宣传一首歌曲。" },
        genesis: { desc: "由人工智能创建的虚拟形象演唱一首真实歌曲，用于巴塞罗那一场名为 Genesis 的装置艺术展。" },
        "deserto-sale": { desc: "由人工智能生成的视觉内容。" },
        "lunca-raclette": { desc: "为罗马尼亚乳制品公司 Lunca Ilvei 的 Raclette 系列制作的 AI 生成广告，创作于在罗马尼亚工作期间。" },
        redbull: { desc: "由人工智能生成的广告概念。" },
        glitch: { desc: "由人工智能生成的视觉内容。" },
        hopy: { desc: "为 TiliLab 旗下大麻基化妆品品牌 Hopy 制作的 AI 生成广告，面向罗马尼亚观众制作——因此采用了罗马尼亚语配音。" },
        "zoona-vinyl": { desc: "为一场黑胶 open decks 之夜定制设计的海报。" },
        "elektronik-summerfest": { desc: "为一场带现场音乐的 techno 活动定制设计的海报。" },
        "touch-of-beauty": { desc: "Touch of Beauty 品牌展示，可逐页浏览。" },
        "energic-swirl": { desc: "两种配色（绿色与紫色）的黑胶唱片封面。", gallery: { viola: "紫色", verde: "绿色" } },
        "smart-home": { desc: "智能家居管理应用的交互原型，可逐屏浏览。" },
        underground: { desc: "交互原型，可逐屏浏览。" },
        festillu: { desc: "虚构音乐节 Festillu 网站的交互原型，可逐页浏览。" },
        "motion-studio": { desc: "为一家视频制作工作室宣传制作的动态设计，涵盖剪辑、蒙太奇与音效设计。" },
        "accademia-impresa": { desc: "为 Accademia di Impresa 制作的动画讲解视频，主题为法律形式与公司决策。" },
      },
    },
  };

  /* ---------- merge helper: override wins, missing keys fall back to Italian ---------- */
  function deepMerge(base, override) {
    const out = { ...base };
    if (!override) return out;
    Object.keys(override).forEach((k) => {
      const v = override[k];
      out[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? deepMerge(base[k] || {}, v) : v;
    });
    return out;
  }

  const TRANSLATIONS = { it: IT };
  Object.keys(OVERRIDES).forEach((lang) => { TRANSLATIONS[lang] = deepMerge(IT, OVERRIDES[lang]); });

  /* ---------- lookups ---------- */
  let currentLang = 'it';

  function byPath(obj, path) {
    return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
  }
  function t(path) {
    const table = TRANSLATIONS[currentLang] || IT;
    const v = byPath(table, path);
    return v !== undefined ? v : byPath(IT, path);
  }
  function project(id) {
    const table = TRANSLATIONS[currentLang] || IT;
    return (table.projects && table.projects[id]) || (IT.projects && IT.projects[id]) || null;
  }
  function galleryLabel(id, key) {
    const p = project(id);
    return p && p.gallery ? p.gallery[key] : null;
  }
  function category(key) {
    return t(`categories.${key}`);
  }

  /* ---------- DOM application ---------- */
  function applyDom(lang) {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const val = t(el.getAttribute('data-i18n'));
      if (typeof val === 'string') el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const val = t(el.getAttribute('data-i18n-aria'));
      if (typeof val === 'string') el.setAttribute('aria-label', val);
    });
    document.documentElement.lang = lang;
  }

  /* ---------- picker UI ---------- */
  function renderPicker() {
    const grid = document.getElementById('langPickerGrid');
    if (!grid) return;
    grid.innerHTML = '';
    LANGUAGES.forEach(({ code, name, flag }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lang-picker__btn';
      btn.setAttribute('data-lang-code', code);
      btn.setAttribute('data-cursor', 'link');
      btn.innerHTML = `<span class="lang-picker__flag" aria-hidden="true">${flag}</span><span>${name}</span>`;
      btn.addEventListener('click', () => setLanguage(code));
      grid.appendChild(btn);
    });
  }

  function updateLangSwitchButton(lang) {
    const flagEl = document.getElementById('langSwitchFlag');
    const meta = LANGUAGES.find((l) => l.code === lang);
    if (flagEl && meta) flagEl.textContent = meta.flag;
  }

  function setLanguage(lang) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    const isFirstChoice = !document.documentElement.classList.contains('lang-ready');
    currentLang = lang;
    document.documentElement.setAttribute('data-lang', lang);
    document.documentElement.classList.add('lang-ready');
    applyDom(lang);
    updateLangSwitchButton(lang);
    if (isFirstChoice) document.dispatchEvent(new CustomEvent('site:lang-ready'));
    document.dispatchEvent(new CustomEvent('site:lang-changed'));
  }

  window.i18n = { t, project, galleryLabel, category, setLanguage, getLang: () => currentLang, LANGUAGES };

  // Nothing is persisted, and nothing pre-stamps `lang-ready` before this
  // runs — every page load starts from scratch, so the CSS default state
  // (picker visible, site blurred behind it) is exactly what's wanted
  // until a click here calls setLanguage().
  renderPicker();

  const langSwitchBtn = document.getElementById('langSwitchBtn');
  if (langSwitchBtn) {
    langSwitchBtn.addEventListener('click', () => {
      document.documentElement.classList.remove('lang-ready');
    });
  }
})();
