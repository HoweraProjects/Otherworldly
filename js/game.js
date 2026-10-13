'use strict';
// =====================================================================
//  因為太怕死，只好派分身去滅世
// =====================================================================
const $ = s => document.querySelector(s);
const UI = $('#ui'), STAGE = $('#stage');
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const TAU = Math.PI * 2;
const ALL_SKILLS = Object.keys(SKILLS);

function fit() {
  const k = Math.min(innerWidth / 960, innerHeight / 540);
  STAGE.style.transform = `scale(${k})`;
  STAGE.style.left = Math.round((innerWidth - 960 * k) / 2) + 'px';
  STAGE.style.top = Math.round((innerHeight - 540 * k) / 2) + 'px';
}
addEventListener('resize', fit);
addEventListener('orientationchange', () => setTimeout(fit, 250));
if (window.visualViewport) visualViewport.addEventListener('resize', fit);
const TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
function goFullscreen() { // 手機：全螢幕 + 鎖定橫向（不支援的瀏覽器會安靜失敗）
  const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!rq) return; try { const r = rq.call(el); const lock = () => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }; if (r && r.then) r.then(lock, () => { }); else lock(); } catch (e) { }
}
document.addEventListener('visibilitychange', () => { if (document.hidden && scene === RunScene && RN && !RN.over && !RN.paused) openPause(); });

// ===== 存檔 =====
const SAVE_KEY = 'paisi_bunshin_save_v1';
let S;
function defSave() { return { points: 0, owned: { bunshin: 1 }, equipped: [], pity: 0, intro: false, gift: false, ng: 0, finale: false, kills: 0, runs: 0, best: 0, mechs: 0, draws: 0, mute: false }; }
function load() { try { const j = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); S = Object.assign(defSave(), j || {}); } catch (e) { S = defSave(); } }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
const ownedCount = () => ALL_SKILLS.filter(id => S.owned[id]).length + 1;
const allCollected = () => ALL_SKILLS.every(id => S.owned[id]);
const cloneCap = () => S.ng > 0 ? 3 : 1;

// ===== 音效 =====
let AC = null;
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, d, type, v, t0, slide) {
  const a = AC; if (!a || S.mute) return; const t = t0 || a.currentTime;
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.02);
}
let NOISE = null;
function noise(d, v, t0, hp) {
  const a = AC; if (!a || S.mute) return; const t = t0 || a.currentTime;
  if (!NOISE) { NOISE = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate); const ch = NOISE.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
  const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); s.buffer = NOISE; f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = hp || 900;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(f); f.connect(g); g.connect(a.destination); s.start(t); s.stop(t + d + 0.02);
}
const sfxLast = {};
function sfx(name) {
  if (!AC || S.mute) return; const now = performance.now(); const gap = { hit: 45, kill: 55, xp: 40, shoot: 70, zap: 80 }[name] || 30;
  if (sfxLast[name] && now - sfxLast[name] < gap) return; sfxLast[name] = now;
  switch (name) {
    case 'hit': tone(220 + Math.random() * 60, 0.04, 'square', 0.015); break;
    case 'kill': tone(660, 0.06, 'square', 0.02, 0, 500); break;
    case 'xp': tone(900 + Math.random() * 300, 0.05, 'sine', 0.025); break;
    case 'shoot': tone(520, 0.05, 'square', 0.012, 0, -200); break;
    case 'slash': noise(0.08, 0.05, 0, 2000); break;
    case 'boom': noise(0.3, 0.12); tone(90, 0.3, 'sawtooth', 0.04, 0, -50); break;
    case 'zap': tone(1200, 0.08, 'sawtooth', 0.02, 0, -900); break;
    case 'roar': noise(0.35, 0.08); tone(140, 0.35, 'sawtooth', 0.04, 0, -60); break;
    case 'hurt': tone(160, 0.15, 'square', 0.05, 0, -80); break;
    case 'lvl': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.04, AC.currentTime + i * 0.07)); break;
    case 'pick': tone(660, 0.08, 'square', 0.04); tone(990, 0.1, 'square', 0.04, AC.currentTime + 0.08); break;
    case 'click': tone(880, 0.04, 'square', 0.03); break;
    case 'gacha': tone(440, 0.1, 'triangle', 0.05); tone(660, 0.1, 'triangle', 0.05, AC.currentTime + 0.08); break;
    case 'ssr': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'square', 0.04, AC.currentTime + i * 0.06)); break;
    case 'mech': [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, 0.18, 'sawtooth', 0.035, AC.currentTime + i * 0.08)); noise(0.5, 0.08); break;
    case 'freeze': tone(1500, 0.5, 'sine', 0.04, 0, -1200); break;
    case 'down': tone(440, 0.6, 'triangle', 0.06, 0, -380); break;
  }
}
const SONGS = {
  hub: { root: 110, ms: 280, bass: [0, null, 7, null, 5, null, 7, null, 3, null, 10, null, 8, null, 7, null], lead: [12, 15, 19, 15, 12, 15, 19, 22, 10, 15, 17, 15, 10, 14, 17, 19] },
  run: { root: 110, ms: 150, drum: true, bass: [0, 0, 12, 0, 0, 0, 12, 0, 8, 8, 20, 8, 10, 10, 22, 10], lead: [null, 12, null, 15, null, 19, 17, 15, null, 12, null, 15, 19, null, 22, 19, null, 20, null, 19, null, 17, 15, 17, null, 22, null, 19, 17, null, 15, 14] },
  boss: { root: 98, ms: 125, drum: true, bass: [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, -2, -2, 3, 3], lead: [12, null, 19, null, 24, null, 22, 19, 13, null, 20, null, 25, 24, 22, 20] },
  story: { root: 98, ms: 360, bass: [0, null, null, null, 5, null, null, null, 3, null, null, null, 7, null, null, null], lead: [null, 12, null, 15, null, 17, null, 15, null, 10, null, 14, null, 19, null, 17] },
};
const Music = {
  cur: null, step: 0, timer: null,
  play(name) { if (this.cur === name) return; this.cur = name; clearInterval(this.timer); this.timer = null; if (!name) return; const s = SONGS[name]; this.step = 0; this.timer = setInterval(() => this.tick(s), s.ms); },
  tick(s) {
    if (!AC || S.mute || AC.state !== 'running') return; const i = this.step++, t = AC.currentTime + 0.03;
    const b = s.bass[i % s.bass.length]; if (b != null) tone(s.root * Math.pow(2, b / 12), s.ms / 1000 * 0.9, 'triangle', 0.06, t);
    const l = s.lead[i % s.lead.length]; if (l != null) tone(s.root * 2 * Math.pow(2, l / 12), s.ms / 1000 * 0.7, 'square', 0.016, t);
    if (s.drum) { if (i % 4 === 0) { tone(120, 0.08, 'sine', 0.08, t, -70); } if (i % 4 === 2) noise(0.04, 0.025, t, 5000); }
  },
};

// ===== 輸入 =====
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true; audio();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (scene && scene.key && !e.repeat) scene.key(e.code, e);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (scene === RunScene && RN && !RN.over && !RN.paused) openPause(); });
const joy = { on: false, id: null, x0: 0, y0: 0, x: 0, y: 0 };
function toInternal(cx, cy) { const r = cv.getBoundingClientRect(); return [(cx - r.left) / r.width * W, (cy - r.top) / r.height * H]; }
STAGE.addEventListener('touchstart', e => {
  audio(); if (scene !== RunScene || e.target.closest('button,.opt,.prompt')) return;
  const t = e.changedTouches[0]; const [x, y] = toInternal(t.clientX, t.clientY); Object.assign(joy, { on: true, id: t.identifier, x0: x, y0: y, x, y }); e.preventDefault();
}, { passive: false });
STAGE.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === joy.id) { const [x, y] = toInternal(t.clientX, t.clientY); joy.x = x; joy.y = y; } if (joy.on) e.preventDefault(); }, { passive: false });
STAGE.addEventListener('touchend', e => { for (const t of e.changedTouches) if (t.identifier === joy.id) joy.on = false; });
function moveInput() {
  let x = 0, y = 0;
  if (keys.KeyA || keys.ArrowLeft) x--; if (keys.KeyD || keys.ArrowRight) x++;
  if (keys.KeyW || keys.ArrowUp) y--; if (keys.KeyS || keys.ArrowDown) y++;
  if (joy.on) { const dx = joy.x - joy.x0, dy = joy.y - joy.y0, d = Math.hypot(dx, dy); if (d > 3) { x = dx / Math.max(d, 24); y = dy / Math.max(d, 24); } }
  const d = Math.hypot(x, y); if (d > 1) { x /= d; y /= d; } return { x, y };
}

