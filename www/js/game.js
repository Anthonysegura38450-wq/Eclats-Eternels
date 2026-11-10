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
  const ri = (k) => `<img class="ri" src="${window.EE_ART.iconURL('res_' + k, 48)}" alt="${D.RES[k].name}">`;
  const img = (key, cls = 'ue', px = 96) => `<img class="${cls}" src="${window.EE_ART.iconURL(key, px)}" alt="">`;
  function costHtml(cost, check = true) {
    return '<span class="costs">' + Object.entries(cost).map(([k, v]) =>
      `<span class="${check && S.res[k] < v ? 'lack' : ''}">${ri(k)} ${fmt(v)}</span>`).join('') + '</span>';
  }
  const $ = (id) => document.getElementById(id);

  // =====================================================================
  // État du jeu
  // =====================================================================
  let S = null;
  let grid = new Array(N * N).fill(null);

  // --- Forme de l'île (identique pour toutes les parties) ---
  const LAYOUT = (function () {
    const land = new Uint8Array(N * N), water = new Uint8Array(N * N);
    const c = N / 2;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const nx = Math.abs((x + 0.5 - c) / c), ny = Math.abs((y + 0.5 - c) / c);
        const d = Math.pow(Math.pow(nx, 2.4) + Math.pow(ny, 2.4), 1 / 2.4);
        const wob = 0.07 * Math.sin(x * 1.3 + y * 0.45) + 0.05 * Math.cos(y * 1.15 - x * 0.7) + 0.03 * Math.sin((x + y) * 2.1);
        if (d < 1.0 + wob) land[y * N + x] = 1;
      }
    }
    // Lac et rivière qui se jette en cascade au bord de l'île
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const dx = x + 0.5 - 17.2, dy = y + 0.5 - 16.2;
        const a = Math.atan2(dy, dx);
        if (Math.hypot(dx * 0.95, dy) < 2.35 + 0.35 * Math.sin(a * 3 + 1)) water[y * N + x] = 1;
      }
    }
    let fall = null;
    for (let x = 18; x < N; x++) {
      const y = 16 + Math.round(Math.sin(x * 0.9) * 0.6);
      if (!land[y * N + x]) break;
      water[y * N + x] = 1;
      fall = [x, y];
    }
    const blocked = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) blocked[i] = !land[i] || water[i] ? 1 : 0;
    // Chemins de terre (décor) qui partent de la place de la citadelle
    const paths = [
      [[11.5, 13.6], [11.6, 15.5], [10.8, 17.5], [9.6, 19.5], [9.2, 21.5]],
      [[13.6, 11.5], [15.2, 12.2], [16.2, 13.8]],
      [[9.4, 11.5], [7.5, 11.2], [5.5, 12.2], [3.6, 12]],
      [[11.5, 9.4], [11.8, 7.5], [13, 5.5], [13.4, 3.5]],
    ];
    return { land, water, blocked, fall, paths, plaza: [9.4, 9.4, 13.6, 13.6] };
  })();

  function addObj(o) {
    o.id = S.nextId++;
    S.objects.push(o);
    return o;
  }

  function nearWater(x, y) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < N && Y < N && LAYOUT.water[Y * N + X]) return true;
    }
    return false;
  }

  function newGame() {
    const seed = (Math.random() * 1e9) | 0;
    S = {
      v: 1, seed, created: now(),
      res: Object.assign({}, D.START),
      xp: 0, level: 1,
      army: {}, objects: [], nextId: 1,
      stats: { collects: 0, trained: 0, cleared: 0, wins: 0, summoned: 0 },
      beaten: [], quest: 0, discovered: [], campCd: {},
    };
    addObj({ type: 'b', kind: 'castle', gx: 10, gy: 10, size: 3, built: true, doneAt: 0, readyAt: now() + B.castle.produce.time * 1000 });
    rebuildGrid();

    const r = rng(seed);
    let trees = 0, rocks = 0, tries = 0;
    while ((trees < 46 || rocks < 16) && tries < 4000) {
      tries++;
      const gx = (r() * N) | 0, gy = (r() * N) | 0;
      if (Math.abs(gx - 11) <= 3 && Math.abs(gy - 11) <= 3) continue;
      if (grid[gy * N + gx] || LAYOUT.blocked[gy * N + gx] || nearWater(gx, gy)) continue;
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
      S.stats = Object.assign({ collects: 0, trained: 0, cleared: 0, wins: 0, summoned: 0 }, S.stats);
      S.discovered = Array.isArray(S.discovered) ? S.discovered : [];
      for (const k of Object.keys(S.army)) if (!D.UNITS[k]) delete S.army[k];
      S.army = S.army || {};
      S.beaten = S.beaten || [];
      for (const k of Object.keys(D.RES)) S.res[k] = Number(S.res[k]) || 0;
      S.campCd = S.campCd || {};
      // Anciennes versions : les repaires étaient sur l'île, et le décor pouvait être dans l'eau
      S.objects = S.objects.filter((o) => o.type !== 'camp' && !((o.type === 'tree' || o.type === 'rock') && LAYOUT.blocked[o.gy * N + o.gx]));
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
    for (const o of S.objects) {
      for (let y = o.gy; y < o.gy + o.size; y++) {
        for (let x = o.gx; x < o.gx + o.size; x++) {
          if (x >= 0 && y >= 0 && x < N && y < N) grid[y * N + x] = o;
        }
      }
    }
  }

  function isFree(gx, gy, size, ignore) {
    if (gx < 0 || gy < 0 || gx + size > N || gy + size > N) return false;
    for (let y = gy; y < gy + size; y++) {
      for (let x = gx; x < gx + size; x++) {
        const o = grid[y * N + x];
        if (o && o !== ignore) return false;
        if (LAYOUT.blocked[y * N + x]) return false;
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
    return B.castle.pop + countBuilt('house') * B.house.pop + countBuilt('den') * B.den.pop;
  }
  // Une unité, une créature ou l'œuf mystère
  const unitDef = (k) => (k === 'egg' ? D.EGG : D.UNITS[k]);
  const popOf = (k) => unitDef(k).pop || 1;
  function armyCount() {
    return Object.values(S.army).reduce((a, b) => a + b, 0);
  }
  // Places occupées (une créature peut prendre plusieurs places)
  function armySize() {
    return Object.entries(S.army).reduce((n, [k, c]) => n + c * popOf(k), 0);
  }
  function queuedSize() {
    return buildings().reduce((n, b) => n + (b.queue ? b.queue.reduce((m, q) => m + popOf(q.unit), 0) : 0), 0);
  }
  // Pourquoi une unité ne peut pas (encore) être entraînée ; null si c'est possible
  function lockReason(k) {
    const u = unitDef(k);
    if (u.unlock && S.level < u.unlock) return `Niv. ${u.unlock}`;
    if (u.req != null && !S.beaten.includes(u.req)) return 'Bloqué';
    return null;
  }
  function rollEgg() {
    const w = D.EGG.weights;
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let rarity = 'common';
    for (const [k, v] of Object.entries(w)) { if ((r -= v) < 0) { rarity = k; break; } }
    const pool = Object.keys(D.UNITS).filter((k) => D.UNITS[k].monster && D.UNITS[k].rarity === rarity);
    return pool[(Math.random() * pool.length) | 0];
  }
  const monsterKeys = () => Object.keys(D.UNITS).filter((k) => D.UNITS[k].monster);
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
    if (wx != null && g > 0) floater(`+${fmt(g)}`, wx, wy, null, 'res_' + res);
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
      const units = Object.keys(D.UNITS).filter((k) => !D.UNITS[k].monster && D.UNITS[k].unlock === S.level).map((k) => D.UNITS[k].name);
      if (Object.values(D.UNITS).some((u) => u.monster && u.unlock === S.level)) units.push('nouvelles créatures');
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
    const u = unitDef(k);
    if (lockReason(k) || !canAfford(u.cost)) return;
    if (armySize() + queuedSize() + popOf(k) > popCap()) {
      toast('🏠 Plus de place ! Construis des Chaumières ou un Antre pour agrandir ton armée.');
      return;
    }
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
        const key = q.unit === 'egg' ? rollEgg() : q.unit;
        const u = D.UNITS[key];
        S.army[key] = (S.army[key] || 0) + 1;
        const c = objCenter(b);
        floater('+1', c[0], c[1] - 60, null, key);
        if (u.monster) {
          S.stats.summoned++;
          if (!S.discovered.includes(key)) {
            S.discovered.push(key);
            toast(`${q.unit === 'egg' ? '🥚 L’œuf éclot ! ' : ''}Nouvelle créature ${D.RARITY[u.rarity].name.toLowerCase()} : ${u.icon} ${u.name} !`, 3500);
          } else if (q.unit === 'egg') {
            toast(`🥚 L’œuf éclot : ${u.icon} ${u.name} !`);
          }
          addXp(5);
        } else {
          S.stats.trained++;
          addXp(3);
        }
        sparkle(c[0], c[1] - 50, 12);
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
    { text: 'Construis un Antre des créatures', goal: () => [countBuilt('den'), 1], reward: { gems: 3 }, xp: 40 },
    { text: 'Invoque ta première créature', goal: () => [S.stats.summoned, 1], reward: { gems: 4 }, xp: 30 },
    { text: "Libère 2 repaires d'ombre", goal: () => [S.beaten.length, 2], reward: { gems: 3 }, xp: 30 },
    { text: 'Atteins le niveau 4', goal: () => [S.level, 4], reward: { gold: 300 }, xp: 0 },
    { text: 'Construis une Tour de guet', goal: () => [countBuilt('tower'), 1], reward: { stone: 100 }, xp: 30 },
    { text: "Libère 3 repaires d'ombre", goal: () => [S.beaten.length, 3], reward: { gems: 4 }, xp: 40 },
    { text: 'Atteins le niveau 5', goal: () => [S.level, 5], reward: { gold: 500 }, xp: 0 },
    { text: "Construis un Sanctuaire d'éclats", goal: () => [countBuilt('shrine'), 1], reward: { gems: 5 }, xp: 50 },
    { text: 'Découvre 6 créatures du Bestiaire', goal: () => [S.discovered.length, 6], reward: { gems: 8 }, xp: 60 },
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
  const rewardHtml = (r) => '<span class="costs">' + Object.entries(r).map(([k, v]) => `<span>${ri(k)} +${fmt(v)}</span>`).join('') + '</span>';

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

  // --- Rendu (les dessins sont dans art.js) ---
  const ART = window.EE_ART;
  let ground = null;
  function poly(pts, fill, stroke, lw = 1) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function circle(x, y, r, fill) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  }
  function growth(o) {
    return clamp(1 - (o.readyAt - now()) / (B[o.kind].produce.time * 1000), 0, 1);
  }
  function variantOf(o) {
    if (o.kind === 'house') return o.id % 2;
    if (o.kind === 'farm') return isReady(o) ? 5 : Math.min(4, Math.floor(growth(o) * 5));
    return 0;
  }

  // Les créatures de l'armée se promènent autour de leur Antre
  function drawRoamingMonsters(t) {
    const dens = S.objects.filter((o) => o.type === 'b' && o.kind === 'den' && o.built && !(placing && placing.move === o));
    if (!dens.length) return;
    const beasts = [];
    for (const k of monsterKeys()) for (let i = 0; i < (S.army[k] || 0); i++) beasts.push(k);
    const list = beasts.slice(0, dens.length * 8).map((k, i) => {
      const den = dens[i % dens.length];
      const seed = hash(i, den.id);
      const dir = seed > 0.5 ? 1 : -1;
      const speed = 0.12 + seed * 0.1;
      const ang = t * speed * dir + seed * 20;
      const rad = 1.95 + Math.sin(t * 0.4 + i) * 0.3;
      const gx = den.gx + 1.5 + Math.cos(ang) * rad, gy = den.gy + 1.5 + Math.sin(ang) * rad;
      // sens de marche à l'écran : dérivée de x écran
      const dxs = (-Math.sin(ang) - Math.cos(ang)) * dir;
      return { k, gx, gy, flip: dxs < 0, hop: Math.abs(Math.sin(t * 5 + i * 1.7)) * 4 };
    });
    list.sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
    for (const m of list) {
      const [x, y] = P(m.gx, m.gy);
      ART.drawSprite(ctx, m.k, x, y, 40, m.flip, m.hop);
    }
  }

  function depth(o) { return o.gx + o.gy + o.size * 2 - 2 + o.gx * 0.001; }

  function drawWorld(t, dt) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Nuages lointains
    const cl = ART.cloudSprite();
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x > W + 200) { c.x = -260; c.y = Math.random() * H; }
      ctx.globalAlpha = 0.85;
      ctx.drawImage(cl, c.x - 80 * c.s, c.y - 35 * c.s, 160 * c.s, 70 * c.s);
      ctx.globalAlpha = 1;
    }

    const z = cam.z;
    ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cam.x * z), DPR * (H / 2 - cam.y * z));
    ctx.imageSmoothingQuality = 'high';

    if (!ground) ground = ART.buildGround(N, LAYOUT);
    ctx.drawImage(ground.c, ground.ox, ground.oy, ground.w, ground.h);
    ART.drawWaterLive(ctx, t);

    // Sélection
    const sel = selectedId != null ? S.objects.find((o) => o.id === selectedId) : null;
    if (sel) {
      const f = foot(sel.gx, sel.gy, sel.size);
      poly([f.t, f.r, f.b, f.l], 'rgba(255,230,120,.22)', 'rgba(255,215,64,.95)', 2);
    }

    // Objets triés par profondeur
    const objs = S.objects.slice().sort((a, b) => depth(a) - depth(b));
    for (const o of objs) {
      if (placing && placing.move === o) continue;
      if (o.type === 'tree') { const [x, y] = P(o.gx + 0.5, o.gy + 0.5); ART.drawTree(ctx, x, y, o.v); }
      else if (o.type === 'rock') { const [x, y] = P(o.gx + 0.5, o.gy + 0.5); ART.drawRock(ctx, x, y, o.v); }
      else if (!o.built) {
        const p = clamp(1 - (o.doneAt - now()) / (B[o.kind].time * 1000), 0, 1);
        const r = ART.drawConstruction(ctx, o.kind, o.gx, o.gy, p);
        const bx = r.top[0] - 24, by = r.top[1] - 6;
        ctx.fillStyle = 'rgba(60,30,10,.8)'; ctx.fillRect(bx - 1.5, by - 1.5, 51, 8);
        ctx.fillStyle = '#ffd24a'; ctx.fillRect(bx, by, 48 * p, 5);
      } else ART.drawBuilding(ctx, o.kind, o.gx, o.gy, t, o, variantOf(o));
    }
    drawRoamingMonsters(t);
    for (const o of objs) {
      if (o.type !== 'b' || !o.built) continue;
      if (placing && placing.move === o) continue;
      const c = objCenter(o);
      const y = c[1] - B[o.kind].h - 26 + Math.sin(t * 3 + o.id) * 3;
      if (isReady(o)) ART.drawBubble(ctx, c[0], y, B[o.kind].produce.res);
      else if (o.queue && o.queue.length) {
        const q = o.queue[0];
        const p = clamp(1 - (q.endAt - now()) / (unitDef(q.unit).time * 1000), 0, 1);
        ART.drawBadge(ctx, c[0], c[1] - B[o.kind].h - 22, q.unit, p);
      }
    }

    // Fantôme de placement
    if (placing) {
      const def = B[placing.kind];
      const ok = isFree(placing.gx, placing.gy, def.size, placing.move);
      for (let y = 0; y < def.size; y++) {
        for (let x = 0; x < def.size; x++) {
          const f = foot(placing.gx + x, placing.gy + y, 1);
          poly([f.t, f.r, f.b, f.l], ok ? 'rgba(80,220,100,.42)' : 'rgba(240,70,70,.48)', 'rgba(255,255,255,.75)', 1);
        }
      }
      ART.drawBuilding(ctx, placing.kind, placing.gx, placing.gy, t, null, placing.move ? variantOf(placing.move) : 0, 0.88);
      const c = P(placing.gx + def.size / 2, placing.gy + def.size / 2);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [dx, dy] of [[1, 0.5], [-1, -0.5], [1, -0.5], [-1, 0.5]]) {
        const ex = c[0] + dx * 20, ey = c[1] + dy * 20;
        ctx.moveTo(c[0] + dx * 8, c[1] + dy * 8); ctx.lineTo(ex, ey);
        ctx.moveTo(ex, ey); ctx.lineTo(ex - dx * 5 - dy * 4, ey - dy * 5 + dx * 1.5);
        ctx.moveTo(ex, ey); ctx.lineTo(ex - dx * 5 + dy * 4, ey - dy * 5 - dx * 1.5);
      }
      ctx.stroke();
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

    // Textes flottants (avec icône)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.age += dt;
      if (f.age > 1.4) { floaters.splice(i, 1); continue; }
      const a = f.age < 1 ? 1 : 1 - (f.age - 1) / 0.4;
      const y = f.y - f.age * 34;
      ctx.font = 'bold 15px "Trebuchet MS", system-ui, sans-serif';
      const tw = ctx.measureText(f.text).width;
      const x = f.icon ? f.x - 10 : f.x;
      ctx.globalAlpha = a;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(60,30,10,.8)';
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color || '#ffec96';
      ctx.fillText(f.text, x, y);
      if (f.icon) ctx.drawImage(ART.sprite(f.icon, 64), x + tw / 2 + 1, y - 11, 20, 20);
      ctx.globalAlpha = 1;
    }
  }

  function floater(text, x, y, color, icon) {
    floaters.push({ text, x, y, age: 0, color, icon });
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
    c.innerHTML = `${ri(k)}<span></span>`;
    c.title = r.name;
    resBar.appendChild(c);
    chips[k] = { el: c, val: c.querySelector('span') };
  }
  const armyChip = document.createElement('div');
  armyChip.className = 'chip';
  armyChip.title = 'Armée';
  armyChip.innerHTML = `${img('squire', 'ri', 48)}<span></span>`;
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
        const prod = def.produce ? `${ri(def.produce.res)} +${def.produce.amount} / ${fmtTime(def.produce.time)}` : def.desc;
        html += `<button class="card" type="button" data-act="place" data-kind="${k}" ${disabled ? 'disabled' : ''}>
          ${tag}${img('bld_' + k, 'thumb', 160)}<b>${def.name}</b>
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
      ? `Déplacer : ${def.name}<small>Fais glisser le bâtiment, puis valide.</small>`
      : `${def.name} ${costHtml(def.cost, false)}<small>Fais glisser le bâtiment, puis valide.</small>`;
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
    let html = `<h2>${img('bld_' + o.kind, 'ht', 160)}${def.name}</h2><p class="muted">${def.desc}</p>`;
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
      html += `<p>Produit <b>${fmt(def.produce.amount)} ${ri(def.produce.res)}</b> toutes les ${fmtTime(def.produce.time)}.</p>
        <p id="shState"></p><div class="bar"><div id="shBar"></div></div>`;
    }
    if (o.kind === 'castle') html += `<p>Réserves : <b>${fmt(storageCap())}</b> par ressource · Population : <b>${popCap()}</b></p>`;
    if (o.kind === 'house') html += `<p>+${def.pop} places dans ton armée.</p>`;
    if (o.kind === 'storage') html += `<p>+${fmt(def.storage)} de réserve par ressource (total : ${fmt(storageCap())}).</p>`;
    if (o.kind === 'tower') html += `<p>Bonus d'attaque actuel : <b>+${Math.round((towerBonus() - 1) * 100)} %</b></p>`;
    if (def.trains || def.summons) {
      const list = Object.keys(D.UNITS).filter((k) => !!D.UNITS[k].monster === !!def.summons);
      html += def.summons
        ? `<h3>Invoquer des créatures</h3><p>Bestiaire : <b>${S.discovered.length}/${monsterKeys().length}</b> découvertes · Armée : <b id="shArmy"></b><br><span id="shQueue" class="muted"></span></p><div class="units">`
        : `<h3>Entraîner des soldats</h3><p>Armée : <b id="shArmy"></b> · <span id="shQueue" class="muted"></span></p><div class="units">`;
      if (def.summons) {
        const e = D.EGG;
        html += `<div class="unit egg">${img('egg')}<div class="info"><b>${e.name}</b>
          <div class="meta">Une créature au hasard, même une rare que tu n'as pas encore débloquée ! · ⏱ ${fmtTime(e.time)}</div>${costHtml(e.cost, false)}</div>
          <button class="btn gem" type="button" data-act="train" data-unit="egg">Faire éclore</button></div>`;
      }
      for (const k of list) {
        const u = D.UNITS[k];
        const lock = lockReason(k);
        const rar = u.monster ? `<span class="rar" style="--rc:${D.RARITY[u.rarity].color}">${D.RARITY[u.rarity].name}</span>` : '';
        const reqTxt = u.req != null && !S.beaten.includes(u.req) ? `<div class="meta">🔒 Bats « ${D.CAMPS[u.req].name} » pour l'apprivoiser</div>` : '';
        const popTxt = u.pop ? ` · 👥 ${u.pop}` : '';
        html += `<div class="unit">${img(k)}<div class="info"><b>${u.name}</b> ${rar}
          <div class="meta">⚔️ ${u.atk} · ❤️ ${u.hp}${popTxt} · ⏱ ${fmtTime(u.time)}</div>${reqTxt}${costHtml(u.cost, false)}</div>
          <button class="btn ok" type="button" data-act="train" data-unit="${k}" ${lock ? 'disabled' : ''}>${lock || (u.monster ? 'Invoquer' : 'Entraîner')}</button></div>`;
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
      if (def.trains || def.summons) {
        $('shArmy').textContent = `${armySize()}/${popCap()} places`;
        const q = o.queue || [];
        const verb = def.summons ? 'En invocation' : 'En formation';
        $('shQueue').textContent = q.length ? `${verb} : ${q.map((x) => unitDef(x.unit).icon).join(' ')} (${fmtTime((q[0].endAt - now()) / 1000)})` : (def.summons ? 'Aucune invocation en cours' : 'Aucun soldat en formation');
        sheetBody.querySelectorAll('[data-act="train"]').forEach((btn) => {
          const k = btn.dataset.unit;
          btn.disabled = !!lockReason(k) || !canAfford(unitDef(k).cost) || armySize() + queuedSize() + popOf(k) > popCap();
        });
      }
    });
  }

  // --- Arbres et rochers ---
  function openClearSheet(o) {
    const c = D.CLEAR[o.type];
    const html = `<h2>${img(o.type, 'ht')}${c.name}</h2>
      <p>${c.verb} pour récupérer ${rewardHtml(c.gain)} et libérer de la place.</p>
      <p>Coût : ${costHtml(c.cost)}</p>
      <div class="row"><button class="btn ok" type="button" data-act="clear" ${canAfford(c.cost) ? '' : 'disabled'}>${c.verb}</button></div>`;
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
  // État d'un repaire sur la carte des expéditions
  function campState(i) {
    if (!S.beaten.includes(i)) return i === 0 || S.beaten.includes(i - 1) ? 'open' : 'locked';
    return now() < (S.campCd[i] || 0) ? 'rest' : 'replay';
  }
  function campLoot(i, replay) {
    const def = D.CAMPS[i];
    const k = replay ? D.REPLAY.loot : 1;
    const loot = {};
    for (const [r, v] of Object.entries(def.loot)) loot[r] = Math.round(v * k);
    loot.gems = replay ? (i === D.CAMPS.length - 1 ? 2 : 0) : def.gems;
    if (!loot.gems) delete loot.gems;
    return { loot, xp: Math.round(def.xp * (replay ? D.REPLAY.xp : 1)) };
  }
  function openCampSheet(i) {
    const def = D.CAMPS[i];
    const st = campState(i);
    const a = armyStats();
    const ch = chance(def);
    const replay = st === 'replay' || st === 'rest';
    const { loot, xp } = campLoot(i, replay);
    let html = `<h2>${img('foe' + i, 'ht')}${def.name}</h2><p class="muted">${def.place} · ${def.desc}</p>
      <div class="stats"><div><span>Attaque ennemie</span><b>⚔️ ${def.atk}</b></div><div><span>Vie ennemie</span><b>❤️ ${fmt(def.hp)}</b></div><div><span>Ton armée</span><b>⚔️ ${fmt(a.atk)} · ❤️ ${fmt(a.hp)}</b></div></div>
      <p>Pronostic : <b class="${ch.cls}">${ch.label}</b></p>
      <p>${replay ? 'Butin (île déjà libérée)' : 'Butin'} : ${rewardHtml(loot)} · +${xp} XP</p>`;
    if (st === 'rest') {
      html += `<p>Les Ombres se regroupent. Elles reviendront dans <b id="shCd"></b>.</p>
        <div class="row"><button class="btn war" type="button" disabled>⚔️ Attaquer</button></div>`;
    } else {
      html += `<div class="row"><button class="btn war" type="button" data-act="attack" data-camp="${i}" ${armySize() ? '' : 'disabled'}>⚔️ ${replay ? 'Repousser les Ombres' : 'Attaquer avec toute l’armée'}</button></div>
        ${armySize() ? '' : '<p class="muted">Construis une Caserne et entraîne des soldats pour attaquer.</p>'}`;
    }
    openSheet(html, () => {
      if (campState(i) === 'rest') { const e = $('shCd'); if (e) e.textContent = fmtTime(((S.campCd[i] || 0) - now()) / 1000); }
      else if (st === 'rest') openCampSheet(i);
    });
  }

  // --- Carte des expéditions ---
  const expEl = $('expedition');
  function openExpedition() {
    closeSheet();
    expEl.hidden = false;
    renderExpedition(true);
  }
  function closeExpedition() {
    expEl.hidden = true;
    closeSheet();
  }
  function renderExpedition(scroll) {
    const map = $('expMap');
    const n = D.CAMPS.length;
    const step = 210, H = n * step + 120;
    const xs = [30, 70, 34, 68, 32, 58];
    const pts = D.CAMPS.map((c, i) => [xs[i % xs.length], H - 150 - i * step]);
    let html = `<div class="exp-inner" style="height:${H}px">
      <svg class="exp-path" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">
        <path d="M ${pts.map((p) => `${p[0]} ${p[1] + 40}`).join(' L ')}" vector-effect="non-scaling-stroke"/></svg>`;
    D.CAMPS.forEach((c, i) => {
      const st = campState(i);
      const dark = st === 'open' || st === 'locked';
      const islet = ART.isletURL(dark ? 'shadow' : 'free', i);
      const top = dark ? `<img class="exp-foe" src="${ART.iconURL('foe' + i, 160)}" alt="">` : `<img class="exp-foe flag" src="${ART.iconURL('squire', 128)}" alt="">`;
      html += `<button class="exp-node ${st}" type="button" data-act="expNode" data-camp="${i}" style="left:${pts[i][0]}%;top:${pts[i][1]}px">
        <img class="exp-islet" src="${islet}" alt="">${top}
        <span class="exp-num">${i + 1}</span>
        <span class="exp-name">${c.place}</span>
        <span class="exp-status" id="expSt${i}"></span></button>`;
    });
    html += '</div>';
    map.innerHTML = html;
    refreshExpedition();
    if (scroll) {
      const cur = D.CAMPS.findIndex((c, i) => campState(i) === 'open');
      const idx = cur < 0 ? n - 1 : cur;
      requestAnimationFrame(() => { map.scrollTop = pts[idx][1] - map.clientHeight / 2 + 60; });
    }
  }
  function refreshExpedition() {
    D.CAMPS.forEach((c, i) => {
      const el = $('expSt' + i);
      if (!el) return;
      const st = campState(i);
      el.textContent = st === 'locked' ? `🔒 ${c.name}`
        : st === 'open' ? `⚔️ ${c.name}`
        : st === 'rest' ? `✨ Libérée · retour dans ${fmtTime(((S.campCd[i] || 0) - now()) / 1000)}`
        : '✨ Libérée · ⚔️ Rejouer';
    });
    const changed = D.CAMPS.some((c, i) => { const el = $('expSt' + i); return el && !el.parentElement.classList.contains(campState(i)); });
    if (changed) { renderExpedition(false); return; }
    const a = armyStats();
    $('expArmy').innerHTML = `<b>Ton armée</b><br>${armyCount()} unité${armyCount() > 1 ? 's' : ''} · ⚔️ ${fmt(a.atk)} · ❤️ ${fmt(a.hp)}`;
  }

  // --- Armée ---
  function openArmy() {
    selectedId = null;
    const a = armyStats();
    let html = `<h2><span class="e">⚔️</span>Armée</h2>
      <div class="stats"><div><span>Places</span><b>${armySize()}/${popCap()}</b></div><div><span>Attaque</span><b>${fmt(a.atk)}</b></div><div><span>Vie</span><b>${fmt(a.hp)}</b></div></div>
      <h3>Soldats</h3><div class="units">`;
    for (const [k, u] of Object.entries(D.UNITS)) {
      if (u.monster) continue;
      html += `<div class="unit">${img(k)}<div class="info"><b>${u.name}</b><div class="meta">⚔️ ${u.atk} · ❤️ ${u.hp}${S.level < u.unlock ? ` · débloqué au niveau ${u.unlock}` : ''}</div></div><b>× ${S.army[k] || 0}</b></div>`;
    }
    html += `</div><h3>Bestiaire · ${S.discovered.length}/${monsterKeys().length}</h3><div class="bestiary">`;
    for (const k of monsterKeys()) {
      const u = D.UNITS[k];
      const known = S.discovered.includes(k);
      const rc = D.RARITY[u.rarity].color;
      html += known
        ? `<div class="beast" style="--rc:${rc}" title="${u.desc}">${img(k, 'be')}<b>${u.name}</b><span class="meta">⚔️ ${u.atk} · ❤️ ${u.hp}</span><span class="own">× ${S.army[k] || 0}</span></div>`
        : `<div class="beast unknown" style="--rc:${rc}">${img(k, 'be')}<b>???</b><span class="meta">${D.RARITY[u.rarity].name}</span></div>`;
    }
    html += '</div>';
    if (!countKind('den')) html += `<p class="muted">Construis un Antre des créatures (niveau 3) pour invoquer des monstres.</p>`;
    html += `<div class="row"><button class="btn war" type="button" data-act="openExpedition">🗺️ Partir en expédition</button></div>`;
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
      html += `<li class="${cls}">${i < S.quest ? '✅' : '📜'} ${q.text}${prog}<span class="r">${rewardHtml(q.reward)}</span></li>`;
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
      <p>👆 Glisse un doigt pour te déplacer, pince pour zoomer.<br>🏗️ Construis des bâtiments, puis touche-les quand une bulle apparaît pour récolter.<br>⚔️ Entraîne des soldats à la Caserne, puis pars en 🗺️ Expédition libérer les îles envahies par les Ombres.<br>🌳 Touche les arbres et les rochers pour récupérer du bois et de la pierre.</p>
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

  function attack(i) {
    const def = D.CAMPS[i];
    const st = campState(i);
    if (!armySize() || st === 'locked' || st === 'rest') return;
    const replay = st === 'replay';
    closeSheet();
    const sim = simulate(def);
    // Appliquer les pertes tout de suite (sauvegarde cohérente)
    for (const [k, n] of Object.entries(sim.dead)) S.army[k] = Math.max(0, (S.army[k] || 0) - n);
    let loot = null, xp = 0;
    if (sim.win) {
      const won = campLoot(i, replay);
      loot = {};
      for (const [k, v] of Object.entries(won.loot)) loot[k] = gain(k, v);
      xp = won.xp;
      if (!replay) S.beaten.push(i);
      S.campCd[i] = now() + D.REPLAY.cooldown * 1000;
      S.stats.wins++;
      addXp(xp);
    }
    save();
    playBattle(def, sim, loot, { xp, replay, idx: i });
  }

  function playBattle(def, sim, loot, info) {
    const el = $('battle');
    $('bTitle').textContent = `⚔️ ${def.name}`;
    const troops = $('bTroops');
    troops.innerHTML = '';
    const order = [];
    for (const [k, n] of Object.entries(S.army)) for (let i = 0; i < n; i++) order.push(k);
    for (const [k, n] of Object.entries(sim.dead)) for (let i = 0; i < n; i++) order.push(k);
    order.sort((a, b) => D.UNITS[b].hp - D.UNITS[a].hp);
    const spans = order.map((k) => {
      const s = document.createElement('img');
      s.src = ART.iconURL(k, 96); s.alt = ''; s.dataset.k = k;
      troops.appendChild(s);
      return s;
    });
    $('bFoe').innerHTML = img('foe' + D.CAMPS.indexOf(def), 'foe-img', 192);
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
        res.innerHTML = `<b>🏆 Victoire !</b>${info.replay ? 'Tu as repoussé les Ombres.' : `${def.place} est libérée de l'ombre !`}<br>Butin : ${rewardHtml(loot)} · +${info.xp} XP${lost ? `<br>Soldats tombés : ${lost}` : '<br>Aucune perte !'}`;
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
    attack: (d) => attack(Number(d.camp)),
    openExpedition: () => openExpedition(),
    closeExpedition: () => closeExpedition(),
    expNode: (d) => {
      const i = Number(d.camp);
      if (campState(i) === 'locked') { toast(`🔒 Libère d'abord ${D.CAMPS[i - 1].place}.`); return; }
      openCampSheet(i);
    },
    closeBattle: () => { $('battle').hidden = true; checkQuests(); if (!expEl.hidden) renderExpedition(false); },
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
      if (!expEl.hidden) refreshExpedition();
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
