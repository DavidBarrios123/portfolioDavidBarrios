/* ============================================================
   Mapa interactivo | David Barrios portfolio
   La bola se arrastra por una "espina" vertical (spine mode).
   Al soltarla, se ancla al cruce (nodo) más cercano.
   En un cruce (row mode) se arrastra en horizontal para elegir
   entre los dos juegos de esa fila. Soltar cerca de un extremo
   navega a la página de ese juego.
   ============================================================ */

const ROWS = [
  { left: { title: "Metro Lines",                        href: "juegos/metro-lines.html" },
    right:{ title: "Coins Only!",                        href: "juegos/coins-only.html" } },
  { left: { title: "Space Tycoon",                       href: "juegos/space-tycoon.html" },
    right:{ title: "Brilliant Secrets",                  href: "juegos/brilliant-secrets.html" } },
  { left: { title: "It's a Cow-Boy",                     href: "juegos/its-a-cow-boy.html" },
    right:{ title: "Paradoffee",                         href: "juegos/paradoffee.html" } },
  { left: { title: "Nivel Plataforma",                   href: "juegos/nivel-plataforma.html" },
    right:{ title: "Angel's Maze",                       href: "juegos/angels-maze.html" } },
  { left: { title: "FES-TI-VAL",                         href: "juegos/fes-ti-val.html" },
    right:{ title: "G.P.S: Ghost Papers Scissors",       href: "juegos/gps.html" } },
  { left: { title: "Bread Of Blood",                     href: "juegos/bread-of-blood.html" },
    right:{ title: "The Memories of Isaac",              href: "juegos/memories-of-isaac.html" } },
  { left: { title: "Metal y Plomo",                      href: "juegos/metal-y-plomo.html" },
    right: null },
];

const track   = document.getElementById('map-track');
const svg     = document.getElementById('map-svg');
const ball    = document.getElementById('ball');
const startEl = document.querySelector('[data-start-marker]');

const START_Y  = 90;
const ROW_GAP  = 210;
const BOTTOM_PAD = 90;

let centerX = 0;
let halfW   = 0;
let rowY    = [];

// ---- estado ----
let mode = 'spine';     // 'spine' | 'row'
let focusRow = -1;      // -1 = salida, 0..3 = fila
let pos = { x: 0, y: START_Y };

let dragging = false;
let dragAxis = null;
let dragStartClientX = 0;
let dragStartPageY = 0;
let dragStartPos = { x: 0, y: 0 };
let autoScrollDir = 0;
let autoScrollRAF = null;

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

// #map tiene position:relative, así que track.offsetTop sería relativo a
// esa sección y no a la página entera. Usamos getBoundingClientRect + scrollY
// para obtener siempre la posición real en el documento.
function trackDocY(){
  return track.getBoundingClientRect().top + window.scrollY;
}

function layout(){
  const w = track.clientWidth;
  centerX = w / 2;
  halfW = Math.min(w * 0.42, 260);

  rowY = ROWS.map((_, i) => START_Y + (i + 1) * ROW_GAP);
  const height = START_Y + (ROWS.length) * ROW_GAP + BOTTOM_PAD;
  track.style.height = height + 'px';
  svg.setAttribute('viewBox', `0 0 ${w} ${height}`);
  svg.style.height = height + 'px';

  // marcador de salida
  startEl.style.left = (centerX) + 'px';
  startEl.style.top  = (START_Y - 34) + 'px';

  // nodos
  document.querySelectorAll('.node').forEach(n => n.remove());
  rowY.forEach((y, i) => {
    const node = document.createElement('div');
    node.className = 'node';
    node.dataset.row = i;
    node.style.left = centerX + 'px';
    node.style.top = y + 'px';
    track.appendChild(node);
  });

  // labels
  document.querySelectorAll('.label').forEach(label => {
    const row = Number(label.dataset.row);
    const side = label.dataset.side;
    const y = rowY[row];
    label.style.top = y + 'px';
    label.style.left = (side === 'left' ? centerX - halfW : centerX + halfW) + 'px';
  });

  drawPath(height);

  // recolocar la bola según el estado actual (sin animación al hacer resize)
  if (mode === 'spine') {
    pos.x = centerX;
    pos.y = focusRow === -1 ? START_Y : rowY[focusRow];
  } else {
    pos.y = rowY[focusRow];
    pos.x = clamp(pos.x, centerX - halfW, centerX + halfW);
  }
  updateBallPosition(false);
}