// ===== 場景框架 =====
let scene = null, sceneT = 0;
function go(sc, ...args) { if (scene && scene.leave) scene.leave(); scene = sc; sceneT = 0; UI.innerHTML = ''; if (sc.enter) sc.enter(...args); }
UI.addEventListener('click', e => { audio(); const b = e.target.closest('[data-act]'); if (b && !b.disabled && scene && scene.act) { sfx('click'); scene.act(b.dataset.act, b); } else if (scene && scene.tap) scene.tap(e); });
function toast(msg) {
  let box = UI.querySelector('.toastbox'); if (!box) { box = document.createElement('div'); box.className = 'toastbox'; UI.appendChild(box); }
  if (box.children.length >= 4) box.firstChild.remove();
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; box.appendChild(d); setTimeout(() => d.remove(), 2700);
}
function banner(msg, col) { const d = document.createElement('div'); d.className = 'big-banner'; d.textContent = msg; if (col) d.style.color = col; UI.appendChild(d); setTimeout(() => d.remove(), 2300); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ===== 標題 =====
const TitleScene = {
  enter() {
    Music.play('story');
    UI.innerHTML = `<div class="title-logo"><div class="t1">像素肉鴿 · 殭屍生存</div><div class="t2">因為太怕死，<br>只好派<b>分身</b>去滅世</div><div class="t3">魔法 ＋ 武道　ＶＳ　賽博</div></div>
      <div class="menu" style="left:50%;transform:translateX(-50%);top:330px;width:300px">
        <button class="btn gold" data-act="start">${S.intro ? '回到安全屋' : '開始遊戲'}<small>Enter</small></button>
        ${S.intro ? '<button class="btn" data-act="intro">重看開場</button>' : ''}
        <button class="btn" data-act="mute">聲音：${S.mute ? '關' : '開'}</button>
        ${TOUCH && (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) ? '<button class="btn" data-act="full">全螢幕遊玩</button>' : ''}
      </div>
      <div style="position:absolute;left:0;right:0;bottom:16px;text-align:center;font-size:14px;color:var(--dim)">${TOUCH ? '手指按住螢幕任意處拖曳移動 · 自動攻擊 · 右下角暫停' : 'WASD／方向鍵 移動 · 自動攻擊 · Esc 暫停'}</div>`;
  },
  act(a, el) {
    if (a === 'start') { if (!S.intro) go(CutScene, STORY_INTRO, () => { S.intro = true; save(); go(HubScene); }, 'story'); else go(HubScene); }
    if (a === 'intro') go(CutScene, STORY_INTRO, () => go(HubScene), 'story');
    if (a === 'mute') { S.mute = !S.mute; save(); el.textContent = '聲音：' + (S.mute ? '關' : '開'); }
    if (a === 'full') goFullscreen();
  },
  key(c) { if (c === 'Enter' || c === 'Space') this.act('start'); },
  update() { },
  draw() {
    BG.era(ctx, sceneT);
    ctx.globalAlpha = 0.55; R(ctx, 0, 0, W, H, '#0b0812'); ctx.globalAlpha = 1;
    for (let i = 0; i < 9; i++) { const x = ((sceneT * 40 + i * 61) % (W + 40)) - 20; drawHeroBig(ctx, x, 262 - (i % 3) * 4, sceneT + i, true, IMG.clone, 1); }
    for (let i = 0; i < 6; i++) { const x = ((sceneT * 34 + i * 83 + 30) % (W + 40)) - 20; drawEnemyBig(ctx, i % 2 ? 'walker' : 'runner', x + 16, 262 - (i % 2) * 3, sceneT + i * 0.13, 1, false); }
  },
};

// ===== 過場 =====
const CutScene = {
  enter(panels, done, music) {
    this.panels = panels; this.done = done; this.pi = 0; this.li = 0; this.chars = 0; this.pt = 0; this.shown = -1;
    Music.play(music || 'story');
    UI.innerHTML = `<button class="skip" data-act="skip">${TOUCH ? '跳過' : '跳過 Esc'}</button><div class="dlg px"><div class="who"></div><div class="txt"></div><div class="next blink">▼</div></div>`;
    this.dlg = UI.querySelector('.dlg'); this.who = UI.querySelector('.who'); this.txt = UI.querySelector('.txt'); this.nx = UI.querySelector('.next');
    this.render();
  },
  line() { return this.panels[this.pi].lines[this.li]; },
  render() {
    const p = this.panels[this.pi], [who] = this.line();
    this.who.textContent = who; this.who.className = 'who ' + (who === '系統' ? 'sys' : who === '分身' ? 'clone' : (who.includes('路人') || who === '世界首腦') ? 'enemy' : '');
    this.dlg.classList.toggle('sysbox', who === '系統'); this.who.style.display = who === '旁白' ? 'none' : '';
  },
  advance() {
    const full = this.line()[1];
    if (this.chars < full.length) { this.chars = full.length; return; }
    this.li++; this.chars = 0; this.shown = -1;
    if (this.li >= this.panels[this.pi].lines.length) { this.li = 0; this.pi++; this.pt = 0; if (this.pi >= this.panels.length) { this.done(); return; } }
    this.render(); sfx('click');
  },
  act(a) { if (a === 'skip') this.done(); },
  tap() { this.advance(); },
  key(c) { if (c === 'Space' || c === 'Enter' || c === 'KeyZ') this.advance(); if (c === 'Escape') this.done(); },
  update(dt) {
    this.pt += dt; const full = this.line()[1]; this.chars = Math.min(full.length, this.chars + dt * 26);
    const n = Math.floor(this.chars); if (n !== this.shown) { this.shown = n; this.txt.textContent = full.slice(0, n); this.nx.style.visibility = n >= full.length ? 'visible' : 'hidden'; if (n % 3 === 0 && n < full.length) tone(600 + Math.random() * 80, 0.02, 'square', 0.012); }
  },
  draw() { BG[this.panels[this.pi].bg](ctx, this.pt); },
};

// ===== 安全屋（主頁）=====
const QUIPS = ['外面好可怕……', '分身加油，我在精神上支持你。', '門鎖了七道，應該夠了吧……', '今天也是不出門的一天。', '系統爸爸，我想要更多鎖。', '為什麼他們都叫我劣等產物……', '被子是最強的防具。'];
const QUIPS_NG = ['堅不可摧！但我還是不出門。', '分身們，割草愉快～', '泡麵配割草直播，完美。', '世界首腦？那是誰？'];
const HubScene = {
  enter() {
    Music.play('hub'); this.panel = null; this.qt = 0; this.quip = '';
    if (!S.gift) { S.gift = true; S.points += 100; save(); setTimeout(() => toast('系統：新手點數 100 已到帳，去商城抽一本功法吧！'), 300); }
    if (allCollected() && !S.finale) { setTimeout(() => go(CutScene, STORY_FINALE, () => startBoss(), 'boss'), 50); return; }
    this.renderSide();
  },
  renderSide() {
    const eq = S.equipped.filter(id => S.owned[id]);
    const eqNames = eq.length ? eq.map(id => SKILLS[id].name).join('、') + (S.ng && eq.length < 3 ? '（其餘隨機）' : '')
      : S.ng ? '未選（隨機派出 3 本）' : '<span style="color:var(--red)">未裝備（分身赤手空拳）</span>';
    UI.innerHTML = `<div class="hubside px">
      <h2>${S.ng ? '堅不可摧安全屋 ★' : '絕對安全屋'}</h2>
      <div class="pts">系統點數　${S.points}</div>
      <div class="meta">已習得功法　${ownedCount()} / ${ALL_SKILLS.length + 1}<br>出戰功法　${eqNames}<br>${S.ng ? '二周目 · 無限流 · 同時派遣 3 名分身<br>' : ''}派遣 ${S.runs} 次 · 擊破 ${S.kills}<br>最長存活 ${fmtT(S.best)}</div>
      <button class="btn gold" data-act="dispatch">派遣分身<small>出擊</small></button>
      <button class="btn" data-act="gacha">系統商城<small>抽功法</small></button>
      <button class="btn" data-act="skills">功法閣<small>裝備</small></button>
      <button class="btn" data-act="log">系統日誌<small>說明</small></button>
      <div class="grow"></div>
      <button class="btn" data-act="title">回標題<small>設定</small></button>
    </div><div id="quip" style="position:absolute;left:150px;top:268px;max-width:260px;background:#f4f4f4;color:#14101e;border:3px solid #14101e;padding:4px 10px;font-size:15px;display:none"></div>`;
  },
  openModal(html) { this.panel = true; UI.innerHTML = `<div class="modal px">${html}</div>`; },
  act(a, el) {
    if (a === 'dispatch') { if (!S.equipped.filter(id => S.owned[id]).length) toast('分身沒有功法，只能用拳頭……'); startRun(); return; }
    if (a === 'gacha') { this.gres = ''; this.showGacha(); }
    if (a === 'skills') this.showSkills();
    if (a === 'log') this.showLog();
    if (a === 'title') go(TitleScene);
    if (a === 'close') { this.panel = null; if (allCollected() && !S.finale) { this.enter(); return; } this.renderSide(); }
    if (a === 'draw1') this.doDraw(1);
    if (a === 'draw10') this.doDraw(10);
    if (a.startsWith('eq:')) this.equip(a.slice(3));
    if (a === 'replay') go(CutScene, STORY_INTRO, () => go(HubScene), 'story');
    if (a === 'replayEnd') go(CutScene, STORY_FINALE.concat(STORY_ENDING), () => go(HubScene), 'story');
    if (a === 'reset') { if (el.dataset.armed) { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } load(); go(TitleScene); } else { el.dataset.armed = 1; el.textContent = '再按一次確認清除存檔'; } }
  },
  key(c) { if (c === 'Escape' && this.panel) this.act('close'); },
  showGacha() {
    const left = Math.max(1, 10 - S.pity), all = allCollected();
    this.openModal(`<h2>系統商城<span class="r">點數 ${S.points}</span></h2>
      <div class="row"><button class="btn" data-act="draw1" ${S.points < 100 ? 'disabled' : ''}>單抽<small>100 點</small></button>
      <button class="btn gold" data-act="draw10" ${S.points < 900 ? 'disabled' : ''}>十連抽<small>900 點</small></button>
      <span style="font-size:14px;color:var(--dim);line-height:1.5">${all ? '已全收集，重複功法會提升等級（上限 Lv5，滿級返還 40 點）' : `保底：再 ${left} 抽必出未擁有功法`}<br>機率　N 45% · R 33% · SR 17% · SSR 5%</span></div>
      <div class="body"><div class="gres">${this.gres || '<div style="grid-column:1/-1;color:var(--dim);padding:30px;text-align:center">【系統】請選擇抽取方式。分身擊敗敵人即可獲得點數。</div>'}</div></div>
      <div class="row"><button class="btn" data-act="close">返回安全屋<small>Esc</small></button><span style="margin-left:auto;color:var(--dim);font-size:14px">已習得 ${ownedCount()} / ${ALL_SKILLS.length + 1}</span></div>`);
  },
  doDraw(n) {
    const cost = n === 10 ? 900 : 100; if (S.points < cost) return; S.points -= cost;
    const res = []; for (let i = 0; i < n; i++) res.push(drawOne());
    save(); const best = res.reduce((m, r) => Math.max(m, ['N', 'R', 'SR', 'SSR'].indexOf(SKILLS[r.id].rar)), 0);
    sfx(best >= 3 ? 'ssr' : 'gacha');
    this.gres = res.map((r, i) => { const s = SKILLS[r.id]; return `<div class="card gcard ${s.rar}" style="animation-delay:${i * 0.08}s">
      ${r.isNew ? '<span class="badge-new">NEW</span>' : ''}<div class="glyph sch-${s.school}">${s.name[0]}</div><div class="nm">${s.name}</div>
      <span class="rar rar-${s.rar}">${s.rar}</span><div class="sm">${r.isNew ? '習得新功法！' : r.refund ? '已滿級，返還 40 點' : '功法等級 → Lv' + r.lvl}</div></div>`; }).join('');
    this.showGacha();
    if (allCollected() && !S.finale) setTimeout(() => toast('系統：全功法收集完成……偵測到異常高能反應。'), 600);
  },
  showSkills() {
    const cap = cloneCap(), eq = S.equipped.filter(id => S.owned[id]);
    const card = id => {
      const s = id === 'bunshin' ? BUNSHIN : SKILLS[id], lv = S.owned[id];
      if (!lv) return `<div class="card locked"><div class="glyph" style="background:#2a2438;color:#566c86">？</div><div class="nm">？？？</div><span class="rar rar-${s.rar}">${s.rar}</span><div class="sm">尚未習得</div></div>`;
      const isEq = eq.includes(id), act = id === 'bunshin' ? '' : `data-act="eq:${id}"`;
      return `<div class="card ${isEq ? 'eq' : ''}" ${act}>${isEq ? `<span class="badge-eq">出戰${cap > 1 ? ' ' + (eq.indexOf(id) + 1) : ''}</span>` : ''}
        <div class="glyph sch-${s.school}">${s.name[0]}</div><div class="nm">${s.name}</div>
        <div><span class="rar rar-${s.rar}">${s.rar}</span> <span class="sm">${s.school === '武' ? '武道' : s.school === '魔' ? '魔法' : '本體專屬'} · Lv${lv}</span></div><div class="sm">${s.desc}</div></div>`;
    };
    this.openModal(`<h2>功法閣<span class="r">${ownedCount()} / ${ALL_SKILLS.length + 1}</span></h2>
      <div style="font-size:14px;color:var(--dim)">點擊功法讓分身學習。分身術的限制：一個分身只能學一本。${cap > 1 ? '二周目可同時派出 3 名分身，最多選 3 本。' : ''}功法流派（武道／魔法）會決定武器 Lv3 的超凡用法。</div>
      <div class="body"><div class="grid">${['bunshin', ...ALL_SKILLS].map(card).join('')}</div></div>
      <div class="row"><button class="btn" data-act="close">返回安全屋<small>Esc</small></button></div>`);
  },
  equip(id) {
    const cap = cloneCap(); let eq = S.equipped.filter(x => S.owned[x]);
    if (eq.includes(id)) { if (cap > 1) eq = eq.filter(x => x !== id); }
    else if (cap === 1) eq = [id]; else { eq.push(id); if (eq.length > cap) eq.shift(); }
    S.equipped = eq; save(); const sc = this.panel; this.showSkills(); this.panel = sc;
  },
  showLog() {
    this.openModal(`<h2>系統日誌</h2><div class="body" style="font-size:16px;line-height:1.75;color:var(--ink)">
      <p style="margin:0 0 8px"><b style="color:var(--cyan)">【宿主檔案】</b>穿越者。在這個魔法、武道與賽博義體並存的未知時代，所有人都視他為「劣等產物」。求生慾望：極強。出門意願：零。</p>
      <p style="margin:0 0 8px"><b style="color:var(--cyan)">【絕對安全屋】</b>藏在兩棟廢棄霓虹大樓之間的灰色方塊水泥屋。鐵門七道鎖，屋頂一根歪掉的天線，外牆罩著只有宿主看得見的系統屏障，失控者會視而不見地走過。</p>
      <p style="margin:0 0 8px"><b style="color:var(--cyan)">【分身術】</b>分身擁有本體部分實力，但只能學習一本功法。分身倒下只會消散，本體毫髮無傷。所以本體絕對不出門。</p>
      <p style="margin:0 0 8px"><b style="color:var(--cyan)">【武器】</b>分身會在野外撿到武器，最多 5 把。武器升到 Lv3 時，依分身功法流派覺醒超凡用法：<span style="color:#ffb08a">武道</span>偏向近身與範圍，<span style="color:#c9b6ff">魔法</span>偏向法術與遠程。</p>
      <p style="margin:0 0 8px"><b style="color:var(--gold)">【手搓機甲】</b>出擊中每次升級，系統都有機會隨機附贈一個機甲部件（V字頭部、裝甲軀幹、肩甲左臂、臂炮右臂、動力腿、核心爐），不用選、也不會中斷。撐到六件到齊，分身就會當場手搓出機甲「怕死一號」：飛彈齊射、臂炮光束、踏步震地，還有 360 度掃射的必殺「天穹貫日炮」。學會《天工開物》的分身，部件出現機率大幅提升。</p>
      <p style="margin:0 0 8px"><b style="color:var(--pink)">【傳聞】</b>據說習得全部功法的人，會引起「世界首腦」的注意……</p>
      <p style="margin:0;color:var(--dim)">累計抽取 ${S.draws} 次 · 手搓機甲 ${S.mechs} 台 · ${S.finale ? '一周目已通關' : '一周目進行中'}</p></div>
      <div class="row"><button class="btn" data-act="close">返回<small>Esc</small></button><button class="btn" data-act="replay">重看開場</button>${S.finale ? '<button class="btn gold" data-act="replayEnd">重看結局</button>' : ''}<button class="btn" data-act="reset" style="margin-left:auto">清除存檔</button></div>`);
  },
  update(dt) {
    this.qt -= dt;
    if (this.qt <= 0 && !this.panel) { this.qt = 6; const q = $('#quip'); if (q) { q.textContent = pick(S.ng ? QUIPS_NG : QUIPS); q.style.display = 'block'; setTimeout(() => { if (q) q.style.display = 'none'; }, 3500); } }
  },
  draw() { drawSafehouse(ctx, sceneT, { ng: S.ng > 0, owned: ownedCount(), mechs: S.mechs }); },
};
function drawOne() {
  S.draws++; S.pity++;
  const unowned = ALL_SKILLS.filter(i => !S.owned[i]); let id;
  if (S.pity >= 10 && unowned.length) id = pick(unowned);
  else { let r = Math.random() * 100, rar = 'N'; for (const k of ['SSR', 'SR', 'R', 'N']) { r -= RAR_W[k]; if (r < 0) { rar = k; break; } } id = pick(ALL_SKILLS.filter(i => SKILLS[i].rar === rar)); }
  const isNew = !S.owned[id]; let refund = false;
  if (isNew) { S.owned[id] = 1; S.pity = 0; } else if (S.owned[id] < 5) S.owned[id]++; else { S.points += 40; refund = true; }
  if (!S.equipped.filter(x => S.owned[x]).length) S.equipped = [id];
  return { id, isNew, lvl: S.owned[id], refund };
}
const fmtT = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// =====================================================================
//  出擊（無限捲軸生存）
// =====================================================================
let RN = null;
const E_CAP = 300;
const need = l => Math.floor(5 + l * 3 + l * l * 0.25);
let NEXT_ID = 1;

function newRun(mode) {
  const p = { x: 0, y: 0, r: 6, hp: 100, maxhp: 100, spd: 64, dir: { x: 1, y: 0 }, face: false, inv: 0, mech: false, anim: 0, moving: false, spdSkill: 1, drSkill: 0, leader: true };
  RN = {
    mode, ng: S.ng > 0 && mode === 'normal', t: 0, kills: 0, elites: 0, level: 1, xp: 0, need: need(1), lvCount: 0, pendingLv: 0,
    p, stats: { dmg: 1, cd: 1, magnet: 36, spd: 1, armor: 0, regen: 0 },
    enemies: [], proj: [], ebul: [], zones: [], fx: [], parts: [], picks: [], texts: [], timers: [],
    casters: [], comps: [], weapons: [], skillBonus: 0, mechParts: [], mechAnim: null, mechSweep: null,
    spawnAcc: 0, crateT: 7, eliteT: 45, waveT: 60, shake: 0, paused: false, over: false, freezeT: 0, cam: { x: 0, y: -10 }, fist: { cd: 0 }, mechSt: { m: 0, l: 2, st: 0, sw: 5 },
    boss: null, ultReady: false, ultUsed: false, ts: 1, hudT: 0, hudDirty: true, school: null,
  };
}
function startRun() {
  newRun('normal');
  let eq = S.equipped.filter(id => S.owned[id]).slice(0, cloneCap());
  if (RN.ng) { const rest = ALL_SKILLS.filter(id => S.owned[id] && !eq.includes(id)); while (eq.length < 3 && rest.length) eq.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]); }
  eq.forEach((id, i) => {
    let ent = RN.p;
    if (i > 0) { ent = { x: rand(-20, 20), y: rand(-20, 20), dir: { x: 1, y: 0 }, face: false, anim: 0, moving: false, comp: true, slot: i }; RN.comps.push(ent); }
    RN.casters.push({ ent, id, st: {} });
  });
  RN.school = eq.length ? (SKILLS[eq[0]].school === '武' ? 'martial' : 'magic') : null;
  S.runs++; save();
  go(RunScene);
}
function startBoss() {
  newRun('boss');
  const p = RN.p; p.hp = p.maxhp = 9999; RN.stats.dmg = 3; RN.school = 'martial';
  ALL_SKILLS.forEach(id => RN.casters.push({ ent: p, id, st: {} }));
  RN.boss = { boss: true, id: NEXT_ID++, type: 'boss', x: 0, y: -110, r: 34, h: 60, hp: 120000, maxhp: 120000, flash: 0, anim: 0, kx: 0, ky: 0, atk: 2.5, pat: 0, laser: null };
  RN.enemies.push(RN.boss);
  go(RunScene);
}
const skillLv = c => RN.mode === 'boss' ? 7 : Math.min(9, (S.owned[c.id] || 1) + RN.skillBonus);
const hasSkill = id => RN.casters.some(c => c.id === id);

