/* Éclats Éternels — graphismes dessinés par le code (bâtiments, décor, créatures, icônes) */
'use strict';

window.EE_ART = (function () {
  const D = window.EE_DATA;
  const HW = 32, HH = 16;
  const OUT = 'rgba(52,32,18,.55)';
  const SOUT = 'rgba(40,24,16,.9)';
  let ctx = null;

  // =====================================================================
  // Outils
  // =====================================================================
  const P = (gx, gy) => [(gx - gy) * HW, (gx + gy) * HH];
  const up = (p, h) => [p[0], p[1] - h];
  const add = (p, d) => [p[0] + d[0], p[1] + d[1]];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  function rect(x0, y0, x1, y1, z = 0) {
    return { t: up(P(x0, y0), z), r: up(P(x1, y0), z), b: up(P(x1, y1), z), l: up(P(x0, y1), z), c: up(P((x0 + x1) / 2, (y0 + y1) / 2), z) };
  }
  function rnd(seed) {
    let s = (seed | 0) || 1;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hex(c) {
    if (c.startsWith('rgb')) return c.match(/[\d.]+/g).slice(0, 3).map(Number);
    c = c.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  }
  // f > 0 éclaircit, f < 0 assombrit
  function shade(c, f, a = 1) {
    const [r, g, b] = hex(c);
    const t = f < 0 ? 0 : 255, p = Math.abs(f);
    return `rgba(${Math.round((t - r) * p + r)},${Math.round((t - g) * p + g)},${Math.round((t - b) * p + b)},${a})`;
  }
  function unit(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    return [[dx / L, dy / L], L];
  }

  // --- Primitives ---
  function path(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function fill(pts, f, stroke = OUT, lw = 0.8) {
    path(pts);
    ctx.fillStyle = f;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function circle(x, y, r, f, stroke) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (f) { ctx.fillStyle = f; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.8; ctx.stroke(); }
  }
  function ell(x, y, rx, ry, f, stroke, rot = 0) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    if (f) { ctx.fillStyle = f; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.8; ctx.stroke(); }
  }
  // Dessine dans le repère d'une face (u le long de e1, v le long de e2), découpé sur la face
  function face(A, e1, e2, clip, fn) {
    ctx.save();
    if (clip) { path(clip); ctx.clip(); }
    ctx.transform(e1[0], e1[1], e2[0], e2[1], A[0], A[1]);
    fn();
    ctx.restore();
  }
  function onWall(A, B, fn) {
    const [e1, L] = unit(A, B);
    face(A, e1, [0, -1], null, () => fn(L));
  }
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
    hi.pop(); lo.pop();
    return lo.concat(hi);
  }
  // Ombre portée (soleil à gauche)
  function shadow(f, h, k = 0.62) {
    const off = [h * k, h * k * 0.3];
    const pts = [f.t, f.r, f.b, f.l];
    fill(hull(pts.concat(pts.map((p) => add(p, off)))), 'rgba(30,45,15,.22)', null);
  }
  function roundShadow(x, y, rx, h) {
    ell(x + h * 0.32, y + h * 0.1, rx + h * 0.3, rx * 0.5 + h * 0.08, 'rgba(30,45,15,.22)');
  }

  // =====================================================================
  // Textures (repère local : u vers la droite de la face, v vers le haut)
  // =====================================================================
  const TEX = {
    plain(L, h, base) { ctx.fillStyle = base; ctx.fillRect(0, 0, L, h); },
    stone(L, h, base, r) {
      ctx.fillStyle = shade(base, -0.32); ctx.fillRect(0, 0, L, h);
      const rowH = 5;
      for (let v = 0; v < h; v += rowH) {
        let u = -r() * 6;
        while (u < L) {
          const w = 6 + r() * 7;
          ctx.fillStyle = shade(base, (r() - 0.5) * 0.2);
          rr(u + 0.5, v + 0.5, w - 1, rowH - 1, 1.3); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.14)';
          ctx.fillRect(u + 1.2, v + rowH - 1.7, w - 2.4, 0.7);
          u += w;
        }
      }
    },
    brick(L, h, base, r) {
      ctx.fillStyle = shade(base, -0.35); ctx.fillRect(0, 0, L, h);
      const rowH = 3.2;
      for (let v = 0, row = 0; v < h; v += rowH, row++) {
        for (let u = -(row % 2) * 3; u < L; u += 6) {
          ctx.fillStyle = shade(base, (r() - 0.5) * 0.18);
          ctx.fillRect(u + 0.4, v + 0.4, 5.2, rowH - 0.8);
        }
      }
    },
    plaster(L, h, base, r) {
      ctx.fillStyle = base; ctx.fillRect(0, 0, L, h);
      for (let i = 0; i < (L * h) / 22; i++) {
        ctx.fillStyle = `rgba(120,90,50,${0.04 + r() * 0.07})`;
        ctx.fillRect(r() * L, r() * h, 1 + r(), 1 + r());
      }
    },
    timber(L, h, base, r) {
      TEX.plaster(L, h, base, r);
      const beam = '#5d3a1f';
      ctx.fillStyle = beam;
      ctx.fillRect(0, 0, L, 2.4);
      ctx.fillRect(0, h - 2.4, L, 2.4);
      ctx.fillRect(0, h * 0.5 - 0.9, L, 1.8);
      const n = Math.max(2, Math.round(L / 15));
      const step = (L - 2.4) / n;
      for (let i = 0; i <= n; i++) ctx.fillRect(i * step, 0, 2.4, h);
      ctx.strokeStyle = beam; ctx.lineWidth = 1.7;
      for (let i = 0; i < n; i++) {
        const u0 = i * step + 2.4, u1 = (i + 1) * step;
        ctx.beginPath();
        if (i % 2 === 0) { ctx.moveTo(u0, h * 0.5); ctx.lineTo(u1, h - 2.4); } else { ctx.moveTo(u0, h - 2.4); ctx.lineTo(u1, h * 0.5); }
        ctx.stroke();
      }
    },
    planks(L, h, base, r) {
      for (let u = 0; u < L; u += 4.2) {
        ctx.fillStyle = shade(base, (r() - 0.5) * 0.2);
        ctx.fillRect(u, 0, 4.2, h);
        ctx.fillStyle = 'rgba(40,20,5,.4)';
        ctx.fillRect(u, 0, 0.6, h);
      }
      ctx.fillStyle = 'rgba(40,20,5,.25)';
      for (let v = 7; v < h; v += 10) ctx.fillRect(0, v, L, 0.7);
    },
    hplanks(L, h, base, r) {
      for (let v = 0; v < h; v += 3.6) {
        ctx.fillStyle = shade(base, (r() - 0.5) * 0.18);
        ctx.fillRect(0, v, L, 3.6);
        ctx.fillStyle = 'rgba(40,10,5,.35)';
        ctx.fillRect(0, v, L, 0.55);
      }
    },
    soil(L, h, base, r) {
      ctx.fillStyle = base; ctx.fillRect(0, 0, L, h);
      for (let i = 0; i < L / 2; i++) { ctx.fillStyle = `rgba(40,20,5,${0.1 + r() * 0.15})`; ctx.fillRect(r() * L, r() * h, 1.2, 1.2); }
    },
  };

  const ROOF = {
    tiles(L, S, base, r) {
      ctx.fillStyle = shade(base, -0.38); ctx.fillRect(0, 0, L, S);
      const rowH = 4, w = 5.2;
      for (let i = Math.ceil(S / rowH); i >= 0; i--) {
        const v = i * rowH;
        for (let u = -(i % 2) * 2.6 - 1; u < L + 3; u += w) {
          ctx.fillStyle = shade(base, (r() - 0.5) * 0.16);
          ctx.beginPath();
          ctx.moveTo(u, v + rowH + 1.6);
          ctx.lineTo(u, v + 1.4);
          ctx.quadraticCurveTo(u + w / 2, v - 1.3, u + w, v + 1.4);
          ctx.lineTo(u + w, v + rowH + 1.6);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(70,20,10,.35)'; ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
    },
    slate(L, S, base, r) {
      ctx.fillStyle = shade(base, -0.4); ctx.fillRect(0, 0, L, S);
      const rowH = 3.4;
      for (let i = Math.ceil(S / rowH); i >= 0; i--) {
        const v = i * rowH;
        for (let u = -(i % 2) * 2.2 - 1; u < L + 3; u += 4.4) {
          ctx.fillStyle = shade(base, (r() - 0.5) * 0.18);
          rr(u + 0.3, v, 4, rowH + 1.4, 0.8); ctx.fill();
        }
      }
    },
    shingle(L, S, base, r) {
      ctx.fillStyle = shade(base, -0.4); ctx.fillRect(0, 0, L, S);
      const rowH = 3.6;
      for (let i = Math.ceil(S / rowH); i >= 0; i--) {
        const v = i * rowH;
        let u = -r() * 3;
        while (u < L + 3) {
          const w = 2.8 + r() * 3.4;
          ctx.fillStyle = shade(base, (r() - 0.5) * 0.25);
          ctx.fillRect(u + 0.3, v, w - 0.6, rowH + 1.2);
          u += w;
        }
      }
    },
    thatch(L, S, base, r) {
      ctx.fillStyle = base; ctx.fillRect(0, 0, L, S);
      ctx.lineWidth = 0.6;
      for (let i = 0; i < L * S / 6; i++) {
        const u = r() * L, v = r() * S;
        ctx.strokeStyle = r() > 0.5 ? shade(base, -0.3, 0.7) : shade(base, 0.25, 0.7);
        ctx.beginPath(); ctx.moveTo(u, v); ctx.lineTo(u + (r() - 0.5), v + 3 + r() * 3); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(80,50,10,.2)';
      for (let v = 4; v < S; v += 7) ctx.fillRect(0, v, L, 1.2);
    },
  };

  // =====================================================================
  // Volumes
  // =====================================================================
  function wall(A, B, h, base, tex, lit, seed) {
    const pts = [A, B, up(B, h), up(A, h)];
    const [e1, L] = unit(A, B);
    const r = rnd(seed);
    face(A, e1, [0, -1], pts, () => {
      (TEX[tex] || TEX.plain)(L, h, base, r);
      const g = ctx.createLinearGradient(0, 0, 0, Math.min(h, 16));
      g.addColorStop(0, 'rgba(25,12,0,.32)');
      g.addColorStop(1, 'rgba(25,12,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, L, h);
      ctx.fillStyle = lit ? 'rgba(255,240,210,.08)' : 'rgba(25,15,50,.28)';
      ctx.fillRect(0, 0, L, h);
    });
    path(pts); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.stroke();
  }

  function topFace(f, h, color, tex, seed) {
    const pts = [up(f.t, h), up(f.r, h), up(f.b, h), up(f.l, h)];
    fill(pts, color);
    if (tex === 'cobble') {
      const r = rnd(seed);
      const [e1, L1] = unit(pts[0], pts[1]);
      const [e2, L2] = unit(pts[0], pts[3]);
      face(pts[0], e1, e2, pts, () => {
        for (let v = 0; v < L2; v += 4.2) {
          for (let u = -r() * 3; u < L1; u += 4.5 + r() * 2) {
            ctx.fillStyle = shade(color, (r() - 0.5) * 0.25);
            rr(u + 0.4, v + 0.4, 3.6, 3.4, 1.2); ctx.fill();
          }
        }
      });
      path(pts); ctx.strokeStyle = OUT; ctx.stroke();
    }
  }

  // Pavé aligné sur la grille, de (x0,y0) à (x1,y1), hauteur h, posé à l'altitude z
  function prism(x0, y0, x1, y1, h, base, tex, seed = 1, z = 0, topColor, topTex) {
    const f = rect(x0, y0, x1, y1, z);
    wall(f.l, f.b, h, base, tex, true, seed);
    wall(f.b, f.r, h, base, tex, false, seed + 7);
    topFace(f, h, topColor || shade(base, 0.12), topTex, seed + 3);
    return f;
  }

  function roofFace(E0, E1, R1, R0, base, kind, lit, seed) {
    const pts = [E0, E1, R1, R0];
    const [e1, L] = unit(E0, E1);
    const sv = [R0[0] - E0[0], R0[1] - E0[1]];
    const S = Math.hypot(sv[0], sv[1]) || 1;
    const e2 = [sv[0] / S, sv[1] / S];
    const r = rnd(seed);
    face(E0, e1, e2, pts, () => {
      (ROOF[kind] || ROOF.tiles)(L, S, base, r);
      const g = ctx.createLinearGradient(0, 0, 0, S);
      g.addColorStop(0, 'rgba(0,0,0,.2)');
      g.addColorStop(1, lit ? 'rgba(255,240,200,.16)' : 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, L, S);
      if (!lit) { ctx.fillStyle = 'rgba(25,12,50,.3)'; ctx.fillRect(0, 0, L, S); }
    });
    path(pts); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.stroke();
  }

  // Toit à deux pans. axis 'x' : faîtage le long de x (pignon visible à droite) ; 'y' : pignon visible à gauche
  function gable(x0, y0, x1, y1, h, rh, base, kind, axis, seed, opts = {}) {
    const o = opts.over != null ? opts.over : 0.14;
    const wallBase = opts.wall || '#efe2c4';
    const wallTex = opts.wallTex || 'plaster';
    if (axis === 'x') {
      const ym = (y0 + y1) / 2;
      const Tc = up(P(x0 - o, y0 - o), h), Rc = up(P(x1 + o, y0 - o), h), Bc = up(P(x1 + o, y1 + o), h), Lc = up(P(x0 - o, y1 + o), h);
      const r0 = up(P(x0 - o, ym), h + rh), r1 = up(P(x1 + o, ym), h + rh);
      fill([Tc, Rc, r1, r0], shade(base, -0.45));
      const g0 = up(P(x1, y1), h), g1 = up(P(x1, y0), h), gt = up(P(x1, ym), h + rh * 0.9);
      gableWall(g0, g1, gt, wallBase, wallTex, false, seed);
      if (opts.mid) opts.mid();
      roofFace(Lc, Bc, r1, r0, base, kind, true, seed + 11);
      ctx.strokeStyle = shade(base, -0.5); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(r0[0], r0[1]); ctx.lineTo(r1[0], r1[1]); ctx.stroke();
      return { ridge: [r0, r1] };
    }
    const xm = (x0 + x1) / 2;
    const Tc = up(P(x0 - o, y0 - o), h), Rc = up(P(x1 + o, y0 - o), h), Bc = up(P(x1 + o, y1 + o), h), Lc = up(P(x0 - o, y1 + o), h);
    const r0 = up(P(xm, y0 - o), h + rh), r1 = up(P(xm, y1 + o), h + rh);
    fill([Tc, Lc, r1, r0], shade(base, -0.45));
    const g0 = up(P(x0, y1), h), g1 = up(P(x1, y1), h), gt = up(P(xm, y1), h + rh * 0.9);
    gableWall(g0, g1, gt, wallBase, wallTex, true, seed);
    if (opts.mid) opts.mid();
    roofFace(Bc, Rc, r0, r1, base, kind, false, seed + 11);
    ctx.strokeStyle = shade(base, -0.5); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(r0[0], r0[1]); ctx.lineTo(r1[0], r1[1]); ctx.stroke();
    return { ridge: [r0, r1] };
  }
  function gableWall(A, B, T, base, tex, lit, seed) {
    const pts = [A, B, T];
    const [e1, L] = unit(A, B);
    const r = rnd(seed + 5);
    face(A, e1, [0, -1], pts, () => {
      (TEX[tex] || TEX.plain)(L, 40, base, r);
      ctx.fillStyle = lit ? 'rgba(255,240,210,.08)' : 'rgba(25,15,50,.28)';
      ctx.fillRect(0, 0, L, 40);
      // petite lucarne
      const cx = L / 2;
      ctx.fillStyle = '#5d3a1f'; rr(cx - 3, 3, 6, 6, 1); ctx.fill();
      ctx.fillStyle = '#2d1c12'; rr(cx - 2, 4, 4, 4, 0.8); ctx.fill();
    });
    path(pts); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.stroke();
  }

  // Toit en pyramide (4 pans)
  function hip(f, h, rh, base, kind, seed) {
    const apex = up(f.c, h + rh);
    const T = up(f.t, h), R = up(f.r, h), B = up(f.b, h), L = up(f.l, h);
    fill([L, T, apex], shade(base, -0.45));
    fill([T, R, apex], shade(base, -0.5));
    roofFace(L, B, apex, apex, base, kind, true, seed);
    roofFace(B, R, apex, apex, base, kind, false, seed + 3);
    return apex;
  }

  function cylinder(cx, cy, rx, h, base, tex, seed = 1) {
    const ry = rx * 0.5;
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(cx - rx, cy - h);
      ctx.lineTo(cx - rx, cy);
      ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(cx + rx, cy - h);
      ctx.ellipse(cx, cy - h, rx, ry, 0, 0, Math.PI, true);
      ctx.closePath();
    };
    body();
    const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    g.addColorStop(0, shade(base, 0.12)); g.addColorStop(0.35, shade(base, 0.05)); g.addColorStop(1, shade(base, -0.4));
    ctx.fillStyle = g; ctx.fill();
    if (tex === 'stone') {
      ctx.save(); body(); ctx.clip();
      const r = rnd(seed);
      ctx.strokeStyle = 'rgba(40,25,10,.35)'; ctx.lineWidth = 0.7;
      for (let v = 5, row = 0; v < h + ry; v += 5, row++) {
        ctx.beginPath(); ctx.ellipse(cx, cy - v + 5, rx, ry, 0, 0.05, Math.PI - 0.05); ctx.stroke();
        for (let a = 0.25 + (row % 2) * 0.3; a < Math.PI; a += 0.55 + r() * 0.2) {
          const x = cx + Math.cos(a) * rx, y = cy - v + 5 + Math.sin(a) * ry;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 5); ctx.stroke();
        }
      }
      ctx.restore();
    }
    body(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.stroke();
    ell(cx, cy - h, rx, ry, shade(base, -0.05), OUT);
  }
  function cone(cx, cy, rx, rh, base, kind = 'slate') {
    const ry = rx * 0.5;
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(cx - rx, cy);
      ctx.lineTo(cx, cy - rh);
      ctx.lineTo(cx + rx, cy);
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI, false);
      ctx.closePath();
    };
    shape();
    const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    g.addColorStop(0, shade(base, 0.2)); g.addColorStop(0.4, base); g.addColorStop(1, shade(base, -0.45));
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); shape(); ctx.clip();
    ctx.strokeStyle = shade(base, -0.45, 0.6); ctx.lineWidth = 0.6;
    for (let k = 1; k < 8; k++) {
      const t = k / 8;
      ctx.beginPath(); ctx.ellipse(cx, cy - rh * t, rx * (1 - t), ry * (1 - t), 0, 0, Math.PI); ctx.stroke();
    }
    for (let a = 0.2; a < Math.PI; a += 0.32) {
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); ctx.lineTo(cx, cy - rh); ctx.stroke();
    }
    ctx.restore();
    shape(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.stroke();
    return [cx, cy - rh];
  }
  function merlonsRing(cx, cy, rx, base) {
    const ry = rx * 0.5;
    for (let a = Math.PI + 0.2; a < Math.PI * 2; a += 0.5) {
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      ctx.fillStyle = shade(base, -0.25); ctx.fillRect(x - 2, y - 4, 4, 4);
    }
    for (let a = 0.15; a < Math.PI; a += 0.5) {
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      const lit = Math.cos(a) < 0.2;
      ctx.fillStyle = lit ? shade(base, 0.05) : shade(base, -0.3);
      ctx.fillRect(x - 2.2, y - 5, 4.4, 5);
      ctx.strokeStyle = OUT; ctx.lineWidth = 0.5; ctx.strokeRect(x - 2.2, y - 5, 4.4, 5);
    }
  }
  function flag(x, y, color, h = 14, w = 11) {
    ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.quadraticCurveTo(x + w * 0.5, y - h - 2.5, x + w, y - h + 1);
    ctx.lineTo(x + w * 0.8, y - h + 4);
    ctx.lineTo(x + w, y - h + 7);
    ctx.quadraticCurveTo(x + w * 0.5, y - h + 4, x, y - h + 6);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.6; ctx.stroke();
    circle(x, y - h - 1, 1.3, '#f2c94c');
  }
  // Ouvertures sur un mur (repère local du mur)
  function door(u, w, hgt, color = '#7a4a26') {
    const x0 = u - w / 2, x1 = u + w / 2;
    ctx.beginPath();
    ctx.moveTo(x0, 0); ctx.lineTo(x0, hgt * 0.7);
    ctx.quadraticCurveTo(x0, hgt, u, hgt);
    ctx.quadraticCurveTo(x1, hgt, x1, hgt * 0.7);
    ctx.lineTo(x1, 0); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#3b2412'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(30,15,5,.45)'; ctx.lineWidth = 0.5;
    for (let x = x0 + w / 4; x < x1 - 0.5; x += w / 4) { ctx.beginPath(); ctx.moveTo(x, 0.5); ctx.lineTo(x, hgt * 0.92); ctx.stroke(); }
    circle(u + w * 0.28, hgt * 0.42, 0.7, '#e0b24a');
  }
  function windowAt(u, v, w, hgt, glow = true) {
    ctx.fillStyle = '#4b2e17';
    ctx.fillRect(u - w / 2 - 1, v - 1, w + 2, hgt + 2);
    const g = ctx.createLinearGradient(0, v, 0, v + hgt);
    if (glow) { g.addColorStop(0, '#ffe7a8'); g.addColorStop(1, '#f2a93b'); } else { g.addColorStop(0, '#bfe6ff'); g.addColorStop(1, '#6aa8d8'); }
    ctx.fillStyle = g; ctx.fillRect(u - w / 2, v, w, hgt);
    ctx.fillStyle = '#4b2e17';
    ctx.fillRect(u - 0.4, v, 0.8, hgt);
    ctx.fillRect(u - w / 2, v + hgt / 2 - 0.4, w, 0.8);
    ctx.fillStyle = '#6b4426'; ctx.fillRect(u - w / 2 - 1.5, v - 1.8, w + 3, 1.2);
  }
  function archWindow(u, v, w, hgt) {
    const x0 = u - w / 2, x1 = u + w / 2;
    ctx.beginPath();
    ctx.moveTo(x0, v); ctx.lineTo(x0, v + hgt * 0.65);
    ctx.quadraticCurveTo(x0, v + hgt, u, v + hgt);
    ctx.quadraticCurveTo(x1, v + hgt, x1, v + hgt * 0.65);
    ctx.lineTo(x1, v); ctx.closePath();
    const g = ctx.createLinearGradient(0, v, 0, v + hgt);
    g.addColorStop(0, '#f3a43a'); g.addColorStop(1, '#ffe39a');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#3e3326'; ctx.lineWidth = 1; ctx.stroke();
  }
  function flowerBox(u, v, w) {
    ctx.fillStyle = '#6b4426'; ctx.fillRect(u - w / 2, v - 2.4, w, 2.4);
    const cols = ['#ff6f91', '#ffd54f', '#ffffff', '#c58cff'];
    for (let i = 0; i < 5; i++) circle(u - w / 2 + 1 + i * (w - 2) / 4, v + 0.6, 1.3, cols[i % 4]);
  }
  function crystalShape(x, y, s, c1, c2) {
    fill([[x, y - s * 1.7], [x + s, y - s * 0.35], [x + s * 0.55, y + s * 1.1], [x, y + s * 1.35], [x - s * 0.6, y + s * 1.05], [x - s, y - s * 0.35]], c1, 'rgba(255,255,255,.7)', 0.6);
    fill([[x, y - s * 1.7], [x + s, y - s * 0.35], [x + s * 0.55, y + s * 1.1], [x, y + s * 1.35]], c2, null);
    fill([[x - s * 0.55, y - s * 0.5], [x - s * 0.1, y - s * 1.2], [x - s * 0.15, y + s * 0.2]], 'rgba(255,255,255,.75)', null);
  }

  // Petits éléments de décor
  function boulder(x, y, s, seed, base = '#9a9890') {
    const r = rnd(seed);
    const pts = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      const rr2 = 1 + (r() - 0.5) * 0.35;
      pts.push([x + Math.cos(a) * 12 * s * rr2, y + Math.sin(a) * 11 * s * rr2]);
    }
    pts.push([x + 11 * s, y + 2 * s], [x + 4 * s, y + 4 * s], [x - 6 * s, y + 4 * s], [x - 12 * s, y + 1 * s]);
    path(pts);
    const g = ctx.createRadialGradient(x - 5 * s, y - 8 * s, 1, x, y - 3 * s, 15 * s);
    g.addColorStop(0, shade(base, 0.35)); g.addColorStop(0.6, base); g.addColorStop(1, shade(base, -0.4));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = SOUT; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.strokeStyle = shade(base, -0.45, 0.8); ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(x - 2 * s, y - 9 * s); ctx.lineTo(x + 1 * s, y - 4 * s); ctx.lineTo(x + 5 * s, y - 3 * s); ctx.stroke();
    if (r() > 0.4) ell(x - 4 * s, y - 9 * s, 4.5 * s, 1.8 * s, 'rgba(110,160,70,.85)');
  }
  function fencePosts(a, b, n, h = 7) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(lerp(a, b, i / n));
    ctx.strokeStyle = '#7a5130'; ctx.lineWidth = 1.3;
    for (const hh of [h * 0.45, h * 0.85]) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1] - hh); ctx.lineTo(pts[n][0], pts[n][1] - hh); ctx.stroke();
    }
    for (const p of pts) {
      ctx.fillStyle = '#8d5f38'; ctx.fillRect(p[0] - 1.1, p[1] - h - 1, 2.2, h + 1);
      ctx.strokeStyle = SOUT; ctx.lineWidth = 0.4; ctx.strokeRect(p[0] - 1.1, p[1] - h - 1, 2.2, h + 1);
    }
  }
  function bush(x, y, s, col = '#4f9a3c') {
    for (const [dx, dy, rr2] of [[-4, -3, 5], [4, -3, 5], [0, -6, 5.5]]) {
      const g = ctx.createRadialGradient(x + dx * s - 2, y + dy * s - 2, 1, x + dx * s, y + dy * s, rr2 * s);
      g.addColorStop(0, shade(col, 0.3)); g.addColorStop(1, shade(col, -0.3));
      circle(x + dx * s, y + dy * s, rr2 * s, g, SOUT);
    }
  }
  function log(a, b, rad, z) {
    const A = up(a, z), B = up(b, z);
    ctx.strokeStyle = '#6d4527'; ctx.lineWidth = rad * 2; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,15,5,.35)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(A[0], A[1] - rad * 0.3); ctx.lineTo(B[0], B[1] - rad * 0.3); ctx.stroke();
    ell(B[0], B[1], rad * 0.8, rad, '#e3bf86', SOUT);
    ell(B[0], B[1], rad * 0.45, rad * 0.55, null, 'rgba(140,90,40,.8)');
  }

  // =====================================================================
  // Bâtiments (dessinés une fois puis mis en cache)
  // =====================================================================
  function tower(cx, cy, z, rx, h, roof, flagColor) {
    const c = up(P(cx, cy), z);
    cylinder(c[0], c[1], rx, h, '#d3ccbc', 'stone', Math.round(cx * 100 + cy));
    ctx.fillStyle = '#3e3326';
    ctx.fillRect(c[0] - rx * 0.45, c[1] - h * 0.62, 2, 5);
    ctx.fillRect(c[0] + rx * 0.1, c[1] - h * 0.35, 2, 5);
    cylinder(c[0], c[1] - h, rx + 2.5, 5, '#c9c2b2', 'plain');
    merlonsRing(c[0], c[1] - h - 5, rx + 2.5, '#d3ccbc');
    const apex = cone(c[0], c[1] - h - 6, rx + 3, roof, '#4f6fc2');
    flag(apex[0], apex[1] + 1, flagColor, 13, 10);
  }
  function curtain(x0, y0, x1, y1, z, h, seed) {
    const f = prism(x0, y0, x1, y1, h, '#cfc8b8', 'stone', seed, z, '#b9b2a2');
    const along = x1 - x0 > y1 - y0;
    const n = Math.round((along ? x1 - x0 : y1 - y0) / 0.28);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      if (along) {
        const x = x0 + (x1 - x0) * t;
        prism(x - 0.06, y1 - 0.12, x + 0.06, y1, 4, '#cfc8b8', 'plain', seed + i, z + h);
      } else {
        const y = y0 + (y1 - y0) * t;
        prism(x1 - 0.12, y - 0.06, x1, y + 0.06, 4, '#cfc8b8', 'plain', seed + i, z + h);
      }
    }
    return f;
  }

  const BUILD = {
    castle() {
      shadow(rect(0.1, 0.1, 2.9, 2.9), 85);
      prism(0.04, 0.04, 2.96, 2.96, 6, '#a9a293', 'stone', 3, 0, '#c9c2b1', 'cobble');
      tower(0.36, 0.36, 6, 15, 46, 30, '#e53935');
      curtain(0.3, 0.2, 2.7, 0.5, 6, 22, 11);
      curtain(0.2, 0.3, 0.5, 2.7, 6, 22, 13);
      tower(0.36, 2.64, 6, 15, 46, 30, '#3f6fd6');
      tower(2.64, 0.36, 6, 15, 46, 30, '#3f6fd6');
      const k = prism(0.95, 0.95, 2.05, 2.05, 54, '#ddd6c6', 'stone', 21, 6);
      onWall(k.l, k.b, (L) => { archWindow(L * 0.3, 22, 6, 10); archWindow(L * 0.7, 22, 6, 10); archWindow(L * 0.5, 38, 5, 8); });
      onWall(k.b, k.r, (L) => { archWindow(L * 0.5, 26, 6, 10); archWindow(L * 0.5, 42, 5, 7); });
      const apex = hip(rect(0.88, 0.88, 2.12, 2.12, 6), 54, 34, '#4f6fc2', 'slate', 23);
      const front = curtain(0.3, 2.5, 2.7, 2.8, 6, 20, 31);
      onWall(front.l, front.b, (L) => {
        const u = L * 0.5;
        ctx.beginPath(); ctx.moveTo(u - 7, 0); ctx.lineTo(u - 7, 10); ctx.quadraticCurveTo(u - 7, 16, u, 16); ctx.quadraticCurveTo(u + 7, 16, u + 7, 10); ctx.lineTo(u + 7, 0); ctx.closePath();
        ctx.fillStyle = '#2a1d14'; ctx.fill();
        ctx.strokeStyle = '#8a8070'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.strokeStyle = '#6d6a66'; ctx.lineWidth = 0.7;
        for (let x = u - 5; x <= u + 5; x += 2.5) { ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, 14.5); ctx.stroke(); }
        for (let y = 6; y < 15; y += 3) { ctx.beginPath(); ctx.moveTo(u - 6.5, y); ctx.lineTo(u + 6.5, y); ctx.stroke(); }
        for (const bx of [L * 0.18, L * 0.82]) {
          ctx.fillStyle = '#b8322c'; ctx.fillRect(bx - 3, 6, 6, 12);
          ctx.beginPath(); ctx.moveTo(bx - 3, 6); ctx.lineTo(bx, 3.5); ctx.lineTo(bx + 3, 6); ctx.fill();
          ctx.fillStyle = '#8ff3ff'; ctx.beginPath(); ctx.moveTo(bx, 14); ctx.lineTo(bx + 1.6, 11.5); ctx.lineTo(bx, 9); ctx.lineTo(bx - 1.6, 11.5); ctx.fill();
          ctx.fillStyle = '#e0b24a'; ctx.fillRect(bx - 3.5, 17.5, 7, 1);
        }
      });
      curtain(2.5, 0.3, 2.8, 2.5, 6, 20, 37);
      tower(2.64, 2.64, 6, 15, 46, 30, '#e53935');
      return { crystal: [apex[0], apex[1] - 12] };
    },

    house(variant) {
      const axis = variant === 1 ? 'y' : 'x';
      shadow(rect(0.3, 0.35, 1.7, 1.65), 46);
      // jardinet
      ell(P(1, 1)[0] - 2, P(1, 1)[1] + 6, 30, 13, 'rgba(70,130,40,.25)', null);
      prism(0.28, 0.33, 1.72, 1.67, 3, '#9d968a', 'stone', 4);
      const f = prism(0.32, 0.38, 1.68, 1.62, 21, '#f1e4c6', 'timber', 5, 3);
      onWall(f.l, f.b, (L) => {
        door(axis === 'y' ? L * 0.5 : L * 0.3, 8, 14);
        if (axis === 'x') { windowAt(L * 0.72, 8, 7, 6); flowerBox(L * 0.72, 7, 9); }
        else { windowAt(L * 0.2, 10, 5, 5); windowAt(L * 0.8, 10, 5, 5); }
      });
      onWall(f.b, f.r, (L) => {
        windowAt(L * 0.3, 8, 7, 6);
        if (axis === 'y') { windowAt(L * 0.72, 8, 7, 6); flowerBox(L * 0.72, 7, 9); }
      });
      let smoke = null;
      gable(0.32, 0.38, 1.68, 1.62, 24, 22, '#c4573b', 'tiles', axis, 7, {
        wall: '#f1e4c6', wallTex: 'timber',
        mid: () => {
          const cx = axis === 'x' ? 1.25 : 0.65, cy = axis === 'x' ? 0.62 : 1.2;
          prism(cx - 0.1, cy - 0.1, cx + 0.1, cy + 0.1, 24, '#a34b34', 'brick', 9, 24);
          prism(cx - 0.12, cy - 0.12, cx + 0.12, cy + 0.12, 2.5, '#7d3a28', 'plain', 10, 48);
          smoke = up(P(cx, cy), 52);
        },
      });
      // pas japonais et buisson
      const d = axis === 'y' ? P(1.0, 1.75) : P(0.75, 1.75);
      for (let i = 0; i < 3; i++) ell(d[0] - i * 4, d[1] + i * 3, 3, 1.5, '#b9b2a2', OUT);
      bush(P(1.85, 1.2)[0], P(1.85, 1.2)[1], 0.8);
      return { smoke };
    },

    farm(stage) {
      const f = prism(0.06, 0.06, 1.94, 1.94, 2.5, '#6d4426', 'soil', 3, 0, '#8a5a33');
      // sillons
      for (let i = 0; i < 7; i++) {
        const y = 0.2 + i * 0.26;
        const a = up(P(0.14, y), 2.5), b = up(P(1.86, y), 2.5);
        ctx.strokeStyle = '#5e3a20'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.strokeStyle = '#a06b40'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(a[0], a[1] - 1.4); ctx.lineTo(b[0], b[1] - 1.4); ctx.stroke();
      }
      // épouvantail
      const s = up(P(0.3, 0.3), 2.5);
      ctx.strokeStyle = '#6d4527'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[0], s[1] - 24); ctx.moveTo(s[0] - 7, s[1] - 16); ctx.lineTo(s[0] + 7, s[1] - 16); ctx.stroke();
      fill([[s[0] - 5, s[1] - 18], [s[0] + 5, s[1] - 18], [s[0] + 4, s[1] - 8], [s[0] - 4, s[1] - 8]], '#4f7fc4', SOUT, 0.6);
      circle(s[0], s[1] - 21, 3.5, '#e9c46a', SOUT);
      fill([[s[0] - 6, s[1] - 22.5], [s[0] + 6, s[1] - 22.5], [s[0], s[1] - 29]], '#8d5f38', SOUT, 0.6);
      // cultures
      const ready = stage >= 5;
      for (let i = 0; i < 7; i++) {
        const y = 0.2 + i * 0.26;
        for (let x = 0.22; x < 1.85; x += 0.16) {
          if (i < 2 && x < 0.5) continue;
          const p = up(P(x, y), 3);
          plant(p[0], p[1], stage, ready, (i * 31 + x * 100) | 0);
        }
      }
      fencePosts(P(0.02, 1.98), P(1.98, 1.98), 8, 7);
      fencePosts(P(1.98, 1.98), P(1.98, 0.02), 8, 7);
      return {};
    },

    lumber() {
      shadow(rect(0.25, 0.25, 1.35, 1.25), 44);
      prism(0.22, 0.22, 1.38, 1.28, 3, '#8f897d', 'stone', 3);
      const f = prism(0.25, 0.25, 1.35, 1.25, 20, '#a87b52', 'planks', 5, 3);
      onWall(f.l, f.b, (L) => { door(L * 0.35, 10, 14, '#6b4220'); windowAt(L * 0.78, 8, 6, 5, false); });
      onWall(f.b, f.r, (L) => { windowAt(L * 0.5, 8, 7, 6, false); });
      gable(0.25, 0.25, 1.35, 1.25, 23, 18, '#7d5434', 'shingle', 'y', 7, { wall: '#a87b52', wallTex: 'planks' });
      // pile de bûches
      for (const [row, n, z] of [[0, 4, 0], [1, 3, 4.5], [2, 2, 9]]) {
        for (let i = 0; i < n; i++) {
          const y = 1.42 + row * 0.07 + i * 0.13;
          log(P(1.35, y), P(1.85, y), 2.6, z + 2.6);
        }
      }
      // scie circulaire
      const sw = P(1.65, 0.55);
      prism(1.5, 0.45, 1.85, 0.68, 6, '#8d5f38', 'planks', 13);
      ctx.save();
      ctx.translate(sw[0] + 2, sw[1] - 12);
      circle(0, 0, 7.5, '#c9ced6', SOUT);
      ctx.fillStyle = '#9aa1ab';
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7.5, Math.sin(a) * 7.5); ctx.lineTo(Math.cos(a + 0.2) * 9.5, Math.sin(a + 0.2) * 9.5); ctx.lineTo(Math.cos(a + 0.35) * 7.5, Math.sin(a + 0.35) * 7.5); ctx.fill();
      }
      circle(0, 0, 2, '#5d6470');
      ctx.restore();
      // souche et hache
      const st = P(0.35, 1.65);
      ell(st[0], st[1] - 4, 5, 2.5, '#e3bf86', SOUT);
      ctx.fillStyle = '#6d4527'; ctx.fillRect(st[0] - 5, st[1] - 4, 10, 4);
      ell(st[0], st[1], 5, 2.5, '#6d4527', SOUT);
      ell(st[0], st[1] - 4, 5, 2.5, '#e3bf86', SOUT);
      ctx.strokeStyle = '#8d5f38'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(st[0] + 1, st[1] - 5); ctx.lineTo(st[0] + 7, st[1] - 14); ctx.stroke();
      fill([[st[0] - 1, st[1] - 5], [st[0] + 3, st[1] - 3], [st[0] + 3, st[1] - 8]], '#b8bec8', SOUT, 0.5);
      return {};
    },

    quarry() {
      prism(0.04, 0.04, 1.96, 1.96, 2, '#8b8172', 'soil', 3, 0, '#a59b8a');
      // fosse
      const rim = rect(0.35, 0.35, 1.65, 1.65, 2);
      const depth = 12;
      ctx.save();
      path([rim.t, rim.r, rim.b, rim.l]); ctx.clip();
      fill([rim.t, rim.r, rim.b, rim.l].map((p) => add(p, [0, depth])), '#5b554d', null);
      wall(add(rim.t, [0, depth]), add(rim.r, [0, depth]), depth, '#8d867a', 'stone', true, 5);
      wall(add(rim.l, [0, depth]), add(rim.t, [0, depth]), depth, '#8d867a', 'stone', false, 6);
      boulder(rim.c[0] + 4, rim.c[1] + depth - 2, 0.55, 3, '#a7a49c');
      ctx.restore();
      path([rim.t, rim.r, rim.b, rim.l]); ctx.strokeStyle = SOUT; ctx.lineWidth = 1; ctx.stroke();
      // grue en bois
      const c0 = up(P(1.7, 0.25), 2), c1 = up(P(1.25, 0.25), 2);
      ctx.strokeStyle = '#7a5130'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c0[0], c0[1]); ctx.lineTo((c0[0] + c1[0]) / 2, c0[1] - 34); ctx.lineTo(c1[0], c1[1]); ctx.stroke();
      const top = [(c0[0] + c1[0]) / 2, c0[1] - 34];
      ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(rim.c[0], rim.c[1] - 26); ctx.stroke();
      ctx.strokeStyle = '#3b2a1a'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(rim.c[0], rim.c[1] - 26); ctx.lineTo(rim.c[0], rim.c[1] - 4); ctx.stroke();
      fill([[rim.c[0] - 3, rim.c[1] - 6], [rim.c[0] + 3, rim.c[1] - 6], [rim.c[0] + 2.5, rim.c[1]], [rim.c[0] - 2.5, rim.c[1]]], '#8d5f38', SOUT, 0.5);
      // tas de pierres
      boulder(P(0.3, 1.6)[0], P(0.3, 1.6)[1], 0.7, 11);
      boulder(P(0.35, 1.25)[0] + 6, P(0.35, 1.25)[1], 0.5, 12);
      boulder(P(1.6, 1.85)[0], P(1.6, 1.85)[1], 0.6, 13);
      // chariot
      const k = P(1.15, 1.85);
      prism(1.0, 1.72, 1.3, 1.92, 6, '#8d5f38', 'planks', 17, 3);
      for (const dx of [-7, 5]) { ell(k[0] + dx, k[1] - 1, 3, 3, '#5d3a1f', SOUT); }
      for (let i = 0; i < 4; i++) circle(k[0] - 3 + i * 2.5, k[1] - 11 - (i % 2), 2, '#9a9890', SOUT);
      return {};
    },

    storage() {
      shadow(rect(0.25, 0.3, 1.75, 1.7), 50);
      prism(0.22, 0.27, 1.78, 1.73, 3, '#8f897d', 'stone', 3);
      const f = prism(0.25, 0.3, 1.75, 1.7, 24, '#b5492f', 'hplanks', 5, 3);
      ctx.strokeStyle = '#f3ead8'; ctx.lineWidth = 1.6;
      for (const p of [f.l, f.b, f.r]) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - 24); ctx.stroke(); }
      onWall(f.l, f.b, (L) => {
        const u = L * 0.5, w = 16, h = 17;
        ctx.fillStyle = '#8a3220'; ctx.fillRect(u - w / 2, 0, w, h);
        ctx.strokeStyle = '#f3ead8'; ctx.lineWidth = 1.4;
        ctx.strokeRect(u - w / 2, 0, w, h);
        ctx.beginPath();
        ctx.moveTo(u - w / 2, 0); ctx.lineTo(u, h); ctx.lineTo(u + w / 2, 0);
        ctx.moveTo(u - w / 2, h); ctx.lineTo(u, 0); ctx.lineTo(u + w / 2, h);
        ctx.moveTo(u, 0); ctx.lineTo(u, h);
        ctx.stroke();
      });
      onWall(f.b, f.r, (L) => { windowAt(L * 0.5, 12, 7, 6, false); });
      gable(0.25, 0.3, 1.75, 1.7, 27, 22, '#5e4a3c', 'shingle', 'x', 7, { wall: '#b5492f', wallTex: 'hplanks' });
      // bottes de foin
      for (const [x, y] of [[1.88, 0.55], [1.88, 0.85]]) {
        const p = P(x, y);
        cylinder(p[0], p[1], 6, 7, '#e2bf55', 'plain');
        ctx.strokeStyle = 'rgba(140,100,20,.6)'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.ellipse(p[0], p[1] - 3.5, 6, 3, 0, 0, Math.PI); ctx.stroke();
      }
      // sacs
      const sk = P(0.2, 1.85);
      ell(sk[0], sk[1] - 4, 4, 5, '#d8c4a0', SOUT);
      ell(sk[0] + 6, sk[1] - 3, 4, 4.5, '#cdb894', SOUT);
      return {};
    },

    shrine() {
      shadow(rect(0.15, 0.15, 1.85, 1.85), 18);
      prism(0.1, 0.1, 1.9, 1.9, 4, '#e9e4f5', 'plain', 3, 0, '#f2eefb');
      prism(0.26, 0.26, 1.74, 1.74, 4, '#e9e4f5', 'plain', 4, 4, '#faf8ff');
      const top = rect(0.26, 0.26, 1.74, 1.74, 8);
      ell(top.c[0], top.c[1], 18, 9, null, 'rgba(120,200,255,.8)');
      ell(top.c[0], top.c[1], 12, 6, null, 'rgba(180,140,255,.8)');
      const col = (x, y) => {
        const p = up(P(x, y), 8);
        cylinder(p[0], p[1], 3.8, 34, '#f4f1fb', 'plain');
        ctx.strokeStyle = 'rgba(150,140,190,.45)'; ctx.lineWidth = 0.5;
        for (const dx of [-1.6, 0, 1.6]) { ctx.beginPath(); ctx.moveTo(p[0] + dx, p[1] - 1); ctx.lineTo(p[0] + dx, p[1] - 33); ctx.stroke(); }
        cylinder(p[0], p[1] - 34, 5, 3, '#e8c55a', 'plain');
      };
      col(0.42, 0.42); col(0.42, 1.58); col(1.58, 0.42);
      col(1.58, 1.58);
      return { crystal: [top.c[0], top.c[1] - 32] };
    },

    barracks() {
      prism(0.06, 0.06, 2.94, 2.94, 2, '#c8ad7a', 'soil', 2, 0, '#dcc495');
      shadow(rect(0.25, 0.25, 2.0, 1.35), 50);
      prism(0.22, 0.22, 2.03, 1.38, 3, '#8f897d', 'stone', 3);
      const f = prism(0.25, 0.25, 2.0, 1.35, 26, '#c7bfae', 'stone', 5, 3);
      onWall(f.l, f.b, (L) => {
        door(L * 0.5, 11, 16, '#6b4220');
        windowAt(L * 0.2, 12, 6, 6); windowAt(L * 0.8, 12, 6, 6);
        ctx.fillStyle = '#b8322c';
        for (const u of [L * 0.35, L * 0.65]) { ctx.fillRect(u - 2.5, 9, 5, 14); }
      });
      onWall(f.b, f.r, (L) => { windowAt(L * 0.5, 12, 6, 6); });
      gable(0.25, 0.25, 2.0, 1.35, 29, 22, '#a8432f', 'tiles', 'x', 7, { wall: '#c7bfae', wallTex: 'stone' });
      // cible
      const tg = P(2.55, 0.7);
      ctx.strokeStyle = '#6d4527'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(tg[0] - 4, tg[1]); ctx.lineTo(tg[0], tg[1] - 14); ctx.lineTo(tg[0] + 4, tg[1]); ctx.stroke();
      for (const [r2, c] of [[8, '#f3ead8'], [6, '#c0392b'], [4, '#f3ead8'], [2, '#c0392b']]) ell(tg[0], tg[1] - 16, r2 * 0.75, r2, c, SOUT);
      // mannequins d'entraînement
      for (const [x, y] of [[0.7, 2.1], [1.4, 2.35]]) {
        const p = P(x, y);
        ctx.strokeStyle = '#6d4527'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - 20); ctx.moveTo(p[0] - 6, p[1] - 14); ctx.lineTo(p[0] + 6, p[1] - 14); ctx.stroke();
        ell(p[0], p[1] - 12, 4, 6, '#d9b56a', SOUT);
        circle(p[0], p[1] - 20, 3.4, '#cfa860', SOUT);
      }
      // râtelier de lances
      const rk = P(2.4, 1.85);
      ctx.strokeStyle = '#6d4527'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(rk[0] - 10, rk[1] - 8); ctx.lineTo(rk[0] + 6, rk[1] - 16); ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const x = rk[0] - 8 + i * 4, y = rk[1] - 6 - i * 2;
        ctx.strokeStyle = '#8d5f38'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + 1, y - 18); ctx.stroke();
        fill([[x + 1, y - 18], [x - 0.6, y - 14], [x + 2.6, y - 14]], '#c9ced6', SOUT, 0.4);
      }
      fencePosts(P(0.04, 2.96), P(2.96, 2.96), 10, 7);
      fencePosts(P(2.96, 2.96), P(2.96, 1.6), 5, 7);
      const fl = P(2.85, 2.85);
      flag(fl[0], fl[1], '#c0392b', 30, 13);
      return {};
    },

    tower() {
      const c = P(0.5, 0.5);
      roundShadow(c[0], c[1], 12, 70);
      cylinder(c[0], c[1], 14, 4, '#9d968a', 'plain');
      tower(0.5, 0.5, 4, 12, 52, 24, '#3f6fd6');
      return {};
    },

    den() {
      const pts = [P(0.1, 2.9), P(0.1, 1.6), P(0.6, 0.5), P(1.6, 0.1), P(2.9, 0.1), P(2.9, 1.5), P(2.9, 2.9), P(1.5, 2.95)];
      const c = P(1.5, 1.5);
      ell(c[0] + 18, c[1] + 6, 70, 34, 'rgba(30,45,15,.2)');
      // colline
      ctx.beginPath();
      const L = P(0.05, 2.95), Rr = P(2.95, 0.05), Bt = P(2.95, 2.95);
      ctx.moveTo(L[0], L[1]);
      ctx.bezierCurveTo(L[0] + 6, L[1] - 40, c[0] - 40, c[1] - 74, c[0] - 4, c[1] - 76);
      ctx.bezierCurveTo(c[0] + 34, c[1] - 78, Rr[0] - 8, Rr[1] - 36, Rr[0], Rr[1]);
      ctx.lineTo(Bt[0], Bt[1]);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, c[1] - 76, 0, Bt[1]);
      g.addColorStop(0, '#7f9a55'); g.addColorStop(0.35, '#6d7d4c'); g.addColorStop(0.55, '#7a6c5a'); g.addColorStop(1, '#5a4c40');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = SOUT; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.save(); ctx.clip();
      const sh = ctx.createLinearGradient(c[0] - 20, 0, Rr[0], 0);
      sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(20,10,40,.35)');
      ctx.fillStyle = sh; ctx.fillRect(c[0] - 120, c[1] - 90, 260, 180);
      const r = rnd(7);
      ctx.strokeStyle = 'rgba(40,30,20,.35)'; ctx.lineWidth = 0.8;
      for (let i = 0; i < 9; i++) {
        const y = c[1] - 40 + i * 9;
        ctx.beginPath(); ctx.moveTo(c[0] - 100, y + r() * 4);
        for (let x = -90; x <= 100; x += 20) ctx.lineTo(c[0] + x, y + (r() - 0.5) * 5);
        ctx.stroke();
      }
      for (let i = 0; i < 26; i++) ell(c[0] - 60 + r() * 120, c[1] - 66 + r() * 28, 4 + r() * 6, 2 + r() * 2, `rgba(${90 + r() * 40},${150 + r() * 40},${60 + r() * 20},.75)`);
      ctx.restore();
      void pts;
      // grotte
      const m = lerp(P(0.05, 2.95), Bt, 0.42);
      const cx = m[0] + 6, cy = m[1] - 4;
      ctx.beginPath();
      ctx.moveTo(cx - 22, cy);
      ctx.bezierCurveTo(cx - 22, cy - 34, cx + 18, cy - 38, cx + 20, cy + 4);
      ctx.closePath();
      const cg = ctx.createRadialGradient(cx - 2, cy - 10, 2, cx, cy - 8, 26);
      cg.addColorStop(0, '#3a2350'); cg.addColorStop(1, '#120a18');
      ctx.fillStyle = cg; ctx.fill();
      ctx.strokeStyle = '#3e3328'; ctx.lineWidth = 2.2; ctx.stroke();
      boulder(cx - 26, cy + 4, 0.55, 21, '#857b6c');
      boulder(cx + 24, cy + 8, 0.6, 22, '#857b6c');
      // cristaux
      crystalShape(cx + 36, cy - 6, 4, '#8ff3ff', '#57b8ff');
      crystalShape(cx + 42, cy - 2, 3, '#c9a7ff', '#8f6fff');
      // œufs
      const eggs = [[cx - 8, cy + 10, '#ffe08a'], [cx + 3, cy + 13, '#9fe8ff'], [cx + 13, cy + 9, '#ffb3e6']];
      for (const [ex, ey, col] of eggs) {
        const eg = ctx.createRadialGradient(ex - 2, ey - 4, 1, ex, ey - 2, 8);
        eg.addColorStop(0, '#fff'); eg.addColorStop(0.5, col); eg.addColorStop(1, shade(col, -0.35));
        ell(ex, ey - 3, 4.6, 6.2, eg, SOUT);
        circle(ex + 1.5, ey - 4, 0.9, shade(col, -0.4)); circle(ex - 1.5, ey - 1, 0.7, shade(col, -0.4));
      }
      // os
      const bn = P(2.3, 2.6);
      ctx.strokeStyle = '#efe6d2'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(bn[0] - 5, bn[1] - 2); ctx.lineTo(bn[0] + 5, bn[1] + 1); ctx.stroke();
      return { cave: [cx, cy - 12], eggs: eggs.map(([x, y]) => [x, y - 3]) };
    },

    fountain() {
      const c = P(0.5, 0.5);
      roundShadow(c[0], c[1], 20, 12);
      cylinder(c[0], c[1] + 2, 24, 9, '#c9c3b5', 'stone', 3);
      const wg = ctx.createRadialGradient(c[0] - 6, c[1] - 9, 2, c[0], c[1] - 7, 22);
      wg.addColorStop(0, '#d8f6ff'); wg.addColorStop(1, '#3d9ad6');
      ell(c[0], c[1] - 7, 20, 10, wg, 'rgba(255,255,255,.6)');
      cylinder(c[0], c[1] - 7, 3.5, 16, '#d8d2c6', 'plain');
      cylinder(c[0], c[1] - 23, 9, 3, '#d8d2c6', 'plain');
      ell(c[0], c[1] - 26, 7, 3.5, '#7fcff5');
      return { spray: [c[0], c[1] - 28], pool: [c[0], c[1] - 7] };
    },

    flowers() {
      const f = rect(0.1, 0.1, 0.9, 0.9);
      const c = f.c;
      ell(c[0], c[1], 24, 12, '#6b4426', null);
      const r = rnd(5);
      for (let a = 0; a < Math.PI * 2; a += 0.35) ell(c[0] + Math.cos(a) * 24, c[1] + Math.sin(a) * 12, 2.6, 1.6, '#b9b2a2', OUT);
      const cols = ['#ff6f91', '#ffd54f', '#ffffff', '#c58cff', '#ff8a65', '#7fc8ff'];
      const spots = [];
      for (let i = 0; i < 16; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.85;
        spots.push([c[0] + Math.cos(a) * 20 * d, c[1] + Math.sin(a) * 9 * d]);
      }
      spots.sort((a, b) => a[1] - b[1]);
      spots.forEach(([x, y], i) => {
        ctx.strokeStyle = '#3f7d2c'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 6); ctx.stroke();
        ell(x - 1.8, y - 3, 1.8, 0.9, '#4f9a3c', null, -0.5);
        const col = cols[i % cols.length];
        for (let k = 0; k < 5; k++) { const a = k * 1.256; circle(x + Math.cos(a) * 1.7, y - 7 + Math.sin(a) * 1.7, 1.4, col); }
        circle(x, y - 7, 0.9, '#ffe066');
      });
      return {};
    },

    statue() {
      shadow(rect(0.25, 0.25, 0.75, 0.75), 24);
      prism(0.22, 0.22, 0.78, 0.78, 5, '#bdb6a8', 'stone', 3);
      prism(0.32, 0.32, 0.68, 0.68, 15, '#e3ddd0', 'plain', 4, 5);
      prism(0.29, 0.29, 0.71, 0.71, 2, '#cfc8b8', 'plain', 5, 20);
      return { crystal: up(P(0.5, 0.5), 34) };
    },
  };

  // Plante d'un champ selon le stade de pousse (0 à 4), mûre au stade 5
  function plant(x, y, stage, ready, seed) {
    const r = rnd(seed + 1);
    const h = ready ? 10 : 2 + stage * 2;
    const col = ready ? '#d9a62e' : stage >= 4 ? '#b5b43c' : '#5fa83a';
    ctx.strokeStyle = shade(col, -0.2); ctx.lineWidth = 0.8;
    for (let k = -1; k <= 1; k++) {
      const lean = k * 1.4 + (r() - 0.5);
      ctx.beginPath(); ctx.moveTo(x + k * 0.8, y); ctx.quadraticCurveTo(x + k, y - h * 0.6, x + lean, y - h); ctx.stroke();
      if (ready) ell(x + lean, y - h - 1.5, 1.1, 2.6, '#f2c14e', 'rgba(120,80,10,.6)', lean * 0.15);
      else if (stage >= 2) ell(x + lean + 0.8, y - h * 0.7, 1.4, 0.7, col, null, 0.6);
    }
  }

  // =====================================================================
  // Cache des sprites de bâtiments
  // =====================================================================
  const bcache = {};
  const SCALE = 2;
  function buildingSprite(kind, variant) {
    const key = kind + ':' + variant;
    if (bcache[key]) return bcache[key];
    const def = D.BUILDINGS[kind];
    const s = def.size;
    const left = -s * HW - 14, right = s * HW + 80, top = -(def.h + 80), bottom = 2 * s * HH + 22;
    const c = document.createElement('canvas');
    c.width = Math.ceil((right - left) * SCALE);
    c.height = Math.ceil((bottom - top) * SCALE);
    const prev = ctx;
    ctx = c.getContext('2d');
    ctx.setTransform(SCALE, 0, 0, SCALE, -left * SCALE, -top * SCALE);
    ctx.lineCap = 'round';
    const anchors = BUILD[kind](variant) || {};
    ctx = prev;
    return (bcache[key] = { c, ox: left, oy: top, w: right - left, h: bottom - top, anchors });
  }

  // Animations par-dessus les sprites
  function liveCrystal(x, y, s, t, c1, c2, glow) {
    const bob = Math.sin(t * 2) * 2.5;
    ctx.save();
    const g = ctx.createRadialGradient(x, y + bob, 1, x, y + bob, s * 4 + glow);
    g.addColorStop(0, shade(c1, 0, 0.55)); g.addColorStop(1, shade(c1, 0, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + bob, s * 4 + glow, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    crystalShape(x, y + bob, s, c1, c2);
  }
  const LIVE = {
    castle(x, y, a, t) {
      const [cx, cy] = a.crystal;
      liveCrystal(x + cx, y + cy, 8, t, '#8ff3ff', '#3fa4ff', 6 + Math.sin(t * 3) * 3);
    },
    house(x, y, a, t, o) {
      if (!a.smoke) return;
      for (let i = 0; i < 4; i++) {
        const ph = (t * 0.35 + i / 4 + (o.id % 7) * 0.13) % 1;
        circle(x + a.smoke[0] + ph * 10, y + a.smoke[1] - ph * 30, 2.5 + ph * 5, `rgba(235,235,240,${0.55 * (1 - ph)})`);
      }
    },
    shrine(x, y, a, t) {
      const [cx, cy] = a.crystal;
      const beam = ctx.createLinearGradient(0, y + cy - 60, 0, y + cy + 30);
      beam.addColorStop(0, 'rgba(190,170,255,0)'); beam.addColorStop(0.6, 'rgba(190,170,255,.35)'); beam.addColorStop(1, 'rgba(190,170,255,0)');
      ctx.fillStyle = beam; ctx.fillRect(x + cx - 6, y + cy - 60, 12, 90);
      liveCrystal(x + cx, y + cy, 10, t, '#c9b6ff', '#7d5cff', 8 + Math.sin(t * 3) * 4);
    },
    statue(x, y, a, t) {
      liveCrystal(x + a.crystal[0], y + a.crystal[1], 6, t + 1, '#ff9fe0', '#c25bd6', 4);
    },
    den(x, y, a, t) {
      const gl = 0.5 + 0.5 * Math.sin(t * 2.2);
      const [cx, cy] = a.cave;
      const g = ctx.createRadialGradient(x + cx, y + cy, 1, x + cx, y + cy, 18);
      g.addColorStop(0, `rgba(200,140,255,${0.35 + gl * 0.3})`); g.addColorStop(1, 'rgba(200,140,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + cx, y + cy, 18, 0, Math.PI * 2); ctx.fill();
      circle(x + cx - 3, y + cy, 1.4, '#ffe066'); circle(x + cx + 3, y + cy, 1.4, '#ffe066');
      a.eggs.forEach(([ex, ey], i) => {
        const k = 0.5 + 0.5 * Math.sin(t * 2.5 + i * 2);
        const eg = ctx.createRadialGradient(x + ex, y + ey, 1, x + ex, y + ey, 12);
        eg.addColorStop(0, `rgba(255,240,200,${0.25 + k * 0.3})`); eg.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(x + ex, y + ey, 12, 0, Math.PI * 2); ctx.fill();
      });
    },
    fountain(x, y, a, t) {
      for (let i = 0; i < 10; i++) {
        const ph = (t * 1.2 + i / 10) % 1;
        const ang = (i / 10) * Math.PI * 2;
        const px = x + a.spray[0] + Math.cos(ang) * ph * 14;
        const py = y + a.spray[1] - Math.sin(ph * Math.PI) * 9 + ph * 20 + Math.sin(ang) * ph * 4;
        circle(px, py, 1.3, `rgba(225,248,255,${0.9 - ph * 0.5})`);
      }
      const rp = (t * 0.6) % 1;
      ell(x + a.pool[0], y + a.pool[1], 6 + rp * 12, 3 + rp * 6, null, `rgba(255,255,255,${0.6 * (1 - rp)})`);
    },
  };

  function drawBuilding(c, kind, gx, gy, t, o, variant, alpha = 1) {
    ctx = c;
    const sp = buildingSprite(kind, variant);
    const [x, y] = P(gx, gy);
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(sp.c, x + sp.ox, y + sp.oy, sp.w, sp.h);
    if (LIVE[kind]) LIVE[kind](x, y, sp.anchors, t, o || { id: 0 });
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  // Chantier (dessiné en direct)
  function drawConstruction(c, kind, gx, gy, p) {
    ctx = c;
    const def = D.BUILDINGS[kind];
    const s = def.size;
    const i = 0.18;
    ctx.save();
    ctx.translate(...P(gx, gy));
    prism(i, i, s - i, s - i, 3, '#a59d8e', 'stone', 3);
    const h = Math.max(6, def.h * 0.55 * p);
    prism(i + 0.06, i + 0.06, s - i - 0.06, s - i - 0.06, h, '#d9c7a3', 'planks', 5, 3);
    const f = rect(i - 0.04, i - 0.04, s - i + 0.04, s - i + 0.04, 3);
    const H = h + 12;
    ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    for (const q of [f.t, f.l, f.r, f.b]) { ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0], q[1] - H); ctx.stroke(); }
    ctx.strokeStyle = '#a8743e'; ctx.lineWidth = 2.4;
    for (const hh of [H * 0.45, H * 0.9]) {
      ctx.beginPath();
      ctx.moveTo(f.l[0], f.l[1] - hh); ctx.lineTo(f.b[0], f.b[1] - hh); ctx.lineTo(f.r[0], f.r[1] - hh);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(90,55,25,.8)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(f.l[0], f.l[1]); ctx.lineTo(f.b[0], f.b[1] - H * 0.45); ctx.moveTo(f.b[0], f.b[1]); ctx.lineTo(f.r[0], f.r[1] - H * 0.45); ctx.stroke();
    // planches et seau
    log(P(s - 0.05, s * 0.3), P(s - 0.05, s * 0.3 + 0.5), 1.4, 1.4);
    ctx.restore();
    return { top: up(P(gx + s / 2, gy + s / 2), H + 8) };
  }

  // =====================================================================
  // Arbres, rochers, repaires
  // =====================================================================
  const tcache = {};
  function cachedSprite(key, w, h, ox, oy, fn) {
    if (tcache[key]) return tcache[key];
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * SCALE); c.height = Math.ceil(h * SCALE);
    const prev = ctx;
    ctx = c.getContext('2d');
    ctx.setTransform(SCALE, 0, 0, SCALE, -ox * SCALE, -oy * SCALE);
    ctx.lineCap = 'round';
    fn();
    ctx = prev;
    return (tcache[key] = { c, ox, oy, w, h });
  }
  function oak(s, seed) {
    const r = rnd(seed);
    ell(14 * s, 3, 18 * s, 7 * s, 'rgba(30,45,15,.25)');
    const tg = ctx.createLinearGradient(-3 * s, 0, 3 * s, 0);
    tg.addColorStop(0, '#9a6a40'); tg.addColorStop(1, '#5a3a20');
    fill([[-3.5 * s, 0], [3.5 * s, 0], [2.4 * s, -18 * s], [-2.4 * s, -18 * s]], tg, SOUT, 0.7);
    ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-3 * s, 0); ctx.lineTo(-6 * s, 1.5); ctx.moveTo(3 * s, 0); ctx.lineTo(6 * s, 1.5); ctx.stroke();
    const blobs = [[0, -28, 13], [-10, -22, 10], [10, -23, 10.5], [-6, -35, 9], [7, -34, 9], [0, -40, 7]];
    const greens = ['#4d9a3a', '#3f8a33', '#56a843'];
    for (const [bx, by, br] of blobs) {
      const x = bx * s + (r() - 0.5) * 2, y = by * s + (r() - 0.5) * 2, rad = br * s;
      const g = ctx.createRadialGradient(x - rad * 0.4, y - rad * 0.5, rad * 0.1, x, y, rad * 1.1);
      const base = greens[(r() * 3) | 0];
      g.addColorStop(0, shade(base, 0.32)); g.addColorStop(0.6, base); g.addColorStop(1, shade(base, -0.4));
      circle(x, y, rad, g, SOUT);
    }
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2, d = r() * 14 * s;
      ell(Math.cos(a) * d - 3 * s, -30 * s + Math.sin(a) * d * 0.8, 2 * s, 1.2 * s, 'rgba(200,240,150,.35)', null, a);
    }
  }
  function pine(s, seed) {
    const r = rnd(seed);
    ell(12 * s, 3, 14 * s, 6 * s, 'rgba(30,45,15,.25)');
    fill([[-2.2 * s, 0], [2.2 * s, 0], [1.6 * s, -10 * s], [-1.6 * s, -10 * s]], '#6d4527', SOUT, 0.6);
    const tiers = [[-6, 15], [-17, 12.5], [-27, 10], [-36, 7]];
    for (const [ty, w] of tiers) {
      const y = ty * s, ww = w * s + (r() - 0.5) * 1.5, hh = 16 * s;
      ctx.beginPath();
      ctx.moveTo(-ww, y);
      ctx.quadraticCurveTo(0, y + 4 * s, ww, y);
      ctx.lineTo(0, y - hh);
      ctx.closePath();
      const g = ctx.createLinearGradient(-ww, 0, ww, 0);
      g.addColorStop(0, '#4c8f4a'); g.addColorStop(0.5, '#2f6e3c'); g.addColorStop(1, '#1d4a2a');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = SOUT; ctx.lineWidth = 0.8; ctx.stroke();
    }
  }
  function drawTree(c, x, y, v) {
    ctx = c;
    const isPine = v > 0.64;
    const variant = Math.floor(v * 1000) % 4;
    const s = 0.85 + variant * 0.1;
    const sp = cachedSprite(`tree:${isPine ? 'p' : 'o'}${variant}`, 80, 80, -36, -66, () => (isPine ? pine(s, variant + 3) : oak(s, variant + 9)));
    ctx.drawImage(sp.c, x + sp.ox, y + sp.oy, sp.w, sp.h);
  }
  function drawRock(c, x, y, v) {
    ctx = c;
    const variant = Math.floor(v * 1000) % 3;
    const sp = cachedSprite(`rock:${variant}`, 60, 36, -24, -26, () => {
      ell(6, 2, 16, 6, 'rgba(30,45,15,.22)');
      boulder(0, 2, 0.95 + variant * 0.12, variant + 5);
      if (variant !== 1) boulder(11, 5, 0.45, variant + 8);
    });
    ctx.drawImage(sp.c, x + sp.ox, y + sp.oy, sp.w, sp.h);
  }
  function campBase() {
    // palissade
    for (let i = 0; i < 9; i++) {
      const p = P(0.1 + i * 0.22, 0.1);
      fill([[p[0] - 2.4, p[1]], [p[0] + 2.4, p[1]], [p[0] + 2.4, p[1] - 15], [p[0], p[1] - 19], [p[0] - 2.4, p[1] - 15]], i % 2 ? '#4a3426' : '#3c2a1f', SOUT, 0.6);
    }
    for (let i = 1; i < 9; i++) {
      const p = P(0.1, 0.1 + i * 0.22);
      fill([[p[0] - 2.4, p[1]], [p[0] + 2.4, p[1]], [p[0] + 2.4, p[1] - 15], [p[0], p[1] - 19], [p[0] - 2.4, p[1] - 15]], i % 2 ? '#3c2a1f' : '#4a3426', SOUT, 0.6);
    }
    const tent = (x, y, rx, rh) => {
      const p = P(x, y);
      cone(p[0], p[1], rx, rh, '#4b3a63', 'slate');
      ctx.strokeStyle = 'rgba(160,30,60,.7)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(p[0] - rx * 0.7, p[1] - 2); ctx.lineTo(p[0], p[1] - rh * 0.7); ctx.stroke();
      fill([[p[0] - 3, p[1] + rx * 0.45], [p[0] + 4, p[1] + rx * 0.45], [p[0] + 0.5, p[1] - rh * 0.45]], '#120a18', SOUT, 0.6);
      ctx.strokeStyle = '#3c2a1f'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(p[0], p[1] - rh); ctx.lineTo(p[0] - 2, p[1] - rh - 6); ctx.moveTo(p[0], p[1] - rh); ctx.lineTo(p[0] + 3, p[1] - rh - 5); ctx.stroke();
    };
    tent(0.55, 0.65, 16, 28);
    tent(1.45, 1.05, 14, 25);
    // foyer
    const fp = P(1.1, 1.65);
    for (let a = 0; a < Math.PI * 2; a += 0.7) ell(fp[0] + Math.cos(a) * 7, fp[1] + Math.sin(a) * 3.5, 2.2, 1.6, '#5b5650', SOUT);
    // totem
    const tp = P(1.75, 0.35);
    fill([[tp[0] - 2, tp[1]], [tp[0] + 2, tp[1]], [tp[0] + 2, tp[1] - 34], [tp[0] - 2, tp[1] - 34]], '#2a1a12', SOUT, 0.6);
    circle(tp[0], tp[1] - 22, 4, '#e8e0cc', SOUT);
    circle(tp[0] - 1.4, tp[1] - 22.5, 0.9, '#120a18'); circle(tp[0] + 1.4, tp[1] - 22.5, 0.9, '#120a18');
    // drapeau déchiré
    const fl = P(0.35, 1.7);
    ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(fl[0], fl[1]); ctx.lineTo(fl[0], fl[1] - 30); ctx.stroke();
    fill([[fl[0], fl[1] - 30], [fl[0] + 12, fl[1] - 28], [fl[0] + 9, fl[1] - 24], [fl[0] + 12, fl[1] - 20], [fl[0], fl[1] - 21]], '#2b1838', SOUT, 0.6);
    circle(fl[0] + 5, fl[1] - 25, 1.8, '#ff3f6c');
  }
  function drawCamp(c, gx, gy, idx, t) {
    ctx = c;
    const sp = cachedSprite('camp', 150, 110, -76, -70, campBase);
    const [x, y] = P(gx, gy);
    ctx.drawImage(sp.c, x + sp.ox, y + sp.oy, sp.w, sp.h);
    // flammes
    const fp = add([x, y], P(1.1, 1.65));
    for (let i = 0; i < 3; i++) {
      const k = Math.sin(t * 9 + i * 2) * 1.5;
      const g = ctx.createRadialGradient(fp[0], fp[1] - 4, 1, fp[0], fp[1] - 6, 9);
      g.addColorStop(0, 'rgba(255,200,255,.9)'); g.addColorStop(0.5, 'rgba(190,60,255,.7)'); g.addColorStop(1, 'rgba(120,20,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(fp[0] - 5 + i * 3, fp[1]); ctx.quadraticCurveTo(fp[0] - 5 + i * 3 + k, fp[1] - 10, fp[0] - 3 + i * 3 + k, fp[1] - 14 - i * 2); ctx.quadraticCurveTo(fp[0] + i * 2, fp[1] - 6, fp[0] - 1 + i * 3, fp[1]); ctx.fill();
    }
    const tp = add([x, y], P(1.75, 0.35));
    liveCrystal(tp[0], tp[1] - 40, 5, t + idx, '#ff3f6c', '#a0153c', 4 + Math.sin(t * 3) * 2);
    // ennemi
    const ec = add([x, y], P(1, 1.35));
    const bob = Math.sin(t * 2 + idx) * 2.5;
    drawSprite(c, 'foe' + idx, ec[0], ec[1] + 2 + bob * 0.2, 52, false, bob);
  }

  // =====================================================================
  // Sol de l'île (mis en cache)
  // =====================================================================
  function hash2(a, b) {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const WATER = { tiles: [], fall: null };

  // Petit rocher flottant autour de l'île
  function miniIslet(cx, cy, s, seed) {
    const r = rnd(seed);
    ctx.beginPath();
    ctx.moveTo(cx - 26 * s, cy);
    for (let i = 1; i <= 6; i++) {
      const t = i / 7;
      ctx.lineTo(cx - 26 * s + 52 * s * t, cy + (8 + Math.sin(t * Math.PI) * 52 + r() * 8) * s);
    }
    ctx.lineTo(cx + 26 * s, cy);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, cy, 0, cy + 60 * s);
    g.addColorStop(0, '#8d6a4a'); g.addColorStop(1, '#3a2a1e');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(40,25,15,.5)'; ctx.lineWidth = 0.8; ctx.stroke();
    ell(cx, cy + 2 * s, 27 * s, 13 * s, '#7a5233');
    const gg = ctx.createRadialGradient(cx - 8 * s, cy - 4 * s, 2, cx, cy, 28 * s);
    gg.addColorStop(0, '#8fd06a'); gg.addColorStop(1, '#4f9a3c');
    ell(cx, cy, 27 * s, 13 * s, gg, 'rgba(40,70,20,.5)');
    if (s > 0.6) { ctx.save(); ctx.translate(cx + 4 * s, cy + 2 * s); oak(s * 0.6, seed); ctx.restore(); }
  }

  function buildGround(N, LAY) {
    const { land, water, fall, paths, plaza } = LAY;
    const isLand = (x, y) => x >= 0 && y >= 0 && x < N && y < N && land[y * N + x] === 1;
    const isWater = (x, y) => isLand(x, y) && water[y * N + x] === 1;
    const pad = 90, GS = 1.75;
    const w = N * 2 * HW + pad * 2, h = N * 2 * HH + pad * 2 + 320;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * GS); c.height = Math.ceil(h * GS);
    const prev = ctx;
    ctx = c.getContext('2d');
    ctx.setTransform(GS, 0, 0, GS, (N * HW + pad) * GS, pad * GS);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const r = rnd(4242);
    const cN = N / 2;
    const depthAt = (x, y) => {
      const d = Math.min(1, Math.hypot((x + 0.5 - cN) / cN, (y + 0.5 - cN) / cN));
      return 42 + 220 * Math.pow(1 - d, 1.35) + hash2(x, y) * 18;
    };

    // Rochers flottants à l'arrière
    miniIslet(...P(-3, 8), 0.9, 3);
    miniIslet(...P(27, 5), 0.7, 4);

    // Dessous rocheux : une colonne par case, de l'arrière vers l'avant
    const tiles = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (isLand(x, y)) tiles.push([x, y]);
    tiles.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0]);
    const cliffFace = (A, B, d, lit, seed) => {
      const rr2 = rnd(seed);
      const mid = lerp(A, B, 0.5);
      const pts = [A, B, add(B, [0, d]), add(mid, [0, d + 6 + rr2() * 10]), add(A, [0, d])];
      const g = ctx.createLinearGradient(0, A[1], 0, A[1] + d);
      if (lit) { g.addColorStop(0, '#a07a55'); g.addColorStop(0.15, '#8c6a4b'); g.addColorStop(1, '#3d2c20'); }
      else { g.addColorStop(0, '#7e5d40'); g.addColorStop(0.15, '#6b4f37'); g.addColorStop(1, '#2a1e16'); }
      path(pts); ctx.fillStyle = g; ctx.fill();
      ctx.save(); path(pts); ctx.clip();
      ctx.strokeStyle = lit ? 'rgba(50,30,15,.28)' : 'rgba(20,10,5,.3)'; ctx.lineWidth = 0.9;
      for (let k = 12; k < d; k += 11) {
        ctx.beginPath(); ctx.moveTo(A[0], A[1] + k + (rr2() - 0.5) * 2); ctx.lineTo(B[0], B[1] + k + (rr2() - 0.5) * 2); ctx.stroke();
      }
      for (let k = 0; k < 3; k++) {
        const p = lerp(A, B, rr2());
        ell(p[0], p[1] + 10 + rr2() * (d - 14), 2 + rr2() * 2.5, 1.4 + rr2() * 1.4, lit ? 'rgba(160,150,135,.55)' : 'rgba(120,110,100,.5)');
      }
      ctx.fillStyle = lit ? 'rgba(60,35,15,.55)' : 'rgba(40,25,10,.6)';
      path([A, B, add(B, [0, 5]), add(A, [0, 5])]); ctx.fill();
      ctx.restore();
    };
    for (const [x, y] of tiles) {
      const d = depthAt(x, y);
      cliffFace(P(x, y + 1), P(x + 1, y + 1), d, true, x * 31 + y);
      cliffFace(P(x + 1, y + 1), P(x + 1, y), d, false, x * 17 + y * 7);
    }

    // Dessus : herbe (et sable sous l'eau)
    const noise = (x, y) => 0.5 + 0.22 * Math.sin(x * 0.42 + 1.3) * Math.cos(y * 0.37 + 0.7) + 0.18 * Math.sin((x + y) * 0.23 + 2.1) + 0.1 * Math.cos((x - y) * 0.6);
    const landPath = () => {
      ctx.beginPath();
      for (const [x, y] of tiles) {
        const a = P(x, y), b = P(x + 1, y), cc = P(x + 1, y + 1), d = P(x, y + 1);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(cc[0], cc[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
      }
    };
    for (const [x, y] of tiles) {
      const n = noise(x, y);
      const col = isWater(x, y) ? '#d8c48e' : `hsl(${88 + n * 16},${52 + n * 8}%,${42 + n * 12}%)`;
      path([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)]);
      ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 0.9; ctx.stroke();
    }

    ctx.save();
    landPath(); ctx.clip();
    const T = P(0, 0), Bt = P(N, N), Lf = P(0, N), Rt = P(N, 0);
    const lg = ctx.createLinearGradient(T[0], T[1], Bt[0], Bt[1]);
    lg.addColorStop(0, 'rgba(255,250,220,.16)'); lg.addColorStop(1, 'rgba(20,40,10,.16)');
    ctx.fillStyle = lg; ctx.fillRect(Lf[0], T[1], Rt[0] - Lf[0], Bt[1] - T[1]);
    const onGrass = (gx, gy) => isLand(gx | 0, gy | 0) && !isWater(gx | 0, gy | 0);
    // taches de trèfle
    for (let i = 0; i < N * N * 0.6; i++) {
      const gx = r() * N, gy = r() * N;
      if (!onGrass(gx, gy)) continue;
      const p = P(gx, gy);
      ell(p[0], p[1], 6 + r() * 12, 3 + r() * 5, `rgba(${40 + r() * 30},${100 + r() * 30},30,.13)`);
    }
    // chemins de terre
    for (const line of paths) {
      const pts = line.map(([x, y]) => P(x, y));
      const stroke = (wd, col) => {
        ctx.strokeStyle = col; ctx.lineWidth = wd;
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          const m = lerp(pts[i - 1], pts[i], 0.5);
          ctx.quadraticCurveTo(pts[i - 1][0], pts[i - 1][1], m[0], m[1]);
        }
        ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
        ctx.stroke();
      };
      stroke(17, 'rgba(120,90,50,.35)');
      stroke(12, '#c2a273');
      stroke(6, 'rgba(220,195,150,.6)');
      for (let i = 1; i < pts.length; i++) {
        for (let k = 0; k < 8; k++) {
          const p = lerp(pts[i - 1], pts[i], r());
          ell(p[0] + (r() - 0.5) * 10, p[1] + (r() - 0.5) * 5, 1 + r(), 0.7 + r() * 0.5, 'rgba(120,100,80,.55)');
        }
      }
    }
    // touffes d'herbe
    const batches = [['rgba(40,90,25,.55)', []], ['rgba(170,220,110,.45)', []], ['rgba(70,120,35,.5)', []]];
    for (let i = 0; i < N * N * 16; i++) {
      const gx = r() * N, gy = r() * N;
      if (!onGrass(gx, gy)) continue;
      const p = P(gx, gy);
      batches[(r() * 3) | 0][1].push([p[0], p[1], (r() - 0.5) * 2.2, 2 + r() * 2.6]);
    }
    for (const [col, list] of batches) {
      ctx.strokeStyle = col; ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (const [x, y, lean, hh] of list) { ctx.moveTo(x, y); ctx.lineTo(x + lean, y - hh); }
      ctx.stroke();
    }
    const fcols = ['#ffffff', '#ffe066', '#ff9ec7', '#c9b6ff'];
    for (let i = 0; i < N * N * 0.9; i++) {
      const gx = r() * N, gy = r() * N;
      if (!onGrass(gx, gy)) continue;
      const p = P(gx, gy);
      circle(p[0], p[1], 0.9, fcols[(r() * 4) | 0]);
    }
    // place pavée de la citadelle
    if (plaza) {
      const pf = rect(...plaza);
      const pts = [pf.t, pf.r, pf.b, pf.l];
      fill(pts, '#b9b09c', 'rgba(90,70,50,.4)');
      const [e1, L1] = unit(pf.t, pf.r);
      const [e2, L2] = unit(pf.t, pf.l);
      face(pf.t, e1, e2, pts, () => {
        for (let v = 0; v < L2; v += 4.4) {
          for (let u = -r() * 3; u < L1; u += 4.6 + r() * 2) {
            ctx.fillStyle = shade('#c2b8a2', (r() - 0.5) * 0.25);
            rr(u + 0.4, v + 0.4, 3.8, 3.6, 1.3); ctx.fill();
          }
        }
      });
    }
    // Eau : lac et rivière
    const wt = tiles.filter(([x, y]) => isWater(x, y));
    if (wt.length) {
      // contours arrondis : union d'ellipses centrées sur chaque case d'eau
      const blob = (rx, ry) => {
        ctx.beginPath();
        for (const [x, y] of wt) { const p = P(x + 0.5, y + 0.5); ctx.moveTo(p[0] + rx, p[1]); ctx.ellipse(p[0], p[1], rx, ry, 0, 0, Math.PI * 2); }
      };
      blob(38, 19.5); ctx.fillStyle = '#cdb983'; ctx.fill();
      blob(34, 17.5); ctx.fillStyle = '#e3d3a2'; ctx.fill();
      blob(30, 15.5); ctx.fillStyle = '#a6e0f4'; ctx.fill();
      blob(26.5, 13.5);
      const wg = ctx.createLinearGradient(P(15, 13)[0], P(15, 13)[1], P(21, 19)[0], P(21, 19)[1]);
      wg.addColorStop(0, '#5fbbe9'); wg.addColorStop(0.5, '#3a92d0'); wg.addColorStop(1, '#2a72b6');
      ctx.fillStyle = wg; ctx.fill();
      ctx.save(); blob(26.5, 13.5); ctx.clip();
      for (const [x, y] of wt) {
        if (r() < 0.22 && !(fall && y === fall[1] && x > 18)) {
          const p = P(x + 0.3 + r() * 0.4, y + 0.3 + r() * 0.4);
          ell(p[0], p[1], 5, 2.6, '#4f9a3c', 'rgba(30,60,20,.6)');
          fill([[p[0], p[1]], [p[0] + 5, p[1] - 0.6], [p[0] + 5, p[1] + 0.8]], '#3a92d0', null);
          if (r() < 0.5) circle(p[0] - 1, p[1] - 1, 1.3, '#ff9ec7');
        }
      }
      ctx.restore();
      // roseaux sur les berges
      ctx.strokeStyle = '#4a7f2e'; ctx.lineWidth = 0.9;
      for (const [x, y] of wt) {
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
          if (isWater(x + dx, y + dy) || !isLand(x + dx, y + dy) || r() > 0.5) continue;
          const p = P(x + 0.5 + dx * 0.55, y + 0.5 + dy * 0.55);
          ctx.beginPath();
          for (let k = -1; k <= 1; k++) { ctx.moveTo(p[0] + k * 1.6, p[1]); ctx.lineTo(p[0] + k * 2.4, p[1] - 6 - r() * 4); }
          ctx.stroke();
          ell(p[0] + 2.4, p[1] - 9, 0.9, 2.2, '#7a5130');
        }
      }
    }
    ctx.restore();

    // Bord de l'île : liseré d'herbe et racines qui pendent
    for (const [x, y] of tiles) {
      const edges = [];
      if (!isLand(x, y + 1)) edges.push([P(x, y + 1), P(x + 1, y + 1)]);
      if (!isLand(x + 1, y)) edges.push([P(x + 1, y + 1), P(x + 1, y)]);
      if (!isLand(x - 1, y)) edges.push([P(x, y), P(x, y + 1), true]);
      if (!isLand(x, y - 1)) edges.push([P(x, y), P(x + 1, y), true]);
      for (const [A, B, back] of edges) {
        if (back) { ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); continue; }
        ctx.strokeStyle = '#4f8f34'; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(A[0], A[1] + 1); ctx.lineTo(B[0], B[1] + 1); ctx.stroke();
        ctx.strokeStyle = 'rgba(80,140,45,.9)'; ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (let k = 0; k < 5; k++) { const p = lerp(A, B, r()); ctx.moveTo(p[0], p[1] + 2); ctx.lineTo(p[0] + (r() - 0.5) * 2, p[1] + 4 + r() * 4); }
        ctx.stroke();
        if (r() < 0.35) {
          const p = lerp(A, B, r());
          ctx.strokeStyle = 'rgba(70,45,25,.85)'; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(p[0], p[1] + 5); ctx.quadraticCurveTo(p[0] + 4, p[1] + 14, p[0] - 1, p[1] + 18 + r() * 12); ctx.stroke();
        }
      }
    }

    // Cascade (partie fixe)
    WATER.tiles = wt.map(([x, y]) => P(x + 0.5, y + 0.5));
    WATER.fall = null;
    if (fall) {
      const [fx, fy] = fall;
      const A = lerp(P(fx + 1, fy + 1), P(fx + 1, fy), 0.18), B = lerp(P(fx + 1, fy + 1), P(fx + 1, fy), 0.82);
      const len = depthAt(fx, fy) + 120;
      const g = ctx.createLinearGradient(0, A[1], 0, A[1] + len);
      g.addColorStop(0, 'rgba(120,200,240,.95)'); g.addColorStop(0.7, 'rgba(200,236,255,.7)'); g.addColorStop(1, 'rgba(230,246,255,0)');
      path([A, B, add(B, [4, len]), add(A, [-4, len])]); ctx.fillStyle = g; ctx.fill();
      WATER.fall = { A, B, len };
    }

    // Rochers flottants à l'avant
    miniIslet(...P(6, 28), 0.8, 5);
    miniIslet(...P(27, 25), 0.55, 6);

    ctx = prev;
    return { c, ox: -(N * HW + pad), oy: -pad, w, h };
  }

  // Reflets sur l'eau et cascade animée
  function drawWaterLive(c, t) {
    ctx = c;
    ctx.lineWidth = 0.9;
    WATER.tiles.forEach(([x, y], i) => {
      const ox = (hash2(i, 7) - 0.5) * 30, oy = (hash2(i, 13) - 0.5) * 12;
      const a = Math.max(0, 0.32 * Math.sin(t * 1.3 + i * 2.3));
      if (a < 0.02) return;
      const dx = Math.sin(t * 0.5 + i) * 3, len = 3 + hash2(i, 3) * 5;
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.moveTo(x + ox + dx - len, y + oy); ctx.lineTo(x + ox + dx + len, y + oy); ctx.stroke();
    });
    const f = WATER.fall;
    if (!f) return;
    ctx.lineWidth = 1.4;
    for (let k = 0; k < 9; k++) {
      const p = lerp(f.A, f.B, (k + 0.5) / 9);
      for (let j = 0; j < 3; j++) {
        const off = (t * 70 + k * 23 + j * f.len / 3) % f.len;
        const a = 0.7 * (1 - off / f.len);
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.moveTo(p[0], p[1] + off); ctx.lineTo(p[0], p[1] + off + 10); ctx.stroke();
      }
    }
    const top = lerp(f.A, f.B, 0.5);
    for (let k = 0; k < 4; k++) {
      const ph = (t * 0.8 + k / 4) % 1;
      circle(top[0] + (k - 1.5) * 4, top[1] + 2 - ph * 4, 1.5 + ph * 2, `rgba(255,255,255,${0.5 * (1 - ph)})`);
    }
  }

  // Petites îles de la carte des expéditions
  const isletUrls = {};
  function isletURL(kind, seed) {
    const key = kind + seed;
    if (isletUrls[key]) return isletUrls[key];
    const c = document.createElement('canvas');
    c.width = 240; c.height = 210;
    const prev = ctx;
    ctx = c.getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const r = rnd(seed + 11);
    const cx = 120, cy = 80;
    // dessous rocheux
    ctx.beginPath();
    ctx.moveTo(cx - 96, cy + 4);
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      ctx.lineTo(cx - 96 + 192 * t, cy + 8 + Math.sin(t * Math.PI) * 108 + (r() - 0.5) * 14);
    }
    ctx.lineTo(cx + 96, cy + 4);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, cy, 0, cy + 120);
    const shadowy = kind === 'shadow';
    g.addColorStop(0, shadowy ? '#5a4560' : '#8d6a4a'); g.addColorStop(1, shadowy ? '#1c1424' : '#33241a');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(30,15,10,.5)'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1;
    for (let k = 18; k < 120; k += 14) { ctx.beginPath(); ctx.moveTo(cx - 100, cy + k); ctx.lineTo(cx + 100, cy + k + (r() - 0.5) * 6); ctx.stroke(); }
    const sh = ctx.createLinearGradient(cx - 96, 0, cx + 96, 0);
    sh.addColorStop(0, 'rgba(255,255,255,.06)'); sh.addColorStop(1, 'rgba(0,0,0,.3)');
    ctx.fillStyle = sh; ctx.fillRect(0, 0, 240, 210);
    ctx.restore();
    // épaisseur de terre + dessus
    ell(cx, cy + 6, 96, 46, shadowy ? '#3e2a44' : '#7a5233');
    const tg = ctx.createRadialGradient(cx - 30, cy - 20, 4, cx, cy, 100);
    if (shadowy) { tg.addColorStop(0, '#5e4a72'); tg.addColorStop(1, '#2d2038'); }
    else { tg.addColorStop(0, '#9ad66f'); tg.addColorStop(1, '#4b9238'); }
    ell(cx, cy, 96, 46, tg, 'rgba(30,20,20,.4)');
    if (shadowy) {
      ctx.strokeStyle = 'rgba(210,80,255,.55)'; ctx.lineWidth = 1;
      for (let k = 0; k < 7; k++) {
        let p = [cx + (r() - 0.5) * 140, cy + (r() - 0.5) * 50];
        ctx.beginPath(); ctx.moveTo(p[0], p[1]);
        for (let s2 = 0; s2 < 4; s2++) { p = add(p, [(r() - 0.5) * 22, (r() - 0.5) * 10]); ctx.lineTo(p[0], p[1]); }
        ctx.stroke();
      }
      // arbres morts
      for (const [x, y] of [[cx - 70, cy - 4], [cx + 72, cy + 2]]) {
        ctx.strokeStyle = '#2a1a22'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 30); ctx.moveTo(x, y - 18); ctx.lineTo(x - 10, y - 30); ctx.moveTo(x, y - 24); ctx.lineTo(x + 9, y - 34); ctx.stroke();
      }
      ctx.save(); ctx.translate(cx, cy - 26); ctx.scale(0.85, 0.85); campBase(); ctx.restore();
      const fog = ctx.createRadialGradient(cx, cy, 10, cx, cy, 110);
      fog.addColorStop(0, 'rgba(120,60,170,0)'); fog.addColorStop(1, 'rgba(120,60,170,.25)');
      ell(cx, cy, 96, 46, fog);
    } else {
      for (let i = 0; i < 40; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r());
        circle(cx + Math.cos(a) * 86 * d, cy + Math.sin(a) * 40 * d, 1.1, ['#fff', '#ffe066', '#ff9ec7'][i % 3]);
      }
      ctx.save(); ctx.translate(cx - 62, cy + 6); oak(0.9, seed + 3); ctx.restore();
      ctx.save(); ctx.translate(cx + 66, cy); pine(0.85, seed + 4); ctx.restore();
      ctx.save(); ctx.translate(cx + 40, cy + 22); oak(0.6, seed + 5); ctx.restore();
    }
    ctx = prev;
    return (isletUrls[key] = c.toDataURL());
  }

  // =====================================================================
  // Personnages et créatures (dans une boîte de 64, pieds en (0,0))
  // =====================================================================
  function body(x, y, rx, ry, base, rot = 0) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(x - rx * 0.4, y - ry * 0.5, Math.max(rx, ry) * 0.1, x, y, Math.max(rx, ry) * 1.15);
    g.addColorStop(0, shade(base, 0.35)); g.addColorStop(0.55, base); g.addColorStop(1, shade(base, -0.38));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = SOUT; ctx.lineWidth = 1.5; ctx.stroke();
  }
  function shapeFill(fn, base, x, y, r2) {
    fn();
    const g = ctx.createRadialGradient(x - r2 * 0.4, y - r2 * 0.5, r2 * 0.1, x, y, r2 * 1.2);
    g.addColorStop(0, shade(base, 0.35)); g.addColorStop(0.55, base); g.addColorStop(1, shade(base, -0.38));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = SOUT; ctx.lineWidth = 1.5; ctx.stroke();
  }
  function eye(x, y, r2, iris = '#2b1d14', angry = false) {
    circle(x, y, r2, '#fff', SOUT);
    circle(x + r2 * 0.2, y + r2 * 0.12, r2 * 0.62, iris);
    circle(x + r2 * 0.28, y + r2 * 0.18, r2 * 0.32, '#000');
    circle(x - r2 * 0.05, y - r2 * 0.25, r2 * 0.28, '#fff');
    if (angry) { ctx.strokeStyle = SOUT; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - r2 * 1.1, y - r2 * 1.3); ctx.lineTo(x + r2 * 1.1, y - r2 * 0.7); ctx.stroke(); }
  }
  function glowEye(x, y, r2, col) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r2 * 2.6);
    g.addColorStop(0, col); g.addColorStop(1, shade(col, 0, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r2 * 2.6, 0, Math.PI * 2); ctx.fill();
    circle(x, y, r2, '#fff');
  }
  function leg(x, y, w, h, base) {
    rr(x - w / 2, y - h, w, h, w / 2);
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, shade(base, 0.15)); g.addColorStop(1, shade(base, -0.3));
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.2; ctx.stroke();
  }
  function tri(pts, base) {
    path(pts);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const g = ctx.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    g.addColorStop(0, shade(base, 0.25)); g.addColorStop(1, shade(base, -0.3));
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.2; ctx.lineJoin = 'round'; ctx.stroke();
  }
  function wing(x, y, span, h, base, flipX = 1, feather = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(flipX, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-span * 0.3, -h * 1.1, -span, -h);
    if (feather) {
      for (let i = 0; i < 4; i++) {
        const x0 = -span + i * span * 0.25;
        ctx.quadraticCurveTo(x0 + span * 0.05, -h * 0.35 + i * 2, x0 + span * 0.25, -h * 0.55 + i * 3);
      }
    } else {
      ctx.quadraticCurveTo(-span * 0.85, -h * 0.3, -span * 0.7, -h * 0.25);
      ctx.quadraticCurveTo(-span * 0.55, -h * 0.55, -span * 0.4, -h * 0.15);
      ctx.quadraticCurveTo(-span * 0.25, -h * 0.4, -span * 0.12, -h * 0.05);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(-span, -h, 0, 0);
    g.addColorStop(0, shade(base, 0.25)); g.addColorStop(1, shade(base, -0.25));
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.strokeStyle = shade(base, -0.4, 0.8); ctx.lineWidth = 0.8;
    for (const t of [0.4, 0.7]) { ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(-span * t, -h * (0.4 + t * 0.4)); ctx.stroke(); }
    ctx.restore();
  }
  function quad(o) {
    // quadrupède générique, tourné vers la droite
    const b = o.body, dk = shade(b, -0.25);
    if (o.tail) o.tail();
    leg(-9, 0, 4.5, 10, dk); leg(7, 0, 4.5, 10, dk);
    if (o.wings) o.wings();
    body(-1, -14, o.rx || 14, o.ry || 9, b);
    if (o.belly) ell(1, -10, (o.rx || 14) * 0.7, (o.ry || 9) * 0.45, o.belly);
    leg(-5, 1, 4.5, 10, b); leg(11, 1, 4.5, 10, b);
    if (o.hooves) { ell(-5, 0, 2.6, 1.4, o.hooves, SOUT); ell(11, 0, 2.6, 1.4, o.hooves, SOUT); }
    if (o.back) o.back();
    o.head();
  }

  const SPR = {
    // --- Ressources et objets ---
    res_gold() {
      for (const [x, y] of [[-8, -12], [8, -14], [0, -24]]) {
        ell(x, y + 3, 12, 6, '#b8860b', SOUT);
        const g = ctx.createLinearGradient(x - 12, y - 6, x + 12, y + 6);
        g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#f5c542'); g.addColorStop(1, '#c98a12');
        ell(x, y, 12, 6, g, SOUT);
        ell(x, y, 8, 4, null, 'rgba(150,100,10,.8)');
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        fill([[x, y - 3], [x + 1, y - 1], [x + 3.2, y - 1], [x + 1.4, y + 0.6], [x + 2, y + 3], [x, y + 1.6], [x - 2, y + 3], [x - 1.4, y + 0.6], [x - 3.2, y - 1], [x - 1, y - 1]], 'rgba(180,120,10,.7)', null);
      }
    },
    res_food() {
      ctx.save(); ctx.rotate(-0.5);
      rr(-2, -48, 6, 22, 3); ctx.fillStyle = '#f5f0e2'; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.4; ctx.stroke();
      circle(-1, -48, 4, '#f5f0e2', SOUT); circle(5, -48, 4, '#f5f0e2', SOUT);
      body(1, -18, 13, 16, '#b5582d');
      ell(-3, -24, 5, 3, 'rgba(255,220,180,.35)', null, -0.5);
      ctx.restore();
    },
    res_wood() {
      ctx.save(); ctx.rotate(-0.25);
      rr(-22, -30, 36, 18, 6);
      const g = ctx.createLinearGradient(0, -30, 0, -12);
      g.addColorStop(0, '#a8744a'); g.addColorStop(1, '#5d3a1f');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(40,20,5,.5)'; ctx.lineWidth = 1;
      for (const y of [-25, -19]) { ctx.beginPath(); ctx.moveTo(-18, y); ctx.lineTo(8, y + 1); ctx.stroke(); }
      ell(14, -21, 6.5, 9, '#e8c48e', SOUT);
      ell(14, -21, 3.5, 5, null, 'rgba(140,90,40,.8)');
      ell(14, -21, 1.3, 2, null, 'rgba(140,90,40,.8)');
      ctx.restore();
    },
    res_stone() {
      boulder(0, -8, 1.5, 3, '#a3a19a');
      boulder(10, -4, 0.7, 4, '#8f8d86');
    },
    res_gems() {
      const g = ctx.createRadialGradient(0, -24, 2, 0, -24, 26);
      g.addColorStop(0, 'rgba(140,240,255,.6)'); g.addColorStop(1, 'rgba(140,240,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -24, 26, 0, Math.PI * 2); ctx.fill();
      crystalShape(0, -24, 13, '#8ff3ff', '#3fa4ff');
      crystalShape(-11, -12, 6, '#c9a7ff', '#8f6fff');
    },
    egg() {
      const g = ctx.createRadialGradient(-5, -34, 2, 0, -24, 24);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#ffe9a8'); g.addColorStop(1, '#e0a83a');
      ell(0, -22, 15, 20, g, SOUT);
      for (const [x, y, r2, c] of [[-5, -28, 3, '#8f6fff'], [6, -20, 4, '#4fc3f7'], [-4, -14, 2.5, '#ff7ac8'], [5, -32, 2, '#4fc3f7']]) circle(x, y, r2, c);
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = 'bold 16px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, -22);
    },

    // --- Soldats ---
    squire() {
      leg(-4, 0, 5, 10, '#4a3a2a'); leg(4, 0, 5, 10, '#4a3a2a');
      body(0, -16, 10, 10, '#3f6fb5');
      ctx.fillStyle = '#8d5f38'; ctx.fillRect(-10, -14, 20, 2.5);
      circle(0, -30, 8, '#f2c9a0', SOUT);
      eye(-2.5, -30, 1.8); eye(3, -30, 1.8);
      ctx.beginPath(); ctx.arc(0, -31, 9, Math.PI, 0); ctx.closePath();
      const hg = ctx.createLinearGradient(-9, -40, 9, -30); hg.addColorStop(0, '#e6ebf2'); hg.addColorStop(1, '#8a94a3');
      ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = '#9aa3b1'; ctx.fillRect(-0.8, -32, 1.6, 6);
      // épée
      ctx.strokeStyle = SOUT; ctx.lineWidth = 1;
      fill([[10, -10], [12, -10], [12.5, -32], [11, -35], [9.5, -32]], '#dfe6ee', SOUT, 0.8);
      ctx.fillStyle = '#c9a227'; ctx.fillRect(7, -11, 8, 2);
      // bouclier
      circle(-9, -16, 8, '#2f5fa8', SOUT);
      circle(-9, -16, 5.5, null, '#f2c94c');
      fill([[-9, -21], [-8, -17], [-4, -16], [-8, -15], [-9, -11], [-10, -15], [-14, -16], [-10, -17]], '#f2c94c', null);
    },
    archer() {
      leg(-4, 0, 5, 10, '#4a3a2a'); leg(4, 0, 5, 10, '#4a3a2a');
      rr(-13, -26, 6, 16, 2); ctx.fillStyle = '#8d5f38'; ctx.fill(); ctx.strokeStyle = SOUT; ctx.stroke();
      for (let i = 0; i < 3; i++) fill([[-12 + i * 2, -26], [-11 + i * 2, -31], [-10 + i * 2, -26]], '#e9e4d8', SOUT, 0.5);
      body(0, -16, 10, 10, '#4c8a3c');
      circle(0, -30, 8, '#f2c9a0', SOUT);
      eye(-2.5, -30, 1.8); eye(3, -30, 1.8);
      ctx.beginPath(); ctx.moveTo(-10, -26); ctx.quadraticCurveTo(-11, -42, 0, -42); ctx.quadraticCurveTo(10, -42, 10, -30); ctx.quadraticCurveTo(6, -38, -2, -36); ctx.quadraticCurveTo(-7, -34, -8, -24); ctx.closePath();
      ctx.fillStyle = '#3f7a31'; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(8, -20, 14, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = '#efe6d2'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(8 + Math.cos(-1.2) * 14, -20 + Math.sin(-1.2) * 14); ctx.lineTo(8 + Math.cos(1.2) * 14, -20 + Math.sin(1.2) * 14); ctx.stroke();
    },
    knight() {
      leg(-4, 0, 5.5, 11, '#8a94a3'); leg(4, 0, 5.5, 11, '#8a94a3');
      body(0, -17, 11, 11, '#b8c1cd');
      ctx.strokeStyle = 'rgba(60,70,80,.6)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-8, -18); ctx.lineTo(8, -18); ctx.moveTo(0, -27); ctx.lineTo(0, -8); ctx.stroke();
      rr(-8, -42, 16, 15, 6);
      const hg = ctx.createLinearGradient(-8, -42, 8, -28); hg.addColorStop(0, '#eef2f7'); hg.addColorStop(1, '#7d8796');
      ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = '#1d2128'; ctx.fillRect(-5, -36, 11, 2.2);
      ctx.beginPath(); ctx.moveTo(-1, -42); ctx.quadraticCurveTo(-8, -50, -12, -42); ctx.quadraticCurveTo(-7, -46, -2, -40); ctx.fillStyle = '#d63a3a'; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1; ctx.stroke();
      fill([[11, -8], [13, -8], [14, -38], [12, -42], [10, -38]], '#e8eef5', SOUT, 0.8);
      ctx.fillStyle = '#c9a227'; ctx.fillRect(8, -10, 10, 2.2);
      fill([[-16, -27], [-2, -27], [-2, -16], [-9, -6], [-16, -16]], '#b8322c', SOUT, 1.3);
      fill([[-10, -25], [-8, -25], [-8, -20], [-4, -20], [-4, -18], [-8, -18], [-8, -11], [-10, -11], [-10, -18], [-14, -18], [-14, -20], [-10, -20]], '#f2c94c', null);
    },
    mage() {
      ctx.beginPath(); ctx.moveTo(-11, 0); ctx.quadraticCurveTo(-10, -18, -6, -26); ctx.lineTo(6, -26); ctx.quadraticCurveTo(10, -18, 11, 0); ctx.closePath();
      const g = ctx.createLinearGradient(-11, 0, 11, 0); g.addColorStop(0, '#8d63d9'); g.addColorStop(1, '#4b2a8f');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.strokeStyle = '#e8c55a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-10.5, -1); ctx.lineTo(10.5, -1); ctx.stroke();
      circle(0, -30, 7.5, '#f2c9a0', SOUT);
      eye(-2.4, -30, 1.7, '#5b3fc4'); eye(2.8, -30, 1.7, '#5b3fc4');
      ctx.beginPath(); ctx.moveTo(-12, -34); ctx.quadraticCurveTo(0, -38, 12, -34); ctx.lineTo(4, -37); ctx.quadraticCurveTo(2, -48, 8, -56); ctx.quadraticCurveTo(-4, -50, -4, -37); ctx.closePath();
      ctx.fillStyle = '#5b3aa8'; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.3; ctx.stroke();
      circle(1, -44, 1.2, '#ffe066'); circle(-1, -40, 0.9, '#ffe066');
      ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(14, -38); ctx.stroke();
      const cg = ctx.createRadialGradient(14, -42, 1, 14, -42, 9);
      cg.addColorStop(0, 'rgba(160,240,255,.9)'); cg.addColorStop(1, 'rgba(160,240,255,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(14, -42, 9, 0, Math.PI * 2); ctx.fill();
      crystalShape(14, -42, 3.6, '#8ff3ff', '#3fa4ff');
    },

    // --- Créatures ---
    rabbit() {
      ell(-12, -12, 5, 5, '#ffffff', SOUT);
      ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-15, -16); ctx.lineTo(-19, -19); ctx.lineTo(-17, -21); ctx.lineTo(-22, -25); ctx.stroke();
      body(-8, -4, 7, 4.5, '#ecebf2');
      body(-1, -12, 12, 10, '#f2f1f7');
      body(4, -2, 4, 3, '#ecebf2');
      body(9, -23, 9.5, 8.5, '#f6f5fb');
      for (const [x, rot] of [[4, -0.25], [11, 0.2]]) {
        body(x, -38, 3.6, 10, '#f2f1f7', rot);
        ell(x, -37, 1.6, 7, '#ffb3c7', null, rot);
      }
      eye(12, -24, 2.6, '#7b4b2a');
      circle(18, -21, 1.4, '#ff8fab');
      ell(14, -18, 2.5, 1.4, 'rgba(255,150,170,.5)');
    },
    shroom() {
      body(-4, -1, 4, 2.5, '#d9c6a6'); body(5, -1, 4, 2.5, '#d9c6a6');
      body(0, -12, 9, 11, '#f5ead6');
      eye(-3, -12, 2.2); eye(3.5, -12, 2.2);
      ctx.strokeStyle = SOUT; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0.5, -8, 2.5, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-20, -20); ctx.quadraticCurveTo(-21, -46, 0, -46); ctx.quadraticCurveTo(21, -46, 20, -20); ctx.quadraticCurveTo(0, -14, -20, -20); ctx.closePath();
      const g = ctx.createRadialGradient(-8, -38, 2, 0, -30, 24);
      g.addColorStop(0, '#ff8a7a'); g.addColorStop(0.6, '#e0453a'); g.addColorStop(1, '#9e2a22');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.5; ctx.stroke();
      for (const [x, y, r2] of [[-9, -34, 4], [4, -39, 3.2], [11, -28, 3.4], [-2, -26, 2.6], [-15, -25, 2.4]]) circle(x, y, r2, '#fff6ea', 'rgba(150,80,60,.5)');
    },
    ladybug() {
      ctx.strokeStyle = SOUT; ctx.lineWidth = 1.4;
      for (const x of [-10, -2, 6]) { ctx.beginPath(); ctx.moveTo(x, -6); ctx.lineTo(x - 3, 0); ctx.stroke(); }
      body(15, -10, 7, 6.5, '#2b2b2b');
      eye(17, -11, 2.2);
      ctx.beginPath(); ctx.moveTo(16, -16); ctx.quadraticCurveTo(18, -24, 22, -24); ctx.moveTo(19, -15); ctx.quadraticCurveTo(24, -21, 26, -19); ctx.stroke();
      circle(22, -24, 1.5, '#2b2b2b'); circle(26, -19, 1.5, '#2b2b2b');
      ctx.beginPath(); ctx.moveTo(-18, -6); ctx.quadraticCurveTo(-18, -30, 0, -30); ctx.quadraticCurveTo(18, -30, 16, -6); ctx.closePath();
      const g = ctx.createRadialGradient(-6, -24, 2, 0, -16, 22);
      g.addColorStop(0, '#ff7a6b'); g.addColorStop(0.6, '#e53935'); g.addColorStop(1, '#9e1f1c');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1, -30); ctx.lineTo(-1, -6); ctx.stroke();
      for (const [x, y, r2] of [[-9, -20, 3.4], [7, -21, 3.2], [-6, -11, 2.6], [9, -11, 2.6], [-1, -25, 2]]) circle(x, y, r2, '#1b1b1b');
      ell(-8, -25, 4, 2, 'rgba(255,255,255,.45)', null, -0.4);
    },
    wolf() {
      quad({
        body: '#7f8fa6', belly: '#d7dee8',
        tail: () => body(-16, -22, 4.5, 10, '#8e9db3', -0.9),
        back: () => {
          ctx.strokeStyle = 'rgba(120,240,255,.8)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-12, -21); ctx.quadraticCurveTo(-2, -26, 8, -22); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,150,220,.7)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(-10, -19); ctx.quadraticCurveTo(-1, -23, 7, -20); ctx.stroke();
        },
        head: () => {
          tri([[6, -30], [8, -42], [12, -32]], '#6c7a90');
          tri([[12, -31], [16, -42], [17, -30]], '#6c7a90');
          body(12, -27, 8.5, 7.5, '#8495ac');
          body(19, -24, 6, 4, '#d7dee8');
          circle(24, -25, 1.8, '#1b1b1b');
          eye(14, -29, 2.2, '#f2b632');
        },
      });
    },
    owl() {
      ell(-3, 0, 3, 1.4, '#e8a33a', SOUT); ell(4, 0, 3, 1.4, '#e8a33a', SOUT);
      body(-11, -17, 5, 11, '#2e3c74', 0.15);
      body(0, -19, 13, 17, '#3a4a8c');
      for (let i = 0; i < 8; i++) circle(-8 + (i * 37 % 17), -30 + (i * 23 % 20), 0.9, '#cfe3ff');
      body(2, -14, 8, 10, '#d9c7a5');
      ctx.strokeStyle = 'rgba(120,90,50,.6)'; ctx.lineWidth = 0.8;
      for (const y of [-18, -13, -8]) { ctx.beginPath(); ctx.moveTo(-2, y); ctx.lineTo(2, y + 2); ctx.lineTo(6, y); ctx.stroke(); }
      tri([[-10, -32], [-7, -42], [-3, -33]], '#3a4a8c');
      tri([[5, -33], [9, -42], [11, -31]], '#3a4a8c');
      eye(-4, -26, 5, '#f2a03a'); eye(6, -26, 5, '#f2a03a');
      tri([[0, -24], [3, -24], [1.5, -19]], '#e8a33a');
    },
    turtle() {
      leg(-10, 0, 6, 7, '#6a9e3a'); leg(9, 0, 6, 7, '#6a9e3a');
      body(17, -11, 7, 6, '#7cb342');
      eye(19, -13, 2.2);
      ctx.strokeStyle = SOUT; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(21, -9, 2, 0.1, 1.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-20, -5); ctx.quadraticCurveTo(-21, -34, 0, -34); ctx.quadraticCurveTo(21, -34, 19, -5); ctx.closePath();
      const g = ctx.createRadialGradient(-6, -26, 2, 0, -18, 24);
      g.addColorStop(0, '#b5a07c'); g.addColorStop(0.6, '#8d7b62'); g.addColorStop(1, '#5a4b39');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(50,35,20,.6)'; ctx.lineWidth = 1;
      for (const [x, y] of [[-8, -22], [5, -24], [-1, -13], [12, -14], [-13, -12]]) {
        ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; const px = x + Math.cos(a) * 5, py = y + Math.sin(a) * 4; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.closePath(); ctx.stroke();
      }
      ell(-4, -30, 6, 2.4, 'rgba(110,170,70,.85)'); ell(8, -31, 4, 1.8, 'rgba(110,170,70,.85)');
      ctx.fillStyle = '#5a4b39'; ctx.fillRect(-21, -6, 41, 3);
    },
    bat(dark = false) {
      const b = dark ? '#2b2235' : '#6d4c9f';
      wing(-3, -24, 24, 14, dark ? '#3a2b48' : '#7d5cb5', 1);
      wing(3, -24, 24, 14, dark ? '#3a2b48' : '#7d5cb5', -1);
      body(0, -20, 8, 9, b);
      tri([[-6, -27], [-5, -37], [-1, -28]], b);
      tri([[1, -28], [5, -37], [6, -27]], b);
      if (dark) { glowEye(-3, -22, 1.6, '#ff3355'); glowEye(3, -22, 1.6, '#ff3355'); } else { eye(-3, -22, 2.4, '#f2b632'); eye(3, -22, 2.4, '#f2b632'); }
      fill([[-2, -16.5], [-1, -14], [0, -16.5]], '#fff', null); fill([[0.5, -16.5], [1.5, -14], [2.5, -16.5]], '#fff', null);
      ell(-3, -6, 1.4, 2.4, b, SOUT); ell(3, -6, 1.4, 2.4, b, SOUT);
    },
    unicorn() {
      quad({
        body: '#fbf8ff', belly: '#ffffff', hooves: '#e8c55a',
        tail: () => {
          for (const [c, dx] of [['#ff9fd6', 0], ['#9fe8ff', 2], ['#c9a7ff', 4]]) body(-17 + dx * 0.3, -15 - dx, 3.5, 9, c, -0.6);
        },
        head: () => {
          body(10, -26, 6, 9, '#fbf8ff', 0.5);
          for (const [x, y, c] of [[4, -32, '#ff9fd6'], [6, -27, '#9fe8ff'], [3, -22, '#c9a7ff'], [8, -36, '#ffd36e']]) body(x, y, 3.5, 6, c, 0.4);
          body(16, -33, 8, 6.5, '#fdfbff');
          body(22, -30, 4, 3.5, '#ffe3ef');
          circle(24, -31, 0.8, '#b06a8a');
          eye(17, -35, 2.2, '#8f6fff');
          path([[13, -38], [21, -56], [17, -37]]);
          const hg = ctx.createLinearGradient(13, -38, 21, -56);
          hg.addColorStop(0, '#f2c94c'); hg.addColorStop(1, '#bff8ff');
          ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.1; ctx.stroke();
          tri([[11, -38], [11, -44], [14, -39]], '#fbf8ff');
        },
      });
    },
    griffin() {
      quad({
        body: '#d9a441', belly: '#f0d79a',
        tail: () => { ctx.strokeStyle = '#b8862c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, -16); ctx.quadraticCurveTo(-24, -20, -22, -30); ctx.stroke(); body(-22, -31, 3, 4, '#8a5a24'); },
        wings: () => { wing(-2, -20, 30, 26, '#f3ead8', 1, true); },
        head: () => {
          body(13, -28, 8, 8, '#f6f1e6');
          tri([[19, -31], [27, -27], [20, -24]], '#f2b632');
          eye(15, -30, 2.3, '#e07a12', true);
          tri([[8, -34], [6, -40], [11, -35]], '#f6f1e6');
        },
      });
    },
    golem(dark = false) {
      const b = dark ? '#4a3b36' : '#9a9a92';
      const rune = dark ? '#ff7a2f' : '#6ff3ff';
      leg(-7, 0, 8, 12, shade(b, -0.1)); leg(7, 0, 8, 12, shade(b, -0.1));
      rr(-20, -32, 9, 20, 4); ctx.fillStyle = shade(b, -0.15); ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.4; ctx.stroke();
      rr(-13, -36, 26, 26, 6);
      const g = ctx.createLinearGradient(-13, -36, 13, -10); g.addColorStop(0, shade(b, 0.25)); g.addColorStop(1, shade(b, -0.35));
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.5; ctx.stroke();
      rr(-8, -48, 16, 13, 4); ctx.fillStyle = shade(b, 0.1); ctx.fill(); ctx.stroke();
      rr(11, -32, 9, 20, 4); ctx.fillStyle = shade(b, -0.05); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.shadowColor = rune; ctx.shadowBlur = 6;
      ctx.strokeStyle = rune; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(0, -24); ctx.lineTo(6, -30); ctx.moveTo(0, -24); ctx.lineTo(0, -16); ctx.stroke();
      ctx.fillStyle = rune; ctx.fillRect(-5, -44, 3, 3); ctx.fillRect(2, -44, 3, 3);
      ctx.restore();
      if (!dark) { ell(-4, -36, 6, 2, 'rgba(110,170,70,.9)'); ell(14, -32, 3, 1.4, 'rgba(110,170,70,.9)'); }
    },
    ghost(dark = false) {
      const b = dark ? '#5b4a7a' : '#eef4ff';
      ctx.save(); ctx.globalAlpha = dark ? 0.95 : 0.92;
      ctx.beginPath();
      ctx.moveTo(-13, -6);
      ctx.quadraticCurveTo(-15, -42, 0, -42);
      ctx.quadraticCurveTo(15, -42, 13, -6);
      for (let i = 0; i < 4; i++) { const x = 13 - i * 6.5; ctx.quadraticCurveTo(x - 3.2, 1, x - 6.5, -6); }
      ctx.closePath();
      const g = ctx.createRadialGradient(-5, -32, 2, 0, -22, 24);
      g.addColorStop(0, shade(b, 0.4)); g.addColorStop(0.6, b); g.addColorStop(1, shade(b, -0.3));
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.restore();
      if (dark) { glowEye(-4, -28, 2, '#6ff3ff'); glowEye(5, -28, 2, '#6ff3ff'); }
      else {
        ell(-4, -28, 2.2, 3.2, '#2b2b3a'); ell(5, -28, 2.2, 3.2, '#2b2b3a');
        circle(-4.6, -29.2, 0.8, '#fff'); circle(4.4, -29.2, 0.8, '#fff');
        ell(-8, -23, 2.6, 1.4, 'rgba(255,150,190,.6)'); ell(9, -23, 2.6, 1.4, 'rgba(255,150,190,.6)');
        ctx.strokeStyle = SOUT; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0.5, -23, 2, 0.2, Math.PI - 0.2); ctx.stroke();
      }
    },
    kraken() {
      const b = '#8e44ad';
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const x0 = -10 + i * 4, dir = i < 3 ? -1 : 1;
        ctx.strokeStyle = SOUT; ctx.lineWidth = 6.5;
        const draw = () => { ctx.beginPath(); ctx.moveTo(x0, -16); ctx.bezierCurveTo(x0 + dir * 6, -8, x0 + dir * 12, -4, x0 + dir * 9, 2); ctx.stroke(); };
        draw();
        ctx.strokeStyle = shade(b, i % 2 ? -0.1 : 0.05); ctx.lineWidth = 4.5; draw();
      }
      body(0, -28, 14, 15, b);
      ell(-5, -36, 4, 2.4, 'rgba(255,255,255,.3)', null, -0.4);
      eye(-5, -26, 3.4, '#f2b632'); eye(6, -26, 3.4, '#f2b632');
      for (const [x, y] of [[-9, -38], [8, -39], [0, -41]]) circle(x, y, 1.5, shade(b, 0.35));
    },
    dragon(dark = false) {
      const b = dark ? '#2b2b34' : '#4fc3c9';
      const sp = dark ? '#ff3f6c' : '#bff8ff';
      quad({
        body: b, belly: dark ? '#4a3a3a' : '#d6f5f2', rx: 15, ry: 9.5,
        tail: () => {
          ctx.strokeStyle = SOUT; ctx.lineWidth = 7;
          ctx.beginPath(); ctx.moveTo(-12, -14); ctx.quadraticCurveTo(-26, -10, -28, -24); ctx.stroke();
          ctx.strokeStyle = b; ctx.lineWidth = 5; ctx.stroke();
          crystalShape(-28, -28, 3.5, sp, shade(sp, -0.3));
        },
        wings: () => { wing(0, -22, 28, 26, dark ? '#4a2b3a' : '#7fe0e0', 1); },
        back: () => { for (const x of [-8, -2, 4]) tri([[x - 2.5, -22], [x, -30], [x + 2.5, -22]], sp); },
        head: () => {
          body(10, -28, 6, 8, b, 0.4);
          body(16, -34, 8.5, 7, b);
          body(23, -31, 5, 4, shade(b, 0.15));
          circle(26, -32, 0.9, '#1b1b1b');
          tri([[12, -39], [9, -48], [15, -40]], sp);
          tri([[16, -40], [16, -49], [19, -40]], sp);
          if (dark) glowEye(17, -36, 1.6, '#ff3355'); else eye(17, -36, 2.4, '#f2b632');
        },
      });
    },

    // --- Ennemis (repaires d'ombre) ---
    foe0() {
      // Rôdeur d'ombre
      leg(-4, 0, 5, 10, '#241b2e'); leg(4, 0, 5, 10, '#241b2e');
      ctx.beginPath(); ctx.moveTo(-13, -2); ctx.quadraticCurveTo(-13, -30, 0, -44); ctx.quadraticCurveTo(13, -30, 13, -2); ctx.closePath();
      const g = ctx.createLinearGradient(-13, 0, 13, 0); g.addColorStop(0, '#4b3a63'); g.addColorStop(1, '#1e1628');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.4; ctx.stroke();
      ell(0, -28, 7, 7, '#0e0912');
      glowEye(-2.5, -28, 1.5, '#ff3355'); glowEye(2.5, -28, 1.5, '#ff3355');
      fill([[11, -14], [13, -14], [20, -26], [18, -27]], '#c9ced6', SOUT, 0.8);
    },
    foe1() { SPR.bat(true); },
    foe2() { SPR.golem(true); },
    foe3() { SPR.ghost(true); },
    foe4() {
      // Seigneur liche
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-12, -22, -7, -30); ctx.lineTo(7, -30); ctx.quadraticCurveTo(12, -22, 14, 0); ctx.closePath();
      const g = ctx.createLinearGradient(-14, 0, 14, 0); g.addColorStop(0, '#4a3566'); g.addColorStop(1, '#1d1530');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = SOUT; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(0, -18); ctx.lineTo(6, -30); ctx.stroke();
      body(0, -36, 8, 8.5, '#ece4d0');
      ell(-3, -37, 2.4, 2.8, '#120a18'); ell(3, -37, 2.4, 2.8, '#120a18');
      glowEye(-3, -37, 0.9, '#b46bff'); glowEye(3, -37, 0.9, '#b46bff');
      ctx.fillStyle = '#120a18'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 1.6 - 0.5, -31, 1, 2.4);
      fill([[-8, -43], [-6, -50], [-3, -45], [0, -52], [3, -45], [6, -50], [8, -43]], '#e8c55a', SOUT, 1);
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(17, -40); ctx.stroke();
      const og = ctx.createRadialGradient(17, -44, 1, 17, -44, 8);
      og.addColorStop(0, '#f3d4ff'); og.addColorStop(0.5, '#a24bff'); og.addColorStop(1, 'rgba(120,40,200,0)');
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(17, -44, 8, 0, Math.PI * 2); ctx.fill();
    },
    foe5() { SPR.dragon(true); },
  };

  // Rendu d'un sprite de personnage dans un canvas mis en cache
  const scache = {};
  function sprite(key, px) {
    const k = key + '@' + px;
    if (scache[k]) return scache[k];
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const prev = ctx;
    ctx = c.getContext('2d');
    const s = px / 64;
    ctx.setTransform(s, 0, 0, s, px / 2, px * 0.92);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (SPR[key]) SPR[key]();
    ctx = prev;
    return (scache[k] = c);
  }
  // Dessine un personnage sur la carte (pieds en x,y)
  function drawSprite(c, key, x, y, size, flip = false, lift = 0) {
    ctx = c;
    const img = sprite(key, 128);
    ell(x, y, size * 0.26, size * 0.1, 'rgba(20,30,10,.25)');
    ctx.save();
    ctx.translate(x, y - lift);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -size / 2, -size * 0.92, size, size);
    ctx.restore();
  }

  const urls = {};
  function iconURL(key, px = 96) {
    const k = key + '@' + px;
    if (urls[k]) return urls[k];
    let c;
    if (key.startsWith('bld_')) c = buildingIcon(key.slice(4), px);
    else if (key === 'tree') { c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d'); const prev = ctx; ctx = g; ctx.setTransform(px / 64, 0, 0, px / 64, px / 2, px * 0.95); oak(1, 9); ctx = prev; }
    else if (key === 'rock') { c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d'); const prev = ctx; ctx = g; ctx.setTransform(px / 40, 0, 0, px / 40, px / 2, px * 0.8); boulder(0, 0, 1.2, 5); ctx = prev; }
    else c = sprite(key, px);
    return (urls[k] = c.toDataURL());
  }
  function buildingIcon(kind, px) {
    const variant = kind === 'farm' ? 5 : 0;
    const sp = buildingSprite(kind, variant);
    const def = D.BUILDINGS[kind];
    const s = def.size;
    // cadre utile : l'empreinte au sol et la hauteur du bâtiment
    const fx0 = -s * HW - 4, fx1 = s * HW + 4, fy0 = -(def.h + 34), fy1 = 2 * s * HH + 6;
    const w = fx1 - fx0, h = fy1 - fy0;
    const k = Math.min(px / w, px / h);
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, (px - w * k) / 2 - fx0 * k, (px - h * k) / 2 - fy0 * k);
    g.drawImage(sp.c, sp.ox, sp.oy, sp.w, sp.h);
    return c;
  }

  // Nuage
  let cloudC = null;
  function cloudSprite() {
    if (cloudC) return cloudC;
    cloudC = document.createElement('canvas');
    cloudC.width = 320; cloudC.height = 140;
    const g = cloudC.getContext('2d');
    const blobs = [[80, 90, 46], [130, 70, 56], [190, 78, 50], [240, 94, 38], [160, 100, 48]];
    for (const [x, y, r2] of blobs) {
      const gr = g.createRadialGradient(x - r2 * 0.3, y - r2 * 0.4, r2 * 0.2, x, y, r2);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.7, 'rgba(250,252,255,.85)'); gr.addColorStop(1, 'rgba(220,235,250,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r2, 0, Math.PI * 2); g.fill();
    }
    return cloudC;
  }

  // Bulle de récolte
  function drawBubble(c, x, y, res) {
    ctx = c;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    circle(x, y, 15, '#fffaf0');
    ctx.restore();
    fill([[x - 5, y + 13], [x + 5, y + 13], [x, y + 21]], '#fffaf0', null);
    ctx.strokeStyle = '#e0a53a'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.stroke();
    ctx.drawImage(sprite('res_' + res, 64), x - 12, y - 14, 24, 24);
  }
  function drawBadge(c, x, y, key, p) {
    ctx = c;
    circle(x, y, 13, 'rgba(255,250,240,.96)', 'rgba(120,80,30,.6)');
    ctx.drawImage(sprite(key, 64), x - 11, y - 13, 22, 22);
    ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 15, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
  }

  return {
    P, buildGround, drawWaterLive, isletURL, drawBuilding, drawConstruction, drawTree, drawRock, drawCamp, drawSprite,
    drawBubble, drawBadge, sprite, iconURL, cloudSprite, buildingSprite,
  };
})();