function drawPath(height){
  const ns = 'http://www.w3.org/2000/svg';
  svg.innerHTML = '';

  const spine = document.createElementNS(ns, 'line');
  spine.setAttribute('x1', centerX); spine.setAttribute('y1', START_Y - 26);
  spine.setAttribute('x2', centerX); spine.setAttribute('y2', rowY[rowY.length - 1]);
  spine.setAttribute('class', 'path-line');
  svg.appendChild(spine);

  const tail = document.createElementNS(ns, 'line');
  tail.setAttribute('x1', centerX); tail.setAttribute('y1', rowY[rowY.length - 1]);
  tail.setAttribute('x2', centerX); tail.setAttribute('y2', height - 20);
  tail.setAttribute('class', 'path-line dashed');
  svg.appendChild(tail);

  rowY.forEach(y => {
    const branch = document.createElementNS(ns, 'line');
    branch.setAttribute('x1', centerX - halfW); branch.setAttribute('y1', y);
    branch.setAttribute('x2', centerX + halfW); branch.setAttribute('y2', y);
    branch.setAttribute('class', 'path-line');
    svg.appendChild(branch);
  });
}

function updateBallPosition(animate){
  ball.classList.toggle('snapping', !!animate);
  ball.style.left = pos.x + 'px';
  ball.style.top  = pos.y + 'px';
  ball.setAttribute('aria-valuenow', String(Math.max(0, focusRow)));

  document.querySelectorAll('.node').forEach(n => {
    n.classList.toggle('is-active', Number(n.dataset.row) === focusRow && mode === 'row');
  });
}

function armedSideForX(x){
  const ratio = (x - centerX) / halfW; // -1..1
  if (ratio <= -0.6) return 'left';
  if (ratio >=  0.6) return 'right';
  return null;
}

function updateArmedLabels(row, x){
  const armed = armedSideForX(x);
  document.querySelectorAll(`.label[data-row="${row}"]`).forEach(label => {
    label.classList.toggle('is-armed', armed !== null && label.dataset.side === armed);
  });
}

function clearArmedLabels(){
  document.querySelectorAll('.label.is-armed').forEach(l => l.classList.remove('is-armed'));
}

/* ---------------- auto-scroll de la pantalla mientras se arrastra ---------------- */
function autoScrollStep(){
  if (autoScrollDir !== 0){
    window.scrollBy(0, autoScrollDir * 14);
  }
  autoScrollRAF = requestAnimationFrame(autoScrollStep);
}
function handleAutoScroll(clientY){
  const edge = 90;
  if (clientY < edge) autoScrollDir = -1;
  else if (clientY > window.innerHeight - edge) autoScrollDir = 1;
  else autoScrollDir = 0;
}
function startAutoScrollLoop(){
  if (!autoScrollRAF) autoScrollRAF = requestAnimationFrame(autoScrollStep);
}
function stopAutoScrollLoop(){
  autoScrollDir = 0;
  if (autoScrollRAF){ cancelAnimationFrame(autoScrollRAF); autoScrollRAF = null; }
}

/* ---------------- arrastre con puntero ---------------- */
ball.addEventListener('pointerdown', (e) => {
  dragging = true;
  ball.setPointerCapture(e.pointerId);
  document.body.classList.add('dragging');
  dragAxis = mode; // 'spine' -> vertical, 'row' -> horizontal
  dragStartClientX = e.clientX;
  dragStartPageY = e.clientY + window.scrollY;
  dragStartPos = { x: pos.x, y: pos.y };
  startAutoScrollLoop();
});

