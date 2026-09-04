/*
 * Rotating dotted globe with great-circle arcs connecting Bolzano to
 * every other marked city. Plain Canvas 2D, no WebGL/library — dots are
 * scattered only over land (an original, hand-authored approximation of
 * the continents built from a handful of ellipses, not real map data),
 * lit by a simple z-depth shade, orthographically projected each frame.
 * Cities are marked with a white dot and a name-tag pill, in the style
 * of the classic "rotating globe with flight routes" genre — an
 * original vanilla rebuild, no external dependencies.
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

  // Rough continent silhouettes as unions of ellipses in lat/lng space —
  // an original, stylised approximation (not traced from any map asset),
  // just enough for the dot cloud to read as "the world" rather than a
  // uniform sphere.
  const LANDMASSES = [
    { lat: 54, lng: -100, rLat: 22, rLng: 38 },   // N. America main
    { lat: 63, lng: -155, rLat: 9, rLng: 16 },    // Alaska
    { lat: 72, lng: -42, rLat: 10, rLng: 12 },    // Greenland
    { lat: 18, lng: -95, rLat: 11, rLng: 12 },    // Central America
    { lat: -14, lng: -60, rLat: 32, rLng: 17 },   // S. America main
    { lat: 6, lng: -68, rLat: 9, rLng: 10 },      // S. America north bulge
    { lat: 50, lng: 15, rLat: 22, rLng: 30 },     // Europe
    { lat: 0, lng: 20, rLat: 30, rLng: 18 },      // Africa main
    { lat: 20, lng: 12, rLat: 12, rLng: 24 },     // Africa north / Sahara
    { lat: 28, lng: 46, rLat: 12, rLng: 14 },     // Middle East
    { lat: 58, lng: 90, rLat: 20, rLng: 55 },     // N./Central Asia
    { lat: 25, lng: 95, rLat: 18, rLng: 35 },     // S./E. Asia
    { lat: -3, lng: 118, rLat: 8, rLng: 14 },     // Indonesia
    { lat: 36, lng: 138, rLat: 6, rLng: 5 },      // Japan
    { lat: -25, lng: 135, rLat: 12, rLng: 18 },   // Australia
  ];

  function isLand(lat, lng) {
    for (const m of LANDMASSES) {
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
    const LAT_STEP = 4;
    for (let lat = -58; lat <= 78; lat += LAT_STEP) {
      const latR = (lat * Math.PI) / 180;
      const lngStep = Math.min(LAT_STEP / Math.cos(latR), 20);
      for (let lng = -180; lng < 180; lng += lngStep) {
        if (!isLand(lat, lng)) continue;
        const jLat = lat + (Math.random() - 0.5) * 2.4;
        const jLng = lng + ((Math.random() - 0.5) * 2.4) / Math.max(0.2, Math.cos(latR));
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
  let autoSpin = 0.0016;

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragStartX = e.clientX;
    rotationAtDragStart = rotation;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    rotation = rotationAtDragStart + (e.clientX - dragStartX) * 0.008;
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  function project(p3d) {
    const rp = orient(p3d);
    return {
      x: cx + rp.x * radius,
      y: cy - rp.y * radius,
      z: rp.z,
    };
  }

  // Some cities sit almost on top of each other on a world-scale globe
  // (Trento is ~50km from Bolzano) — their labels would collide if just
  // placed straight above each marker. Try a ring of candidate positions
  // around each marker and keep the first that clears already-placed
  // labels, so the true (geographically accurate) marker position never
  // moves, only where its name-tag renders.
  const LABEL_DIRS = [
    [0, -1], [0.75, -0.75], [1, 0], [0.75, 0.75],
    [0, 1], [-0.75, 0.75], [-1, 0], [-0.75, -0.75],
  ];
  const LABEL_RINGS = [24, 38, 54, 72];

  function rectsOverlap(a, b, pad) {
    return !(a.x2 + pad < b.x1 || b.x2 + pad < a.x1 || a.y2 + pad < b.y1 || b.y2 + pad < a.y1);
  }

  function placeLabel(markerX, markerY, w, h, placed) {
    for (const dist of LABEL_RINGS) {
      for (const [ux, uy] of LABEL_DIRS) {
        const ax = markerX + ux * dist;
        const ay = markerY + uy * dist;
        const box = { x1: ax - w / 2, y1: ay - h / 2, x2: ax + w / 2, y2: ay + h / 2 };
        if (!placed.some((p) => rectsOverlap(box, p, 4))) return { ax, ay, box };
      }
    }
    const dist = LABEL_RINGS[LABEL_RINGS.length - 1];
    const ax = markerX, ay = markerY - dist;
    return { ax, ay, box: { x1: ax - w / 2, y1: ay - h / 2, x2: ax + w / 2, y2: ay + h / 2 } };
  }

  function drawLabel(markerX, markerY, ax, ay, text, isHub) {
    ctx.font = '600 11px "Space Grotesk", sans-serif';
    const textW = ctx.measureText(text).width;
    const padX = 9;
    const w = textW + padX * 2;
    const h = 21;
    const pillX = ax - w / 2;
    const pillY = ay - h / 2;
    const r = 5;
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
    ctx.fillText(text, ax, ay + 0.5);
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

    // city + hub markers: draw all dots first, then lay out labels (hub
    // gets first pick of position, then front-to-back) so pills never
    // cover a marker that hasn't been placed yet.
    const markers = [{ ...HUB, xyz: hubXYZ, hub: true }, ...cityData]
      .map((city) => ({ city, z: orient(city.xyz).z, proj: project(city.xyz) }))
      .filter((m) => m.z >= -0.05);

    markers.forEach(({ city, proj }) => {
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
    });

    const labelOrder = [...markers].sort((a, b) => (b.city.hub ? 1 : 0) - (a.city.hub ? 1 : 0) || b.z - a.z);
    const placedBoxes = [];
    labelOrder.forEach(({ city, proj }) => {
      ctx.font = '600 11px "Space Grotesk", sans-serif';
      const w = ctx.measureText(city.name).width + 18;
      const h = 21;
      const { ax, ay, box } = placeLabel(proj.x, proj.y, w, h, placedBoxes);
      placedBoxes.push(box);
      drawLabel(proj.x, proj.y, ax, ay, city.name, city.hub);
    });

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