// ---------- 輔助 ----------
const GC = 24, GW = 48, GH = 32; let GRID = [];
function buildGrid() {
  GRID = new Array(GW * GH); const ox = RN.cam.x - GW * GC / 2, oy = RN.cam.y - GH * GC / 2;
  for (const e of RN.enemies) { if (e.dead || e.boss) continue; const gx = Math.floor((e.x - ox) / GC), gy = Math.floor((e.y - oy) / GC); e.gx = gx; e.gy = gy; if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue; const k = gy * GW + gx; (GRID[k] || (GRID[k] = [])).push(e); }
}
function query(x, y, r, cb) {
  const ox = RN.cam.x - GW * GC / 2, oy = RN.cam.y - GH * GC / 2; const pad = r + 40;
  const x0 = Math.max(0, Math.floor((x - pad - ox) / GC)), x1 = Math.min(GW - 1, Math.floor((x + pad - ox) / GC));
  const y0 = Math.max(0, Math.floor((y - pad - oy) / GC)), y1 = Math.min(GH - 1, Math.floor((y + pad - oy) / GC));
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) { const c = GRID[gy * GW + gx]; if (c) for (const e of c) if (!e.dead && cb(e) === false) return; }
  if (RN.boss && !RN.boss.dead) { const b = RN.boss; if (Math.hypot(b.x - x, b.y - y) < r + b.r + 60) cb(b); }
}
function nearest(x, y, maxR = 400) { let best = null, bd = maxR * maxR; for (const e of RN.enemies) { if (e.dead) continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; best = e; } } return best; }
const onScreen = (e, m = 0) => Math.abs(e.x - RN.cam.x) < W / 2 + m && Math.abs(e.y - RN.cam.y) < H / 2 + m;
function randomEnemy() { const a = RN.enemies.filter(e => !e.dead && onScreen(e)); return a.length ? pick(a) : null; }
function aim(o, t) { if (!t) return { x: o.dir.x, y: o.dir.y }; const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d }; }
function shoot(o) { const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, r: 3, dmg: 5, life: 1, pierce: 0, kind: 'orb', kb: 40, rehit: 0, t: 0 }, o); p.hits = new Map(); RN.proj.push(p); return p; }
function zone(o) { const z = Object.assign({ x: 0, y: 0, r: 20, dmg: 0, tick: 0.5, tt: 0, life: 1, t: 0, kind: 'rune', slow: 0, pull: 0, kb: 0, once: false }, o); z.max = z.life; if (z.once) z.hitset = new Set(); RN.zones.push(z); return z; }
function fx(o) { const f = Object.assign({ t: 0, life: 0.3 }, o); RN.fx.push(f); return f; }
function later(t, fn) { RN.timers.push({ t, fn }); }
function burst(x, y, cols, n = 8, spd = 50, life = 0.5, s = 1) {
  if (RN.parts.length > 700) n = Math.min(n, 2);
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = spd * (0.3 + Math.random()); RN.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: life * (0.6 + Math.random() * 0.6), max: life, col: pick(cols), s }); }
}
function areaHit(x, y, r, dmg, kb = 0, slow = 0) { query(x, y, r, e => { const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1; if (d < r + e.r) { hurt(e, dmg, dx / d * kb, dy / d * kb); if (slow) e.slowT = slow; } }); }
function lineHit(x0, y0, dx, dy, len, w, dmg, kb = 0) { query(x0 + dx * len / 2, y0 + dy * len / 2, len / 2 + w, e => { const t = (e.x - x0) * dx + (e.y - y0) * dy; if (t < -e.r || t > len + e.r) return; const pd = Math.abs((e.x - x0) * dy - (e.y - y0) * dx); if (pd < w + e.r) hurt(e, dmg, dx * kb, dy * kb); }); }
function arcHit(x, y, r, ang, half, dmg, kb) { query(x, y, r, e => { const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1; if (d > r + e.r) return; let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) < half || d < 10) hurt(e, dmg, dx / d * kb, dy / d * kb); }); }

function hurt(e, dmg, kx = 0, ky = 0) {
  if (e.dead) return; if (RN.freezeT > 0) dmg *= 1.5;
  dmg = Math.max(1, Math.round(dmg * (0.9 + Math.random() * 0.2)));
  e.hp -= dmg; if (!e.boss || e.flash < -0.25) e.flash = e.boss ? 0.05 : 0.08;
  if (!e.boss) { const m = e.elite ? 0.25 : e.type === 'brute' ? 0.5 : 1; e.kx += kx * m; e.ky += ky * m; }
  if (RN.texts.length < 70 && (dmg >= 8 || Math.random() < 0.5)) RN.texts.push({ x: e.x + rand(-4, 4), y: e.y - (e.h || 12) / 2 - 2, n: dmg, t: 0, col: dmg >= 100 ? '#ffcd4a' : dmg >= 40 ? '#ffa300' : '#f4f4f4' });
  sfx('hit');
  if (e.hp <= 0) kill(e);
}
function kill(e) {
  e.dead = true;
  if (e.boss) { bossDown(e); return; }
  RN.kills++;
  burst(e.x, e.y, ['#73eff7', '#f4f4f4', '#ff77a8', '#41a6f6', '#a46be0'], e.elite ? 30 : 7, e.elite ? 90 : 55, 0.55, e.elite ? 2 : 1);
  fx({ kind: 'pop', x: e.x, y: e.y, r: e.r + 3, life: 0.22 });
  sfx('kill');
  if (RN.mode === 'boss') return;
  RN.picks.push({ kind: 'xp', x: e.x, y: e.y, val: e.xp, t: 0 });
  if (Math.random() < 0.012) RN.picks.push({ kind: 'heal', x: e.x + 4, y: e.y, t: 0 });
  if (Math.random() < 0.0035) RN.picks.push({ kind: 'magnet', x: e.x - 4, y: e.y, t: 0 });
  if (e.elite) { RN.elites++; RN.picks.push({ kind: 'crate', x: e.x, y: e.y, t: 0 }); }
}
function hurtPlayer(d) {
  const p = RN.p; if (p.inv > 0 || RN.over) return;
  if (RN.mechAnim) return;
  if (p.dodge && Math.random() < p.dodge) { p.inv = 0.3; fx({ kind: 'ring', x: p.x, y: p.y, r: 12, col: '#c9b6ff', life: 0.25 }); burst(p.x, p.y, ['#c9b6ff', '#f4f4f4', '#73eff7'], 6, 60, 0.35); return; } // 鏡花水月：閃避
  const dr = Math.min(0.75, RN.stats.armor + p.drSkill + (p.mech ? 0.3 : 0));
  p.hp -= d * (1 - dr); p.inv = 0.45; RN.shake = Math.max(RN.shake, 3); sfx('hurt');
  burst(p.x, p.y, ['#73eff7', '#c9fff6'], 6, 50, 0.4);
  if (RN.mode === 'boss') p.hp = Math.max(p.hp, p.maxhp * 0.5);
  else if (p.hp <= 0) { p.hp = 0; endRun('down'); }
}

// ---------- 功法 ----------
const SK = {
  taiji(c, L, dt, M) {
    const o = c.ent, st = c.st, n = 2 + Math.floor(L / 2), rad = 28 + L * 2; st.a = (st.a || 0) + dt * (2.6 + 0.15 * L);
    if (!st.orbs || st.orbs.length !== n) { (st.orbs || []).forEach(p => p.life = 0); st.orbs = []; for (let i = 0; i < n; i++) st.orbs.push(shoot({ kind: 'yinyang', r: 7, life: 1e9, pierce: 1e9, rehit: 0.45, kb: 150 })); }
    st.orbs.forEach((p, i) => { const a = st.a + i * TAU / n; p.x = o.x + Math.cos(a) * rad; p.y = o.y + Math.sin(a) * rad; p.dmg = (7 + 3 * L) * M.dmg; p.life = 1e9; });
  },
  xianglong(c, L, dt, M) {
    const o = c.ent, st = c.st; st.cd = (st.cd || 0) - dt; if (st.cd > 0) return; st.cd = 1.8 * M.cd;
    const a = aim(o, nearest(o.x, o.y, 220)); const fire = s => shoot({ x: o.x, y: o.y, vx: a.x * 170 * s, vy: a.y * 170 * s, r: 10, dmg: (28 + 10 * L) * M.dmg, life: 1.3, pierce: 1e9, kind: 'dragon', kb: 110 });
    fire(1); if (L >= 4) fire(-1); sfx('roar');
  },
  jifeng(c, L, dt, M) {
    const o = c.ent, st = c.st; if (o.leader) o.spdSkill = 1.25 + 0.03 * L;
    st.tt = (st.tt || 0) - dt; if (st.tt <= 0 && o.moving) { st.tt = 0.11; zone({ x: o.x, y: o.y, r: 9, dmg: (4 + 2 * L) * M.dmg, tick: 0.3, life: 0.8, kind: 'after', face: o.face }); }
    st.cd = (st.cd || 0) - dt; if (st.cd <= 0) { st.cd = 2.8 * M.cd; const n = 6 + L; for (let i = 0; i < n; i++) { const a = i / n * TAU; shoot({ x: o.x, y: o.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 5, dmg: (6 + 2 * L) * M.dmg, life: 0.45, pierce: 2, kind: 'wind', ang: a }); } }
  },
  jinzhong(c, L, dt, M) {
    const o = c.ent, st = c.st; if (o.leader) o.drSkill = 0.22 + 0.04 * L; st.bell = 30 + 3 * L;
    st.cd = (st.cd || 0) - dt; if (st.cd > 0) return; st.cd = 0.6;
    areaHit(o.x, o.y, st.bell, (5 + 2 * L) * M.dmg, 90); fx({ kind: 'ring', x: o.x, y: o.y, r: st.bell, col: '#ffcd4a', life: 0.25 });
  },
  wanjian(c, L, dt, M) {
    const o = c.ent, st = c.st; st.cd = (st.cd || 0) - dt; if (st.cd > 0) return; st.cd = 2.2 * M.cd;
    const n = 3 + L; for (let i = 0; i < n; i++) { const a = i / n * TAU; shoot({ x: o.x + Math.cos(a) * 16, y: o.y + Math.sin(a) * 16, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, r: 4, dmg: (14 + 5 * L) * M.dmg, life: 2.2, pierce: 2, kind: 'sword', home: 7, spd: 220, delay: 0.25 }); }
  },
  shihou(c, L, dt, M) {
    const o = c.ent, st = c.st; st.cd = (st.cd || 0) - dt; if (st.cd > 0) return; st.cd = Math.max(1.2, 2.6 - 0.12 * L) * M.cd;
    zone({ x: o.x, y: o.y, r: 4, r0: 4, r1: 70 + 8 * L, dur: 0.45, once: true, dmg: (12 + 5 * L) * M.dmg, kb: 200, life: 0.5, kind: 'roar' }); RN.shake = Math.max(RN.shake, 2); sfx('roar');
  },
  tiangong(c, L, dt, M) {
    const o = c.ent, st = c.st; st.cd = (st.cd || 0) - dt; if (st.cd > 0) return; st.cd = 1.6 * M.cd;
    const a = aim(o, nearest(o.x, o.y, 240)); shoot({ x: o.x, y: o.y, vx: a.x * 200, vy: a.y * 200, r: 5, dmg: (10 + 4 * L) * M.dmg, life: 1.2, pierce: 3, kind: 'gear' });
  },
  jinghua(c, L, dt, M) { // 鏡花水月：閃身穿梭、鏡像、鏡界
    const o = c.ent, st = c.st;
    if (o.leader) o.dodge = Math.min(0.6, 0.25 + 0.03 * L);
    if (st.dash) {
      const d = st.dash; d.t += dt; const k = Math.min(1, d.t / d.dur);
      o.x = d.x0 + (d.x1 - d.x0) * k; o.y = d.y0 + (d.y1 - d.y0) * k; if (o.leader) o.inv = Math.max(o.inv, 0.35);
      RN.parts.push({ x: o.x + rand(-3, 3), y: o.y + rand(-6, 4), vx: 0, vy: 0, life: 0.35, max: 0.35, col: pick(['#c9b6ff', '#73eff7', '#f4f4f4']), s: 1 });
      if (k >= 1) st.dash = null;
    }
    st.realm = Math.max(0, (st.realm || 0) - dt);
    if (st.realm > 0 && o.leader) o.inv = Math.max(o.inv, 0.1);
    st.cd = (st.cd === undefined ? 0.8 : st.cd) - dt; st.ult = (st.ult === undefined ? 6 : st.ult) - dt;
    if (st.ult <= 0 && nearest(o.x, o.y, 200)) {
      st.ult = Math.max(7, 12 - 0.5 * L) * M.cd; st.realm = 2.5 + 0.2 * L; st.cd = 0;
      fx({ kind: 'mirror', x: o.x, y: o.y, life: 0.5 }); sfx('freeze');
    }
    if (st.dash || st.cd > 0) return;
    const realm = st.realm > 0;
    if (!st.chain) { if (!realm && !nearest(o.x, o.y, 220)) return; st.chain = realm ? 1 : 2 + Math.floor(L / 3); }
    // 朝遠一點的敵人位移：在 70~280 範圍內隨機挑，越遠越容易被選中
    let t = null, best = -1;
    for (const e of RN.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - o.x, e.y - o.y); if (d < 50 || d > 280) continue; const sc = d * Math.random(); if (sc > best) { best = sc; t = e; } }
    if (!t) t = nearest(o.x, o.y, 220);
    if (!t) { st.chain = 0; st.cd = 0.4; return; }
    st.chain--;
    st.cd = st.chain > 0 ? 0.04 : (realm ? 0.08 : Math.max(0.9, 2 - 0.08 * L) * M.cd);
    const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, len = Math.min(d + 34, 300);
    const dmg = (18 + 6 * L) * M.dmg * (realm ? 1.3 : 1), gx = o.x, gy = o.y, face = o.face;
    lineHit(o.x, o.y, ux, uy, len, 12, dmg, 80);
    zone({ x: gx, y: gy, r: 10, life: 0.4, kind: 'mirrorimg', face });
    later(0.28, () => { areaHit(gx, gy, 26, dmg * 0.8, 70); fx({ kind: 'shards', x: gx, y: gy, life: 0.35 }); burst(gx, gy, ['#c9b6ff', '#f4f4f4', '#73eff7'], 8, 70, 0.4); });
    st.dash = { x0: o.x, y0: o.y, x1: o.x + ux * len, y1: o.y + uy * len, t: 0, dur: Math.max(0.05, len / 2600) };
    fx({ kind: 'dashline', x: o.x, y: o.y, dx: ux, dy: uy, len, life: 0.35 });
    if (o.leader) RN.camLag = 0.8; // 攝影機故意跟不上
    o.face = ux < 0; sfx('slash');
  },
  fireball(c, L, dt, M) {
    const o = c.ent, st = c.st; st.cd = (st.cd || 0) - dt; if (st.cd > 0) return; st.cd = 0.95 * M.cd;
    const n = L >= 5 ? 2 : 1; for (let i = 0; i < n; i++) {
      const t = i ? randomEnemy() : nearest(o.x, o.y, 260); if (!t) return; const a = aim(o, t);
      shoot({ x: o.x, y: o.y, vx: a.x * 180, vy: a.y * 180, r: 4, dmg: (12 + 4 * L) * M.dmg, life: 2, kind: 'fire', boom: 18 + 2 * L });
    } sfx('shoot');
  },
  arcane(c, L, dt, M) {
    const o = c.ent, st = c.st; st.cd = (st.cd || 0) - dt; if (st.cd > 0) return; st.cd = 1.15 * M.cd;
    if (!nearest(o.x, o.y, 300)) return; const n = 3 + Math.floor(L / 2);
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU; shoot({ x: o.x, y: o.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, r: 3, dmg: (8 + 3 * L) * M.dmg, life: 2.5, kind: 'arcane', home: 9, spd: 170 }); }
  },
  frost(c, L, dt, M) {
    const o = c.ent, st = c.st; st.cd = (st.cd || 0) - dt; if (st.cd > 0) return; st.cd = 3.2 * M.cd;
    zone({ x: o.x, y: o.y, r: 4, r0: 4, r1: 60 + 6 * L, dur: 0.35, once: true, dmg: (8 + 3 * L) * M.dmg, slow: 2.2, life: 0.55, kind: 'frost' }); sfx('freeze');
  },
  chain(c, L, dt, M) {
    const o = c.ent, st = c.st; st.cd = (st.cd || 0) - dt; if (st.cd > 0) return;
    let t = nearest(o.x, o.y, 160); if (!t) return; st.cd = 1.4 * M.cd;
    const pts = [[o.x, o.y]], hit = new Set(); let cur = t;
    for (let j = 0; j < 3 + L && cur; j++) { hit.add(cur); pts.push([cur.x, cur.y]); hurt(cur, (16 + 5 * L) * M.dmg); let nx = null, bd = 85 * 85; for (const e of RN.enemies) { if (e.dead || hit.has(e)) continue; const d = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2; if (d < bd) { bd = d; nx = e; } } cur = nx; }
    fx({ kind: 'bolt', pts, life: 0.22 }); sfx('zap');
  },
  meteor(c, L, dt, M) {
    const o = c.ent, st = c.st; st.cd = (st.cd || 0) - dt; if (st.cd > 0) return; st.cd = Math.max(1.4, 2.6 - 0.1 * L) * M.cd;
    const n = 1 + Math.ceil(L / 2);
    for (let i = 0; i < n; i++) { const t = randomEnemy(); const x = t ? t.x : o.x + rand(-120, 120), y = t ? t.y : o.y + rand(-80, 80); const r = 28 + 3 * L, d = (50 + 15 * L) * M.dmg;
      fx({ kind: 'warn', x, y, r, life: 0.6 }); later(0.6, () => { areaHit(x, y, r, d, 120); fx({ kind: 'boom', x, y, r, life: 0.4 }); burst(x, y, ['#ffa300', '#ffec27', '#f4f4f4'], 14, 80, 0.5); RN.shake = Math.max(RN.shake, 4); sfx('boom'); }); }
  },
  timestop(c, L, dt, M) {
    const o = c.ent, st = c.st; st.cd = (st.cd === undefined ? 3 : st.cd) - dt; if (st.cd > 0) return; st.cd = Math.max(5, 11 - 0.6 * L) * M.cd;
    RN.freezeT = 2 + 0.3 * L; for (const e of RN.enemies) if (!e.dead && onScreen(e, 20)) hurt(e, (10 + 5 * L) * M.dmg);
    fx({ kind: 'clock', x: o.x, y: o.y, r: 60, life: 0.8 }); sfx('freeze');
  },
};

