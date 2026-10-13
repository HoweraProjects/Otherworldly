'use strict';
// ===== 繪圖工具 =====
const W = 480, H = 270;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
function hash(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function srand(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function pcircle(c, cx, cy, r, col) {
  c.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy);
  for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.8)); c.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
}
function pring(c, cx, cy, r, col, th = 1) {
  c.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy);
  const n = Math.max(12, Math.floor(r * 6.3));
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; c.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), th, th); }
}
function pline(c, x0, y0, x1, y1, col, th = 1) {
  c.fillStyle = col; const dx = x1 - x0, dy = y1 - y0; const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let i = 0; i <= n; i++) c.fillRect(Math.round(x0 + dx * i / n - th / 2), Math.round(y0 + dy * i / n - th / 2), th, th);
}
// 帶抖動的垂直漸層（像素風）
function ditherGrad(c, y0, y1, cols, x0 = 0, x1 = W) {
  const n = cols.length, hgt = y1 - y0;
  for (let y = y0; y < y1; y++) {
    const f = (y - y0) / hgt * (n - 1), i = Math.min(n - 2, Math.floor(f)), fr = f - i;
    c.fillStyle = cols[i]; c.fillRect(x0, y, x1 - x0, 1);
    if (fr > 0.5) { c.fillStyle = cols[i + 1]; for (let x = x0 + ((y & 1) ? 0 : 1); x < x1; x += (fr > 0.8 ? 1 : 2)) c.fillRect(x, y, 1, 1); }
  }
}

// ===== 精靈圖 =====
function buildSprite(rows, map) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const [c, x] = mkCanvas(w, h);
  rows.forEach((row, y) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.' || ch === ' ') continue; const col = (map && map[ch]) || PAL[ch]; if (col) { x.fillStyle = col; x.fillRect(i, y, 1, 1); } } });
  return c;
}
function flipC(src) { const [c, x] = mkCanvas(src.width, src.height); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c; }
function silhouette(src, col) { const [c, x] = mkCanvas(src.width, src.height); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c; }
function outlined(src, col) { // 1px 外描邊光暈
  const [c, x] = mkCanvas(src.width + 2, src.height + 2); const s = silhouette(src, col);
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) x.drawImage(s, dx, dy);
  x.drawImage(src, 1, 1); return c;
}
const CLONE_MAP = { h: '#1f6f6a', H: '#2ec4b6', B: '#41a6f6', b: '#3b5dc9', c: '#73eff7', C: '#f4f4f4', s: '#c9fff6', S: '#73eff7', w: '#c9fff6', m: '#41a6f6' };
const HERO_GOLD = { B: '#3b5dc9', c: '#ffec27', C: '#ffcd4a' };
const IMG = {};
function withLegs(rows, legs) { const r = rows.slice(); r.splice(r.length - legs.length, legs.length, ...legs); return r; }
function makeSet(rows, rows2, map, glow) {
  const frames = [rows, rows2 || rows].map(rr => { let c = buildSprite(rr, map); if (glow) c = outlined(c, glow); return c; });
  return { r: frames, l: frames.map(flipC), w: frames.map(f => silhouette(f, '#ffffff')), wl: frames.map(f => flipC(silhouette(f, '#ffffff'))), gold: frames.map(f => outlined(f, '#ffcd4a')) };
}
function initSprites() {
  const h2 = withLegs(SPR.hero, SPR.heroLegs2);
  IMG.hero = makeSet(SPR.hero, h2, null, null);
  IMG.heroGold = makeSet(SPR.hero, h2, HERO_GOLD, '#ffcd4a');
  IMG.clone = makeSet(SPR.hero, h2, CLONE_MAP, 'rgba(115,239,247,.55)');
  IMG.walker = makeSet(SPR.walker, withLegs(SPR.walker, SPR.walkerLegs2));
  IMG.runner = makeSet(SPR.runner, null);
  IMG.drone = makeSet(SPR.drone, SPR.drone.map((r, i) => i === 0 ? '.ggg......ggg.' : r));
  IMG.hacker = makeSet(SPR.hacker, null);
  IMG.brute = makeSet(SPR.brute, null);
  { const fr = [0, 1].map(st => outlined(buildMechFrame(st), 'rgba(115,239,247,.7)'));
    IMG.mech = { r: fr, l: fr.map(flipC), w: fr.map(f => silhouette(f, '#ffffff')), wl: fr.map(f => flipC(silhouette(f, '#ffffff'))), gold: fr }; }
  for (const id in WEAPONS) IMG[WEAPONS[id].icon] = buildSprite(SPR[WEAPONS[id].icon]);
}
// 機甲「怕死一號」34x36（程序繪製）
function buildMechFrame(step) {
  const [c, x] = mkCanvas(34, 36);
  const K = '#14101e', Wt = '#e8eef5', Gr = '#94b0c2', Gd = '#566c86', B = '#3b5dc9', Bd = '#29366f', Cy = '#73eff7', Au = '#ffcd4a';
  // 背包推進器
  R(x, 6, 9, 5, 11, K); R(x, 7, 10, 3, 9, Gd); R(x, 23, 9, 5, 11, K); R(x, 24, 10, 3, 9, Gd);
  // 腿
  const leg = (lx, dy) => { R(x, lx, 23, 6, 10 - dy, K); R(x, lx + 1, 23, 4, 9 - dy, Wt); R(x, lx + 1, 27, 4, 2, B); R(x, lx - 1, 32 - dy, 8, 4, K); R(x, lx, 32 - dy, 6, 2, Bd); R(x, lx, 32 - dy, 6, 1, Gr); };
  leg(10, step ? 1 : 0); leg(18, step ? 0 : 1);
  R(x, 11, 21, 12, 3, K); R(x, 12, 21, 10, 2, Bd);
  // 軀幹 + 核心爐
  R(x, 9, 11, 16, 11, K); R(x, 10, 12, 14, 9, B); R(x, 10, 12, 5, 4, Wt); R(x, 19, 12, 5, 4, Wt); R(x, 10, 12, 5, 1, '#ffffff'); R(x, 19, 12, 5, 1, '#ffffff');
  R(x, 15, 14, 4, 4, Au); R(x, 16, 15, 2, 2, '#fff3c0'); R(x, 13, 18, 8, 1, Bd); R(x, 12, 20, 10, 1, Bd);
  // 巨大肩甲
  R(x, 1, 8, 10, 9, K); R(x, 2, 9, 8, 7, Wt); R(x, 2, 9, 8, 1, '#ffffff'); R(x, 2, 13, 8, 2, B); R(x, 3, 11, 2, 1, Au);
  R(x, 23, 8, 10, 9, K); R(x, 24, 9, 8, 7, Wt); R(x, 24, 9, 8, 1, '#ffffff'); R(x, 24, 13, 8, 2, B); R(x, 29, 11, 2, 1, Au);
  // 手臂：左拳、右臂炮
  R(x, 3, 17, 6, 8, K); R(x, 4, 17, 4, 5, Gr); R(x, 3, 22, 6, 4, K); R(x, 4, 22, 4, 3, Gd);
  R(x, 24, 17, 10, 6, K); R(x, 25, 18, 5, 4, Gr); R(x, 30, 18, 3, 4, Gd); R(x, 32, 19, 2, 2, Cy);
  // 頭：V 字天線 + 青色護目鏡
  R(x, 12, 3, 10, 9, K); R(x, 13, 4, 8, 7, Wt); R(x, 14, 6, 6, 2, Cy); R(x, 14, 6, 2, 1, '#ffffff'); R(x, 15, 10, 4, 1, Gr);
  R(x, 11, 6, 1, 3, Gd); R(x, 22, 6, 1, 3, Gd);
  R(x, 16, 2, 2, 2, Au); R(x, 14, 1, 2, 1, Au); R(x, 12, 0, 2, 1, Au); R(x, 18, 1, 2, 1, Au); R(x, 20, 0, 2, 1, Au); R(x, 16, 3, 2, 1, '#ff3860');
  return c;
}
// 以腳底中心為錨點繪製
function drawSet(set, frame, x, y, flip, white, scale = 1) {
  const arr = white ? (flip ? set.wl : set.w) : (flip ? set.l : set.r); const img = arr[frame % arr.length];
  ctx.drawImage(img, Math.round(x - img.width * scale / 2), Math.round(y - img.height * scale), img.width * scale, img.height * scale);
}
function iconURL(name, scale = 4) {
  const src = IMG[name]; const [c, x] = mkCanvas(src.width * scale, src.height * scale); x.drawImage(src, 0, 0, c.width, c.height); return c.toDataURL();
}

