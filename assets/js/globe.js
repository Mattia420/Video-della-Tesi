/*
 * Rotating dotted globe with great-circle arcs connecting Bolzano to
 * every other marked city. Plain Canvas 2D, no WebGL/library — a
 * uniform Fibonacci-sphere point cloud stands in for the world map,
 * lit by a simple z-depth shade, orthographically projected each
 * frame. Vanilla rebuild of the "rotating globe with flight arcs"
 * genre, no external dependencies.
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

  // Fibonacci-sphere distribution: evenly spaced points standing in for a
  // dotted world surface.
  function buildSurfaceDots(count) {
    const dots = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = golden * i;
      dots.push({ x: Math.cos(theta) * radiusAtY, y, z: Math.sin(theta) * radiusAtY });
    }
    return dots;
  }

  const surfaceDots = buildSurfaceDots(900);
  const hubXYZ = latLngToXYZ(HUB.lat, HUB.lng);
  const cityData = CITIES.map((c) => ({ ...c, xyz: latLngToXYZ(c.lat, c.lng) }));

  let width = 0, height = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let radius = 0, cx = 0, cy = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    canvas.width = width * dpr; canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    radius = Math.min(width, height) * 0.42;
    cx = width / 2; cy = height / 2;
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

  function frame() {
    if (!dragging && !prefersReducedMotion) rotation += autoSpin;
    ctx.clearRect(0, 0, width, height);

    // sphere outline glow
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(214,146,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // surface dots, back-to-front by z
    const projected = surfaceDots.map((p) => ({ pt: project(p), z: orient(p).z }));
    projected.sort((a, b) => a.z - b.z);
    projected.forEach(({ pt, z }) => {
      if (z < -0.05) return;
      const shade = 0.25 + Math.max(0, z) * 0.55;
      const size = 0.9 + Math.max(0, z) * 1.1;
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
      ctx.strokeStyle = 'rgba(166,0,255,0.75)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });

    // city + hub markers on top
    [{ ...HUB, xyz: hubXYZ, hub: true }, ...cityData].forEach((city) => {
      const rz = orient(city.xyz).z;
      if (rz < -0.05) return;
      const proj = project(city.xyz);
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, city.hub ? 4.5 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle = city.hub ? '#d9a6ff' : '#fbf8ff';
      ctx.shadowColor = 'rgba(214,146,255,0.9)';
      ctx.shadowBlur = city.hub ? 12 : 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