// ---------- 武器 ----------
function wName(w) { const d = WEAPONS[w.id]; if (w.lvl >= 3 && RN.school) return d[RN.school].name; return d.name; }
const WP = {
  blade(w, o, dt, M, tr) {
    const L = w.lvl, d = (14 + 6 * L) * M.wdmg, a = aim(o, nearest(o.x, o.y, 120)), ang = Math.atan2(a.y, a.x);
    if (tr === 'martial') { const r = 44 + 4 * L; areaHit(o.x, o.y, r, d * 1.15, 90); fx({ kind: 'whirl', x: o.x, y: o.y, r, life: 0.28 }); }
    else { const r = 38 + 2 * L; arcHit(o.x, o.y, r, ang, 1.15, d, 90); fx({ kind: 'slash', x: o.x, y: o.y, r, ang, life: 0.2 });
      if (tr === 'magic') for (const s of [-0.28, 0.28]) shoot({ x: o.x, y: o.y, vx: Math.cos(ang + s) * 190, vy: Math.sin(ang + s) * 190, r: 7, dmg: (10 + 4 * L) * M.wdmg, life: 1, pierce: 1e9, kind: 'crescent', ang: ang + s }); }
    sfx('slash'); return 1.1;
  },
  spear(w, o, dt, M, tr) {
    const L = w.lvl, d = (16 + 6 * L) * M.wdmg, a = aim(o, nearest(o.x, o.y, 160)), ang = Math.atan2(a.y, a.x);
    if (tr === 'magic') { shoot({ x: o.x, y: o.y, vx: a.x * 330, vy: a.y * 330, r: 5, dmg: (30 + 8 * L) * M.wdmg, life: 1.1, pierce: 1e9, kind: 'javelin' }); sfx('zap'); return 1.2; }
    const shots = tr === 'martial' ? [-0.6, -0.3, 0, 0.3, 0.6] : [0]; const len = (tr === 'martial' ? 72 : 60) + 5 * L;
    for (const s of shots) { const dx = Math.cos(ang + s), dy = Math.sin(ang + s); lineHit(o.x, o.y, dx, dy, len, 5, d, 70); fx({ kind: 'thrust', x: o.x, y: o.y, dx, dy, len, life: 0.18 }); }
    sfx('slash'); return 1.3;
  },
  bow(w, o, dt, M, tr) {
    const L = w.lvl, t = nearest(o.x, o.y, 300); if (!t) return 0.2; const a = aim(o, t), d = (10 + 4 * L) * M.wdmg;
    if (tr === 'martial') { for (const s of [-0.15, 0, 0.15]) { const c = Math.cos(s), sn = Math.sin(s); const vx = a.x * c - a.y * sn, vy = a.x * sn + a.y * c; shoot({ x: o.x, y: o.y, vx: vx * 300, vy: vy * 300, r: 5, dmg: d * 1.3, life: 1.2, pierce: 1e9, kind: 'bigarrow' }); } }
    else shoot({ x: o.x, y: o.y, vx: a.x * 270, vy: a.y * 270, r: 3, dmg: d, life: 1.2, pierce: 1, kind: 'arrow', split: tr === 'magic' ? (6 + 3 * L) * M.wdmg : 0 });
    sfx('shoot'); return 0.8;
  },
  fan(w, o, dt, M, tr) {
    const L = w.lvl, a = aim(o, nearest(o.x, o.y, 200)), d = (9 + 4 * L) * M.wdmg;
    const mk = s => shoot({ x: o.x, y: o.y, vx: a.x * 210 * s, vy: a.y * 210 * s, r: tr === 'martial' ? 9 : 7, dmg: d, life: 3, pierce: 1e9, rehit: 0.35, kind: 'fan', boomer: true, owner: o, out: 0.5, spd: 230, torn: tr === 'magic' ? (4 + 2 * L) * M.wdmg : 0 });
    mk(1); if (tr === 'martial') mk(-1); return 1.6;
  },
  laser(w, o, dt, M, tr) {
    const L = w.lvl, t = nearest(o.x, o.y, 260), a = aim(o, t);
    if (tr === 'martial') { w.st.burst = 6; return 1.3; }
    if (tr === 'magic') { lineHit(o.x, o.y, a.x, a.y, 300, 10, (30 + 10 * L) * M.wdmg, 60); fx({ kind: 'beam', x: o.x, y: o.y, dx: a.x, dy: a.y, len: 300, w: 10, col: '#c06cf0', life: 0.3 }); RN.shake = Math.max(RN.shake, 2); sfx('zap'); return 2; }
    lineHit(o.x, o.y, a.x, a.y, 130, 3, (12 + 4 * L) * M.wdmg, 20); fx({ kind: 'beam', x: o.x, y: o.y, dx: a.x, dy: a.y, len: 130, w: 3, col: '#ff3860', life: 0.12 }); sfx('zap'); return 1;
  },
  hammer(w, o, dt, M, tr) {
    const L = w.lvl, r = 40 + 4 * L, d = (20 + 8 * L) * M.wdmg;
    areaHit(o.x, o.y, r, d, 160); fx({ kind: 'shock', x: o.x, y: o.y, r, life: 0.35 }); RN.shake = Math.max(RN.shake, 3); sfx('boom');
    if (tr === 'magic') zone({ x: o.x, y: o.y, r: 34 + 3 * L, dmg: (5 + 2 * L) * M.wdmg, tick: 0.4, life: 2.2, kind: 'rune' });
    if (tr === 'martial') for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; shoot({ x: o.x, y: o.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, r: 7, dmg: d * 0.6, life: 0.7, pierce: 1e9, kind: 'wave', ang: a }); }
    return 2.4;
  },
};
function giveWeapon(id) {
  const w = RN.weapons.find(x => x.id === id);
  if (w) { if (w.lvl < 5) { w.lvl++; if (w.lvl === 3 && RN.school) { banner('超凡覺醒！', '#73eff7'); toast(`${WEAPONS[id].name} → 《${WEAPONS[id][RN.school].name}》${WEAPONS[id][RN.school].desc}`); } else toast(`${wName(w)} 升級 Lv${w.lvl}`); } else { gainXp(15); toast(`${wName(w)} 已滿級，轉化為經驗`); } }
  else if (RN.weapons.length < 5) { RN.weapons.push({ id, lvl: 1, st: { cd: 0.3 } }); toast(`撿到武器：${WEAPONS[id].name}`); }
  else { gainXp(20); toast('武器欄已滿，拆解為經驗'); }
  RN.hudDirty = true; sfx('pick');
}

// ---------- 升級 ----------
function gainXp(v) {
  if (RN.mode === 'boss') return; RN.xp += v;
  while (RN.xp >= RN.need) { RN.xp -= RN.need; RN.level++; RN.need = need(RN.level); RN.pendingLv++; }
  if (RN.pendingLv > 0 && !RN.lvUI && !RN.over) openLevelUp();
}
const STAT_OPTS = [
  { k: 'hp', t: '生命上限 +25', d: '分身更耐打，並回復 25 生命。', ok: () => true, f: () => { RN.p.maxhp += 25; RN.p.hp += 25; } },
  { k: 'spd', t: '移動速度 +10%', d: '跑得快，才不會被抓到。', ok: () => RN.stats.spd < 1.6, f: () => RN.stats.spd += 0.1 },
  { k: 'dmg', t: '傷害 +12%', d: '所有功法與武器傷害提升。', ok: () => true, f: () => RN.stats.dmg += 0.12 },
  { k: 'cd', t: '冷卻 -8%', d: '功法與武器更頻繁發動。', ok: () => RN.stats.cd > 0.55, f: () => RN.stats.cd *= 0.92 },
  { k: 'mag', t: '拾取範圍 +35%', d: '經驗結晶從更遠處飛來。', ok: () => RN.stats.magnet < 140, f: () => RN.stats.magnet *= 1.35 },
  { k: 'regen', t: '每秒回復 +0.6', d: '分身緩慢自我修復。', ok: () => RN.stats.regen < 4, f: () => RN.stats.regen += 0.6 },
  { k: 'armor', t: '減傷 +6%', d: '受到的傷害降低。', ok: () => RN.stats.armor < 0.4, f: () => RN.stats.armor += 0.06 },
];
function makeOptions() {
  const pool = [];
  for (const w of RN.weapons) if (w.lvl < 5) pool.push({ type: 'wup', w, wt: 2.2 });
  if (RN.weapons.length < 5) { const un = Object.keys(WEAPONS).filter(id => !RN.weapons.some(w => w.id === id)); if (un.length) pool.push({ type: 'wnew', id: pick(un), wt: 1.4 }); }
  if (RN.casters.length && RN.skillBonus < 4) pool.push({ type: 'skill', wt: 1.6 });
  for (const s of STAT_OPTS) if (s.ok()) pool.push({ type: 'stat', s, wt: 1 });
  const out = [];
  while (out.length < 3 && pool.length) { let tot = pool.reduce((a, b) => a + b.wt, 0), r = Math.random() * tot, i = 0; for (; i < pool.length - 1; i++) { r -= pool[i].wt; if (r < 0) break; } out.push(pool.splice(i, 1)[0]); }
  while (out.length < 3) out.push({ type: 'heal' });
  return out;
}
function optHTML(o, i) {
  let t = '', d = '', cls = '';
  if (o.type === 'wup') { const W2 = WEAPONS[o.w.id], nl = o.w.lvl + 1; t = `${wName(o.w)} Lv${nl}`; d = (nl === 3 && RN.school) ? `<span style="color:var(--cyan)">超凡覺醒 →《${W2[RN.school].name}》</span><br>${W2[RN.school].desc}` : (nl === 3 ? '升級武器。（分身沒有功法，無法覺醒超凡）' : '武器威力與範圍提升。'); }
  if (o.type === 'wnew') { const W2 = WEAPONS[o.id]; t = `新武器：${W2.name}`; d = W2.desc + (RN.school ? `<br><span style="color:var(--dim)">Lv3 超凡：${W2[RN.school].name}</span>` : ''); }
  if (o.type === 'skill') { const c = RN.casters[0]; t = `功法精進：${SKILLS[c.id].name}`; d = `本次出擊中功法等級 +1（目前 Lv${skillLv(c)}）。${RN.comps.length ? '所有分身同時精進。' : ''}`; }
  if (o.type === 'stat') { t = o.s.t; d = o.s.d; }
  if (o.type === 'heal') { t = '系統補給'; d = '回復全部生命。'; }
  const icon = o.type === 'wup' ? `<img src="${ICONS[WEAPONS[o.w.id].icon]}" style="width:36px;image-rendering:pixelated">` : o.type === 'wnew' ? `<img src="${ICONS[WEAPONS[o.id].icon]}" style="width:36px;image-rendering:pixelated">` : '';
  return `<button class="opt ${cls}" data-act="opt:${i}">${icon}<div class="ot">${t}</div><div class="od">${d}</div><div class="key">${TOUCH ? '點擊選擇' : '按 ' + (i + 1)}</div></button>`;
}
function openLevelUp() {
  RN.paused = true; RN.lvUI = true; RN.lvCount++; const n = RN.lvCount;
  const opts = makeOptions(); let partMsg = '';
  // 機甲部件：每次升級由系統隨機附贈（不必選擇、不會中斷），撐得越久越有機會集滿
  const missing = [0, 1, 2, 3, 4, 5].filter(i => !RN.mechParts.includes(i));
  if (!RN.p.mech && !RN.mechAnim && missing.length && Math.random() < (hasSkill('tiangong') ? 0.55 : 0.3)) {
    const part = pick(missing); RN.mechParts.push(part); RN.hudDirty = true;
    partMsg = `<div style="color:var(--gold);font-size:19px;text-shadow:2px 2px 0 #14101e">【系統附贈】機甲部件「${MECH_PARTS[part]}」（${RN.mechParts.length}/6）${RN.mechParts.length >= 6 ? '　部件到齊，準備手搓！' : ''}</div>`;
  }
  RN.opts = opts; sfx('lvl');
  const d = document.createElement('div'); d.className = 'lvl'; d.id = 'lvlui';
  d.innerHTML = `<h3>升級！Lv ${RN.level - RN.pendingLv + 1}</h3>${partMsg}<div class="opts">${opts.map(optHTML).join('')}</div>`;
  UI.appendChild(d);
}
function chooseOpt(i) {
  const o = RN.opts && RN.opts[i]; if (!o) return;
  if (o.type === 'wup') giveWeapon(o.w.id);
  if (o.type === 'wnew') giveWeapon(o.id);
  if (o.type === 'skill') { RN.skillBonus++; toast('功法精進！'); }
  if (o.type === 'stat') o.s.f();
  if (o.type === 'heal') RN.p.hp = RN.p.maxhp;
  RN.hudDirty = true; RN.opts = null; RN.lvUI = false; const el = $('#lvlui'); if (el) el.remove();
  RN.pendingLv--; if (RN.pendingLv > 0) openLevelUp(); else { RN.paused = false; if (RN.mechParts.length >= 6 && !RN.p.mech && !RN.mechAnim) startMechBuild(); }
}
// 手搓機甲：六個部件從四面八方飛來組裝
function startMechBuild() {
  const p = RN.p; RN.mechAnim = { t: 0 }; RN.ts = 0.35; RN.freezeT = Math.max(RN.freezeT, 2.5); p.inv = 3;
  banner('手搓機甲', '#ffcd4a'); sfx('mech');
}
function finishMech() {
  const p = RN.p; RN.mechAnim = null; RN.ts = 1;
  p.mech = true; p.maxhp += 200; p.hp = p.maxhp; S.mechs++; save(); RN.hudDirty = true;
  banner('怕死一號・出擊！', '#73eff7'); sfx('boom'); sfx('mech'); RN.shake = 9;
  fx({ kind: 'flash', life: 0.5 }); fx({ kind: 'shock', x: p.x, y: p.y, r: 150, life: 0.6 }); fx({ kind: 'shock', x: p.x, y: p.y, r: 90, life: 0.45 });
  burst(p.x, p.y, ['#ffcd4a', '#73eff7', '#f4f4f4', '#3b5dc9'], 80, 160, 1, 2);
  for (const e of RN.enemies) if (!e.dead && onScreen(e, 20)) { const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1; hurt(e, 300 * RN.stats.dmg, dx / d * 420, dy / d * 420); }
  setTimeout(() => toast('【系統】手搓完成。……宿主，這台其實比你本人還能打。'), 900);
}