// ===== 像素數字 =====
const DIG = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111' };
function drawNum(n, x, y, col) {
  const s = String(n); const w = s.length * 4 - 1; let ox = Math.round(x - w / 2); y = Math.round(y);
  for (const pass of [0, 1]) {
    for (let i = 0; i < s.length; i++) { const g = DIG[s[i]]; if (!g) continue; ctx.fillStyle = pass ? col : '#14101e';
      for (let j = 0; j < 15; j++) if (g[j] === '1') { const px = ox + i * 4 + (j % 3), py = y + Math.floor(j / 3); if (pass) ctx.fillRect(px, py, 1, 1); else ctx.fillRect(px - 1, py - 1, 3, 3); } }
  }
}

// ===== 地面圖塊（無限捲軸）=====
const TILE = 32; const TILES = { city: [], ruin: [], temple: [] };
function initTiles() {
  for (let v = 0; v < 10; v++) {
    // 城市柏油
    { const [c, x] = mkCanvas(TILE, TILE); const rnd = srand(100 + v);
      R(x, 0, 0, TILE, TILE, '#231d30');
      for (let i = 0; i < 40; i++) R(x, rnd() * TILE, rnd() * TILE, 1, 1, rnd() < .5 ? '#2c253b' : '#1b1626');
      if (v === 1 || v === 6) { let px = rnd() * TILE, py = 0; for (let i = 0; i < 18; i++) { R(x, px, py, 1, 1, '#14101e'); px += rnd() * 2 - 1; py += 1.8; } }
      if (v === 2) { R(x, 0, 15, TILE, 2, '#3a3152'); R(x, 4, 15, 8, 2, '#ffcd4a'); R(x, 20, 15, 8, 2, '#ffcd4a'); }
      if (v === 3) { R(x, 0, 30, TILE, 2, '#2e9fb0'); R(x, 0, 31, TILE, 1, '#73eff7'); }
      if (v === 4) { R(x, 8, 8, 16, 16, '#2c253b'); R(x, 9, 9, 14, 14, '#191424'); for (let i = 0; i < 4; i++) R(x, 11 + i * 3, 11, 1, 10, '#2c253b'); }
      if (v === 7) { R(x, 10, 12, 5, 3, '#3b324f'); R(x, 22, 20, 3, 2, '#3b324f'); }
      TILES.city.push(c); }
    // 荒廢綠化（魔法植物）
    { const [c, x] = mkCanvas(TILE, TILE); const rnd = srand(300 + v);
      R(x, 0, 0, TILE, TILE, '#16232a');
      for (let i = 0; i < 60; i++) R(x, rnd() * TILE, rnd() * TILE, 1, 1, rnd() < .5 ? '#1d3036' : '#122027');
      for (let i = 0; i < 6; i++) { const gx = rnd() * 30, gy = rnd() * 28; R(x, gx, gy, 1, 3, '#2a6b4f'); R(x, gx + 1, gy + 1, 1, 2, '#38b764'); }
      if (v === 2) { R(x, 12, 12, 2, 2, '#a7f070'); R(x, 13, 11, 1, 1, '#f4f4f4'); }
      if (v === 5) { pring(x, 16, 16, 7, '#5b3fb0'); R(x, 15, 9, 2, 14, '#5b3fb0'); }
      if (v === 8) { R(x, 4, 20, 6, 3, '#4b5a63'); R(x, 22, 6, 4, 3, '#4b5a63'); }
      TILES.ruin.push(c); }
    // 古寺石板
    { const [c, x] = mkCanvas(TILE, TILE); const rnd = srand(500 + v);
      R(x, 0, 0, TILE, TILE, '#2b2638');
      R(x, 0, 0, TILE, 1, '#1a1624'); R(x, 0, 16, TILE, 1, '#1a1624'); R(x, 0, 0, 1, 16, '#1a1624'); R(x, 16, 16, 1, 16, '#1a1624');
      for (let i = 0; i < 30; i++) R(x, rnd() * TILE, rnd() * TILE, 1, 1, '#34304a');
      if (v === 3) { R(x, 6, 4, 6, 1, '#a46be0'); R(x, 8, 4, 1, 8, '#a46be0'); R(x, 5, 8, 8, 1, '#a46be0'); }
      if (v === 7) { R(x, 20, 20, 8, 8, '#1f6f6a'); R(x, 21, 21, 6, 6, '#16232a'); }
      TILES.temple.push(c); }
  }
}
function districtAt(tx, ty) { const n = vnoise(tx / 9, ty / 9, 7); return n < 0.42 ? 'city' : n < 0.68 ? 'ruin' : 'temple'; }

