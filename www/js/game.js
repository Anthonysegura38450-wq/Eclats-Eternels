/* Éclats Éternels — moteur du jeu (carte isométrique, royaume, armée, batailles) */
'use strict';

(function () {
  const D = window.EE_DATA;
  const B = D.BUILDINGS;
  const N = D.MAP;
  const HW = 32;            // demi-largeur d'une case
  const HH = 16;            // demi-hauteur d'une case
  const SAVE_KEY = 'ee-royaume-v1';
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const now = () => Date.now();

  // =====================================================================
  // Utilitaires
  // =====================================================================
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(a, b) {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const up = (p, h) => [p[0], p[1] - h];

  function fmt(n) {
    n = Math.floor(n);
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M';
    if (n >= 1e4) return (n / 1e3).toFixed(1).replace('.', ',') + ' k';
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m >= 60) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
    if (m > 0) return `${m} min ${String(s).padStart(2, '0')}`;
    return `${s} s`;
  }
  function costHtml(cost, check = true) {
    return '<span class="costs">' + Object.entries(cost).map(([k, v]) =>
      `<span class="${check && S.res[k] < v ? 'lack' : ''}"><i>${D.RES[k].icon}</i> ${fmt(v)}</span>`).join('') + '</span>';
  }
  const $ = (id) => document.getElementById(id);

  // =====================================================================
  // État du jeu
  // =====================================================================
  let S = null;
  let grid = new Array(N * N).fill(null);
  let corrupt = new Uint8Array(N * N);

  function addObj(o) {
    o.id = S.nextId++;
    S.objects.push(o);
    return o;
  }

  function newGame() {
    const seed = (Math.random() * 1e9) | 0;
    S = {
      v: 1, seed, created: now(),
      res: Object.assign({}, D.START),
      xp: 0, level: 1,
      army: {}, objects: [], nextId: 1,
      stats: { collects: 0, trained: 0, cleared: 0, wins: 0 },
      beaten: [], quest: 0,
    };
    addObj({ type: 'b', kind: 'castle', gx: 10, gy: 10, size: 3, built: true, doneAt: 0, readyAt: now() + B.castle.produce.time * 1000 });
    D.CAMPS.forEach((c, i) => addObj({ type: 'camp', camp: i, gx: c.gx, gy: c.gy, size: 2 }));
    rebuildGrid();

    const r = rng(seed);
    let trees = 0, rocks = 0, tries = 0;
    while ((trees < 46 || rocks < 16) && tries < 4000) {
      tries++;
      const gx = (r() * N) | 0, gy = (r() * N) | 0;
      if (Math.abs(gx - 11) <= 3 && Math.abs(gy - 11) <= 3) continue;
      if (grid[gy * N + gx]) continue;
      if (trees < 46) { addObj({ type: 'tree', gx, gy, size: 1, v: r() }); trees++; }
      else { addObj({ type: 'rock', gx, gy, size: 1, v: r() }); rocks++; }
      grid[gy * N + gx] = true;
    }
    rebuildGrid();
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d || d.v !== 1 || !Array.isArray(d.objects)) return false;
      S = d;
      S.stats = Object.assign({ collects: 0, trained: 0, cleared: 0, wins: 0 }, S.stats);
      S.army = S.army || {};
      S.beaten = S.beaten || [];
      for (const k of Object.keys(D.RES)) S.res[k] = Number(S.res[k]) || 0;
      rebuildGrid();
      return true;
    } catch (e) {
      return false;
    }
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* stockage indisponible */ }
  }

  function rebuildGrid() {
    grid = new Array(N * N).fill(null);
    corrupt = new Uint8Array(N * N);
    for (const o of S.objects) {
      for (let y = o.gy; y < o.gy + o.size; y++) {
        for (let x = o.gx; x < o.gx + o.size; x++) {
          if (x >= 0 && y >= 0 && x < N && y < N) grid[y * N + x] = o;
        }
      }
      if (o.type === 'camp') {
        for (let y = o.gy - 2; y < o.gy + o.size + 2; y++) {
          for (let x = o.gx - 2; x < o.gx + o.size + 2; x++) {
            if (x >= 0 && y >= 0 && x < N && y < N) corrupt[y * N + x] = 1;
          }
        }
      }
    }
    groundDirty = true;
  }

  function isFree(gx, gy, size, ignore) {
    if (gx < 0 || gy < 0 || gx + size > N || gy + size > N) return false;
    for (let y = gy; y < gy + size; y++) {
      for (let x = gx; x < gx + size; x++) {
        const o = grid[y * N + x];
        if (o && o !== ignore) return false;
        if (corrupt[y * N + x]) return false;
      }
    }
    return true;
  }

  // =====================================================================
  // Règles
  // =====================================================================
  const buildings = () => S.objects.filter((o) => o.type === 'b');
  const countKind = (k) => S.objects.reduce((n, o) => n + (o.type === 'b' && o.kind === k ? 1 : 0), 0);
  const countBuilt = (k) => S.objects.reduce((n, o) => n + (o.type === 'b' && o.kind === k && o.built ? 1 : 0), 0);
  const maxKind = (k) => { const m = B[k].max || [0]; return m[Math.min(S.level - 1, m.length - 1)]; };
  const unlockLevel = (k) => { const m = B[k].max || [0]; const i = m.findIndex((v) => v > 0); return i < 0 ? 99 : i + 1; };
  const xpNeed = (l) => Math.round(40 * Math.pow(l, 1.7));

  function storageCap() {
    return B.castle.storage + countBuilt('storage') * B.storage.storage;
  }
  function popCap() {
    return B.castle.pop + countBuilt('house') * B.house.pop;
  }
  function armySize() {
    return Object.values(S.army).reduce((a, b) => a + b, 0);
  }
  function queuedSize() {
    return buildings().reduce((n, b) => n + (b.queue ? b.queue.length : 0), 0);
  }
  function towerBonus() {
    return 1 + countBuilt('tower') * B.tower.bonus;
  }
  function armyStats() {
    let atk = 0, hp = 0;
    for (const [k, n] of Object.entries(S.army)) { atk += D.UNITS[k].atk * n; hp += D.UNITS[k].hp * n; }
    return { atk: atk * towerBonus(), hp };
  }

  function canAfford(cost) { return Object.entries(cost).every(([k, v]) => S.res[k] >= v); }
  function pay(cost) { for (const [k, v] of Object.entries(cost)) S.res[k] -= v; }
  function gain(res, amount, wx, wy) {
    let g = amount;
    if (res !== 'gems') g = Math.max(0, Math.min(amount, storageCap() - S.res[res]));
    S.res[res] += g;
    if (wx != null && g > 0) floater(`+${fmt(g)} ${D.RES[res].icon}`, wx, wy);
    return g;
  }

  function addXp(x, wx, wy) {
    if (x <= 0) return;
    S.xp += x;
    if (wx != null) floater(`+${x} XP`, wx, wy - 18, '#7b5cff');
    while (S.xp >= xpNeed(S.level)) {
      S.xp -= xpNeed(S.level);
      S.level++;
      S.res.gems += 2;
      const unlocked = Object.keys(B).filter((k) => B[k].max && unlockLevel(k) === S.level).map((k) => B[k].name);
      const units = Object.keys(D.UNITS).filter((k) => D.UNITS[k].unlock === S.level).map((k) => D.UNITS[k].name);
      const news = unlocked.concat(units);
      toast(`🎉 Niveau ${S.level} ! +2 💎${news.length ? ' · Nouveau : ' + news.join(', ') : ''}`, 4000);
    }
  }

  // --- Construction & récolte ---
  function finishBuild(b) {
    b.built = true;
    b.doneAt = 0;
    const def = B[b.kind];
    if (def.produce) b.readyAt = now() + def.produce.time * 1000;
    const c = objCenter(b);
    addXp(def.xp || 0, c[0], c[1] - 30);
    toast(`${def.icon} ${def.name} : construction terminée !`);
  }

  function isReady(b) {
    return b.built && B[b.kind].produce && now() >= b.readyAt;
  }

  function collect(b) {
    const p = B[b.kind].produce;
    const c = objCenter(b);
    const g = gain(p.res, p.amount, c[0], c[1] - B[b.kind].h);
    if (g <= 0) {
      toast('📦 Tes réserves sont pleines ! Construis un Entrepôt.');
      return;
    }
    b.readyAt = now() + p.time * 1000;
    S.stats.collects++;
    addXp(2, c[0], c[1] - B[b.kind].h);
    sparkle(c[0], c[1] - B[b.kind].h / 2, 10);
  }

  function speedCost(b) {
    return Math.max(1, Math.ceil((b.doneAt - now()) / 60000));
  }

  // --- Armée ---
  function trainUnit(b, k) {
    const u = D.UNITS[k];
    if (S.level < u.unlock || !canAfford(u.cost)) return;
    if (armySize() + queuedSize() >= popCap()) { toast('🏠 Plus de place ! Construis des Chaumières pour agrandir ton armée.'); return; }
    pay(u.cost);
    b.queue = b.queue || [];
    const start = b.queue.length ? b.queue[b.queue.length - 1].endAt : now();
    b.queue.push({ unit: k, endAt: Math.max(start, now()) + u.time * 1000 });
    save();
  }

  function processQueues() {
    const t = now();
    for (const b of buildings()) {
      if (!b.queue || !b.queue.length) continue;
      while (b.queue.length && b.queue[0].endAt <= t) {
        const q = b.queue.shift();
        S.army[q.unit] = (S.army[q.unit] || 0) + 1;
        S.stats.trained++;
        const c = objCenter(b);
        floater(`${D.UNITS[q.unit].icon} +1`, c[0], c[1] - 60);
        addXp(3);
      }
    }
  }

  // =====================================================================
  // Quêtes
  // =====================================================================
  const QUESTS = [
    { text: 'Construis une Chaumière', goal: () => [countBuilt('house'), 1], reward: { gold: 60 }, xp: 15 },
    { text: 'Construis un Champ', goal: () => [countBuilt('farm'), 1], reward: { food: 40 }, xp: 15 },
    { text: 'Récolte tes bâtiments 5 fois', goal: () => [S.stats.collects, 5], reward: { gems: 2 }, xp: 20 },
    { text: 'Abats 3 arbres ou rochers', goal: () => [S.stats.cleared, 3], reward: { gold: 50 }, xp: 15 },
    { text: 'Atteins le niveau 2', goal: () => [S.level, 2], reward: { gold: 100 }, xp: 0 },
    { text: 'Construis une Caserne', goal: () => [countBuilt('barracks'), 1], reward: { food: 60 }, xp: 25 },
    { text: 'Entraîne 3 soldats', goal: () => [S.stats.trained, 3], reward: { gold: 80 }, xp: 20 },
    { text: "Chasse les Rôdeurs d'ombre", goal: () => [S.beaten.includes(0) ? 1 : 0, 1], reward: { gems: 3 }, xp: 0 },
    { text: 'Construis une Scierie', goal: () => [countBuilt('lumber'), 1], reward: { gold: 80 }, xp: 20 },
    { text: 'Possède 4 Chaumières', goal: () => [countBuilt('house'), 4], reward: { wood: 60 }, xp: 25 },
    { text: 'Atteins le niveau 3', goal: () => [S.level, 3], reward: { gems: 2 }, xp: 0 },
    { text: 'Construis une Carrière', goal: () => [countBuilt('quarry'), 1], reward: { gold: 150 }, xp: 25 },
    { text: 'Construis un Entrepôt', goal: () => [countBuilt('storage'), 1], reward: { stone: 60 }, xp: 30 },
    { text: "Libère 2 repaires d'ombre", goal: () => [S.beaten.length, 2], reward: { gems: 3 }, xp: 30 },
    { text: 'Atteins le niveau 4', goal: () => [S.level, 4], reward: { gold: 300 }, xp: 0 },
    { text: 'Construis une Tour de guet', goal: () => [countBuilt('tower'), 1], reward: { stone: 100 }, xp: 30 },
    { text: "Libère 3 repaires d'ombre", goal: () => [S.beaten.length, 3], reward: { gems: 4 }, xp: 40 },
    { text: 'Atteins le niveau 5', goal: () => [S.level, 5], reward: { gold: 500 }, xp: 0 },
    { text: "Construis un Sanctuaire d'éclats", goal: () => [countBuilt('shrine'), 1], reward: { gems: 5 }, xp: 50 },
    { text: "Libère 5 repaires d'ombre", goal: () => [S.beaten.length, 5], reward: { gems: 5 }, xp: 80 },
    { text: "Terrasse le Dragon d'obsidienne", goal: () => [S.beaten.includes(5) ? 1 : 0, 1], reward: { gems: 25 }, xp: 200 },
  ];

  function checkQuests() {
    let guard = 0;
    while (S.quest < QUESTS.length && guard++ < 5) {
      const q = QUESTS[S.quest];
      const [cur, goal] = q.goal();
      if (cur < goal) break;
      for (const [k, v] of Object.entries(q.reward)) gain(k, v);
      S.quest++;
      toast(`📜 Quête accomplie : ${q.text} ! ${rewardText(q.reward)}`, 3500);
      addXp(q.xp);
      save();
    }
  }
  const rewardText = (r) => Object.entries(r).map(([k, v]) => `+${fmt(v)} ${D.RES[k].icon}`).join(' ');

  // =====================================================================
  // Rendu
  // =====================================================================
  const canvas = $('world');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  const cam = { x: 0, y: 0, z: 1 };
  const floaters = [];
  const sparks = [];
  const clouds = [];
  let groundDirty = true;
  let groundCanvas = null;
  let selectedId = null;
  let placing = null;   // { kind, gx, gy, move: obj|null }

  const P = (gx, gy) => [(gx - gy) * HW, (gx + gy) * HH];
  function foot(gx, gy, s, inset = 0) {
    const a = gx + inset, b = gy + inset, c = s - 2 * inset;
    return { t: P(a, b), r: P(a + c, b), b: P(a + c, b + c), l: P(a, b + c), c: P(a + c / 2, b + c / 2) };
  }
  function objCenter(o) { return P(o.gx + o.size / 2, o.gy + o.size / 2); }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    if (!clouds.length) {
      for (let i = 0; i < 6; i++) clouds.push({ x: Math.random() * W, y: Math.random() * H, s: 0.6 + Math.random() * 0.9, v: 4 + Math.random() * 8 });
    }
    clampCam();
  }

  function clampCam() {
    cam.z = clamp(cam.z, 0.45, 2.2);
    cam.x = clamp(cam.x, -N * HW, N * HW);
    cam.y = clamp(cam.y, -40, N * 2 * HH);
  }

  // --- Primitives ---
  function poly(pts, fill, stroke, lw = 1) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function box(f, h, cl, cr, ct) {
    poly([f.l, f.b, up(f.b, h), up(f.l, h)], cl);
    poly([f.b, f.r, up(f.r, h), up(f.b, h)], cr);
    poly([up(f.t, h), up(f.r, h), up(f.b, h), up(f.l, h)], ct);
  }
  function pyramid(f, h, rh, cl, cr, cb) {
    const apex = [f.c[0], f.c[1] - h - rh];
    poly([up(f.l, h), up(f.t, h), apex], cb);
    poly([up(f.t, h), up(f.r, h), apex], cb);
    poly([up(f.l, h), up(f.b, h), apex], cl);
    poly([up(f.b, h), up(f.r, h), apex], cr);
    return apex;
  }
  function wallQuad(f, side, u0, u1, v0, v1, h, color) {
    const a = side === 'L' ? f.l : f.b, b = side === 'L' ? f.b : f.r;
    const p0 = lerp(a, b, u0), p1 = lerp(a, b, u1);
    poly([up(p0, v0 * h), up(p1, v0 * h), up(p1, v1 * h), up(p0, v1 * h)], color);
  }
  function crystal(x, y, s, c1, c2, glow) {
    ctx.save();
    if (glow) { ctx.shadowColor = c1; ctx.shadowBlur = glow; }
    poly([[x, y - s * 1.6], [x + s, y - s * 0.3], [x, y + s * 1.2], [x - s, y - s * 0.3]], c1);
    ctx.shadowBlur = 0;
    poly([[x, y - s * 1.6], [x + s, y - s * 0.3], [x, y + s * 1.2]], c2);
    poly([[x - s * 0.5, y - s * 0.6], [x - s * 0.15, y - s * 1.1], [x - s * 0.2, y - s * 0.1]], 'rgba(255,255,255,.8)');
    ctx.restore();
  }
  function emoji(ch, x, y, size) {
    ctx.font = `${size}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y);
  }
  function circle(x, y, r, fill) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  }

  // --- Sol (mis en cache) ---
  function buildGround() {
    const pad = 60;
    const w = N * 2 * HW + pad * 2, h = N * 2 * HH + pad * 2 + 60;
    const scale = 2;
    groundCanvas = groundCanvas || document.createElement('canvas');
    groundCanvas.width = w * scale;
    groundCanvas.height = h * scale;
    const g = groundCanvas.getContext('2d');
    g.setTransform(scale, 0, 0, scale, (N * HW + pad) * scale, pad * scale);
    const prev = ctx;
    // Dessine avec les mêmes primitives en remplaçant temporairement le contexte
    drawGroundTo(g);
    groundCanvas.ox = -(N * HW + pad);
    groundCanvas.oy = -pad;
    groundCanvas.w = w;
    groundCanvas.h = h;
    groundDirty = false;
    return prev;
  }

  function drawGroundTo(g) {
    const pl = (pts, fill) => {
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath(); g.fillStyle = fill; g.fill();
      g.strokeStyle = fill; g.lineWidth = 0.6; g.stroke();
    };
    // Falaises de l'île flottante
    const L = P(0, N), Bt = P(N, N), R = P(N, 0);
    const depth = 46;
    pl([L, Bt, up(Bt, -depth), [L[0] + 40, L[1] + depth - 10]], '#9a6b43');
    pl([Bt, R, [R[0] - 40, R[1] + depth - 10], up(Bt, -depth)], '#7a5233');
    pl([[L[0] + 40, L[1] + depth - 10], up(Bt, -depth), [Bt[0], Bt[1] + depth + 40]], '#6b4a30');
    pl([up(Bt, -depth), [R[0] - 40, R[1] + depth - 10], [Bt[0], Bt[1] + depth + 40]], '#563b26');
    // Herbe / terre corrompue
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const n = hash(x, y);
        const f = [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)];
        let col;
        if (corrupt[y * N + x]) col = `hsl(${270 + n * 15},${28 + n * 10}%,${24 + n * 8}%)`;
        else col = `hsl(${95 + n * 14},${48 + n * 10}%,${50 + n * 7}%)`;
        pl(f, col);
      }
    }
    // Bordure lumineuse
    g.strokeStyle = 'rgba(255,255,255,.35)';
    g.lineWidth = 2;
    g.beginPath();
    const T = P(0, 0);
    g.moveTo(T[0], T[1]); g.lineTo(R[0], R[1]); g.lineTo(Bt[0], Bt[1]); g.lineTo(L[0], L[1]); g.closePath();
    g.stroke();
  }

  // --- Objets ---
  function drawTree(o, t) {
    const c = P(o.gx + 0.5, o.gy + 0.5);
    const s = 0.85 + o.v * 0.4;
    ctx.fillStyle = 'rgba(0,40,0,.18)';
    ctx.beginPath(); ctx.ellipse(c[0], c[1], 14 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
    poly([[c[0] - 3, c[1]], [c[0] + 3, c[1]], [c[0] + 2.5, c[1] - 16 * s], [c[0] - 2.5, c[1] - 16 * s]], '#7a4f2c');
    const sway = Math.sin(t * 1.3 + o.v * 10) * 1.2;
    circle(c[0] + sway, c[1] - 26 * s, 13 * s, '#2f7d3a');
    circle(c[0] - 7 * s + sway, c[1] - 19 * s, 10 * s, '#3a9146');
    circle(c[0] + 7 * s + sway, c[1] - 20 * s, 10 * s, '#2a6f34');
    circle(c[0] - 3 * s + sway, c[1] - 30 * s, 5 * s, 'rgba(255,255,255,.18)');
  }

  function rockShape(x, y, s, v) {
    poly([[x - 12 * s, y], [x - 9 * s, y - 9 * s], [x - 2 * s, y - 13 * s], [x + 8 * s, y - 10 * s], [x + 12 * s, y - 2 * s], [x + 5 * s, y + 3 * s], [x - 6 * s, y + 3 * s]], v > 0.5 ? '#9ea3ad' : '#8f949e');
    poly([[x - 2 * s, y - 13 * s], [x + 8 * s, y - 10 * s], [x + 12 * s, y - 2 * s], [x + 2 * s, y - 4 * s]], '#7b808a');
    poly([[x - 9 * s, y - 9 * s], [x - 2 * s, y - 13 * s], [x - 3 * s, y - 6 * s]], '#c1c5cd');
  }
  function drawRock(o) {
    const c = P(o.gx + 0.5, o.gy + 0.5);
    rockShape(c[0], c[1] + 2, 0.9 + o.v * 0.4, o.v);
    if (o.v > 0.6) rockShape(c[0] + 10, c[1] + 4, 0.5, 1 - o.v);
  }

  function drawCamp(o, t) {
    const def = D.CAMPS[o.camp];
    const f = foot(o.gx, o.gy, 2, 0.1);
    ctx.fillStyle = 'rgba(40,0,60,.35)';
    ctx.beginPath(); ctx.ellipse(f.c[0], f.c[1], 60, 30, 0, 0, Math.PI * 2); ctx.fill();
    const t1 = foot(o.gx + 0.1, o.gy + 0.15, 0.95);
    pyramid(t1, 0, 30, '#4a3566', '#2d1f42', '#1c1230');
    const t2 = foot(o.gx + 1.0, o.gy + 0.95, 0.95);
    pyramid(t2, 0, 26, '#4a3566', '#2d1f42', '#1c1230');
    // Totem au cristal noir
    const tp = P(o.gx + 1.45, o.gy + 0.45);
    poly([[tp[0] - 2, tp[1]], [tp[0] + 2, tp[1]], [tp[0] + 2, tp[1] - 36], [tp[0] - 2, tp[1] - 36]], '#2a1a12');
    const pulse = 10 + Math.sin(t * 3 + o.camp) * 6;
    crystal(tp[0], tp[1] - 44, 6, '#ff3f6c', '#a0153c', pulse);
    // Ennemi
    const bob = Math.sin(t * 2 + o.camp) * 3;
    emoji(def.icon, f.c[0], f.c[1] - 56 + bob, 30);
    if (Math.random() < 0.08) sparks.push({ x: f.c[0] + (Math.random() - 0.5) * 80, y: f.c[1] + (Math.random() - 0.5) * 30, vx: 0, vy: -18, life: 2, age: 0, r: 2.5, c: '120,60,190' });
  }

  function drawConstruction(o) {
    const def = B[o.kind];
    const f = foot(o.gx, o.gy, o.size, 0.15);
    box(f, 3, '#a58a63', '#87704f', '#bfa57c');
    const p = clamp(1 - (o.doneAt - now()) / (def.time * 1000), 0, 1);
    const h = Math.max(14, def.h * 0.6) * (0.3 + 0.7 * p);
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 2.5;
    for (const q of [f.l, f.b, f.r, f.t]) {
      ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0], q[1] - h); ctx.stroke();
    }
    ctx.beginPath();
    for (const hh of [h * 0.5, h]) {
      ctx.moveTo(f.l[0], f.l[1] - hh); ctx.lineTo(f.b[0], f.b[1] - hh); ctx.lineTo(f.r[0], f.r[1] - hh);
      ctx.moveTo(f.l[0], f.l[1] - hh); ctx.lineTo(f.t[0], f.t[1] - hh); ctx.lineTo(f.r[0], f.r[1] - hh);
    }
    ctx.stroke();
    // Barre de progression
    const bx = f.c[0] - 24, by = f.c[1] - h - 26;
    ctx.fillStyle = 'rgba(60,30,10,.75)';
    ctx.fillRect(bx - 1, by - 1, 50, 9);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(bx, by, 48 * p, 7);
    emoji('🔨', f.c[0], by - 12, 16);
  }

  function drawBuilding(o, t) {
    const k = o.kind;
    const { gx, gy } = o;
    if (k !== 'flowers' && k !== 'farm') {
      const pad = foot(gx, gy, o.size, 0.05);
      poly([pad.t, pad.r, pad.b, pad.l], 'rgba(120,90,50,.25)');
    }
    switch (k) {
      case 'castle': {
        const base = foot(gx, gy, 3, 0.12);
        box(base, 16, '#c9cdd8', '#9aa1b2', '#dde0e8');
        const tower = (x, y) => {
          const f = foot(x, y, 0.75);
          box(f, 42, '#e4e1ef', '#b3aecb', '#f0eef7');
          wallQuad(f, 'L', 0.35, 0.65, 0.55, 0.8, 42, '#5a6fb0');
          pyramid(f, 42, 24, '#6f8fe6', '#4d6cc9', '#3d58ad');
        };
        tower(gx + 0.1, gy + 0.1);
        tower(gx + 0.1, gy + 2.15);
        tower(gx + 2.15, gy + 0.1);
        const keep = foot(gx + 0.85, gy + 0.85, 1.3);
        box(keep, 60, '#f2eefb', '#c2bbdb', '#fbf9ff');
        wallQuad(keep, 'L', 0.3, 0.7, 0, 0.38, 60, '#7a4a2b');
        wallQuad(keep, 'R', 0.3, 0.45, 0.55, 0.75, 60, '#5a6fb0');
        wallQuad(keep, 'R', 0.6, 0.75, 0.55, 0.75, 60, '#5a6fb0');
        const apex = pyramid(keep, 60, 32, '#6f8fe6', '#4d6cc9', '#3d58ad');
        const bob = Math.sin(t * 2) * 3;
        crystal(apex[0], apex[1] - 16 + bob, 9, '#8ff3ff', '#57b8ff', 14 + Math.sin(t * 3) * 6);
        tower(gx + 2.15, gy + 2.15);
        if (Math.random() < 0.15) sparks.push({ x: apex[0] + (Math.random() - 0.5) * 20, y: apex[1] - 16, vx: (Math.random() - 0.5) * 20, vy: -20, life: 1.5, age: 0, r: 2, c: '160,240,255' });
        break;
      }
      case 'house': {
        const f = foot(gx, gy, 2, 0.28);
        box(f, 22, '#f3e6c8', '#d6c29a', '#f7ecd3');
        wallQuad(f, 'L', 0.42, 0.62, 0, 0.6, 22, '#7a4a2b');
        wallQuad(f, 'R', 0.3, 0.55, 0.35, 0.72, 22, '#8fd3ff');
        const a = pyramid(f, 22, 24, '#d4573f', '#a9402e', '#8a3324');
        poly([[a[0] + 10, a[1] + 12], [a[0] + 16, a[1] + 14], [a[0] + 16, a[1] + 2], [a[0] + 10, a[1]]], '#8d6e63');
        break;
      }
      case 'farm': {
        const f = foot(gx, gy, 2, 0.06);
        box(f, 3, '#8a5a36', '#6e4528', '#9b6a40');
        const p = isReady(o) ? 1 : clamp(1 - (o.readyAt - now()) / (B.farm.produce.time * 1000), 0, 1);
        for (let i = 1; i <= 5; i++) {
          const u = i / 6;
          const a = up(lerp(f.l, f.b, u), 3), b = up(lerp(f.t, f.r, u), 3);
          ctx.strokeStyle = '#7a4b2c'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          for (let j = 1; j <= 5; j++) {
            const q = lerp(a, b, j / 6);
            const r = 1.5 + p * 3;
            ctx.fillStyle = p >= 1 ? '#f4c430' : `hsl(${100 - p * 30},60%,${40 + p * 10}%)`;
            ctx.beginPath(); ctx.ellipse(q[0], q[1] - r, r * 0.7, r * 1.3, 0, 0, Math.PI * 2); ctx.fill();
          }
        }
        break;
      }
      case 'lumber': {
        const f = foot(gx, gy, 2, 0.3);
        box(f, 20, '#b5835a', '#8d6141', '#c79770');
        wallQuad(f, 'L', 0.35, 0.65, 0, 0.65, 20, '#5d3b22');
        pyramid(f, 20, 22, '#4f8a4b', '#386b36', '#2d5a2b');
        const lp = P(gx + 1.85, gy + 1.2);
        for (let i = 0; i < 3; i++) {
          const y = lp[1] - i * 5, x = lp[0] - (i % 2) * 4;
          poly([[x - 9, y - 3], [x + 7, y - 3], [x + 7, y + 3], [x - 9, y + 3]], '#9a6b43');
          circle(x + 7, y, 3, '#e3c393');
        }
        break;
      }
      case 'quarry': {
        const f = foot(gx, gy, 2, 0.1);
        box(f, 4, '#8d8f99', '#6f717b', '#a3a5ae');
        const r = hash(gx, gy);
        rockShape(f.c[0] - 14, f.c[1] - 2, 0.9, r);
        rockShape(f.c[0] + 12, f.c[1] - 6, 0.8, 1 - r);
        rockShape(f.c[0], f.c[1] + 8, 0.6, r);
        const pk = P(gx + 1.7, gy + 0.4);
        poly([[pk[0] - 1, pk[1]], [pk[0] + 1, pk[1]], [pk[0] + 1, pk[1] - 26], [pk[0] - 1, pk[1] - 26]], '#6d4c33');
        poly([[pk[0] - 10, pk[1] - 24], [pk[0] + 10, pk[1] - 28], [pk[0] + 10, pk[1] - 25], [pk[0] - 10, pk[1] - 21]], '#c0c4cc');
        break;
      }
      case 'barracks': {
        const f = foot(gx, gy, 3, 0.28);
        box(f, 28, '#b7b2a8', '#8f8a80', '#cdc8bd');
        wallQuad(f, 'L', 0.4, 0.6, 0, 0.6, 28, '#5d3b22');
        wallQuad(f, 'R', 0.2, 0.35, 0.45, 0.75, 28, '#3d3a35');
        wallQuad(f, 'R', 0.65, 0.8, 0.45, 0.75, 28, '#3d3a35');
        const a = pyramid(f, 28, 18, '#b8423a', '#8e2f29', '#74251f');
        ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0], a[1] - 26); ctx.stroke();
        const wave = Math.sin(t * 4) * 2;
        poly([[a[0], a[1] - 26], [a[0] + 18, a[1] - 22 + wave], [a[0], a[1] - 16]], '#e53935');
        break;
      }
      case 'storage': {
        const f = foot(gx, gy, 2, 0.22);
        box(f, 24, '#c08a52', '#985f2f', '#d39d64');
        wallQuad(f, 'L', 0.3, 0.7, 0, 0.7, 24, '#6b4220');
        wallQuad(f, 'L', 0.49, 0.51, 0, 0.7, 24, '#4a2c14');
        pyramid(f, 24, 18, '#8d6e63', '#6d4c41', '#5d4037');
        break;
      }
      case 'tower': {
        const f = foot(gx, gy, 1, 0.2);
        box(f, 52, '#c9c4ba', '#9d978c', '#ddd8cf');
        wallQuad(f, 'L', 0.4, 0.6, 0.6, 0.8, 52, '#3d3a35');
        wallQuad(f, 'R', 0.4, 0.6, 0.35, 0.55, 52, '#3d3a35');
        pyramid(f, 52, 22, '#6f8fe6', '#4d6cc9', '#3d58ad');
        break;
      }
      case 'shrine': {
        const f = foot(gx, gy, 2, 0.22);
        box(f, 8, '#f4f1ff', '#cfc9ea', '#ffffff');
        for (const [u, v] of [[0.32, 0.32], [1.68, 0.32], [0.32, 1.68], [1.68, 1.68]]) {
          const pf = foot(gx + u - 0.08, gy + v - 0.08, 0.16);
          poly([up(pf.l, 8), up(pf.b, 8), up(pf.b, 34), up(pf.l, 34)], '#eeeafc');
          poly([up(pf.b, 8), up(pf.r, 8), up(pf.r, 34), up(pf.b, 34)], '#c8c1e6');
        }
        const bob = Math.sin(t * 2.2) * 4;
        crystal(f.c[0], f.c[1] - 44 + bob, 11, '#b9a6ff', '#7d5cff', 18 + Math.sin(t * 3) * 8);
        if (Math.random() < 0.2) sparks.push({ x: f.c[0] + (Math.random() - 0.5) * 30, y: f.c[1] - 40, vx: 0, vy: -16, life: 1.4, age: 0, r: 2, c: '200,180,255' });
        break;
      }
      case 'fountain': {
        const f = foot(gx, gy, 1, 0.12);
        box(f, 7, '#d8dbe4', '#aeb3c0', '#e8ebf2');
        const w = foot(gx, gy, 1, 0.22);
        poly([up(w.t, 7), up(w.r, 7), up(w.b, 7), up(w.l, 7)], '#7fd3ff');
        poly([[f.c[0] - 2, f.c[1] - 7], [f.c[0] + 2, f.c[1] - 7], [f.c[0] + 2, f.c[1] - 20], [f.c[0] - 2, f.c[1] - 20]], '#c5c9d3');
        for (let i = 0; i < 6; i++) {
          const a = (t * 2 + i) % 1;
          const ang = (i / 6) * Math.PI * 2;
          circle(f.c[0] + Math.cos(ang) * a * 10, f.c[1] - 22 - Math.sin(a * Math.PI) * 8 + a * 12, 1.6, 'rgba(220,245,255,.9)');
        }
        break;
      }
      case 'flowers': {
        const f = foot(gx, gy, 1, 0.12);
        poly([f.t, f.r, f.b, f.l], '#4f9a3c');
        const cols = ['#ff6fa8', '#ffd54f', '#ffffff', '#b388ff', '#ff8a65'];
        for (let i = 0; i < 9; i++) {
          const u = hash(o.id, i), v = hash(i, o.id);
          const p = lerp(lerp(f.l, f.t, u), lerp(f.b, f.r, u), v);
          circle(p[0], p[1] - 3, 2.6, cols[i % cols.length]);
          circle(p[0], p[1] - 3, 1, '#fff59d');
        }
        break;
      }
      case 'statue': {
        const f = foot(gx, gy, 1, 0.28);
        box(f, 12, '#e6e1f3', '#b9b2d3', '#f5f2fb');
        const bob = Math.sin(t * 2 + o.id) * 2;
        crystal(f.c[0], f.c[1] - 30 + bob, 8, '#ff9fe0', '#c25bd6', 12);
        break;
      }
      default: break;
    }
  }

  function drawBubble(o, t) {
    const def = B[o.kind];
    const c = objCenter(o);
    const bob = Math.sin(t * 3 + o.id) * 3;
    const x = c[0], y = c[1] - def.h - 26 + bob;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    circle(x, y, 15, '#fffaf0');
    ctx.restore();
    ctx.strokeStyle = '#f2b53a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.stroke();
    poly([[x - 5, y + 13], [x + 5, y + 13], [x, y + 21]], '#fffaf0');
    emoji(D.RES[def.produce.res].icon, x, y + 1, 18);
  }

  function drawQueueBadge(o, t) {
    const c = objCenter(o);
    const q = o.queue[0];
    const u = D.UNITS[q.unit];
    const x = c[0], y = c[1] - B[o.kind].h - 22;
    circle(x, y, 13, 'rgba(255,250,240,.95)');
    emoji(u.icon, x, y + 1, 15);
    const total = u.time * 1000;
    const p = clamp(1 - (q.endAt - now()) / total, 0, 1);
    ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 15, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
  }

  function depth(o) { return o.gx + o.gy + o.size * 2 - 2 + o.gx * 0.001; }

  function drawWorld(t, dt) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Nuages lointains
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x > W + 120) { c.x = -120; c.y = Math.random() * H; }
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 60 * c.s, 18 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 30 * c.s, c.y - 10 * c.s, 34 * c.s, 18 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - 26 * c.s, c.y - 6 * c.s, 28 * c.s, 14 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const z = cam.z;
    ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cam.x * z), DPR * (H / 2 - cam.y * z));

    if (groundDirty) buildGround();
    ctx.drawImage(groundCanvas, groundCanvas.ox, groundCanvas.oy, groundCanvas.w, groundCanvas.h);

    // Sélection
    const sel = selectedId != null ? S.objects.find((o) => o.id === selectedId) : null;
    if (sel) {
      const f = foot(sel.gx, sel.gy, sel.size);
      poly([f.t, f.r, f.b, f.l], 'rgba(255,230,120,.25)', 'rgba(255,215,64,.95)', 2);
    }

    // Objets triés par profondeur
    const objs = S.objects.slice().sort((a, b) => depth(a) - depth(b));
    for (const o of objs) {
      if (placing && placing.move === o) continue;
      if (o.type === 'tree') drawTree(o, t);
      else if (o.type === 'rock') drawRock(o);
      else if (o.type === 'camp') drawCamp(o, t);
      else if (!o.built) drawConstruction(o);
      else drawBuilding(o, t);
    }
    for (const o of objs) {
      if (o.type !== 'b' || !o.built) continue;
      if (placing && placing.move === o) continue;
      if (isReady(o)) drawBubble(o, t);
      else if (o.queue && o.queue.length) drawQueueBadge(o, t);
    }

    // Fantôme de placement
    if (placing) {
      const def = B[placing.kind];
      const ok = isFree(placing.gx, placing.gy, def.size, placing.move);
      for (let y = 0; y < def.size; y++) {
        for (let x = 0; x < def.size; x++) {
          const f = foot(placing.gx + x, placing.gy + y, 1);
          poly([f.t, f.r, f.b, f.l], ok ? 'rgba(80,220,100,.45)' : 'rgba(240,70,70,.5)', 'rgba(255,255,255,.7)', 1);
        }
      }
      ctx.globalAlpha = 0.85;
      const ghost = { type: 'b', kind: placing.kind, gx: placing.gx, gy: placing.gy, size: def.size, built: true, id: -1, readyAt: now() + 1e9 };
      drawBuilding(ghost, t);
      ctx.globalAlpha = 1;
      const c = objCenter(ghost);
      emoji('✥', c[0], c[1] + 2, 20);
      $('placeOk').disabled = !ok;
    }

    // Étincelles
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age >= p.life) { sparks.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - dt; p.vy = p.vy * (1 - dt) + (p.g || 0) * dt;
      const a = 1 - p.age / p.life;
      circle(p.x, p.y, p.r * 2.2, `rgba(${p.c},${a * 0.25})`);
      circle(p.x, p.y, p.r, `rgba(${p.c},${a})`);
    }
    if (sparks.length > 300) sparks.splice(0, sparks.length - 300);

    // Textes flottants
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.age += dt;
      if (f.age > 1.4) { floaters.splice(i, 1); continue; }
      const a = f.age < 1 ? 1 : 1 - (f.age - 1) / 0.4;
      const y = f.y - f.age * 34;
      ctx.font = `bold 15px "Trebuchet MS", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = `rgba(60,30,10,${a * 0.8})`;
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color ? f.color : `rgba(255,236,150,${a})`;
      ctx.globalAlpha = a;
      ctx.fillText(f.text, f.x, y);
      ctx.globalAlpha = 1;
    }
  }

  function floater(text, x, y, color) {
    floaters.push({ text, x, y, age: 0, color });
  }
  function sparkle(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 60;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, g: 60, life: 0.8, age: 0, r: 2, c: '255,220,120' });
    }
  }

  // =====================================================================
  // Entrées (glisser, pincer, toucher)
  // =====================================================================
  function toWorld(sx, sy) { return [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y]; }
  function toTile(sx, sy) {
    const [wx, wy] = toWorld(sx, sy);
    return [Math.floor((wx / HW + wy / HH) / 2), Math.floor((wy / HH - wx / HW) / 2)];
  }
  function objHeight(o) {
    if (o.type === 'tree') return 50;
    if (o.type === 'rock') return 20;
    if (o.type === 'camp') return 80;
    return B[o.kind].h + (isReady(o) ? 40 : 0);
  }
  function pick(sx, sy) {
    const [wx, wy] = toWorld(sx, sy);
    const objs = S.objects.slice().sort((a, b) => depth(b) - depth(a));
    for (const o of objs) {
      const left = P(o.gx, o.gy + o.size)[0], right = P(o.gx + o.size, o.gy)[0];
      const top = P(o.gx, o.gy)[1] - objHeight(o), bottom = P(o.gx + o.size, o.gy + o.size)[1];
      if (wx < left + 4 || wx > right - 4 || wy < top || wy > bottom) continue;
      // Au niveau du sol, on exige d'être dans le losange
      const [tx, ty] = toTile(sx, sy);
      const inFoot = tx >= o.gx && tx < o.gx + o.size && ty >= o.gy && ty < o.gy + o.size;
      const aboveFoot = wy < P(o.gx + o.size / 2, o.gy + o.size / 2)[1];
      if (inFoot || aboveFoot) return o;
    }
    return null;
  }

  const pointers = new Map();
  let gesture = null;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      let onGhost = false;
      if (placing) {
        const [tx, ty] = toTile(e.clientX, e.clientY);
        const s = B[placing.kind].size;
        onGhost = tx >= placing.gx - 1 && tx <= placing.gx + s && ty >= placing.gy - 1 && ty <= placing.gy + s;
      }
      gesture = { mode: 'tap', sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, onGhost };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      gesture = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: cam.z, w0: toWorld(mid[0], mid[1]) };
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p || !gesture) return;
    p.x = e.clientX; p.y = e.clientY;
    if (gesture.mode === 'tap' && Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy) > 8) {
      gesture.mode = gesture.onGhost ? 'ghost' : 'pan';
    }
    if (gesture.mode === 'pan') {
      cam.x = gesture.cx - (e.clientX - gesture.sx) / cam.z;
      cam.y = gesture.cy - (e.clientY - gesture.sy) / cam.z;
      clampCam();
    } else if (gesture.mode === 'ghost') {
      const [tx, ty] = toTile(e.clientX, e.clientY);
      const s = B[placing.kind].size;
      placing.gx = clamp(tx - Math.floor(s / 2), 0, N - s);
      placing.gy = clamp(ty - Math.floor(s / 2), 0, N - s);
    } else if (gesture.mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      cam.z = clamp(gesture.z0 * d / gesture.d0, 0.45, 2.2);
      cam.x = gesture.w0[0] - (mid[0] - W / 2) / cam.z;
      cam.y = gesture.w0[1] - (mid[1] - H / 2) / cam.z;
      clampCam();
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture && gesture.mode === 'tap' && pointers.size === 0 && e.type === 'pointerup') handleTap(e.clientX, e.clientY);
    if (pointers.size === 0) gesture = null;
    else if (pointers.size === 1) {
      const p = [...pointers.values()][0];
      gesture = { mode: 'pan', sx: p.x, sy: p.y, cx: cam.x, cy: cam.y };
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const w = toWorld(e.clientX, e.clientY);
    cam.z = clamp(cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.45, 2.2);
    cam.x = w[0] - (e.clientX - W / 2) / cam.z;
    cam.y = w[1] - (e.clientY - H / 2) / cam.z;
    clampCam();
  }, { passive: false });

  function handleTap(sx, sy) {
    if (placing) {
      const [tx, ty] = toTile(sx, sy);
      const s = B[placing.kind].size;
      placing.gx = clamp(tx - Math.floor(s / 2), 0, N - s);
      placing.gy = clamp(ty - Math.floor(s / 2), 0, N - s);
      return;
    }
    const o = pick(sx, sy);
    if (!o) { closeSheet(); return; }
    if (o.type === 'b' && isReady(o)) { collect(o); save(); return; }
    selectedId = o.id;
    if (o.type === 'b') openBuildingSheet(o);
    else if (o.type === 'camp') openCampSheet(o);
    else openClearSheet(o);
  }

  function centerOn(o) {
    const c = objCenter(o);
    cam.x = c[0];
    cam.y = c[1] + 60;
    clampCam();
  }

  // =====================================================================
  // Interface : barre du haut, toasts
  // =====================================================================
  const resBar = $('resBar');
  const chips = {};
  for (const [k, r] of Object.entries(D.RES)) {
    const c = document.createElement('div');
    c.className = 'chip';
    c.innerHTML = `<i>${r.icon}</i><span></span>`;
    c.title = r.name;
    resBar.appendChild(c);
    chips[k] = { el: c, val: c.querySelector('span') };
  }
  const armyChip = document.createElement('div');
  armyChip.className = 'chip';
  armyChip.title = 'Armée';
  armyChip.innerHTML = '<i>⚔️</i><span></span>';
  resBar.appendChild(armyChip);

  function renderHud() {
    const cap = storageCap();
    for (const [k, c] of Object.entries(chips)) {
      c.val.textContent = fmt(S.res[k]);
      c.el.classList.toggle('full', k !== 'gems' && S.res[k] >= cap);
    }
    armyChip.querySelector('span').textContent = `${armySize()}/${popCap()}`;
    $('lvlNum').textContent = S.level;
    $('xpFill').style.width = `${clamp(S.xp / xpNeed(S.level), 0, 1) * 100}%`;
    const qb = $('questBanner');
    if (S.quest < QUESTS.length) {
      const q = QUESTS[S.quest];
      const [cur, goal] = q.goal();
      $('questText').textContent = goal > 1 ? `${q.text} (${Math.min(cur, goal)}/${goal})` : q.text;
      qb.hidden = !!placing;
    } else {
      $('questText').textContent = 'Le royaume est libéré !';
    }
    $('bottomBar').hidden = !!placing;
  }

  let toastTimer = 0;
  function toast(msg, ms = 2600) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  // =====================================================================
  // Panneaux
  // =====================================================================
  const sheet = $('sheet');
  const sheetBody = $('sheetBody');
  let sheetRefresh = null;

  function openSheet(html, refresh) {
    sheetBody.innerHTML = html;
    sheet.hidden = false;
    sheetBody.scrollTop = 0;
    sheetRefresh = refresh || null;
    if (sheetRefresh) sheetRefresh();
  }
  function closeSheet() {
    sheet.hidden = true;
    sheetRefresh = null;
    selectedId = null;
  }

  // --- Construire ---
  function openBuild() {
    selectedId = null;
    const cats = [['prod', 'Production'], ['war', 'Défense et armée'], ['deco', 'Décoration']];
    let html = '<h2><span class="e">🏗️</span>Construire</h2>';
    for (const [cat, label] of cats) {
      html += `<h3>${label}</h3><div class="grid">`;
      for (const [k, def] of Object.entries(B)) {
        if (def.cat !== cat) continue;
        const lock = unlockLevel(k);
        const max = maxKind(k), n = countKind(k);
        let tag = `<span class="tag">${n}/${max}</span>`;
        if (S.level < lock) tag = `<span class="tag lock">Niv. ${lock}</span>`;
        const disabled = S.level < lock || n >= max || !canAfford(def.cost);
        const prod = def.produce ? `${D.RES[def.produce.res].icon} +${def.produce.amount} / ${fmtTime(def.produce.time)}` : def.desc;
        html += `<button class="card" type="button" data-act="place" data-kind="${k}" ${disabled ? 'disabled' : ''}>
          ${tag}<span class="e">${def.icon}</span><b>${def.name}</b>
          <span class="meta">${prod}</span>${costHtml(def.cost)}<span class="meta">⏱ ${fmtTime(def.time)}</span></button>`;
      }
      html += '</div>';
    }
    openSheet(html);
  }

  function startPlace(kind, move) {
    closeSheet();
    const def = B[kind];
    let gx, gy;
    if (move) { gx = move.gx; gy = move.gy; }
    else {
      const [tx, ty] = toTile(W / 2, H / 2);
      const spot = findSpot(tx, ty, def.size);
      gx = spot[0]; gy = spot[1];
    }
    placing = { kind, gx, gy, move: move || null };
    $('placeInfo').innerHTML = move
      ? `Déplacer : ${def.icon} ${def.name}<small>Fais glisser le bâtiment, puis valide.</small>`
      : `${def.icon} ${def.name} ${costHtml(def.cost, false)}<small>Fais glisser le bâtiment, puis valide.</small>`;
    $('placeBar').hidden = false;
  }
  function findSpot(cx, cy, s) {
    for (let r = 0; r < N; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx, y = cy + dy;
          if (isFree(x, y, s)) return [x, y];
        }
      }
    }
    return [clamp(cx, 0, N - s), clamp(cy, 0, N - s)];
  }
  function confirmPlace() {
    if (!placing) return;
    const def = B[placing.kind];
    if (!isFree(placing.gx, placing.gy, def.size, placing.move)) return;
    if (placing.move) {
      placing.move.gx = placing.gx;
      placing.move.gy = placing.gy;
    } else {
      if (!canAfford(def.cost) || countKind(placing.kind) >= maxKind(placing.kind)) { toast('Ressources insuffisantes.'); cancelPlace(); return; }
      pay(def.cost);
      const o = addObj({ type: 'b', kind: placing.kind, gx: placing.gx, gy: placing.gy, size: def.size, built: false, doneAt: now() + def.time * 1000, readyAt: 0 });
      const c = objCenter(o);
      sparkle(c[0], c[1], 14);
    }
    placing = null;
    $('placeBar').hidden = true;
    rebuildGrid();
    save();
  }
  function cancelPlace() {
    placing = null;
    $('placeBar').hidden = true;
  }

  // --- Bâtiment ---
  function openBuildingSheet(o) {
    const def = B[o.kind];
    let html = `<h2><span class="e">${def.icon}</span>${def.name}</h2><p class="muted">${def.desc}</p>`;
    if (!o.built) {
      html += `<p>Construction en cours : <b id="shTimer"></b></p><div class="bar"><div id="shBar"></div></div>
        <div class="row"><button class="btn gem" type="button" data-act="speed" id="shSpeed"></button></div>`;
      openSheet(html, () => {
        if (o.built) { openBuildingSheet(o); return; }
        const left = (o.doneAt - now()) / 1000;
        $('shTimer').textContent = fmtTime(left);
        $('shBar').style.width = `${clamp(1 - left / def.time, 0, 1) * 100}%`;
        const c = speedCost(o);
        const btn = $('shSpeed');
        btn.textContent = `⚡ Terminer maintenant (${c} 💎)`;
        btn.disabled = S.res.gems < c;
      });
      return;
    }
    if (def.produce) {
      const r = D.RES[def.produce.res];
      html += `<p>Produit <b>${fmt(def.produce.amount)} ${r.icon}</b> toutes les ${fmtTime(def.produce.time)}.</p>
        <p id="shState"></p><div class="bar"><div id="shBar"></div></div>`;
    }
    if (o.kind === 'castle') html += `<p>Réserves : <b>${fmt(storageCap())}</b> par ressource · Population : <b>${popCap()}</b></p>`;
    if (o.kind === 'house') html += `<p>+${def.pop} places dans ton armée.</p>`;
    if (o.kind === 'storage') html += `<p>+${fmt(def.storage)} de réserve par ressource (total : ${fmt(storageCap())}).</p>`;
    if (o.kind === 'tower') html += `<p>Bonus d'attaque actuel : <b>+${Math.round((towerBonus() - 1) * 100)} %</b></p>`;
    if (def.trains) {
      html += `<h3>Entraîner des soldats</h3><p>Armée : <b id="shArmy"></b> · <span id="shQueue" class="muted"></span></p><div class="units">`;
      for (const [k, u] of Object.entries(D.UNITS)) {
        const locked = S.level < u.unlock;
        html += `<div class="unit"><span class="e">${u.icon}</span><div class="info"><b>${u.name}</b>
          <div class="meta">⚔️ ${u.atk} · ❤️ ${u.hp} · ⏱ ${fmtTime(u.time)}</div>${costHtml(u.cost, false)}</div>
          <button class="btn ok" type="button" data-act="train" data-unit="${k}" ${locked ? 'disabled' : ''}>${locked ? `Niv. ${u.unlock}` : 'Entraîner'}</button></div>`;
      }
      html += '</div>';
    }
    if (o.kind !== 'castle') html += '<div class="row"><button class="btn" type="button" data-act="move">✥ Déplacer</button></div>';
    openSheet(html, () => {
      if (def.produce) {
        const ready = isReady(o);
        const left = (o.readyAt - now()) / 1000;
        $('shState').innerHTML = ready ? '<b>Prêt !</b> Touche le bâtiment pour récolter.' : `Prochaine récolte dans <b>${fmtTime(left)}</b>`;
        $('shBar').style.width = `${ready ? 100 : clamp(1 - left / def.produce.time, 0, 1) * 100}%`;
      }
      if (def.trains) {
        $('shArmy').textContent = `${armySize()}/${popCap()}`;
        const q = o.queue || [];
        $('shQueue').textContent = q.length ? `En formation : ${q.map((x) => D.UNITS[x.unit].icon).join(' ')} (${fmtTime((q[0].endAt - now()) / 1000)})` : 'Aucun soldat en formation';
        sheetBody.querySelectorAll('[data-act="train"]').forEach((btn) => {
          const u = D.UNITS[btn.dataset.unit];
          btn.disabled = S.level < u.unlock || !canAfford(u.cost) || armySize() + queuedSize() >= popCap();
        });
      }
    });
  }

  // --- Arbres et rochers ---
  function openClearSheet(o) {
    const c = D.CLEAR[o.type];
    const html = `<h2><span class="e">${o.type === 'tree' ? '🌳' : '🪨'}</span>${c.name}</h2>
      <p>${c.verb} pour récupérer ${rewardText(c.gain)} et libérer de la place.</p>
      <p>Coût : ${costHtml(c.cost)}</p>
      <div class="row"><button class="btn ok" type="button" data-act="clear" ${canAfford(c.cost) ? '' : 'disabled'}>${c.verb} (${rewardText(c.gain)})</button></div>`;
    openSheet(html);
  }
  function clearObj(o) {
    const c = D.CLEAR[o.type];
    if (!canAfford(c.cost)) return;
    pay(c.cost);
    const p = objCenter(o);
    for (const [k, v] of Object.entries(c.gain)) gain(k, v, p[0], p[1] - 20);
    addXp(c.xp, p[0], p[1] - 20);
    sparkle(p[0], p[1] - 10, 12);
    S.objects = S.objects.filter((x) => x !== o);
    S.stats.cleared++;
    rebuildGrid();
    closeSheet();
    save();
  }

  // --- Repaires d'ombre ---
  function chance(def) {
    const a = armyStats();
    if (a.atk <= 0) return { label: 'Aucune armée', cls: 'lack' };
    const r = (a.atk * a.hp) / (def.atk * def.hp);
    if (r >= 2) return { label: 'Victoire assurée', cls: '' };
    if (r >= 1.2) return { label: 'Bonnes chances', cls: '' };
    if (r >= 0.7) return { label: 'Combat serré', cls: '' };
    return { label: 'Très risqué', cls: 'lack' };
  }
  function openCampSheet(o) {
    const def = D.CAMPS[o.camp];
    const a = armyStats();
    const ch = chance(def);
    const loot = Object.assign({}, def.loot, { gems: def.gems });
    const html = `<h2><span class="e">${def.icon}</span>${def.name}</h2><p class="muted">${def.desc}</p>
      <div class="stats"><div><span>Attaque ennemie</span><b>⚔️ ${def.atk}</b></div><div><span>Vie ennemie</span><b>❤️ ${fmt(def.hp)}</b></div><div><span>Ton armée</span><b>⚔️ ${fmt(a.atk)} · ❤️ ${fmt(a.hp)}</b></div></div>
      <p>Pronostic : <b class="${ch.cls}">${ch.label}</b></p>
      <p>Butin : ${rewardText(loot)} · +${def.xp} XP · terres libérées</p>
      <div class="row"><button class="btn war" type="button" data-act="attack" ${armySize() ? '' : 'disabled'}>⚔️ Attaquer avec toute l'armée</button></div>
      ${armySize() ? '' : '<p class="muted">Construis une Caserne et entraîne des soldats pour attaquer.</p>'}`;
    openSheet(html);
  }

  // --- Armée ---
  function openArmy() {
    selectedId = null;
    const a = armyStats();
    let html = `<h2><span class="e">⚔️</span>Armée</h2>
      <div class="stats"><div><span>Soldats</span><b>${armySize()}/${popCap()}</b></div><div><span>Attaque</span><b>${fmt(a.atk)}</b></div><div><span>Vie</span><b>${fmt(a.hp)}</b></div></div><div class="units" style="margin-top:10px">`;
    for (const [k, u] of Object.entries(D.UNITS)) {
      html += `<div class="unit"><span class="e">${u.icon}</span><div class="info"><b>${u.name}</b><div class="meta">⚔️ ${u.atk} · ❤️ ${u.hp}${S.level < u.unlock ? ` · débloqué au niveau ${u.unlock}` : ''}</div></div><b>× ${S.army[k] || 0}</b></div>`;
    }
    html += `</div><h3>Repaires d'ombre</h3><div class="units">`;
    D.CAMPS.forEach((c, i) => {
      const done = S.beaten.includes(i);
      html += `<div class="unit"><span class="e">${done ? '✨' : c.icon}</span><div class="info"><b>${c.name}</b><div class="meta">${done ? 'Terres libérées' : `⚔️ ${c.atk} · ❤️ ${fmt(c.hp)}`}</div></div>
        ${done ? '<span class="muted">✓</span>' : `<button class="btn" type="button" data-act="goCamp" data-camp="${i}">Voir</button>`}</div>`;
    });
    html += '</div>';
    if (!countKind('barracks')) html += `<p class="muted">Construis une Caserne (niveau 2) pour entraîner des soldats.</p>`;
    openSheet(html);
  }

  // --- Quêtes ---
  function openQuests() {
    selectedId = null;
    let html = '<h2><span class="e">📜</span>Quêtes</h2><ul class="qlist">';
    QUESTS.forEach((q, i) => {
      if (i > S.quest + 2) return;
      const cls = i < S.quest ? 'done' : i === S.quest ? 'cur' : '';
      const [cur, goal] = q.goal();
      const prog = i === S.quest && goal > 1 ? ` (${Math.min(cur, goal)}/${goal})` : '';
      html += `<li class="${cls}">${i < S.quest ? '✅' : '📜'} ${q.text}${prog}<span class="r">${rewardText(q.reward)}</span></li>`;
    });
    html += '</ul>';
    if (S.quest >= QUESTS.length) html += '<p>Tu as libéré tout le royaume ! D’autres aventures arrivent bientôt.</p>';
    html += `<p class="muted">Quêtes accomplies : ${Math.min(S.quest, QUESTS.length)} / ${QUESTS.length}</p>`;
    openSheet(html);
  }

  // --- Options ---
  function openSettings() {
    selectedId = null;
    const html = `<h2><span class="e">⚙️</span>Options</h2>
      <p>Ta partie est sauvegardée automatiquement sur cet appareil. Les constructions, récoltes et entraînements continuent même quand le jeu est fermé.</p>
      <h3>Comment jouer</h3>
      <p>👆 Glisse un doigt pour te déplacer, pince pour zoomer.<br>🏗️ Construis des bâtiments, puis touche-les quand une bulle apparaît pour récolter.<br>⚔️ Entraîne des soldats à la Caserne et libère l’île des repaires d’ombre.<br>🌳 Touche les arbres et les rochers pour récupérer du bois et de la pierre.</p>
      <div class="row"><button class="btn" type="button" data-act="center">🏰 Revenir à la citadelle</button>
      <button class="btn war" type="button" data-act="askReset">Recommencer la partie</button></div>
      <p class="muted">Niveau ${S.level} · ${S.stats.collects} récoltes · ${S.stats.trained} soldats entraînés · ${S.beaten.length} repaires libérés</p>`;
    openSheet(html);
  }

  // =====================================================================
  // Bataille
  // =====================================================================
  function simulate(def) {
    const units = [];
    for (const [k, n] of Object.entries(S.army)) for (let i = 0; i < n; i++) units.push({ k, hp: D.UNITS[k].hp });
    units.sort((a, b) => D.UNITS[b.k].hp - D.UNITS[a.k].hp);
    const startHp = units.reduce((s, u) => s + u.hp, 0);
    const bonus = towerBonus();
    let eHp = def.hp;
    const rounds = [];
    const dead = {};
    for (let r = 0; r < 40 && eHp > 0 && units.length; r++) {
      const atk = units.reduce((s, u) => s + D.UNITS[u.k].atk, 0) * bonus * (0.85 + Math.random() * 0.3);
      eHp = Math.max(0, eHp - atk);
      let edmg = 0;
      const lost = [];
      if (eHp > 0) {
        edmg = def.atk * (0.85 + Math.random() * 0.3);
        let d = edmg;
        while (d > 0 && units.length) {
          const u = units[0];
          const take = Math.min(u.hp, d);
          u.hp -= take; d -= take;
          if (u.hp <= 0) { units.shift(); dead[u.k] = (dead[u.k] || 0) + 1; lost.push(u.k); }
        }
      }
      rounds.push({ atk, edmg, eHp, aHp: units.reduce((s, u) => s + u.hp, 0), lost });
    }
    const win = eHp <= 0;
    return { rounds, win, dead, startHp };
  }

  function attack(o) {
    const def = D.CAMPS[o.camp];
    if (!armySize()) return;
    closeSheet();
    const sim = simulate(def);
    // Appliquer les pertes tout de suite (sauvegarde cohérente)
    for (const [k, n] of Object.entries(sim.dead)) S.army[k] = Math.max(0, (S.army[k] || 0) - n);
    let loot = null;
    if (sim.win) {
      loot = {};
      for (const [k, v] of Object.entries(def.loot)) loot[k] = gain(k, v);
      loot.gems = gain('gems', def.gems);
      S.beaten.push(o.camp);
      S.stats.wins++;
      S.objects = S.objects.filter((x) => x !== o);
      rebuildGrid();
      addXp(def.xp);
    }
    save();
    playBattle(def, sim, loot);
  }

  function playBattle(def, sim, loot) {
    const el = $('battle');
    $('bTitle').textContent = `⚔️ ${def.name}`;
    const troops = $('bTroops');
    troops.innerHTML = '';
    const order = [];
    for (const [k, n] of Object.entries(S.army)) for (let i = 0; i < n; i++) order.push(k);
    for (const [k, n] of Object.entries(sim.dead)) for (let i = 0; i < n; i++) order.push(k);
    order.sort((a, b) => D.UNITS[b].hp - D.UNITS[a].hp);
    const spans = order.map((k) => { const s = document.createElement('span'); s.textContent = D.UNITS[k].icon; s.dataset.k = k; troops.appendChild(s); return s; });
    $('bFoe').textContent = def.icon;
    $('bArmyHp').style.width = '100%';
    $('bFoeHp').style.width = '100%';
    $('bArmyLabel').textContent = `❤️ ${fmt(sim.startHp)}`;
    $('bFoeLabel').textContent = `❤️ ${fmt(def.hp)}`;
    $('bLog').textContent = 'La bataille commence !';
    $('bResult').hidden = true;
    $('bClose').hidden = true;
    el.hidden = false;

    let i = 0;
    const step = () => {
      if (i >= sim.rounds.length) return finish();
      const r = sim.rounds[i++];
      const foe = $('bFoe');
      foe.classList.remove('hit'); void foe.offsetWidth; foe.classList.add('hit');
      $('bFoeHp').style.width = `${(r.eHp / def.hp) * 100}%`;
      $('bFoeLabel').textContent = `❤️ ${fmt(r.eHp)}`;
      let log = `Ton armée inflige ${fmt(r.atk)} dégâts.`;
      if (r.edmg > 0) {
        setTimeout(() => {
          troops.classList.remove('hit'); void troops.offsetWidth; troops.classList.add('hit');
          $('bArmyHp').style.width = `${(r.aHp / sim.startHp) * 100}%`;
          $('bArmyLabel').textContent = `❤️ ${fmt(r.aHp)}`;
          for (const k of r.lost) {
            const s = spans.find((x) => x.dataset.k === k && !x.classList.contains('dead'));
            if (s) s.classList.add('dead');
          }
        }, 220);
        log += ` L'ennemi riposte : ${fmt(r.edmg)}.`;
      }
      $('bLog').textContent = log;
      setTimeout(step, Math.max(260, 2600 / sim.rounds.length));
    };
    const finish = () => {
      const lost = Object.values(sim.dead).reduce((a, b) => a + b, 0);
      const res = $('bResult');
      if (sim.win) {
        res.innerHTML = `<b>🏆 Victoire !</b>Les terres sont libérées de l'ombre.<br>Butin : ${rewardText(loot)} · +${def.xp} XP${lost ? `<br>Soldats tombés : ${lost}` : '<br>Aucune perte !'}`;
      } else {
        res.innerHTML = `<b>💀 Défaite…</b>${lost ? `Tu as perdu ${lost} soldat${lost > 1 ? 's' : ''}.` : ''} Renforce ton armée et reviens plus fort.`;
      }
      res.hidden = false;
      $('bClose').hidden = false;
    };
    setTimeout(step, 600);
  }

  // =====================================================================
  // Actions (délégation des clics)
  // =====================================================================
  const actions = {
    openBuild, openArmy, openQuests, openSettings,
    closeSheet: () => closeSheet(),
    place: (d) => startPlace(d.kind),
    confirmPlace: () => confirmPlace(),
    cancelPlace: () => cancelPlace(),
    move: () => { const o = S.objects.find((x) => x.id === selectedId); if (o) startPlace(o.kind, o); },
    speed: () => {
      const o = S.objects.find((x) => x.id === selectedId);
      if (!o || o.built) return;
      const c = speedCost(o);
      if (S.res.gems < c) return;
      S.res.gems -= c;
      o.doneAt = now();
      update();
      save();
    },
    train: (d) => { const o = S.objects.find((x) => x.id === selectedId); if (o) trainUnit(o, d.unit); },
    clear: () => { const o = S.objects.find((x) => x.id === selectedId); if (o) clearObj(o); },
    attack: () => { const o = S.objects.find((x) => x.id === selectedId); if (o) attack(o); },
    goCamp: (d) => {
      const o = S.objects.find((x) => x.type === 'camp' && x.camp === Number(d.camp));
      if (!o) return;
      centerOn(o);
      selectedId = o.id;
      openCampSheet(o);
    },
    closeBattle: () => { $('battle').hidden = true; checkQuests(); },
    center: () => { const c = S.objects.find((x) => x.kind === 'castle'); if (c) centerOn(c); closeSheet(); },
    askReset: () => {
      openSheet(`<h2><span class="e">⚠️</span>Recommencer ?</h2><p>Toute ta progression sera effacée. Cette action est définitive.</p>
        <div class="row"><button class="btn" type="button" data-act="closeSheet">Annuler</button><button class="btn war" type="button" data-act="reset">Tout effacer</button></div>`);
    },
    reset: () => { newGame(); save(); closeSheet(); start(); toast('Une nouvelle aventure commence !'); },
    openQuestsBanner: () => openQuests(),
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const fn = actions[b.dataset.act];
    if (fn) fn(b.dataset);
  });
  $('questBanner').addEventListener('click', openQuests);
  $('levelBtn').addEventListener('click', () => toast(`Niveau ${S.level} · ${fmt(S.xp)} / ${fmt(xpNeed(S.level))} XP`));

  // =====================================================================
  // Boucle
  // =====================================================================
  function update() {
    const t = now();
    for (const o of S.objects) if (o.type === 'b' && !o.built && t >= o.doneAt) finishBuild(o);
    processQueues();
    checkQuests();
  }

  let last = performance.now();
  let lastUi = 0;
  let lastSave = now();
  function frame(ts) {
    const dt = Math.min(0.1, (ts - last) / 1000);
    last = ts;
    update();
    drawWorld(ts / 1000, dt);
    if (ts - lastUi > 250) {
      renderHud();
      if (sheetRefresh && !sheet.hidden) sheetRefresh();
      lastUi = ts;
    }
    if (now() - lastSave > 5000) { save(); lastSave = now(); }
    requestAnimationFrame(frame);
  }

  function start() {
    const castle = S.objects.find((o) => o.kind === 'castle');
    cam.z = Math.min(1.1, Math.max(0.7, W / 520));
    centerOn(castle);
    renderHud();
  }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  const loaded = load();
  if (!loaded) newGame();
  resize();
  start();
  if (!loaded) setTimeout(() => toast('✨ Bienvenue ! Suis les quêtes 📜 pour bâtir ton royaume.', 4000), 600);
  requestAnimationFrame(frame);

  // Accès pour les tests
  window.EE = {
    get state() { return S; }, save, update,
    screenOf: (o) => { const c = objCenter(o); return [(c[0] - cam.x) * cam.z + W / 2, (c[1] - cam.y) * cam.z + H / 2]; },
  };
})();