// ---------- 生怪 ----------
function spawnEnemy(type, elite = false, ang) {
  const d = ENEMY[type], p = RN.p, a = ang === undefined ? Math.random() * TAU : ang, t = RN.t;
  const hpMul = (1 + t / 70 + (t / 300) ** 2) * (RN.ng ? 1.8 : 1) * (elite ? 14 : 1);
  const e = { id: NEXT_ID++, type, spr: d.spr, x: p.x + Math.cos(a) * 290, y: p.y + Math.sin(a) * 190, r: d.r * (elite ? 1.4 : 1), hp: d.hp * hpMul, spd: d.spd * (1 + Math.min(0.6, t / 500)) * (elite ? 1.3 : 1) * rand(0.9, 1.1), dmg: d.dmg * (1 + t / 260) * (elite ? 1.6 : 1), xp: d.xp * (elite ? 12 : 1), elite, flash: 0, anim: Math.random() * 5, kx: 0, ky: 0, slowT: 0, cd: rand(1, 3), ranged: d.ranged, fly: d.fly, h: IMG[d.spr].r[0].height };
  e.maxhp = e.hp; RN.enemies.push(e); return e;
}
function spawnTick(dt) {
  if (RN.mode === 'boss') { RN.spawnAcc += dt * 2.5; while (RN.spawnAcc >= 1 && RN.enemies.length < 120) { RN.spawnAcc--; spawnEnemy(pick(['walker', 'drone', 'runner'])); } return; }
  const t = RN.t, rate = (1.1 + t / 20) * (RN.ng ? 2 : 1);
  if (RN.enemies.length < E_CAP) { RN.spawnAcc += rate * dt; while (RN.spawnAcc >= 1) { RN.spawnAcc--;
    const pool = [['walker', 10], ['runner', t > 25 ? 5 : 0], ['drone', t > 50 ? 4 : 0], ['hacker', t > 80 ? 2.2 : 0], ['brute', t > 120 ? 1 + t / 150 : 0]];
    let tot = pool.reduce((a, b) => a + b[1], 0), r = Math.random() * tot, ty = 'walker'; for (const [k, w] of pool) { r -= w; if (r < 0) { ty = k; break; } } spawnEnemy(ty); } }
  RN.eliteT -= dt; if (RN.eliteT <= 0) { RN.eliteT = 40; spawnEnemy(RN.t > 90 ? 'brute' : 'walker', true); toast('警告：精英義體接近（擊敗掉落武器）'); }
  RN.waveT -= dt; if (RN.waveT <= 0) { RN.waveT = 60; const n = 28 + Math.floor(t / 10); const ty = t > 150 ? 'runner' : 'walker'; for (let i = 0; i < n; i++) spawnEnemy(ty, false, i / n * TAU); banner('屍潮來襲', '#ff77a8'); }
  RN.crateT -= dt; if (RN.crateT <= 0) { RN.crateT = 32; const a = Math.random() * TAU, x = RN.p.x + Math.cos(a) * 90, y = RN.p.y + Math.sin(a) * 60; RN.picks.push({ kind: 'crate', x, y, t: 0 }); fx({ kind: 'drop', x, y, life: 0.8 }); toast('系統空投：武器箱已投放'); }
}

// ---------- 首腦 ----------
function bossUpdate(b, dt) {
  const p = RN.p; b.anim += dt; b.flash -= dt;
  if (RN.ultUsed) return;
  const tx = p.x + Math.sin(RN.t * 0.6) * 60, ty = p.y - 78; b.x += (tx - b.x) * Math.min(1, dt * 1.2); b.y += (ty - b.y) * Math.min(1, dt * 1.2);
  b.atk -= dt;
  if (b.laser) { b.laser.t += dt; if (b.laser.t > 1 && !b.laser.fired) { b.laser.fired = true; lineHitPlayer(b.x, b.y + 10, b.laser.dx, b.laser.dy, 400, 10, 60); RN.shake = 5; sfx('zap'); } if (b.laser.t > 1.35) b.laser = null; }
  if (b.atk > 0) return;
  b.pat = (b.pat + 1) % 3; b.atk = 2.2;
  if (b.pat === 0) { for (let i = 0; i < 28; i++) { const a = i / 28 * TAU + RN.t; RN.ebul.push({ x: b.x, y: b.y, vx: Math.cos(a) * 75, vy: Math.sin(a) * 75, r: 3, dmg: 30, life: 5 }); } sfx('shoot'); }
  if (b.pat === 1) { const a = aim(b, p); b.laser = { dx: a.x, dy: a.y, t: 0 }; }
  if (b.pat === 2) { for (let k = 0; k < 3; k++) later(k * 0.2, () => { const a = Math.atan2(p.y - b.y, p.x - b.x); for (let i = -2; i <= 2; i++) RN.ebul.push({ x: b.x, y: b.y, vx: Math.cos(a + i * 0.2) * 120, vy: Math.sin(a + i * 0.2) * 120, r: 3, dmg: 30, life: 4 }); }); }
}
function lineHitPlayer(x0, y0, dx, dy, len, w, dmg) { const p = RN.p; const t = (p.x - x0) * dx + (p.y - y0) * dy; if (t < 0 || t > len) return; if (Math.abs((p.x - x0) * dy - (p.y - y0) * dx) < w + p.r) hurtPlayer(dmg); }
function useUlt() {
  if (!RN.ultReady || RN.ultUsed || RN.over) return; RN.ultUsed = true; RN.ultReady = false; const pr = $('#prompt'); if (pr) pr.remove();
  const b = RN.boss, p = RN.p; RN.ts = 0.35; banner('萬法歸一', '#ffcd4a'); sfx('mech');
  ALL_SKILLS.forEach((id, i) => later(i * 0.06, () => {
    const a = i / ALL_SKILLS.length * TAU; const x = b.x + Math.cos(a) * 40, y = b.y + Math.sin(a) * 30;
    fx({ kind: 'boom', x, y, r: 26, life: 0.5 }); fx({ kind: 'bolt', pts: [[p.x, p.y], [(p.x + x) / 2 + rand(-20, 20), (p.y + y) / 2], [x, y]], life: 0.3 });
    burst(x, y, ['#ffcd4a', '#73eff7', '#c06cf0', '#f4f4f4'], 14, 120, 0.7, 2); sfx('boom'); RN.shake = 6;
  }));
  for (let i = 0; i < 24; i++) later(0.1 + i * 0.02, () => shoot({ x: p.x + rand(-60, 60), y: p.y + 40, vx: 0, vy: -260, r: 4, dmg: 0, life: 0.8, kind: 'sword', pierce: 1e9 }));
  later(1.0, () => { RN.ts = 1; fx({ kind: 'flash', life: 0.6 }); for (const e of RN.enemies) if (!e.dead && !e.boss) kill(e); RN.texts.push({ x: b.x, y: b.y - 40, n: 9999999, t: 0, col: '#ffcd4a', big: true }); b.hp = 0; kill(b); });
}
function bossDown(b) {
  RN.over = true; RN.ts = 1; Music.play(null); const pr = $('#prompt'); if (pr) pr.remove();
  for (const e of RN.enemies) if (!e.dead && !e.boss) kill(e);
  for (let i = 0; i < 16; i++) later(i * 0.12, () => { const x = b.x + rand(-40, 40), y = b.y + rand(-30, 30); fx({ kind: 'boom', x, y, r: 20 + Math.random() * 20, life: 0.5 }); burst(x, y, ['#ff3860', '#73eff7', '#ffcd4a', '#f4f4f4', '#566c86'], 20, 140, 1, 2); sfx('boom'); RN.shake = 7; });
  later(0.4, () => banner('秒 殺', '#ffcd4a'));
  later(3.6, () => { S.finale = true; S.ng = Math.max(1, S.ng); save(); go(CutScene, STORY_ENDING, () => go(HubScene), 'story'); });
}

// ---------- 結算 ----------
function endRun(why) {
  if (RN.over) return; RN.over = true; RN.paused = false; const p = RN.p;
  const pts = Math.floor((RN.kills * 1.2 + RN.t + RN.elites * 25 + RN.level * 8 + (p.mech ? 60 : 0)) * (RN.ng ? 1.5 : 1));
  RN.result = { pts, why }; S.points += pts; S.kills += RN.kills; S.best = Math.max(S.best, RN.t); save();
  if (why === 'down') { banner('分身消散', '#73eff7'); sfx('down'); burst(p.x, p.y, ['#73eff7', '#c9fff6', '#41a6f6'], 50, 80, 1.2, 2); RN.dead = true; }
  const lu = $('#lvlui'); if (lu) lu.remove(); const pu = $('#pauseui'); if (pu) pu.remove();
  later(why === 'down' ? 1.8 : 0.2, () => {
    const d = document.createElement('div'); d.className = 'lvl'; d.innerHTML = `<div class="center-panel px">
      <h2 style="color:var(--cyan)">${why === 'down' ? '分身已消散' : '分身已召回'}</h2>
      <div style="text-align:center;color:var(--dim);font-size:15px">${why === 'down' ? '本體在安全屋裡毫髮無傷，並鬆了一口氣。' : '「辛苦了，下一個。」'}</div>
      <div class="stat"><span>存活時間</span><span>${fmtT(RN.t)}</span></div>
      <div class="stat"><span>擊破數</span><span>${RN.kills}</span></div>
      <div class="stat"><span>精英擊破</span><span>${RN.elites}</span></div>
      <div class="stat"><span>分身等級</span><span>Lv ${RN.level}</span></div>
      ${p.mech ? '<div class="stat" style="color:var(--gold)"><span>手搓機甲</span><span>完成</span></div>' : ''}
      <div class="stat" style="color:var(--gold);font-size:22px"><span>獲得系統點數</span><span>+${pts}</span></div>
      <div class="row" style="justify-content:center;margin-top:6px"><button class="btn gold" data-act="again">再派一個<small>Enter</small></button><button class="btn" data-act="home">回安全屋<small>Esc</small></button></div></div>`;
    UI.appendChild(d); RN.resultUI = true;
  });
}
function openPause() {
  if (RN.over || RN.lvUI || RN.mode === 'boss') return; RN.paused = true;
  const d = document.createElement('div'); d.className = 'lvl'; d.id = 'pauseui';
  d.innerHTML = `<div class="center-panel px"><h2>暫停</h2>
    <button class="btn gold" data-act="resume">繼續<small>Esc</small></button>
    <button class="btn" data-act="recall">召回分身（結算點數）</button>
    <button class="btn" data-act="mute">聲音：${S.mute ? '關' : '開'}</button>
    <div style="font-size:14px;color:var(--dim);line-height:1.6">功法：${RN.casters.map(c => SKILLS[c.id].name + ' Lv' + skillLv(c)).join('、') || '無'}<br>武器：${RN.weapons.map(w => wName(w) + ' Lv' + w.lvl).join('、') || '無'}</div></div>`;
  UI.appendChild(d);
}
function closePause() { const d = $('#pauseui'); if (d) d.remove(); RN.paused = false; }

// ---------- 場景 ----------
const ICONS = {};
const RunScene = {
  enter() {
    Music.play(RN.mode === 'boss' ? 'boss' : 'run');
    UI.innerHTML = `<div id="hud">
      ${RN.mode === 'boss' ? `<div style="position:absolute;left:180px;right:180px;top:10px;text-align:center;font-size:16px;color:var(--red);text-shadow:2px 2px 0 #14101e">世界首腦</div><div class="xpbar" style="left:180px;right:180px;top:34px;height:14px;border:3px solid #f4f4f4"><div class="xpfill" id="bossfill" style="background:linear-gradient(#ff77a8,#ff3860);width:100%"></div></div>`
        : `<div class="xpbar"><div class="xpfill" id="xpfill"></div><div class="xplv" id="xplv"></div></div><div class="htimer" id="htimer"></div>`}
      <div class="hpwrap" ${RN.mode === 'boss' ? 'style="top:60px"' : ''}>${RN.mode === 'boss' ? '本體' : '分身'}<div class="hpbar"><div class="hpfill" id="hpfill"></div></div><span id="hptxt"></span></div>
      <div class="hinfo" id="hinfo" ${RN.mode === 'boss' ? 'style="top:84px"' : ''}></div>
      ${RN.mode === 'boss' ? '' : '<div class="mechbar" id="mechbar"></div><div class="wname" id="wname"></div><div class="slots" id="slots"></div><button class="btn pausebtn" data-act="pause">II 暫停</button>'}
    </div>`;
    this.el = { xp: $('#xpfill'), lv: $('#xplv'), tm: $('#htimer'), hp: $('#hpfill'), hpt: $('#hptxt'), info: $('#hinfo'), mech: $('#mechbar'), slots: $('#slots'), wn: $('#wname'), boss: $('#bossfill') };
    RN.hudDirty = true;
    if (RN.mode === 'boss') { banner('最終決戰', '#ff3860'); later(4, () => { if (RN.over) return; RN.ultReady = true; const d = document.createElement('div'); d.className = 'prompt blink'; d.id = 'prompt'; d.dataset.act = 'ult'; d.textContent = TOUCH ? '點這裡 釋放【萬法歸一】' : '按 空白鍵／點這裡 釋放【萬法歸一】'; UI.appendChild(d); }); }
  },
  act(a) {
    if (a.startsWith('opt:')) chooseOpt(+a.slice(4));
    if (a === 'pause') openPause();
    if (a === 'resume') closePause();
    if (a === 'recall') { closePause(); endRun('recall'); }
    if (a === 'mute') { S.mute = !S.mute; save(); closePause(); openPause(); }
    if (a === 'again') startRun();
    if (a === 'home') go(HubScene);
    if (a === 'ult') useUlt();
  },
  key(c) {
    if (RN.resultUI) { if (c === 'Enter' || c === 'Space') this.act('again'); if (c === 'Escape') this.act('home'); return; }
    if (RN.lvUI) { const i = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[c]; if (i !== undefined) chooseOpt(i); return; }
    if (c === 'Escape' || c === 'KeyP') { if ($('#pauseui')) closePause(); else openPause(); }
    if (c === 'Space' && RN.mode === 'boss') useUlt();
  },
  update(dt) { updateRun(dt); },
  draw() { drawRun(); },
  leave() { joy.on = false; },
};