// ===== 地圖裝飾物 =====
const PROPS = {};
function initProps() {
  let c, x;
  [c, x] = mkCanvas(34, 20); // 廢車
  R(x, 2, 6, 30, 10, '#4a3b52'); R(x, 7, 1, 18, 7, '#4a3b52'); R(x, 9, 2, 6, 5, '#2a6b8a'); R(x, 17, 2, 6, 5, '#2a6b8a'); R(x, 10, 2, 2, 2, '#73eff7');
  R(x, 2, 12, 30, 2, '#2a2438'); pcircle(x, 8, 16, 3, '#14101e'); pcircle(x, 26, 16, 3, '#14101e'); R(x, 30, 8, 2, 2, '#ff3860'); R(x, 2, 8, 2, 2, '#ffec27'); R(x, 13, 9, 7, 1, '#5d4a68');
  PROPS.car = c;
  [c, x] = mkCanvas(12, 40); // 霓虹路燈
  R(x, 5, 6, 2, 34, '#333c57'); R(x, 4, 38, 4, 2, '#14101e'); R(x, 1, 2, 10, 4, '#333c57'); R(x, 2, 5, 8, 1, '#ff77a8'); R(x, 3, 3, 6, 1, '#ffbcd7');
  PROPS.lamp = c;
  [c, x] = mkCanvas(14, 13); // 木箱
  R(x, 0, 1, 14, 12, '#7a4b2a'); R(x, 0, 1, 14, 1, '#a0693c'); R(x, 0, 6, 14, 1, '#4b2e1e'); R(x, 1, 2, 1, 10, '#4b2e1e'); R(x, 12, 2, 1, 10, '#4b2e1e'); R(x, 0, 12, 14, 1, '#14101e');
  PROPS.crate = c;
  [c, x] = mkCanvas(14, 26); // 石燈籠
  R(x, 5, 16, 4, 8, '#566c86'); R(x, 2, 23, 10, 3, '#3d4a5f'); R(x, 1, 6, 12, 2, '#566c86'); R(x, 3, 8, 8, 7, '#3d4a5f'); R(x, 5, 10, 4, 3, '#ffcd4a'); R(x, 0, 4, 14, 2, '#94b0c2'); R(x, 5, 1, 4, 3, '#566c86');
  PROPS.lantern = c;
  [c, x] = mkCanvas(30, 34); // 全息看板
  R(x, 4, 14, 2, 20, '#333c57'); R(x, 24, 14, 2, 20, '#333c57'); R(x, 0, 0, 30, 16, 'rgba(65,166,246,.35)'); R(x, 0, 0, 30, 1, '#73eff7'); R(x, 0, 15, 30, 1, '#73eff7');
  for (let i = 0; i < 4; i++) R(x, 4 + i * 6, 4, 4, 8, i % 2 ? '#ff77a8' : '#73eff7');
  PROPS.holo = c;
  [c, x] = mkCanvas(12, 34); // 符文石柱
  R(x, 2, 2, 8, 30, '#3d3552'); R(x, 2, 2, 2, 30, '#4a4163'); R(x, 0, 30, 12, 4, '#2b2638'); R(x, 1, 0, 10, 3, '#4a4163');
  R(x, 5, 8, 2, 2, '#a46be0'); R(x, 4, 13, 4, 1, '#a46be0'); R(x, 5, 17, 2, 4, '#a46be0'); R(x, 4, 24, 4, 1, '#a46be0');
  PROPS.pillar = c;
  [c, x] = mkCanvas(26, 32); // 發光枯樹
  R(x, 12, 14, 3, 18, '#4b2e1e'); R(x, 9, 12, 3, 2, '#4b2e1e'); R(x, 15, 10, 3, 2, '#4b2e1e');
  pcircle(x, 13, 9, 8, '#1f6f6a'); pcircle(x, 8, 12, 5, '#1f6f6a'); pcircle(x, 18, 12, 5, '#1f6f6a');
  for (let i = 0; i < 9; i++) R(x, 5 + (i * 7) % 16, 4 + (i * 5) % 12, 1, 1, '#a7f070');
  PROPS.tree = c;
  [c, x] = mkCanvas(24, 12); // 路障
  R(x, 0, 2, 24, 5, '#ffcd4a'); for (let i = 0; i < 4; i++) R(x, 2 + i * 6, 2, 3, 5, '#14101e'); R(x, 2, 7, 2, 5, '#566c86'); R(x, 20, 7, 2, 5, '#566c86');
  PROPS.barrier = c;
}
const PROP_BY = { city: ['car', 'lamp', 'crate', 'holo', 'barrier', 'lamp'], ruin: ['tree', 'crate', 'car', 'tree', 'pillar'], temple: ['lantern', 'pillar', 'lantern', 'tree'] };

// ===== 光暈快取 =====
const GLOW = {};
function glow(r, col) {
  const k = r + col; if (GLOW[k]) return GLOW[k];
  const [c, x] = mkCanvas(r * 2, r * 2); const g = x.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); return GLOW[k] = c;
}
function drawGlow(x, y, r, col, a = 1) { ctx.globalAlpha = a; ctx.drawImage(glow(r, col), Math.round(x - r), Math.round(y - r)); ctx.globalAlpha = 1; }

