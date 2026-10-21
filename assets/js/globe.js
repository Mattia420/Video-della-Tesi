/*
 * Rotating dotted globe with great-circle arcs connecting Bolzano to
 * every other marked city. Plain Canvas 2D, no WebGL/library — dots are
 * scattered only over land (an original, hand-authored approximation of
 * the continents/coastlines as a handful of polygons and ellipses, not
 * traced from any map asset), lit by a simple z-depth shade,
 * orthographically projected each frame. Cities are marked with a white
 * dot and a name-tag pill that fades in/out smoothly as the globe turns
 * them past the horizon — an original vanilla rebuild of the classic
 * "rotating globe with flight routes" genre, no external dependencies.
 */
(() => {
  const canvas = document.getElementById('globeCanvas');
  if (!canvas) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');

  const HUB = { name: 'Bolzano', lat: 46.50, lng: 11.35 };
  const CITIES = [
    { name: 'Boston', lat: 42.36, lng: -71.06 },
    { name: 'Valencia', lat: 39.47, lng: -0.38 },
    { name: 'Oradea', lat: 47.06, lng: 21.93 },
    { name: 'Tilburg', lat: 51.56, lng: 5.09 },
    { name: 'Trento', lat: 46.07, lng: 11.12 },
  ];

  // Rough continent outlines as [lat, lng] polygons — an original,
  // hand-authored approximation (not traced from any map asset), just
  // detailed enough for the dot cloud to read as real coastlines rather
  // than blobs.
  const LANDMASS_POLYGONS = [
    // North America
    [[70,-160],[66,-168],[58,-160],[55,-135],[49,-123],[40,-124],[32,-117],
     [23,-110],[16,-95],[9,-83],[8,-77],[18,-90],[21,-97],[26,-97],[30,-89],
     [25,-80],[31,-81],[35,-76],[41,-70],[45,-67],[47,-60],[52,-56],[58,-62],
     [63,-68],[70,-70],[78,-95],[75,-115],[70,-140]],
    // South America
    [[12,-72],[11,-64],[5,-52],[-1,-48],[-8,-35],[-15,-39],[-23,-43],
     [-30,-51],[-34,-57],[-38,-58],[-42,-64],[-50,-69],[-54,-68],[-52,-74],
     [-45,-74],[-33,-72],[-24,-70],[-18,-70],[-5,-81],[1,-80],[4,-77],
     [8,-77],[10,-75]],
    // Africa
    [[37,10],[33,10],[31,32],[22,37],[15,40],[12,43],[11,51],[2,45],
     [-1,42],[-6,40],[-16,40],[-22,35],[-26,33],[-34,20],[-29,17],
     [-18,12],[-6,12],[4,9],[5,-4],[6,-10],[14,-17],[21,-17],
     [28,-13],[31,-10],[35,-6]],
    // Europe
    [[71,25],[70,30],[65,22],[60,30],[54,20],[45,38],[42,29],[41,26],
     [37,23],[38,15],[41,16],[44,8],[43,-2],[36,-6],[43,-9],
     [48,-5],[49,2],[51,3],[53,7],[57,7],[60,5],[65,12]],
    // Middle East / Asia
    [[41,29],[41,48],[47,55],[55,60],[70,60],[77,105],[70,140],[62,175],
     [52,142],[42,132],[35,130],[30,122],[22,114],[10,106],[1,104],
     [8,98],[13,98],[18,94],[22,89],[20,82],[8,77],[15,73],[24,68],
     [25,57],[30,48],[35,36],[37,36]],
    // Australia
    [[-11,131],[-13,136],[-12,142],[-17,146],[-24,153],[-28,153],
     [-33,151],[-38,145],[-39,146],[-35,138],[-32,126],[-32,115],
     [-25,113],[-20,114],[-16,123],[-14,126]],
  ];

  // Smaller islands, as ellipses — plenty of precision for their size.
  const LANDMASS_ELLIPSES = [
    { lat: 72, lng: -42, rLat: 10, rLng: 12 },   // Greenland
    { lat: 65, lng: -18, rLat: 3, rLng: 4 },     // Iceland
    { lat: 54, lng: -4, rLat: 4.5, rLng: 4 },    // UK / Ireland
    { lat: 36, lng: 138, rLat: 6, rLng: 5 },     // Japan
    { lat: -3, lng: 118, rLat: 8, rLng: 14 },    // Indonesia
    { lat: 12, lng: 122, rLat: 6, rLng: 4 },     // Philippines
    { lat: -18, lng: 46, rLat: 6.5, rLng: 2.5 }, // Madagascar
    { lat: -42, lng: 173, rLat: 5, rLng: 3 },    // New Zealand
  ];

  function pointInPolygon(lat, lng, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [latI, lngI] = poly[i];
      const [latJ, lngJ] = poly[j];
      const intersect = ((lngI > lng) !== (lngJ > lng)) &&
        (lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function isLand(lat, lng) {
    for (const poly of LANDMASS_POLYGONS) {
      if (pointInPolygon(lat, lng, poly)) return true;
    }
    for (const m of LANDMASS_ELLIPSES) {
      const dLat = (lat - m.lat) / m.rLat;
      let dLng = lng - m.lng;
      if (dLng > 180) dLng -= 360;
      if (dLng < -180) dLng += 360;
      dLng /= m.rLng;
      if (dLat * dLat + dLng * dLng <= 1) return true;
    }
    return false;
  }

  function latLngToXYZ(lat, lng) {
    const latR = (lat * Math.PI) / 180;
    const lngR = (lng * Math.PI) / 180;
    return {
      x: Math.cos(latR) * Math.sin(lngR),
      y: Math.sin(latR),
      z: Math.cos(latR) * Math.cos(lngR),
    };
  }

  function rotateY(p, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
  }

  function rotateX(p, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
  }

  // Align the view so Bolzano sits dead-center, facing the camera: rotateY
  // cancels the hub's longitude, then rotateX cancels its latitude. Every
  // other city — all within ~40deg of Bolzano — then spreads out around it
  // by true angular distance instead of clumping near a screen pole.
  const HUB_LNG_RAD = (HUB.lng * Math.PI) / 180;
  const VIEW_TILT = (HUB.lat * Math.PI) / 180;
  function orient(p) {
    return rotateX(rotateY(p, rotation), VIEW_TILT);
  }

  function scalePoint(p, k) {
    return { x: p.x * k, y: p.y * k, z: p.z * k };
  }

  function slerp(a, b, t) {
    const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
    const angle = Math.acos(dot);
    if (angle < 0.0001) return a;
    const sinA = Math.sin(angle);
    const wa = Math.sin((1 - t) * angle) / sinA;
    const wb = Math.sin(t * angle) / sinA;
    return { x: a.x * wa + b.x * wb, y: a.y * wa + b.y * wb, z: a.z * wa + b.z * wb };
  }

  // Regular lat/lng grid, longitude spacing widened by 1/cos(lat) to keep
  // dot density roughly uniform on the sphere, kept only where isLand().
  function buildLandDots() {
    const dots = [];
    const LAT_STEP = 2.4;
    for (let lat = -58; lat <= 78; lat += LAT_STEP) {
      const latR = (lat * Math.PI) / 180;
      const lngStep = Math.min(LAT_STEP / Math.cos(latR), 20);
      for (let lng = -180; lng < 180; lng += lngStep) {
        if (!isLand(lat, lng)) continue;
        const jLat = lat + (Math.random() - 0.5) * 1.6;
        const jLng = lng + ((Math.random() - 0.5) * 1.6) / Math.max(0.2, Math.cos(latR));
        dots.push(latLngToXYZ(jLat, jLng));
      }
    }
    return dots;
  }

  const surfaceDots = buildLandDots();
  const hubXYZ = latLngToXYZ(HUB.lat, HUB.lng);
  const cityData = CITIES.map((c) => ({ ...c, xyz: latLngToXYZ(c.lat, c.lng) }));

  let width = 0, height = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let radius = 0, cx = 0, cy = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    canvas.width = width * dpr; canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // leave headroom above the sphere for the name-tag pills
    radius = Math.min(width, height) * 0.36;
    cx = width / 2; cy = height / 2 + Math.min(width, height) * 0.04;
  }
  resize();
  window.addEventListener('resize', resize);

  let rotation = -HUB_LNG_RAD;
  let dragging = false;
  let dragStartX = 0;
  let rotationAtDragStart = 0;
  let autoSpin = 0.0033;

  // The canvas box is bigger than the sphere actually drawn in it (extra
  // room for the name-tag pills above it), so only start a drag when the
  // pointer comes down within the visible sphere itself — otherwise a
  // touch anywhere in that empty padding would "grab" the globe instead of
  // scrolling the page. touch-action stays pan-y (native vertical scroll)
  // everywhere on the canvas except while actually dragging: CSS
  // touch-action is a compositor-level hint the browser applies before any
  // JS runs, so a horizontal drag gesture on a pan-y element can get
  // throttled or cut short by the browser's own scroll handling no matter
  // what preventDefault() does in a handler — switching it to 'none' only
  // for the drag's own duration (and back once it ends) is what actually
  // hands the whole gesture to JS, letting a full rotation complete.
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left - cx;
    const py = e.clientY - rect.top - cy;
    if (Math.hypot(px, py) > radius) return;
    e.preventDefault();
    dragging = true;
    dragStartX = e.clientX;
    rotationAtDragStart = rotation;
    canvas.style.touchAction = 'none';
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    rotation = rotationAtDragStart + (e.clientX - dragStartX) * 0.008;
  });
  function endDrag() { dragging = false; canvas.style.touchAction = 'pan-y'; }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function project(p3d) {
    const rp = orient(p3d);
    return {
      x: cx + rp.x * radius,
      y: cy - rp.y * radius,
      z: rp.z,
    };
  }

  // Markers/labels ease out smoothly right around the horizon (z=0) instead
  // of popping away — narrow enough that a city reads as "gone" once it's
  // actually on the far side, not lingering deep into the back hemisphere.
  const FADE_IN_Z = 0.08;
  const FADE_OUT_Z = -0.06;
  function fadeAlpha(z) {
    return Math.max(0, Math.min(1, (z - FADE_OUT_Z) / (FADE_IN_Z - FADE_OUT_Z)));
  }

  // Some cities sit almost on top of each other on a world-scale globe
  // (Trento is ~50km from Bolzano) — their labels would collide if just
  // placed straight above each marker. Each label keeps a persistent
  // offset from its marker (in `labelOffsets`, carried across frames)
  // instead of being re-solved from scratch every frame: a light
  // relaxation pass only nudges overlapping labels apart by a fraction of
  // the overlap each frame, and a much gentler spring eases them back
  // toward sitting straight above their marker once nothing is pushing
  // them away. That keeps the minimum gap between labels without ever
  // having them hop between discrete candidate slots as the globe turns.
  const LABEL_DEFAULT_DIST = 40;
  const LABEL_MAX_DIST = 100;
  const LABEL_SEPARATION_STEP = 0.35;
  const LABEL_SPRING_STEP = 0.025;
  // High enough to fully resolve even a dense 4-5-label cluster within a
  // single frame (cheap: a handful of markers, so negligible CPU cost) —
  // the smoothness comes from `labelOffsets` persisting across frames, not
  // from going easy on iterations within one.
  const LABEL_RELAX_ITERS = 24;
  const LABEL_PAD = 4;
  const labelOffsets = new Map(); // city name -> { dx, dy } relative to its marker

  // Every label's rest position pulls toward "straight above its marker" by
  // default, but giving each city its own direction instead of sharing one
  // matters when several of them project close together on screen (Trento,
  // Tilburg and Oradea all sit a short hop from Bolzano): six labels all
  // springing back toward the same point fights the separation pass into a
  // stalemate, each one shoving its neighbor right back as soon as it's
  // nudged aside. Spread six collision-free "home" directions 60deg apart
  // instead, so a crowded cluster fans out into a rosette around its
  // markers rather than stacking in one jammed row.
  const LABEL_HOME_DIRS = {
    Bolzano: [0, -1],
    Boston: [0.87, -0.5],
    Valencia: [0.87, 0.5],
    Oradea: [0, 1],
    Tilburg: [-0.87, 0.5],
    Trento: [-0.87, -0.5],
  };

  function layoutLabels(items) {
    items.forEach((it) => {
      const [hx, hy] = LABEL_HOME_DIRS[it.city.name] || [0, -1];
      it.homeDx = hx * LABEL_DEFAULT_DIST;
      it.homeDy = hy * LABEL_DEFAULT_DIST;
      const off = labelOffsets.get(it.city.name) || { dx: it.homeDx, dy: it.homeDy };
      it.dx = off.dx;
      it.dy = off.dy;
    });

    for (let iter = 0; iter < LABEL_RELAX_ITERS; iter++) {
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i], b = items[j];
          const ax = a.proj.x + a.dx, ay = a.proj.y + a.dy;
          const bx = b.proj.x + b.dx, by = b.proj.y + b.dy;
          const overlapX = (a.w + b.w) / 2 + LABEL_PAD - Math.abs(ax - bx);
          const overlapY = (a.h + b.h) / 2 + LABEL_PAD - Math.abs(ay - by);
          if (overlapX <= 0 || overlapY <= 0) continue;
          // Push along the line between the two labels' centers (not
          // strictly along one axis) so a tight knot of several overlapping
          // labels fans radially outward instead of just sliding into a
          // single overlapping row or column.
          let pdx = ax - bx, pdy = ay - by;
          let pdist = Math.hypot(pdx, pdy);
          if (pdist < 0.01) { pdx = i < j ? 1 : -1; pdy = -0.3; pdist = 1; }
          pdx /= pdist; pdy /= pdist;
          const mag = Math.min(overlapX, overlapY) * LABEL_SEPARATION_STEP;
          a.dx += (pdx * mag) / 2; a.dy += (pdy * mag) / 2;
          b.dx -= (pdx * mag) / 2; b.dy -= (pdy * mag) / 2;
        }
      }
    }

    return items.map((it) => {
      it.dx += (it.homeDx - it.dx) * LABEL_SPRING_STEP;
      it.dy += (it.homeDy - it.dy) * LABEL_SPRING_STEP;
      const dist = Math.hypot(it.dx, it.dy);
      if (dist > LABEL_MAX_DIST) {
        const k = LABEL_MAX_DIST / dist;
        it.dx *= k; it.dy *= k;
      }
      const { ax, ay } = clampToDisc(it.proj.x + it.dx, it.proj.y + it.dy, it.w, it.h);
      labelOffsets.set(it.city.name, { dx: ax - it.proj.x, dy: ay - it.proj.y });
      return { city: it.city, proj: it.proj, alpha: it.alpha, ax, ay };
    });
  }

  // The canvas element itself is clipped to a circle (border-radius: 50%
  // in CSS), but the relaxation above only keeps labels from overlapping
  // each other — it knows nothing about that circular edge. A marker near
  // the horizon can end up with its name-tag pushed far enough outward to
  // land past the visible disc, where the CSS clip silently chops it off
  // mid-word. Pull the candidate back along its own direction from the
  // globe's centre so its full bounding box — approximated as its
  // half-diagonal — always stays inside the disc, with a small safety margin.
  function clampToDisc(ax, ay, w, h) {
    const discRadius = Math.min(width, height) / 2 - 3;
    const halfDiag = Math.sqrt((w / 2) ** 2 + (h / 2) ** 2);
    const maxDist = discRadius - halfDiag;
    const dx = ax - cx, dy = ay - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (maxDist > 0 && dist > maxDist) {
      const k = maxDist / dist;
      return { ax: cx + dx * k, ay: cy + dy * k };
    }
    return { ax, ay };
  }

  const LABEL_FONT = '700 14px "Space Grotesk", sans-serif';

  function drawLabel(markerX, markerY, ax, ay, text, isHub, alpha) {
    ctx.globalAlpha = alpha;
    ctx.font = LABEL_FONT;
    const label = text.toUpperCase();
    const textW = ctx.measureText(label).width;
    const padX = 11;
    const w = textW + padX * 2;
    const h = 26;
    const pillX = ax - w / 2;
    const pillY = ay - h / 2;
    const r = 6;
    const pillFill = isHub ? 'rgba(74,0,128,0.94)' : 'rgba(16,13,21,0.94)';

    // leader line first, so the pill (drawn after) cleanly caps its end
    ctx.beginPath();
    ctx.moveTo(markerX, markerY);
    ctx.lineTo(ax, ay);
    ctx.strokeStyle = 'rgba(214,146,255,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pillX + r, pillY);
    ctx.arcTo(pillX + w, pillY, pillX + w, pillY + h, r);
    ctx.arcTo(pillX + w, pillY + h, pillX, pillY + h, r);
    ctx.arcTo(pillX, pillY + h, pillX, pillY, r);
    ctx.arcTo(pillX, pillY, pillX + w, pillY, r);
    ctx.closePath();
    ctx.fillStyle = pillFill;
    ctx.strokeStyle = 'rgba(214,146,255,0.4)';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbf8ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '0.03em';
    ctx.fillText(label, ax, ay + 1);
    ctx.letterSpacing = '0px';
    ctx.globalAlpha = 1;
  }

  function frame() {
    if (!dragging && !prefersReducedMotion) rotation += autoSpin;
    ctx.clearRect(0, 0, width, height);

    // sphere outline glow
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(214,146,255,0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // land dots, back-to-front by z
    const projected = surfaceDots.map((p) => ({ pt: project(p), z: orient(p).z }));
    projected.sort((a, b) => a.z - b.z);
    projected.forEach(({ pt, z }) => {
      if (z < -0.05) return;
      const shade = 0.35 + Math.max(0, z) * 0.55;
      const size = 1 + Math.max(0, z) * 1.1;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(214,146,255,${shade.toFixed(3)})`;
      ctx.fill();
    });

    // arcs from hub to each city
    cityData.forEach((city) => {
      const steps = 40;
      let started = false;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const mid = slerp(hubXYZ, city.xyz, t);
        const bulge = 1 + Math.sin(Math.PI * t) * 0.14;
        const arcPoint = scalePoint(mid, bulge);
        const proj = project(arcPoint);
        const rz = orient(arcPoint).z;
        if (rz < -0.02) { started = false; continue; }
        if (!started) { ctx.moveTo(proj.x, proj.y); started = true; }
        else ctx.lineTo(proj.x, proj.y);
      }
      ctx.strokeStyle = 'rgba(166,0,255,0.8)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });

    // city + hub markers: draw all dots first (each faded by its own
    // horizon proximity), then lay out labels so pills never cover a
    // marker that hasn't been placed yet.
    const allMarkers = [{ ...HUB, xyz: hubXYZ, hub: true }, ...cityData]
      .map((city) => ({ city, z: orient(city.xyz).z, proj: project(city.xyz) }))
      .map((m) => ({ ...m, alpha: fadeAlpha(m.z) }));
    // Drop the stored offset for anything currently behind the horizon —
    // otherwise, once it rotates back into view, its label would resume
    // from a now-stale offset and snap a long way to catch up instead of
    // starting fresh (which settles smoothly while it's still fading in).
    allMarkers.forEach((m) => { if (m.alpha <= 0.01) labelOffsets.delete(m.city.name); });
    const markers = allMarkers.filter((m) => m.alpha > 0.01);

    markers.forEach(({ city, proj, alpha }) => {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, city.hub ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255,255,255,0.85)';
      ctx.shadowBlur = city.hub ? 10 : 5;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (city.hub) {
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 8.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(214,146,255,0.85)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    const labelOrder = [...markers].sort((a, b) => (b.city.hub ? 1 : 0) - (a.city.hub ? 1 : 0) || b.z - a.z);
    ctx.font = LABEL_FONT;
    const labelItems = labelOrder.map(({ city, proj, alpha }) => ({
      city, proj, alpha,
      w: ctx.measureText(city.name.toUpperCase()).width + 22,
      h: 26,
    }));
    layoutLabels(labelItems).forEach(({ city, proj, alpha, ax, ay }) => {
      drawLabel(proj.x, proj.y, ax, ay, city.name, city.hub, alpha);
    });

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