function updateRun(rdt) {
  const timers = RN.timers; // 計時器即使在結束動畫時也要跑
  if (RN.paused) { updateHud(); return; }
  const dt = rdt * RN.ts; const p = RN.p;
  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } }
  if (!RN) return;
  if (RN.mechAnim) { RN.mechAnim.t += rdt; RN.freezeT = Math.max(RN.freezeT, 0.5); if (RN.mechAnim.t >= 1.9) finishMech(); }
  if (!RN.over) RN.t += dt;
  RN.camLag = Math.max(0, (RN.camLag || 0) - rdt); const cf = Math.min(1, rdt * (RN.camLag > 0 ? 1.6 : 8)); // 鏡花水月衝刺時攝影機追不上
  RN.cam.x += (p.x - RN.cam.x) * cf; RN.cam.y += (p.y - RN.cam.y) * cf;
  RN.shake = Math.max(0, RN.shake - rdt * 20);
  buildGrid();
  // 分身移動
  if (!RN.dead && !(RN.mode === 'boss' && RN.over)) {
    const mv = moveInput(); const spd = p.spd * RN.stats.spd * p.spdSkill * (p.mech ? 0.95 : 1) * (RN.mode === 'boss' ? 1.2 : 1);
    p.x += mv.x * spd * dt; p.y += mv.y * spd * dt; p.moving = !!(mv.x || mv.y);
    if (p.moving) { p.dir = { x: mv.x, y: mv.y }; if (Math.abs(mv.x) > 0.1) p.face = mv.x < 0; p.anim += dt; }
    p.inv -= dt; p.hp = Math.min(p.maxhp, p.hp + RN.stats.regen * dt);
    RN.comps.forEach((c, i) => {
      const a = RN.t * 0.8 + i * TAU / 3, tx = p.x + Math.cos(a) * 26, ty = p.y + Math.sin(a) * 18, dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
      const sp = Math.min(d * 5, spd * 1.4); if (d > 1) { c.x += dx / d * sp * dt; c.y += dy / d * sp * dt; } c.moving = d > 4; if (c.moving) { c.anim += dt; if (Math.abs(dx) > 1) c.face = dx < 0; }
      const t = nearest(c.x, c.y, 200); c.dir = t ? aim(c, t) : p.dir;
    });
  }
  // 功法 / 武器
  if (!RN.over) {
    const tg = hasSkill('tiangong'), tgL = tg ? skillLv(RN.casters.find(c => c.id === 'tiangong')) : 0;
    const M = { dmg: RN.stats.dmg, cd: RN.stats.cd, wdmg: RN.stats.dmg * (tg ? 1.25 + 0.05 * tgL : 1), wcd: RN.stats.cd * (tg ? 0.85 : 1) };
    p.spdSkill = 1; p.drSkill = 0; p.dodge = 0;
    for (const c of RN.casters) SK[c.id](c, skillLv(c), dt, M);
    for (const w of RN.weapons) {
      w.st.cd -= dt; const tr = w.lvl >= 3 ? RN.school : null;
      if (w.st.burst > 0) { w.st.bt = (w.st.bt || 0) - dt; if (w.st.bt <= 0) { w.st.bt = 0.08; w.st.burst--; const a = aim(p, nearest(p.x, p.y, 260)); shoot({ x: p.x, y: p.y, vx: a.x * 290 + rand(-15, 15), vy: a.y * 290 + rand(-15, 15), r: 4, dmg: (8 + 3 * w.lvl) * M.wdmg, life: 1, pierce: 1, kind: 'ki' }); sfx('shoot'); } }
      if (w.st.cd <= 0) w.st.cd = WP[w.id](w, p, dt, M, tr) * M.wcd;
    }
    if (!p.mech && RN.mode !== 'boss') { RN.fist.cd -= dt; if (RN.fist.cd <= 0) { const t = nearest(p.x, p.y, 70); if (t) { RN.fist.cd = 0.7 * M.cd; const a = aim(p, t); shoot({ x: p.x, y: p.y, vx: a.x * 240, vy: a.y * 240, r: 5, dmg: 7 * M.dmg, life: 0.28, kind: 'fist', kb: 70 }); } } }
    if (p.mech) {
      const ms = RN.mechSt; ms.m -= dt; ms.l -= dt; ms.st -= dt; ms.sw -= dt;
      // 肩部飛彈齊射
      if (ms.m <= 0 && nearest(p.x, p.y, 280)) { ms.m = 0.8 * M.cd; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.4; later(i * 0.04, () => shoot({ x: p.x + (i < 3 ? -12 : 12), y: p.y - 14, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, r: 3, dmg: 26 * M.dmg, life: 2.5, kind: 'missile', home: 8, spd: 210, boom: 18 })); } sfx('shoot'); }
      // 臂炮光束
      if (ms.l <= 0) { const t = nearest(p.x, p.y, 320); if (t) { ms.l = 2.6 * M.cd; const a = aim(p, t); lineHit(p.x, p.y - 6, a.x, a.y, 340, 12, 60 * M.dmg, 90); fx({ kind: 'beam', x: p.x + a.x * 14, y: p.y - 6, dx: a.x, dy: a.y, len: 340, w: 12, col: '#73eff7', life: 0.4 }); RN.shake = Math.max(RN.shake, 3); sfx('zap'); } }
      // 踏步震地
      if (p.moving && ms.st <= 0) { ms.st = 0.42; areaHit(p.x, p.y + 6, 28, 16 * M.dmg, 140); fx({ kind: 'ring', x: p.x, y: p.y + 8, r: 22, col: '#94b0c2', life: 0.25 }); burst(p.x, p.y + 8, ['#566c86', '#94b0c2'], 5, 40, 0.35); RN.shake = Math.max(RN.shake, 1.5); }
      // 必殺：天穹貫日炮（360 度掃射）
      if (ms.sw <= 0 && nearest(p.x, p.y, 260)) { ms.sw = 9 * M.cd; const t = nearest(p.x, p.y, 260); RN.mechSweep = { t: 0, a0: Math.atan2(t.y - p.y, t.x - p.x) }; sfx('mech'); }
      if (RN.mechSweep) { const sw = RN.mechSweep; sw.t += dt; const a = sw.a0 + sw.t / 1.1 * TAU; sw.a = a;
        lineHit(p.x, p.y - 8, Math.cos(a), Math.sin(a), 300, 14, 500 * dt * M.dmg, 120); RN.shake = Math.max(RN.shake, 3);
        if (sw.t >= 1.1) RN.mechSweep = null; }
    }
  }
  RN.freezeT = Math.max(0, RN.freezeT - dt);
  // 投射物
  for (const pr of RN.proj) {
    pr.t += dt; pr.life -= dt; if (pr.life <= 0) continue;
    if (pr.delay && pr.t < pr.delay) { pr.x += pr.vx * dt; pr.y += pr.vy * dt; continue; }
    if (pr.home) { if (!pr.tgt || pr.tgt.dead) pr.tgt = nearest(pr.x, pr.y, 260); if (pr.tgt) { const want = Math.atan2(pr.tgt.y - pr.y, pr.tgt.x - pr.x); let cur = Math.atan2(pr.vy, pr.vx); let da = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)); cur += clamp(da, -pr.home * dt, pr.home * dt); pr.vx = Math.cos(cur) * pr.spd; pr.vy = Math.sin(cur) * pr.spd; } }
    if (pr.boomer) { if (pr.t > pr.out) { if (pr.torn && !pr.tornDone) { pr.tornDone = true; zone({ x: pr.x, y: pr.y, r: 24, dmg: pr.torn, tick: 0.3, life: 2, pull: 50, kind: 'tornado' }); } const a = aim(pr, pr.owner); pr.vx = a.x * pr.spd; pr.vy = a.y * pr.spd; if (Math.hypot(pr.owner.x - pr.x, pr.owner.y - pr.y) < 8) pr.life = 0; } else { pr.vx *= 1 - dt * 2; pr.vy *= 1 - dt * 2; } }
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (pr.kind === 'fire' || pr.kind === 'missile' || pr.kind === 'arcane' || pr.kind === 'dragon') if (Math.random() < 0.5) RN.parts.push({ x: pr.x, y: pr.y, vx: rand(-10, 10), vy: rand(-10, 10), life: 0.3, max: 0.3, col: pr.kind === 'arcane' ? '#c06cf0' : pr.kind === 'missile' ? '#f4f4f4' : '#ffa300', s: 1 });
    if (pr.dmg <= 0) continue;
    query(pr.x, pr.y, pr.r, e => {
      if (pr.life <= 0) return false;
      if (Math.hypot(e.x - pr.x, e.y - pr.y) > pr.r + e.r) return;
      const h = pr.hits.get(e.id); if (h !== undefined && RN.t < h) return; pr.hits.set(e.id, pr.rehit ? RN.t + pr.rehit : 1e9);
      let kx = pr.vx, ky = pr.vy; let d = Math.hypot(kx, ky); if (d < 1) { kx = e.x - pr.x; ky = e.y - pr.y; d = Math.hypot(kx, ky) || 1; }
      hurt(e, pr.dmg, kx / d * pr.kb, ky / d * pr.kb);
      if (pr.boom) { areaHit(pr.x, pr.y, pr.boom, pr.dmg * 0.6, 40); fx({ kind: 'boom', x: pr.x, y: pr.y, r: pr.boom, life: 0.3 }); sfx('boom'); }
      if (pr.split) { pr.split = 0; for (let i = 0; i < 3; i++) { const a = Math.random() * TAU; shoot({ x: pr.x, y: pr.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, r: 3, dmg: pr.dmg * 0.6, life: 1.4, kind: 'star', home: 10, spd: 200, pierce: 0 }); } }
      if (pr.pierce <= 0) { pr.life = 0; return false; } pr.pierce--;
    });
  }
  RN.proj = RN.proj.filter(q => q.life > 0 && Math.abs(q.x - p.x) < 600 && Math.abs(q.y - p.y) < 450);
  // 區域
  for (const z of RN.zones) {
    z.t += dt; z.life -= dt; if (z.r1) z.r = z.r0 + (z.r1 - z.r0) * Math.min(1, z.t / z.dur);
    if (z.pull) query(z.x, z.y, z.r + 20, e => { if (e.boss) return; const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy) || 1; if (d < z.r + 30) { e.x += dx / d * z.pull * dt; e.y += dy / d * z.pull * dt; } });
    if (z.once) { query(z.x, z.y, z.r, e => { if (z.hitset.has(e.id)) return; const dx = e.x - z.x, dy = e.y - z.y, d = Math.hypot(dx, dy) || 1; if (d < z.r + e.r) { z.hitset.add(e.id); hurt(e, z.dmg, dx / d * z.kb, dy / d * z.kb); if (z.slow) e.slowT = z.slow; } }); }
    else if (z.dmg > 0) { z.tt -= dt; if (z.tt <= 0) { z.tt = z.tick; areaHit(z.x, z.y, z.r, z.dmg, z.kb); } }
  }
  RN.zones = RN.zones.filter(z => z.life > 0);
  // 敵人
  const frozen = RN.freezeT > 0;
  for (const e of RN.enemies) {
    if (e.dead) continue; e.flash -= dt;
    if (e.boss) { bossUpdate(e, dt); continue; }
    e.x += e.kx * dt; e.y += e.ky * dt; const kd = Math.min(1, dt * 9); e.kx -= e.kx * kd; e.ky -= e.ky * kd;
    if (frozen || RN.over) continue;
    e.anim += dt; e.slowT -= dt;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1; const sp = e.spd * (e.slowT > 0 ? 0.45 : 1);
    if (e.ranged && d < 110) { e.x -= dy / d * sp * 0.6 * dt; e.y += dx / d * sp * 0.6 * dt; if (d < 80) { e.x -= dx / d * sp * dt; e.y -= dy / d * sp * dt; } }
    else { e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; }
    if (e.fly) e.y += Math.sin(e.anim * 5 + e.id) * 12 * dt;
    if (e.ranged) { e.cd -= dt; if (e.cd <= 0 && d < 200) { e.cd = rand(2.2, 3.2); RN.ebul.push({ x: e.x, y: e.y, vx: dx / d * 75, vy: dy / d * 75, r: 3, dmg: e.dmg, life: 4 }); } }
    // 互推
    const c = e.gx !== undefined && e.gx >= 0 && e.gy >= 0 && e.gx < GW && e.gy < GH ? GRID[e.gy * GW + e.gx] : null;
    if (c) for (const o of c) { if (o === e || o.dead) continue; const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), mn = e.r + o.r; if (od < mn && od > 0.01) { const push = (mn - od) * 0.5; e.x += ox / od * push; e.y += oy / od * push; } }
    if (!RN.dead && d < e.r + p.r) hurtPlayer(e.dmg);
    if (Math.abs(dx) > 330 || Math.abs(dy) > 230) { // 回收到前方
      e.x = p.x + dx * 0.85; e.y = p.y + dy * 0.85;
    }
  }
  RN.enemies = RN.enemies.filter(e => !e.dead);
  // 敵方子彈
  for (const b of RN.ebul) { if (frozen && RN.mode !== 'boss') continue; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (!RN.dead && Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r) { b.life = 0; hurtPlayer(b.dmg); } }
  RN.ebul = RN.ebul.filter(b => b.life > 0);
  // 拾取
  for (const k of RN.picks) {
    k.t += dt; if (RN.dead) continue; const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy) || 1;
    const mag = k.kind === 'xp' ? RN.stats.magnet : 18;
    if (k.pull || d < mag) { k.pull = true; const sp = 160 + k.t * 40; k.x += dx / d * sp * dt; k.y += dy / d * sp * dt; }
    if (d < p.r + 5) { k.got = true;
      if (k.kind === 'xp') { gainXp(k.val); sfx('xp'); }
      if (k.kind === 'heal') { p.hp = Math.min(p.maxhp, p.hp + 30); toast('能量罐：回復 30'); sfx('pick'); }
      if (k.kind === 'magnet') { RN.picks.forEach(q => { if (q.kind === 'xp') q.pull = true; }); toast('系統磁鐵：吸取全部經驗'); sfx('pick'); }
      if (k.kind === 'crate') { const un = Object.keys(WEAPONS).filter(id => !RN.weapons.some(w => w.id === id)); const up = RN.weapons.filter(w => w.lvl < 5).map(w => w.id);
        const id = (RN.weapons.length < 5 && un.length && (Math.random() < 0.6 || !up.length)) ? pick(un) : up.length ? pick(up) : pick(Object.keys(WEAPONS)); giveWeapon(id); burst(k.x, k.y, ['#ffcd4a', '#f4f4f4'], 16, 70, 0.6); }
    }
  }
  RN.picks = RN.picks.filter(k => !k.got && Math.abs(k.x - p.x) < 900 && Math.abs(k.y - p.y) < 700);
  if (RN.picks.length > 400) { // 合併遠處經驗
    let sum = 0; RN.picks = RN.picks.filter(k => { if (k.kind === 'xp' && !k.pull && Math.hypot(k.x - p.x, k.y - p.y) > 200) { sum += k.val; return false; } return true; });
    if (sum) RN.picks.push({ kind: 'xp', x: p.x + rand(-120, 120), y: p.y + rand(-80, 80), val: sum, t: 0 });
  }
  // 特效
  for (const f of RN.fx) f.t += dt; RN.fx = RN.fx.filter(f => f.t < f.life);
  for (const q of RN.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - dt * 3; q.vy = q.vy * (1 - dt * 3) - 8 * dt; q.life -= dt; } RN.parts = RN.parts.filter(q => q.life > 0);
  for (const t of RN.texts) { t.t += dt; t.y -= 18 * dt; } RN.texts = RN.texts.filter(t => t.t < (t.big ? 2.5 : 0.6));
  if (!RN.over) spawnTick(dt);
  RN.cam.x = clamp(RN.cam.x, p.x - (W / 2 - 14), p.x + (W / 2 - 14)); RN.cam.y = clamp(RN.cam.y, p.y - (H / 2 - 18), p.y + (H / 2 - 18)); // 攝影機再慢，主角至少留在畫面內
  updateHud(rdt);
}