// ===== 世界首腦 =====
function drawBoss(c, x, y, t, sc = 1, hurt = 0) {
  x = Math.round(x); y = Math.round(y);
  const S = v => Math.round(v * sc);
  // 纜線
  for (let i = 0; i < 7; i++) {
    const bx = x + S(-36 + i * 12), sw = Math.sin(t * 2 + i) * S(6);
    for (let j = 0; j < 14; j++) R(c, bx + Math.sin(t * 2 + i + j * 0.4) * S(3) + sw * j / 14, y + S(20 + j * 4), S(3), S(4), j % 3 ? '#2a2438' : '#5b3fb0');
    pcircle(c, bx + sw, y + S(78), S(2), '#ff77a8');
  }
  // 頭殼
  pcircle(c, x, y, S(46), '#14101e');
  pcircle(c, x, y, S(44), hurt > 0 ? '#ffffff' : '#3d4a5f');
  pcircle(c, x - S(8), y - S(10), S(34), hurt > 0 ? '#ffffff' : '#566c86');
  R(c, x - S(44), y + S(8), S(88), S(4), '#2a2438');
  R(c, x - S(30), y - S(34), S(60), S(3), '#2a2438');
  for (let i = 0; i < 6; i++) R(c, x - S(40) + S(i * 15), y + S(14), S(6), S(10), '#333c57');
  // 電路紋
  const pulse = (Math.sin(t * 4) + 1) / 2;
  c.globalAlpha = 0.6 + pulse * 0.4;
  R(c, x - S(38), y - S(4), S(20), S(2), '#a46be0'); R(c, x + S(18), y - S(4), S(20), S(2), '#a46be0');
  R(c, x - S(22), y - S(30), S(2), S(14), '#a46be0'); R(c, x + S(20), y - S(30), S(2), S(14), '#a46be0');
  c.globalAlpha = 1;
  // 獨眼
  pcircle(c, x, y - S(4), S(18), '#14101e');
  pcircle(c, x, y - S(4), S(16), '#a8203e');
  pcircle(c, x + Math.sin(t * 1.3) * S(4), y - S(4), S(10), '#ff3860');
  pcircle(c, x + Math.sin(t * 1.3) * S(4), y - S(4), S(4), '#ffe0e8');
  R(c, x - S(18), y - S(4) - S(1), S(36), S(2), 'rgba(20,16,30,.5)');
}

// ===== 主角（躲在被子裡）=====
function drawHidingHero(c, x, y, t, scared = 1) {
  const sh = scared ? (Math.floor(t * 12) % 2) : 0;
  x = Math.round(x + sh); y = Math.round(y);
  const hx = x - 34, hy = y - 25; // 頭（枕在枕頭上）
  // 頭
  R(c, hx - 7, hy, 14, 14, '#14101e');
  R(c, hx - 6, hy + 1, 12, 12, '#2b2233');
  R(c, hx - 5, hy + 5, 10, 8, '#ffd6b0');
  R(c, hx - 5, hy + 4, 3, 1, '#2b2233'); R(c, hx + 1, hy + 4, 4, 2, '#2b2233'); R(c, hx - 1, hy + 4, 1, 1, '#ffd6b0');
  R(c, hx - 5, hy + 11, 1, 1, '#e8a07a'); R(c, hx + 4, hy + 11, 1, 1, '#e8a07a');
  if (scared) { // 驚恐睜大眼，眼珠往門口瞄
    const look = Math.floor(t * 0.7) % 3 === 0 ? 0 : 1;
    R(c, hx - 4, hy + 6, 3, 4, '#f4f4f4'); R(c, hx + 1, hy + 6, 3, 4, '#f4f4f4');
    R(c, hx - 4 + look + 1, hy + 7, 1, 2, '#14101e'); R(c, hx + 1 + look + 1, hy + 7, 1, 2, '#14101e');
    R(c, hx - 4, hy + 5, 3, 1, '#14101e'); R(c, hx + 2, hy + 5, 2, 1, '#14101e');
  } else { // 安心的 ^ ^
    R(c, hx - 4, hy + 8, 1, 1, '#14101e'); R(c, hx - 3, hy + 7, 1, 1, '#14101e'); R(c, hx - 2, hy + 8, 1, 1, '#14101e');
    R(c, hx + 1, hy + 8, 1, 1, '#14101e'); R(c, hx + 2, hy + 7, 1, 1, '#14101e'); R(c, hx + 3, hy + 8, 1, 1, '#14101e');
  }
  // 被子（拉到鼻子）
  R(c, hx - 8, y - 13, 70, 16, '#14101e'); R(c, hx - 7, y - 12, 68, 14, '#c86b1e'); R(c, hx - 7, y - 12, 68, 3, '#ffa300');
  R(c, hx - 8, hy + 11, 17, 4, '#14101e'); R(c, hx - 7, hy + 12, 15, 3, '#ffa300');
  for (let i = 0; i < 6; i++) R(c, hx + 6 + i * 9, y - 7, 4, 4, '#ffcd75');
  R(c, hx - 9, hy + 12, 3, 3, '#ffd6b0'); // 抓著被子的手
  if (scared && Math.floor(t * 2) % 3 === 0) { R(c, hx + 8, hy + 2, 2, 3, '#73eff7'); R(c, hx + 8, hy + 1, 1, 1, '#c9fff6'); }
}