ball.addEventListener('pointermove', (e) => {
  if (!dragging) return;

  if (dragAxis === 'spine'){
    const deltaY = (e.clientY + window.scrollY) - dragStartPageY;
    const minY = START_Y;
    const maxY = rowY[rowY.length - 1];
    pos.y = clamp(dragStartPos.y + deltaY, minY, maxY);
    pos.x = centerX;
    handleAutoScroll(e.clientY);
  } else {
    const deltaX = e.clientX - dragStartClientX;
    pos.x = clamp(dragStartPos.x + deltaX, centerX - halfW, centerX + halfW);
    pos.y = rowY[focusRow];
    updateArmedLabels(focusRow, pos.x);
  }
  updateBallPosition(false);
});

function endDrag(e){
  if (!dragging) return;
  dragging = false;
  document.body.classList.remove('dragging');
  stopAutoScrollLoop();

  if (dragAxis === 'spine'){
    resolveSpineRelease();
  } else {
    resolveRowRelease();
  }
}
ball.addEventListener('pointerup', endDrag);
ball.addEventListener('pointercancel', endDrag);

function resolveSpineRelease(){
  const candidates = [{ row: -1, y: START_Y }, ...rowY.map((y, i) => ({ row: i, y }))];
  let best = candidates[0];
  let bestDist = Infinity;
  candidates.forEach(c => {
    const d = Math.abs(pos.y - c.y);
    if (d < bestDist){ bestDist = d; best = c; }
  });

  focusRow = best.row;
  pos.x = centerX;
  pos.y = best.y;
  mode = focusRow === -1 ? 'spine' : 'row';
  updateBallPosition(true);

  if (focusRow !== -1){
    const targetPageY = trackDocY() + best.y - window.innerHeight * 0.45;
    window.scrollTo({ top: Math.max(0, targetPageY), behavior: 'smooth' });
  }
}

function resolveRowRelease(){
  const side = armedSideForX(pos.x);
  clearArmedLabels();

  const target = side && ROWS[focusRow][side];
  if (target){
    pos.x = side === 'left' ? centerX - halfW : centerX + halfW;
    updateBallPosition(true);
    setTimeout(() => { window.location.href = target.href; }, 260);
    return;
  }

  // vuelve al centro y libera el movimiento vertical de nuevo
  pos.x = centerX;
  mode = 'spine';
  updateBallPosition(true);
}

/* ---------------- teclado (accesibilidad) ---------------- */
ball.addEventListener('keydown', (e) => {
  switch (e.key){
    case 'ArrowDown':
      e.preventDefault();
      focusRow = Math.min(focusRow + 1, ROWS.length - 1);
      mode = 'row';
      pos.x = centerX; pos.y = rowY[focusRow];
      clearArmedLabels();
      updateBallPosition(true);
      window.scrollTo({ top: Math.max(0, trackDocY() + pos.y - window.innerHeight * 0.45), behavior: 'smooth' });
      break;
    case 'ArrowUp':
      e.preventDefault();
      focusRow = Math.max(focusRow - 1, -1);
      mode = 'spine';
      pos.x = centerX; pos.y = focusRow === -1 ? START_Y : rowY[focusRow];
      clearArmedLabels();
      updateBallPosition(true);
      window.scrollTo({ top: Math.max(0, trackDocY() + pos.y - window.innerHeight * 0.45), behavior: 'smooth' });
      break;
    case 'ArrowLeft':
      if (mode === 'row'){
        e.preventDefault();
        pos.x = centerX - halfW;
        updateArmedLabels(focusRow, pos.x);
        updateBallPosition(true);
      }
      break;
    case 'ArrowRight':
      if (mode === 'row'){
        e.preventDefault();
        pos.x = centerX + halfW;
        updateArmedLabels(focusRow, pos.x);
        updateBallPosition(true);
      }
      break;
    case 'Enter':
    case ' ':
      if (mode === 'row'){
        e.preventDefault();
        const side = armedSideForX(pos.x);
        const target = side && ROWS[focusRow][side];
        if (target) window.location.href = target.href;
      }
      break;
  }
});

window.addEventListener('resize', layout);
layout();