function updateHud(dt = 0) {
  const el = RunScene.el; if (!el) return; RN.hudT -= dt; if (RN.hudT > 0 && !RN.hudDirty) return; RN.hudT = 0.1;
  const p = RN.p;
  el.hp.style.width = (p.hp / p.maxhp * 100) + '%'; el.hp.style.background = p.hp / p.maxhp < 0.3 ? '#ff4f6d' : p.mech ? '#ffcd4a' : '#a7f070';
  el.hpt.textContent = `${Math.ceil(p.hp)}/${p.maxhp}`;
  if (RN.mode === 'boss') { el.boss.style.width = Math.max(0, RN.boss.hp / RN.boss.maxhp * 100) + '%'; el.info.textContent = `習得功法 ${RN.casters.length} 本，全數發動中`; return; }
  el.xp.style.width = (RN.xp / RN.need * 100) + '%'; el.lv.textContent = 'Lv ' + RN.level; el.tm.textContent = fmtT(RN.t);
  el.info.innerHTML = `擊破 ${RN.kills}　精英 ${RN.elites}${RN.ng ? '　<span style="color:var(--gold)">無限流 ×1.5</span>' : ''}`;
  if (RN.hudDirty) {
    RN.hudDirty = false;
    const sk = RN.casters.map(c => { const s = SKILLS[c.id]; return `<div class="slot skill" title="${s.name}"><div class="glyph sch-${s.school}" style="width:42px;height:42px;font-size:24px">${s.name[0]}</div><span class="lv">Lv${skillLv(c)}</span></div>`; }).join('');
    let ws = ''; for (let i = 0; i < 5; i++) { const w = RN.weapons[i]; ws += w ? `<div class="slot ${w.lvl >= 3 && RN.school ? 'tr' : ''}"><img src="${ICONS[WEAPONS[w.id].icon]}" alt=""><span class="lv">${w.lvl}</span></div>` : '<div class="slot"></div>'; }
    el.slots.innerHTML = sk + ws;
    el.wn.innerHTML = RN.weapons.map(w => w.lvl >= 3 && RN.school ? `<b>${wName(w)}</b>` : wName(w)).join(' · ');
    if (p.mech) { el.mech.className = 'mechbar'; el.mech.innerHTML = '<span style="color:var(--gold)">機甲「怕死一號」運轉中</span>'; }
    else { el.mech.className = 'mechbar'; el.mech.innerHTML = `機甲部件 ${RN.mechParts.length}/6<div class="cells">${MECH_PARTS.map((n, i) => `<div class="cell ${RN.mechParts.includes(i) ? 'on' : ''}" title="${n}"></div>`).join('')}</div>`; }
  }
}