// ===== 安全屋場景 =====
const LAYER = {};
function cached(key, w, h, fn) { if (LAYER[key]) return LAYER[key]; const [c, x] = mkCanvas(w, h); fn(x); return LAYER[key] = c; }
function drawCityWindow(c, x0, y0, w, h, t, shield) {
  ditherGrad(c, y0, y0 + h, ['#120a24', '#2a1145', '#5d275d'], x0, x0 + w);
  const rnd = srand(77);
  for (let i = 0; i < 9; i++) { const bw = 6 + rnd() * 10, bh = 14 + rnd() * 30, bx = x0 + rnd() * w; R(c, bx, y0 + h - bh, Math.min(bw, x0 + w - bx), bh, '#1a1426');
    for (let j = 0; j < 6; j++) if (bx + 2 + (j % 2) * 4 < x0 + w - 1) R(c, bx + 2 + (j % 2) * 4, y0 + h - bh + 3 + Math.floor(j / 2) * 6, 1, 2, rnd() < .5 ? '#ff77a8' : '#73eff7'); }
  // 窗外的紅眼
  if (!shield) for (let i = 0; i < 5; i++) { const ex = x0 + 6 + i * (w - 12) / 4, ey = y0 + h - 8 - (i % 2) * 6;
    if (Math.floor(t * 1.5 + i * 1.7) % 4 !== 0) { R(c, ex, ey, 2, 1, '#ff3860'); R(c, ex + 4, ey, 2, 1, '#ff3860'); } }
  if (shield) { c.globalAlpha = 0.25 + Math.sin(t * 2) * 0.08; R(c, x0, y0, w, h, '#ffcd4a'); c.globalAlpha = 1; for (let i = 0; i < w; i += 6) R(c, x0 + i, y0 + ((i * 3 + Math.floor(t * 20)) % h), 1, 1, '#fff3c0'); }
}
function drawSafehouse(c, t, opt = {}) {
  const ng = opt.ng, owned = opt.owned || 0, mechs = opt.mechs || 0, alarm = opt.alarm;
  // 牆
  const wall = cached('wall' + (ng ? 1 : 0), W, H, x => {
    R(x, 0, 0, W, H, '#14101e');
    ditherGrad(x, 0, 196, ng ? ['#3a3020', '#2a2418'] : ['#1d2f3a', '#16232a']);
    for (let i = 0; i < W; i += 40) { R(x, i, 0, 1, 196, ng ? '#4a3d24' : '#22384a'); }
    R(x, 0, 30, W, 2, ng ? '#6b5530' : '#27455a'); R(x, 0, 150, W, 2, ng ? '#6b5530' : '#27455a');
    if (ng) for (let i = 0; i < W; i += 40) { R(x, i - 3, 26, 7, 10, '#ffcd4a'); R(x, i - 3, 146, 7, 10, '#ffcd4a'); R(x, i - 1, 28, 3, 6, '#c8962a'); }
    // 地板
    R(x, 0, 196, W, 74, '#2a2033'); for (let i = 0; i < W; i += 24) R(x, i, 196, 1, 74, '#1e1726'); for (let j = 208; j < H; j += 14) R(x, 0, j, W, 1, '#1e1726');
    R(x, 0, 196, W, 2, '#3b2e47');
  });
  c.drawImage(wall, 0, 0);
  // 窗戶
  R(c, 20, 46, 80, 64, '#14101e'); drawCityWindow(c, 24, 50, 72, 56, t, ng); R(c, 59, 50, 2, 56, '#14101e'); R(c, 24, 77, 72, 2, '#14101e');
  R(c, 18, 110, 84, 4, '#4b5a63');
  // 功法書架
  R(c, 110, 40, 64, 70, '#14101e'); R(c, 112, 42, 60, 66, '#4b2e1e'); R(c, 112, 64, 60, 2, '#7a4b2a'); R(c, 112, 86, 60, 2, '#7a4b2a');
  const cols = ['#c86b1e', '#5b3fb0', '#38b764', '#41a6f6', '#ff77a8', '#ffcd4a', '#a46be0'];
  for (let i = 0; i < 15; i++) { const row = Math.floor(i / 5), col = i % 5; const bx = 116 + col * 11, by = 46 + row * 22;
    if (i < owned) { R(c, bx, by, 8, 17, cols[i % cols.length]); R(c, bx, by + 3, 8, 1, '#fff3d6'); R(c, bx, by + 13, 8, 1, '#fff3d6'); }
    else { R(c, bx + 2, by + 13, 4, 4, '#2a1a12'); } }
  // 機甲藍圖海報
  R(c, 184, 44, 46, 56, '#14101e'); R(c, 186, 46, 42, 52, '#1f3a6b');
  for (let i = 0; i < 42; i += 6) R(c, 186 + i, 46, 1, 52, '#29507f');
  c.globalAlpha = mechs > 0 ? 1 : 0.4; R(c, 199, 54, 16, 10, '#73eff7'); R(c, 196, 66, 22, 14, '#73eff7'); R(c, 199, 82, 5, 10, '#73eff7'); R(c, 210, 82, 5, 10, '#73eff7'); R(c, 205, 70, 4, 4, '#ffec27'); c.globalAlpha = 1;
  // 床 + 主角
  R(c, 40, 184, 100, 22, '#14101e'); R(c, 42, 186, 96, 10, '#d8d0e8'); R(c, 42, 196, 96, 8, '#4b2e1e'); R(c, 42, 204, 4, 8, '#4b2e1e'); R(c, 134, 204, 4, 8, '#4b2e1e');
  R(c, 44, 180, 22, 8, '#f4f4f4'); R(c, 44, 186, 22, 2, '#c0b8d0');
  if (!opt.noHero) drawHidingHero(c, 98, 190, t, ng ? (Math.floor(t * 0.5) % 4 === 0 ? 1 : 0) : 1);
  // 系統終端
  R(c, 196, 160, 36, 40, '#14101e'); R(c, 198, 162, 32, 36, '#333c57'); R(c, 202, 166, 24, 14, '#0b2a36');
  for (let i = 0; i < 4; i++) R(c, 204, 168 + i * 3, 4 + ((i * 7 + Math.floor(t * 3)) % 16), 1, '#73eff7');
  // 全息投影
  const fl = 0.55 + Math.sin(t * 5) * 0.1 + (Math.random() < 0.03 ? -0.3 : 0);
  c.globalAlpha = Math.max(0.1, fl);
  R(c, 190, 118, 48, 36, 'rgba(65,166,246,.35)'); R(c, 190, 118, 48, 1, '#73eff7'); R(c, 190, 153, 48, 1, '#73eff7'); R(c, 190, 118, 1, 36, '#73eff7'); R(c, 237, 118, 1, 36, '#73eff7');
  R(c, 196, 124, 20, 2, '#73eff7'); R(c, 196, 130, 34, 1, '#c9fff6'); R(c, 196, 135, 28, 1, '#c9fff6'); R(c, 196, 140, 30, 1, '#c9fff6'); R(c, 220, 124, 12, 6, '#ffcd4a');
  c.globalAlpha = 1;
  // 大門（很多把鎖）
  R(c, 248, 104, 58, 94, '#14101e'); R(c, 251, 107, 52, 91, ng ? '#8a6a2a' : '#4a3b52'); R(c, 255, 111, 44, 83, ng ? '#a8842f' : '#5d4a68');
  for (let i = 0; i < 7; i++) { R(c, 291, 116 + i * 11, 8, 6, '#14101e'); R(c, 292, 117 + i * 11, 6, 4, ng ? '#ffec27' : '#94b0c2'); }
  R(c, 258, 150, 20, 4, '#14101e'); R(c, 262, 120, 16, 10, '#14101e'); R(c, 264, 122, 12, 6, alarm ? '#ff3860' : '#2ec4b6');
  // 雜物
  R(c, 160, 202, 18, 10, '#14101e'); R(c, 161, 203, 16, 8, '#c86b1e'); R(c, 164, 204, 10, 2, '#ffcd75');
  R(c, 6, 186, 12, 24, '#14101e'); R(c, 7, 187, 10, 22, '#2ec4b6'); R(c, 9, 190, 6, 4, '#c9fff6');
  if (ng) { R(c, 4, 4, 70, 14, '#14101e'); R(c, 5, 5, 68, 12, '#ffcd4a'); for (let i = 0; i < 6; i++) R(c, 9 + i * 11, 9, 6, 4, '#8a6a2a'); }
  // 燈光
  drawGlowOn(c, 214, 136, 50, 'rgba(115,239,247,.25)');
  if (alarm) { c.globalAlpha = 0.25 + 0.25 * Math.sin(t * 10); R(c, 0, 0, W, H, '#ff1040'); c.globalAlpha = 1; }
}
function drawGlowOn(c, x, y, r, col) { c.drawImage(glow(r, col), Math.round(x - r), Math.round(y - r)); }

// ===== 過場背景 =====
function skyline(c, seed, baseY, h0, h1, body, win, neon, x0 = 0, x1 = W, wDen = .3) {
  const rnd = srand(seed); let x = x0 - 10;
  while (x < x1) { const bw = 14 + Math.floor(rnd() * 26), bh = h0 + Math.floor(rnd() * (h1 - h0));
    R(c, x, baseY - bh, bw, bh, body);
    if (rnd() < 0.3) R(c, x + bw / 2 - 1, baseY - bh - 8, 2, 8, body);
    for (let wy = baseY - bh + 4; wy < baseY - 4; wy += 5) for (let wx = x + 3; wx < x + bw - 3; wx += 4) if (rnd() < wDen) R(c, wx, wy, 2, 2, win);
    if (neon && rnd() < 0.35) { const ny = baseY - bh + 6 + rnd() * 20; R(c, x + 2, ny, 3, 14, rnd() < .5 ? '#ff77a8' : '#73eff7'); }
    x += bw + 1 + Math.floor(rnd() * 3); }
}
function stars(c, seed, n, y1) { const rnd = srand(seed); for (let i = 0; i < n; i++) R(c, rnd() * W, rnd() * y1, 1, 1, rnd() < .3 ? '#f4f4f4' : '#94b0c2'); }
function drawHeroBig(c, x, y, t, walk, set = IMG.hero, sc = 3, flip = false) {
  const f = walk ? Math.floor(t * 4) % 2 : 0; const arr = flip ? set.l : set.r; const img = arr[f];
  c.drawImage(img, Math.round(x - img.width * sc / 2), Math.round(y - img.height * sc - (walk && f ? Math.ceil(sc / 2) : 0)), img.width * sc, img.height * sc);
}
function drawEnemyBig(c, name, x, y, t, sc = 3, flip = true) {
  const set = IMG[name]; const f = Math.floor(t * 4) % 2; const img = (flip ? set.l : set.r)[f];
  c.drawImage(img, Math.round(x - img.width * sc / 2), Math.round(y - img.height * sc), img.width * sc, img.height * sc);
}
const BG = {
  city(c, t) {
    c.drawImage(cached('bgcity', W, H, x => { ditherGrad(x, 0, 200, ['#0b0f2a', '#1a2350', '#3a3a6e']); stars(x, 3, 60, 120);
      skyline(x, 5, 200, 50, 130, '#141a36', '#ffec8a', false); skyline(x, 9, 210, 30, 80, '#0e1228', '#ffcd4a', false, 0, W, .45);
      R(x, 210, 0, 0, 0, '#000'); R(x, 0, 210, W, 60, '#22202e'); R(x, 0, 228, W, 3, '#ffcd4a'); for (let i = 0; i < W; i += 30) R(x, i, 245, 16, 2, '#f4f4f4'); }), 0, 0);
    const px = 150 + t * 18; drawHeroBig(c, px, 236, t, true);
    R(c, px + 10, 190, 4, 6, '#14101e'); R(c, px + 11, 191, 2, 4, '#73eff7'); drawGlowOn(c, px + 12, 192, 14, 'rgba(115,239,247,.3)');
  },
  portal(c, t) {
    BG.city(c, 6);
    const r = Math.min(70, t * 40); for (let i = 0; i < 3; i++) pring(c, 258, 236, Math.max(1, r - i * 9), i % 2 ? '#ffec27' : '#a46be0', 2);
    drawGlowOn(c, 258, 230, Math.max(4, Math.floor(r * 1.5)), 'rgba(164,107,224,.45)');
    if (t > 2.2) { c.globalAlpha = Math.min(1, (t - 2.2) * 1.5); R(c, 0, 0, W, H, '#ffffff'); c.globalAlpha = 1; }
  },
  era(c, t) {
    c.drawImage(cached('bgera', W, H, x => {
      ditherGrad(x, 0, 190, ['#1a0b2e', '#4a1550', '#a03a6e', '#ff8a6a']); stars(x, 11, 80, 100);
      pcircle(x, 380, 48, 22, '#ffe0c0'); pcircle(x, 372, 44, 22, '#3a1550'); pcircle(x, 90, 40, 9, '#c9fff6');
      skyline(x, 21, 190, 60, 150, '#2a1440', '#ff77a8', true, 0, W, .2);
      // 浮空島與樓閣
      for (const [ix, iy, s] of [[120, 70, 1], [300, 100, .7], [420, 120, .5]]) {
        R(x, ix - 30 * s, iy, 60 * s, 8 * s, '#3d3552'); R(x, ix - 20 * s, iy + 8 * s, 40 * s, 8 * s, '#2b2638'); R(x, ix - 8 * s, iy + 16 * s, 16 * s, 6 * s, '#2b2638');
        R(x, ix - 14 * s, iy - 14 * s, 28 * s, 14 * s, '#7a2a3a'); R(x, ix - 22 * s, iy - 18 * s, 44 * s, 4 * s, '#2a1a12'); R(x, ix - 10 * s, iy - 30 * s, 20 * s, 12 * s, '#7a2a3a'); R(x, ix - 16 * s, iy - 33 * s, 32 * s, 3 * s, '#2a1a12');
        R(x, ix - 3 * s, iy - 8 * s, 6 * s, 8 * s, '#ffcd4a'); }
      skyline(x, 33, 205, 40, 90, '#1a0f28', '#73eff7', true, 0, W, .35);
      R(x, 0, 205, W, 65, '#1d1626'); for (let i = 0; i < W; i += 32) R(x, i, 205, 1, 65, '#2a2038'); R(x, 0, 205, W, 2, '#ff77a8');
    }), 0, 0);
    for (let i = 0; i < 8; i++) { const rx = (i * 67 + t * 10) % W, ry = 60 + Math.sin(t + i) * 20 + i * 12; c.globalAlpha = .7; R(c, rx, ry, 4, 1, '#ffec27'); R(c, rx + 1, ry - 1, 1, 3, '#ffec27'); c.globalAlpha = 1; }
    drawHeroBig(c, 240, 250, t, false);
  },
  mob(c, t) {
    BG.era(c, 0);
    c.globalAlpha = .45; R(c, 0, 0, W, H, '#14101e'); c.globalAlpha = 1;
    drawHeroBig(c, 110, 250, t, false);
    const types = ['walker', 'runner', 'walker', 'hacker', 'walker', 'brute', 'walker'];
    types.forEach((ty, i) => { const ex = 470 - i * 34 - Math.min(80, t * 14) + (i % 2) * 10; drawEnemyBig(c, ty, ex, 246 + (i % 3) * 6, t + i * 0.13, ty === 'brute' ? 2 : 3); });
    for (let i = 0; i < 4; i++) if (Math.floor(t * 3 + i) % 2) { R(c, 300 + i * 40, 120 + (i % 2) * 14, 12, 10, '#f4f4f4'); R(c, 305 + i * 40, 122 + (i % 2) * 14, 2, 4, '#ff3860'); R(c, 305 + i * 40, 127 + (i % 2) * 14, 2, 2, '#ff3860'); }
  },
  cornered(c, t, noHero) {
    R(c, 0, 0, W, H, '#120c1c'); for (let i = 0; i < W; i += 20) for (let j = 0; j < 200; j += 10) R(c, i + ((j / 10) % 2) * 10, j, 19, 9, '#1d1528');
    R(c, 0, 200, W, 70, '#0e0a16');
    if (!noHero) drawHeroBig(c, 70 + (Math.floor(t * 14) % 2), 250, t, false);
    for (let i = 0; i < 6; i++) { const ex = 200 + i * 45 - Math.min(40, t * 8); drawEnemyBig(c, i % 3 === 1 ? 'runner' : 'walker', ex, 252 - (i % 2) * 4, t + i * 0.13, 3); }
    const g = c.createRadialGradient(80, 200, 10, 80, 200, 320); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.8)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  },
  system(c, t) {
    BG.cornered(c, 6);
    c.globalAlpha = .6; R(c, 0, 0, W, H, '#04121c'); c.globalAlpha = 1;
    c.save(); c.translate(0, 72);
    const s = Math.min(1, t * 2); const pw = 260 * s, ph = 120 * s;
    R(c, 240 - pw / 2, 90 - ph / 2, pw, ph, 'rgba(20,80,110,.55)');
    pline(c, 240 - pw / 2, 90 - ph / 2, 240 + pw / 2, 90 - ph / 2, '#73eff7', 2); pline(c, 240 - pw / 2, 90 + ph / 2, 240 + pw / 2, 90 + ph / 2, '#73eff7', 2);
    pline(c, 240 - pw / 2, 90 - ph / 2, 240 - pw / 2, 90 + ph / 2, '#73eff7', 2); pline(c, 240 + pw / 2, 90 - ph / 2, 240 + pw / 2, 90 + ph / 2, '#73eff7', 2);
    if (s >= 1) { for (let i = 0; i < 5; i++) R(c, 130, 52 + i * 14, 40 + ((i * 53 + Math.floor(t * 8) * 7) % 180), 3, i === 0 ? '#ffcd4a' : '#73eff7'); pcircle(c, 345, 90, 18, '#41a6f6'); pcircle(c, 345, 90, 12, '#0b2a36'); R(c, 343, 80, 4, 12, '#73eff7'); R(c, 343, 95, 4, 4, '#73eff7'); }
    drawGlowOn(c, 240, 90, 120, 'rgba(115,239,247,.18)'); c.restore();
  },
  clone(c, t) {
    BG.cornered(c, 6, true);
    const cx = 160 + Math.max(0, t - 1) * 60;
    if (t < 1) { drawGlowOn(c, 150, 220, Math.floor(10 + t * 50), 'rgba(115,239,247,.6)'); }
    drawHeroBig(c, cx, 252, t, t > 1, IMG.clone);
    drawHeroBig(c, 70 - Math.max(0, t - 2) * 30, 250, t, t > 2, IMG.hero, 3, true);
  },
  exterior(c, t) {
    c.drawImage(cached('bgext', W, H, x => {
      ditherGrad(x, 0, 210, ['#120a24', '#2a1145', '#5d275d', '#8a3a5e']); stars(x, 61, 70, 120);
      pcircle(x, 70, 40, 12, '#ffe0c0'); pcircle(x, 64, 37, 12, '#2a1145');
      skyline(x, 71, 210, 40, 110, '#1e1030', '#ff77a8', true, 0, W, .15);
      // 左右兩棟廢棄霓虹大樓
      R(x, 20, 50, 130, 162, '#1a1426'); R(x, 20, 50, 130, 3, '#2a2438');
      for (let wy = 60; wy < 200; wy += 12) for (let wx = 30; wx < 140; wx += 14) R(x, wx, wy, 8, 6, hash(wx, wy, 1) < .7 ? '#0e0a16' : '#3a2d55');
      R(x, 330, 30, 140, 182, '#1a1426'); R(x, 330, 30, 140, 3, '#2a2438');
      for (let wy = 40; wy < 200; wy += 12) for (let wx = 340; wx < 460; wx += 14) R(x, wx, wy, 8, 6, hash(wx, wy, 2) < .75 ? '#0e0a16' : '#3a2d55');
      // 街道
      R(x, 0, 212, W, 58, '#1d1626'); R(x, 0, 212, W, 2, '#3b2e47'); for (let i = 0; i < W; i += 36) R(x, i, 244, 18, 2, '#ffcd4a');
      // 安全屋本體：灰色方塊水泥屋
      R(x, 178, 138, 124, 76, '#14101e');
      R(x, 180, 142, 120, 70, '#566c86');
      for (let wy = 148; wy < 212; wy += 8) R(x, 180, wy, 120, 1, '#4b5a6b');
      for (let wy = 142, k = 0; wy < 212; wy += 8, k++) for (let wx = 180 + (k % 2) * 12; wx < 300; wx += 24) R(x, wx, wy, 1, 8, '#4b5a6b');
      R(x, 172, 132, 136, 10, '#14101e'); R(x, 173, 133, 134, 8, '#3d4a5f'); R(x, 173, 133, 134, 2, '#94b0c2'); // 屋頂板
      // 鐵門 + 七道鎖
      R(x, 224, 164, 34, 48, '#14101e'); R(x, 226, 166, 30, 46, '#5d4a68'); R(x, 229, 169, 24, 40, '#4a3b52');
      for (let i = 0; i < 7; i++) R(x, 250, 170 + i * 5, 3, 3, '#ffcd4a');
      R(x, 230, 186, 6, 2, '#94b0c2');
      // 門上警告牌
      R(x, 226, 152, 30, 9, '#14101e'); R(x, 227, 153, 28, 7, '#ffcd4a'); for (let i = 0; i < 4; i++) R(x, 229 + i * 7, 153, 3, 7, '#14101e');
      // 小窗
      R(x, 192, 158, 20, 14, '#14101e'); R(x, 194, 160, 16, 10, '#ffcd75'); R(x, 201, 160, 1, 10, '#14101e'); R(x, 194, 164, 16, 1, '#14101e');
      // 屋頂雜物：歪掉的天線、碟形天線、通風管
      pline(x, 286, 132, 296, 98, '#94b0c2'); pline(x, 296, 98, 288, 104, '#94b0c2'); pline(x, 293, 108, 301, 104, '#94b0c2');
      R(x, 190, 124, 14, 8, '#14101e'); R(x, 191, 125, 12, 6, '#94b0c2'); R(x, 196, 128, 2, 4, '#566c86');
      R(x, 260, 122, 6, 10, '#3d4a5f'); R(x, 258, 120, 10, 3, '#566c86');
      R(x, 304, 150, 4, 60, '#3d4a5f'); // 排水管
      R(x, 268, 196, 22, 14, '#7a4b2a'); R(x, 268, 196, 22, 2, '#a0693c'); // 門口的箱子
    }), 0, 0);
    // 系統屏障（只有宿主看得見）
    c.save(); c.beginPath(); c.rect(0, 0, W, 213); c.clip();
    c.globalAlpha = 0.1 + 0.04 * Math.sin(t * 2); pcircle(c, 240, 212, 96, '#73eff7'); c.globalAlpha = 0.6; pring(c, 240, 212, 96, '#73eff7');
    for (let i = 0; i < 26; i++) { const a = Math.PI + (i / 26) * Math.PI, r = 30 + ((i * 37 + Math.floor(t * 12)) % 64); c.globalAlpha = 0.35; R(c, 240 + Math.cos(a) * r, 212 + Math.sin(a) * r, 2, 2, '#c9fff6'); }
    c.restore(); c.globalAlpha = 1;
    // 霓虹招牌閃爍
    if (Math.floor(t * 3) % 5) { R(c, 60, 90, 6, 40, '#ff77a8'); drawGlowOn(c, 63, 110, 26, 'rgba(255,119,168,.3)'); }
    R(c, 400, 70, 40, 6, '#73eff7'); drawGlowOn(c, 420, 73, 26, 'rgba(115,239,247,.25)');
    // 窗內溫暖燈光
    drawGlowOn(c, 202, 166, 22, 'rgba(255,205,117,.35)');
    // 路過卻視而不見的失控者
    for (let i = 0; i < 4; i++) { const ex = ((t * 22 + i * 130) % (W + 60)) - 30; drawEnemyBig(c, i % 2 ? 'runner' : 'walker', ex, 262 - (i % 2) * 4, t + i, 2, false); }
    // 主角衝進門
    if (t < 2.4) drawHeroBig(c, 120 + t * 48, 214, t, true, IMG.hero, 2);
    else { c.globalAlpha = Math.max(0, 1 - (t - 2.4)); R(c, 229, 169, 24, 40, '#ffcd75'); c.globalAlpha = 1; }
  },
  house(c, t) { drawSafehouse(c, t, { owned: 1 }); },
  alarm(c, t) { drawSafehouse(c, t, { owned: 15, alarm: true }); },
  destroy(c, t) {
    drawSafehouse(c, t, { owned: 15, noHero: true });
    // 屋頂被掀開
    ditherGrad(c, 0, 110, ['#0a0614', '#2a0d2a', '#5a1030']); stars(c, 4, 40, 90);
    for (let x = 0; x < W; x += 8) { const hh = 100 + Math.floor(hash(x, 1) * 30); R(c, x, hh, 8, 14, '#14101e'); R(c, x + 1, hh + 1, 6, 4, '#2a2438'); }
    drawBoss(c, 370, 112 + Math.sin(t) * 4, t, 1);
    for (let i = 0; i < 14; i++) { const dx = (i * 41) % W, dy = ((t * 60 + i * 37) % 280) - 10; R(c, dx, dy, 3 + (i % 3), 3, '#4a3b52'); }
    drawHeroBig(c, 100, 214, t, false);
  },
  standoff(c, t) {
    BG.destroy(c, t);
    c.globalAlpha = .35 + .15 * Math.sin(t * 3); drawGlowOn(c, 100, 190, 60, 'rgba(255,205,74,.6)'); c.globalAlpha = 1;
    drawHeroBig(c, 100, 214, t, false, IMG.heroGold);
  },
  aftermath(c, t) {
    ditherGrad(c, 0, 200, ['#0a0614', '#1a1040', '#3a2a6e']); stars(c, 9, 90, 180);
    for (let i = 0; i < 120; i++) { const a = i * 2.39996, r = (t * 30 + i * 3) % 200; c.globalAlpha = Math.max(0, 1 - r / 200);
      R(c, 300 + Math.cos(a) * r, 60 + Math.sin(a) * r * .6, 2, 2, ['#ff3860', '#73eff7', '#ffcd4a', '#f4f4f4'][i % 4]); }
    c.globalAlpha = 1; R(c, 0, 200, W, 70, '#1d1626'); R(c, 0, 200, W, 2, '#ffcd4a');
    drawHeroBig(c, 120, 252, t, false, IMG.heroGold);
  },
  rebuild(c, t) { drawSafehouse(c, t, { owned: 15, ng: true, mechs: 1 }); },
  ngplus(c, t) {
    c.drawImage(cached('bgng', W, H, x => { ditherGrad(x, 0, 190, ['#1a2050', '#5a4a8a', '#ffb07a', '#ffe0a0']); skyline(x, 51, 190, 30, 90, '#3a2a50', '#ffcd4a', true, 0, W, .15); R(x, 0, 190, W, 80, '#2a2a3a'); R(x, 0, 190, W, 2, '#ffcd4a'); }), 0, 0);
    // 安全屋 + 護盾
    R(c, 40, 140, 70, 52, '#8a6a2a'); R(c, 34, 132, 82, 10, '#ffcd4a'); R(c, 66, 160, 18, 32, '#5a4420'); R(c, 50, 150, 10, 10, '#73eff7');
    c.globalAlpha = .25 + .08 * Math.sin(t * 2); pcircle(c, 75, 190, 64, '#ffec27'); c.globalAlpha = 1; pring(c, 75, 190, 64, '#fff3c0');
    for (let i = 0; i < 18; i++) { const x = 110 + ((t * 70 + i * 47) % 420), y = 230 + (i % 5) * 7; drawHeroBig(c, x, y, t + i * .3, true, IMG.clone, 2); }
  },
};