// ---------- 繪製 ----------
let VIGNETTE = null;
function drawRun() {
  const p = RN.p; const sx = (Math.random() - 0.5) * RN.shake, sy = (Math.random() - 0.5) * RN.shake;
  const cx = Math.round(RN.cam.x - W / 2 + sx), cy = Math.round(RN.cam.y - H / 2 + sy);
  // 地面
  const tx0 = Math.floor(cx / TILE), ty0 = Math.floor(cy / TILE);
  for (let ty = ty0; ty <= ty0 + Math.ceil(H / TILE); ty++) for (let tx = tx0; tx <= tx0 + Math.ceil(W / TILE); tx++) {
    const set = TILES[districtAt(tx, ty)], hv = hash(tx, ty, 1); const v = hv < 0.6 ? 0 : 1 + Math.floor(hash(tx, ty, 2) * 9);
    ctx.drawImage(set[v], tx * TILE - cx, ty * TILE - cy);
  }
  // 裝飾
  const PC = 96, lights = [];
  for (let gy = Math.floor((cy - 40) / PC); gy <= Math.floor((cy + H + 40) / PC); gy++) for (let gx = Math.floor((cx - 40) / PC); gx <= Math.floor((cx + W + 40) / PC); gx++) {
    if (hash(gx, gy, 3) > 0.32) continue; const px = gx * PC + 10 + hash(gx, gy, 4) * 70, py = gy * PC + 20 + hash(gx, gy, 5) * 60;
    const d = districtAt(Math.floor(px / TILE), Math.floor(py / TILE)), list = PROP_BY[d], name = list[Math.floor(hash(gx, gy, 6) * list.length)], img = PROPS[name];
    ctx.drawImage(img, Math.round(px - img.width / 2 - cx), Math.round(py - img.height - cy));
    if (name === 'lamp') lights.push([px, py - 36, '#ff77a8']); if (name === 'lantern') lights.push([px, py - 14, '#ffcd4a']); if (name === 'holo') lights.push([px, py - 26, '#41a6f6']); if (name === 'pillar') lights.push([px, py - 18, '#a46be0']);
  }
  if (RN.mode === 'boss') { ctx.globalAlpha = 0.35; R(ctx, 0, 0, W, H, '#3a0820'); ctx.globalAlpha = 1; }
  // 拾取物
  for (const k of RN.picks) {
    const x = Math.round(k.x - cx), y = Math.round(k.y - cy + Math.sin(k.t * 5) * 1); if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
    if (k.kind === 'xp') { const col = k.val >= 10 ? '#ffcd4a' : k.val >= 3 ? '#a7f070' : '#73eff7'; R(ctx, x - 1, y - 2, 3, 5, '#14101e'); R(ctx, x - 2, y - 1, 5, 3, '#14101e'); R(ctx, x, y - 2, 1, 5, col); R(ctx, x - 1, y - 1, 3, 3, col); R(ctx, x, y - 1, 1, 1, '#f4f4f4'); }
    if (k.kind === 'heal') { R(ctx, x - 3, y - 4, 7, 9, '#14101e'); R(ctx, x - 2, y - 3, 5, 7, '#38b764'); R(ctx, x - 1, y - 1, 3, 1, '#f4f4f4'); R(ctx, x, y - 2, 1, 3, '#f4f4f4'); }
    if (k.kind === 'magnet') { R(ctx, x - 4, y - 4, 9, 8, '#14101e'); R(ctx, x - 3, y - 3, 3, 6, '#ff3860'); R(ctx, x + 1, y - 3, 3, 6, '#41a6f6'); R(ctx, x - 3, y - 3, 7, 2, '#94b0c2'); }
    if (k.kind === 'crate') { drawGlow(x, y, 16, 'rgba(255,205,74,.5)', 0.6 + Math.sin(k.t * 6) * 0.3); R(ctx, x - 7, y - 6, 14, 12, '#14101e'); R(ctx, x - 6, y - 5, 12, 10, '#41a6f6'); R(ctx, x - 6, y - 1, 12, 2, '#ffcd4a'); R(ctx, x - 1, y - 5, 2, 10, '#ffcd4a'); R(ctx, x - 6, y - 5, 12, 1, '#73eff7'); }
  }
  // 區域（地面層）
  for (const z of RN.zones) {
    const x = z.x - cx, y = z.y - cy, a = Math.max(0, z.life / z.max);
    if (z.kind === 'after') { ctx.globalAlpha = a * 0.45; drawSet(IMG.clone, 0, x, y + 8, z.face, true); ctx.globalAlpha = 1; }
    if (z.kind === 'mirrorimg') { ctx.globalAlpha = a * 0.7; drawSet(IMG.clone, 0, x, y + 8, z.face, false); ctx.globalAlpha = a * 0.5; drawSet(IMG.clone, 0, x, y + 8, z.face, true); ctx.globalAlpha = a; pring(ctx, x, y, 11, '#c9b6ff'); ctx.globalAlpha = 1; }
    if (z.kind === 'roar') { ctx.globalAlpha = a; pring(ctx, x, y, z.r, '#fff3c0', 2); pring(ctx, x, y, z.r * 0.8, '#ffcd4a'); ctx.globalAlpha = 1; }
    if (z.kind === 'frost') { ctx.globalAlpha = a * 0.3; pcircle(ctx, x, y, Math.floor(z.r), '#73eff7'); ctx.globalAlpha = a; pring(ctx, x, y, z.r, '#c9fff6', 2); for (let i = 0; i < 8; i++) { const an = i / 8 * TAU; R(ctx, x + Math.cos(an) * z.r * 0.7, y + Math.sin(an) * z.r * 0.7, 2, 2, '#f4f4f4'); } ctx.globalAlpha = 1; }
    if (z.kind === 'rune') { ctx.globalAlpha = Math.min(1, a * 2) * 0.85; pring(ctx, x, y, z.r, '#c06cf0', 1); pring(ctx, x, y, z.r - 5, '#a46be0', 1); for (let i = 0; i < 6; i++) { const an = i / 6 * TAU + z.t; const an2 = an + TAU / 3; pline(ctx, x + Math.cos(an) * (z.r - 5), y + Math.sin(an) * (z.r - 5), x + Math.cos(an2) * (z.r - 5), y + Math.sin(an2) * (z.r - 5), '#c06cf0'); } ctx.globalAlpha = 1; }
    if (z.kind === 'tornado') { ctx.globalAlpha = Math.min(1, a * 2); for (let i = 0; i < 18; i++) { const an = i * 0.7 + z.t * 9, rr = (i / 18) * z.r; R(ctx, x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.6 - i * 0.6, 2, 2, i % 3 ? '#c9fff6' : '#94b0c2'); } ctx.globalAlpha = 1; }
  }
  // 實體（依 y 排序）
  const ents = [];
  for (const e of RN.enemies) if (!e.dead && Math.abs(e.x - cx - W / 2) < W / 2 + 30 && Math.abs(e.y - cy - H / 2) < H / 2 + 40) ents.push(e);
  if (!RN.dead) ents.push(p); for (const c of RN.comps) if (!RN.dead) ents.push(c);
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) {
    const x = e.x - cx, y = e.y - cy;
    if (e.boss) { drawBoss(ctx, x, y, e.anim, 0.85, e.flash > 0 ? 1 : 0); continue; }
    if (e === p || e.comp) {
      R(ctx, x - 5, y + 6, 10, 2, 'rgba(0,0,0,.35)');
      if (e === p && p.inv > 0 && Math.floor(p.inv * 20) % 2) continue;
      if (e === p && p.mech) { drawMech(x, y, e.moving ? Math.floor(e.anim * 6) % 2 : 0); continue; }
      const set = e === p ? (RN.mode === 'boss' ? IMG.heroGold : IMG.clone) : IMG.clone;
      const fr = e.moving ? Math.floor(e.anim * 8) % 2 : 0; const bob = e.moving && fr ? 1 : 0;
      if (e === p && RN.mode === 'boss') drawGlow(x, y, 26, 'rgba(255,205,74,.35)');
      drawSet(set, fr, x, y + 8 - bob, e.face, false);
      continue;
    }
    R(ctx, x - e.r, y + 6, e.r * 2, 2, 'rgba(0,0,0,.35)');
    const set = IMG[e.spr], fr = Math.floor(e.anim * 5) % 2, flip = p.x < e.x;
    if (e.elite) { const g = set.gold[fr]; ctx.drawImage(g, Math.round(x - g.width / 2), Math.round(y + 9 - g.height)); }
    drawSet(set, fr, x, y + 8, flip, false);
    if (e.flash > 0) drawSet(set, fr, x, y + 8, flip, true);
    else if (!RN.mechAnim && (RN.freezeT > 0 || e.slowT > 0)) { ctx.globalAlpha = RN.freezeT > 0 ? 0.55 : 0.3; const img = (flip ? set.wl : set.w)[fr]; ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y + 8 - img.height)); ctx.globalAlpha = 1; }
    if (e.elite || e.type === 'brute') { const w = 20, f = e.hp / e.maxhp; R(ctx, x - w / 2, y - e.h + 4, w, 3, '#14101e'); R(ctx, x - w / 2 + 1, y - e.h + 5, (w - 2) * f, 1, e.elite ? '#ffcd4a' : '#ff77a8'); }
  }
  // 金鐘罩
  for (const c of RN.casters) if (c.st.bell && !RN.dead) { const x = c.ent.x - cx, y = c.ent.y - cy; ctx.globalAlpha = 0.35 + Math.sin(RN.t * 6) * 0.1; pring(ctx, x, y, c.st.bell, '#ffcd4a'); ctx.globalAlpha = 0.12; pcircle(ctx, x, y, Math.floor(c.st.bell), '#ffcd4a'); ctx.globalAlpha = 1; }
  // 首腦雷射預警
  if (RN.boss && RN.boss.laser && !RN.boss.dead) { const b = RN.boss, L = b.laser, x = b.x - cx, y = b.y - cy + 10; if (!L.fired) { ctx.globalAlpha = 0.4 + 0.4 * Math.sin(L.t * 30); pline(ctx, x, y, x + L.dx * 400, y + L.dy * 400, '#ff3860', 1); ctx.globalAlpha = 1; } else { pline(ctx, x, y, x + L.dx * 400, y + L.dy * 400, '#ff3860', 9); pline(ctx, x, y, x + L.dx * 400, y + L.dy * 400, '#ffe0e8', 3); } }
  // 投射物
  for (const q of RN.proj) drawProj(q, q.x - cx, q.y - cy);
  for (const b of RN.ebul) { const x = b.x - cx, y = b.y - cy; drawGlow(x, y, 7, 'rgba(255,119,168,.6)'); pcircle(ctx, x, y, 3, '#ff77a8'); R(ctx, x - 1, y - 1, 2, 2, '#f4f4f4'); }
  if (RN.mechSweep && RN.p.mech) { const a = RN.mechSweep.a, x = p.x - cx, y = p.y - cy - 8; drawGlow(x, y, 34, 'rgba(255,205,74,.6)'); pline(ctx, x, y, x + Math.cos(a) * 300, y + Math.sin(a) * 300, '#ffcd4a', 14); pline(ctx, x, y, x + Math.cos(a) * 300, y + Math.sin(a) * 300, '#fff3c0', 6); pline(ctx, x, y, x + Math.cos(a) * 300, y + Math.sin(a) * 300, '#ffffff', 2); }
  // 特效
  for (const f of RN.fx) drawFx(f, cx, cy);
  for (const q of RN.parts) { ctx.globalAlpha = Math.min(1, q.life / q.max * 1.5); R(ctx, q.x - cx, q.y - cy, q.s, q.s, q.col); } ctx.globalAlpha = 1;
  // 光
  ctx.globalCompositeOperation = 'lighter';
  for (const [lx, ly, col] of lights) drawGlow(lx - cx, ly - cy, 28, col, 0.22);
  ctx.globalCompositeOperation = 'source-over';
  if (!RN.mechAnim) for (const t of RN.texts) { if (t.big) { ctx.save(); ctx.translate(Math.round(t.x - cx), Math.round(t.y - cy)); ctx.scale(3, 3); drawNum(t.n, 0, 0, t.col); ctx.restore(); } else drawNum(t.n, t.x - cx, t.y - cy, t.col); }
  if (RN.mechAnim) drawMechAssembly(RN.mechAnim.t, p.x - cx, p.y - cy);
  if (RN.casters.some(c => c.st.realm > 0)) { // 鏡界：淡紫色調 + 鏡面裂紋
    ctx.globalAlpha = 0.14; R(ctx, 0, 0, W, H, '#a46be0'); ctx.globalAlpha = 0.35;
    const rs = srand(7); for (let i = 0; i < 9; i++) { const an = rs() * TAU, r0 = 60 + rs() * 40; pline(ctx, W / 2 + Math.cos(an) * r0, H / 2 + Math.sin(an) * r0, W / 2 + Math.cos(an) * 320, H / 2 + Math.sin(an) * 320, '#e6dcff', 1); }
    ctx.globalAlpha = 1;
  }
  // 暗角
  if (!VIGNETTE) { const [c, x] = mkCanvas(W, H); const g = x.createRadialGradient(W / 2, H / 2, 90, W / 2, H / 2, 290); g.addColorStop(0, 'rgba(8,4,16,0)'); g.addColorStop(1, 'rgba(8,4,16,.7)'); x.fillStyle = g; x.fillRect(0, 0, W, H); VIGNETTE = c; }
  ctx.drawImage(VIGNETTE, 0, 0);
  if (RN.freezeT > 0 && !RN.mechAnim) { ctx.globalAlpha = 0.18; R(ctx, 0, 0, W, H, '#73eff7'); ctx.globalAlpha = 1; }
  if (RN.p.hp / RN.p.maxhp < 0.3 && !RN.over && RN.mode !== 'boss') { ctx.globalAlpha = 0.15 + 0.1 * Math.sin(RN.t * 8); R(ctx, 0, 0, W, 3, '#ff4f6d'); R(ctx, 0, H - 3, W, 3, '#ff4f6d'); R(ctx, 0, 0, 3, H, '#ff4f6d'); R(ctx, W - 3, 0, 3, H, '#ff4f6d'); ctx.globalAlpha = 1; }
  // 虛擬搖桿
  if (joy.on) { ctx.globalAlpha = 0.4; pring(ctx, joy.x0, joy.y0, 24, '#f4f4f4', 1); const dx = joy.x - joy.x0, dy = joy.y - joy.y0, d = Math.hypot(dx, dy), m = Math.min(d, 24) / (d || 1); pcircle(ctx, joy.x0 + dx * m, joy.y0 + dy * m, 8, '#73eff7'); ctx.globalAlpha = 1; }
}
function drawMech(x, y, fr) {
  const p = RN.p, fl = Math.random();
  drawGlow(x, y - 10, 34, 'rgba(115,239,247,.3)');
  R(ctx, x - 12, y + 7, 24, 3, 'rgba(0,0,0,.4)');
  // 推進器噴焰
  for (const ox of [-9, 7]) { const L = 4 + Math.floor(fl * 4) + (p.moving ? 3 : 0); const fx0 = p.face ? x - ox - 2 : x + ox; R(ctx, fx0, y - 9, 3, L, '#ffa300'); R(ctx, fx0 + 1, y - 9, 1, L - 2, '#fff3c0'); drawGlow(fx0 + 1, y - 6 + L / 2, 8, 'rgba(255,163,0,.5)'); }
  if (p.inv > 0 && Math.floor(p.inv * 20) % 2 && !RN.mechAnim) return;
  drawSet(IMG.mech, fr, x, y + 9 - (p.moving && fr ? 1 : 0), p.face, false);
  // 核心爐脈動
  const cxp = p.face ? x - 1 : x; ctx.globalCompositeOperation = 'lighter'; drawGlow(cxp, y - 14, 7 + Math.floor((Math.sin(RN.t * 6) + 1) * 2), 'rgba(255,205,74,.8)'); ctx.globalCompositeOperation = 'source-over';
}
function drawMechAssembly(t, x, y) {
  const k = Math.min(1, t / 1.3), e = 1 - Math.pow(1 - k, 3);
  ctx.globalAlpha = 0.7 * Math.min(1, t * 3); R(ctx, 0, 0, W, H, '#0b0812'); ctx.globalAlpha = 1;
  drawGlow(x, y - 4, 30, 'rgba(115,239,247,.5)'); drawSet(IMG.clone, 0, x, y + 8, RN.p.face, false);
  pring(ctx, x, y - 10, 40 - e * 20, '#ffcd4a'); pring(ctx, x, y - 10, 46 - e * 26, '#73eff7');
  const cols = [['#e8eef5', '#73eff7'], ['#3b5dc9', '#ffcd4a'], ['#e8eef5', '#3b5dc9'], ['#94b0c2', '#73eff7'], ['#e8eef5', '#29366f'], ['#ffcd4a', '#fff3c0']];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU - Math.PI / 2 + t * 0.6, r = 190 * (1 - e) + 4, px = x + Math.cos(a) * r, py = y - 10 + Math.sin(a) * r * 0.75;
    pline(ctx, px, py, px - Math.cos(a) * -18 * (1 - e), py - Math.sin(a) * -14 * (1 - e), 'rgba(255,205,74,.5)', 2);
    drawGlow(px, py, 12, 'rgba(115,239,247,.6)');
    R(ctx, px - 5, py - 5, 10, 10, '#14101e'); R(ctx, px - 4, py - 4, 8, 8, cols[i][0]); R(ctx, px - 4, py, 8, 2, cols[i][1]); R(ctx, px - 4, py - 4, 8, 1, '#ffffff');
  }
  if (t > 1.3) { const f = (t - 1.3) / 0.6; ctx.globalAlpha = Math.min(1, f * 1.5); pcircle(ctx, x, y - 10, Math.floor(6 + f * 40), '#fff3c0'); ctx.globalAlpha = 1; }
}
function drawProj(q, x, y) {
  if (x < -30 || y < -30 || x > W + 30 || y > H + 30) return;
  const ang = Math.atan2(q.vy, q.vx), cs = Math.cos(ang), sn = Math.sin(ang);
  switch (q.kind) {
    case 'yinyang': drawGlow(x, y, 12, 'rgba(255,236,180,.5)'); pcircle(ctx, x, y, 6, '#14101e'); pcircle(ctx, x, y, 5, '#f4f4f4'); R(ctx, x - 5, y, 11, 5, '#14101e'); pcircle(ctx, x, y + 3, 1, '#f4f4f4'); pcircle(ctx, x, y - 3, 1, '#14101e'); R(ctx, x - 5, y, 11, 1, '#14101e'); break;
    case 'dragon': drawGlow(x, y, 20, 'rgba(255,163,0,.6)'); pcircle(ctx, x, y, 8, '#c86b1e'); pcircle(ctx, x, y, 6, '#ffa300'); pcircle(ctx, x + cs * 2, y + sn * 2, 3, '#ffec27'); R(ctx, x + cs * 5 - sn * 3, y + sn * 5 + cs * 3, 2, 2, '#14101e'); R(ctx, x + cs * 5 + sn * 3, y + sn * 5 - cs * 3, 2, 2, '#14101e'); break;
    case 'crescent': drawGlow(x, y, 12, 'rgba(115,239,247,.5)'); for (let i = -4; i <= 4; i++) { const a2 = ang + Math.PI / 2 + i * 0.25 - Math.PI / 2; R(ctx, x + Math.cos(ang + i * 0.28) * 6, y + Math.sin(ang + i * 0.28) * 6, 2, 2, i === 0 ? '#f4f4f4' : '#73eff7'); } break;
    case 'javelin': drawGlow(x, y, 12, 'rgba(255,236,39,.6)'); pline(ctx, x - cs * 10, y - sn * 10, x + cs * 6, y + sn * 6, '#ffec27', 2); R(ctx, x + cs * 6 - 1, y + sn * 6 - 1, 3, 3, '#f4f4f4'); if (Math.random() < 0.5) R(ctx, x + rand(-6, 6), y + rand(-6, 6), 1, 1, '#f4f4f4'); break;
    case 'arrow': pline(ctx, x - cs * 6, y - sn * 6, x + cs * 3, y + sn * 3, '#c0a080'); R(ctx, x + cs * 3, y + sn * 3, 2, 2, '#f4f4f4'); break;
    case 'bigarrow': drawGlow(x, y, 10, 'rgba(255,205,74,.5)'); pline(ctx, x - cs * 10, y - sn * 10, x + cs * 5, y + sn * 5, '#ffcd4a', 2); R(ctx, x + cs * 5 - 1, y + sn * 5 - 1, 3, 3, '#f4f4f4'); break;
    case 'star': drawGlow(x, y, 7, 'rgba(255,236,39,.6)'); R(ctx, x - 2, y, 5, 1, '#ffec27'); R(ctx, x, y - 2, 1, 5, '#ffec27'); break;
    case 'fan': { const a = q.t * 18; for (let i = 0; i < 3; i++) { const b = a + i * TAU / 3; pline(ctx, x, y, x + Math.cos(b) * q.r, y + Math.sin(b) * q.r, i ? '#94b0c2' : '#ff3860', 2); } R(ctx, x - 1, y - 1, 3, 3, '#14101e'); break; }
    case 'ki': drawGlow(x, y, 9, 'rgba(255,163,0,.6)'); pcircle(ctx, x, y, 3, '#ffa300'); R(ctx, x - 1, y - 1, 2, 2, '#fff3c0'); break;
    case 'wave': ctx.globalAlpha = Math.min(1, q.life * 2); for (let i = -3; i <= 3; i++) R(ctx, x + Math.cos(q.ang + Math.PI / 2) * i * 2, y + Math.sin(q.ang + Math.PI / 2) * i * 2, 2, 2, '#ffcd4a'); ctx.globalAlpha = 1; break;
    case 'wind': ctx.globalAlpha = Math.min(1, q.life * 3); for (let i = -2; i <= 2; i++) R(ctx, x + Math.cos(q.ang + Math.PI / 2) * i * 2 - cs * Math.abs(i), y + Math.sin(q.ang + Math.PI / 2) * i * 2 - sn * Math.abs(i), 1, 1, '#c9fff6'); ctx.globalAlpha = 1; break;
    case 'sword': drawGlow(x, y, 10, 'rgba(115,239,247,.5)'); pline(ctx, x - cs * 7, y - sn * 7, x + cs * 6, y + sn * 6, '#c9fff6', 2); R(ctx, x - cs * 4 - sn * 3, y - sn * 4 + cs * 3, 1, 1, '#ffcd4a'); R(ctx, x - cs * 4 + sn * 3, y - sn * 4 - cs * 3, 1, 1, '#ffcd4a'); pline(ctx, x - cs * 4 - sn * 2, y - sn * 4 + cs * 2, x - cs * 4 + sn * 2, y - sn * 4 - cs * 2, '#ffcd4a'); break;
    case 'fire': drawGlow(x, y, 12, 'rgba(255,120,0,.6)'); pcircle(ctx, x, y, 4, '#ff6a00'); pcircle(ctx, x, y, 2, '#ffec27'); break;
    case 'arcane': drawGlow(x, y, 9, 'rgba(192,108,240,.7)'); pcircle(ctx, x, y, 3, '#c06cf0'); R(ctx, x, y, 1, 1, '#f4f4f4'); break;
    case 'gear': { const a = q.t * 10; pcircle(ctx, x, y, 4, '#566c86'); for (let i = 0; i < 6; i++) R(ctx, x + Math.cos(a + i) * 5 - 1, y + Math.sin(a + i) * 5 - 1, 2, 2, '#ffcd4a'); R(ctx, x - 1, y - 1, 2, 2, '#14101e'); break; }
    case 'missile': pline(ctx, x - cs * 4, y - sn * 4, x + cs * 3, y + sn * 3, '#f4f4f4', 2); R(ctx, x + cs * 3, y + sn * 3, 2, 2, '#ff3860'); break;
    case 'fist': drawGlow(x, y, 9, 'rgba(115,239,247,.5)'); pcircle(ctx, x, y, 3, '#73eff7'); R(ctx, x - 1, y - 1, 2, 2, '#f4f4f4'); break;
    default: pcircle(ctx, x, y, q.r, '#f4f4f4');
  }
}
function drawFx(f, cx, cy) {
  const a = 1 - f.t / f.life; if (f.kind === 'flash') { ctx.globalAlpha = a; R(ctx, 0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; return; }
  const x = f.x - cx, y = f.y - cy; ctx.globalAlpha = Math.max(0, a);
  switch (f.kind) {
    case 'slash': for (let i = -10; i <= 10; i++) { const an = f.ang + i * 0.115; const r = f.r * (0.75 + 0.25 * (1 - Math.abs(i) / 10)); R(ctx, x + Math.cos(an) * r, y + Math.sin(an) * r, 2, 2, Math.abs(i) < 4 ? '#f4f4f4' : '#94b0c2'); R(ctx, x + Math.cos(an) * (r - 4), y + Math.sin(an) * (r - 4), 1, 1, '#73eff7'); } break;
    case 'whirl': pring(ctx, x, y, f.r, '#f4f4f4', 2); pring(ctx, x, y, f.r - 5, '#73eff7'); break;
    case 'thrust': pline(ctx, x, y, x + f.dx * f.len, y + f.dy * f.len, '#f4f4f4', 2); pline(ctx, x, y, x + f.dx * f.len * 0.7, y + f.dy * f.len * 0.7, '#ffcd4a', 1); break;
    case 'beam': drawGlow(x + f.dx * 20, y + f.dy * 20, 20, 'rgba(255,255,255,.4)'); pline(ctx, x, y, x + f.dx * f.len, y + f.dy * f.len, f.col, f.w); pline(ctx, x, y, x + f.dx * f.len, y + f.dy * f.len, '#f4f4f4', Math.max(1, Math.floor(f.w / 3))); break;
    case 'shock': pring(ctx, x, y, f.r * (1 - a * 0.6), '#ffcd4a', 2); pring(ctx, x, y, f.r * (1 - a * 0.6) * 0.7, '#f4f4f4'); break;
    case 'boom': { const r = Math.max(2, Math.floor(f.r * (0.4 + (1 - a) * 0.6))); pcircle(ctx, x, y, r, a > 0.6 ? '#f4f4f4' : '#ffa300'); if (r > 4) pcircle(ctx, x, y, r - 4, a > 0.5 ? '#ffec27' : '#c86b1e'); pring(ctx, x, y, r + 3, '#ffec27'); break; }
    case 'pop': pring(ctx, x, y, f.r * (1.5 - a * 0.5), '#c9fff6'); break;
    case 'ring': pring(ctx, x, y, f.r, f.col, 1); break;
    case 'bolt': { const pts = f.pts; for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; const mx = (x0 + x1) / 2 + rand(-6, 6), my = (y0 + y1) / 2 + rand(-6, 6); pline(ctx, x0 - cx, y0 - cy, mx - cx, my - cy, '#ffec27', 2); pline(ctx, mx - cx, my - cy, x1 - cx, y1 - cy, '#ffec27', 2); pline(ctx, x0 - cx, y0 - cy, mx - cx, my - cy, '#f4f4f4'); pline(ctx, mx - cx, my - cy, x1 - cx, y1 - cy, '#f4f4f4'); } break; }
    case 'warn': { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(f.t * 30); pring(ctx, x, y, f.r, '#ff6a00'); ctx.globalAlpha = 1; const k = f.t / f.life; const mx = x + (1 - k) * 60, my = y - (1 - k) * 160; drawGlow(mx, my, 16, 'rgba(255,120,0,.7)'); pcircle(ctx, mx, my, 6, '#c86b1e'); pcircle(ctx, mx, my, 4, '#ffa300'); pline(ctx, mx, my, mx + 14, my - 30, '#ffec27', 2); break; }
    case 'clock': { const r = f.r * (0.6 + (1 - a) * 1.4); pring(ctx, x, y, r, '#c9fff6', 2); for (let i = 0; i < 12; i++) { const an = i / 12 * TAU; R(ctx, x + Math.cos(an) * (r - 6), y + Math.sin(an) * (r - 6), 2, 2, '#73eff7'); } pline(ctx, x, y, x + Math.cos(f.t * 8) * r * 0.6, y + Math.sin(f.t * 8) * r * 0.6, '#f4f4f4', 2); break; }
    case 'dashline': pline(ctx, x, y, x + f.dx * f.len, y + f.dy * f.len, '#a46be0', 4); pline(ctx, x, y, x + f.dx * f.len, y + f.dy * f.len, '#c9b6ff', 2); pline(ctx, x, y, x + f.dx * f.len, y + f.dy * f.len, '#ffffff', 1); break;
    case 'shards': for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + 0.3, r = 6 + (1 - a) * 22; pline(ctx, x + Math.cos(an) * r, y + Math.sin(an) * r, x + Math.cos(an) * (r + 5), y + Math.sin(an) * (r + 5) - 2, i % 2 ? '#f4f4f4' : '#c9b6ff', 1); } break;
    case 'mirror': { const r = 20 + (1 - a) * 160; pring(ctx, x, y, r, '#c9b6ff', 2); pring(ctx, x, y, r * 0.7, '#ffffff'); break; }
    case 'drop': ctx.globalAlpha = a * 0.7; R(ctx, x - 4, 0, 8, y, '#ffcd4a'); R(ctx, x - 1, 0, 2, y, '#f4f4f4'); break;
  }
  ctx.globalAlpha = 1;
}


// ===== 主迴圈 =====
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; sceneT += dt;
  try { if (scene) { scene.update(dt); scene.draw(); } } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
function boot() {
  load(); initSprites(); initTiles(); initProps();
  for (const id in WEAPONS) ICONS[WEAPONS[id].icon] = iconURL(WEAPONS[id].icon, 3);
  fit(); go(TitleScene); requestAnimationFrame(frame);
}
let booted = false; const bootOnce = () => { if (!booted) { booted = true; boot(); } };
if (document.fonts && document.fonts.load) document.fonts.load('16px DotGothic16').then(bootOnce, bootOnce); setTimeout(bootOnce, 1500);
