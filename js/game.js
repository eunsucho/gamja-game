// 산성비 엔진. 화면 그리기는 단어 방울만 하고, 상태 변화는 hooks로 바깥(main.js)에 알린다.
// 전형 하나 = 본사 한 층. 받아칠 때마다 엘리베이터가 한 칸씩 올라가고, 칸을 다 채우면 그 전형 합격.
import { CONFIG } from "./config.js";
import { norm, keystrokes, shuffle } from "./util.js";

export const MINE = new Set(["X", "□"]);

export class Game {
  // opts.tutorial: 연습 라운드 대본 [{ kind: "job"|"trap", w?, text }]
  constructor(posting, sky, hooks, opts = {}) {
    this.p = posting;
    this.sky = sky;
    this.layer = sky.querySelector(".drops") || sky;
    this.hooks = hooks;              // { hud, event, stageClear, end, tutorialDone }
    this.script = opts.tutorial || null;
    this.si = 0;
    this.uid = 0;
    this.drops = [];
    this.bag = [];
    this.paused = false;
    this.running = false;
    this.fails = 0;
    this.steps = 0;
    this.timeLeft = CONFIG.stageSeconds;
    this.stats = {
      score: 0, combo: 0, maxCombo: 0, keys: 0, activeMs: 0,
      mineSpawned: 0, mineTyped: 0, salary: CONFIG.salaryBase,
      trapHits: 0, specHits: 0, claimOk: 0, claimWrong: 0, aiTyped: 0,
      typed: {}, aiGrabbed: {}, missed: {}   // 단어 text → 횟수
    };
    this._loop = this._loop.bind(this);
  }

  // ---------- 전형 진행 ----------
  get stage() { return this.p.stages[this.si]; }
  get isBonus() { return !this.script && this.stage.type === "bonus"; }
  has(feature) { return !this.script && (this.stage.features || []).includes(feature); }

  // 본사 전체에서 지금 높이 (0 = 1층 로비, 1 = 옥상)
  altitude() {
    const n = this.p.stages.length;
    const inStage = this.isBonus ? 1 - this.timeLeft / CONFIG.bonusSeconds : this.steps / CONFIG.floorSteps;
    return Math.min(1, (this.si + Math.max(0, Math.min(1, inStage))) / n);
  }

  startStage(i) {
    this.si = i;
    this.clearDrops();
    this.fails = 0;
    this.steps = 0;
    this.timeLeft = this.isBonus ? CONFIG.bonusSeconds : CONFIG.stageSeconds;
    this.fallSec = this.script ? CONFIG.tutorialFall : CONFIG.fallSeconds * Math.pow(CONFIG.fallSpeedUp, i);
    this.spawnSec = CONFIG.spawnSeconds * Math.pow(CONFIG.spawnSpeedUp, i) * (this.isBonus ? 0.7 : 1);
    this.spawnIn = this.script ? 0.8 : 0.4;
    this.tutI = 0;
    this.slowUntil = 0;
    const cs = getComputedStyle(this.sky);
    this.floorH = parseFloat(cs.getPropertyValue("--floor-h")) || 0;
    this.padLeft = parseFloat(cs.getPropertyValue("--pad-left")) || 8;
    this.dropTop = parseFloat(cs.getPropertyValue("--drop-top")) || 10;   // 단어가 출발하는 높이 (위 계기판 아래)
    this.running = true;
    this.paused = false;
    this.last = performance.now();
    requestAnimationFrame(this._loop);
  }

  pause() { this.paused = true; }
  resume() { if (!this.running) return; this.paused = false; this.last = performance.now(); requestAnimationFrame(this._loop); }
  stop() { this.running = false; this.clearDrops(); }

  // ---------- 루프 ----------
  _loop(now) {
    if (!this.running || this.paused) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.script) { this.stats.activeMs += dt * 1000; this.timeLeft -= dt; }
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      if (this.script) { if (!this.drops.length) this.spawnScripted(); this.spawnIn = 0.8; }
      else { this.spawn(); this.spawnIn = this.spawnSec * (0.8 + Math.random() * 0.4); }
    }

    const slow = now < this.slowUntil ? CONFIG.specSlowFactor : 1;
    const step = dt / this.fallSec * slow;
    const fallPx = this.sky.clientHeight - this.floorH - this.dropTop - 34;
    for (const d of this.drops.slice()) {
      d.y += step * d.speed;
      d.el.style.transform = `translateY(${d.y * fallPx}px)`;
      if (d.kind === "job" && d.w.judge === "O" && !d.tried && d.y >= d.grabAt) this.tryGrab(d);
      if (d.y >= 1) this.hitBottom(d);
    }
    if (!this.running) return;          // 연습 라운드가 방금 끝남
    this.hud(now < this.slowUntil);

    if (!this.script) {
      if (!this.isBonus && this.fails >= CONFIG.failLimit) return this.finish(false, "letters");
      if (!this.isBonus && this.steps >= CONFIG.floorSteps) return this.clearStage();
      if (this.timeLeft <= 0) return this.isBonus ? this.clearStage() : this.finish(false, "deadline");
    }
    requestAnimationFrame(this._loop);
  }

  clearStage() {
    this.running = false;
    this.clearDrops();
    const next = this.si + 1;
    if (next >= this.p.stages.length) return this.finish(true);
    this.hooks.stageClear(this.si, next);
  }

  // reason: "letters"(불합격 문자) | "deadline"(마감) | "quit"(포기)
  finish(passed, reason = null) {
    this.running = false;
    this.clearDrops();
    const s = this.stats;
    this.hooks.end({
      passed, reason,
      reached: passed ? this.p.stages.length : this.si,   // 통과한 전형 수
      failedStage: passed ? null : this.stage.name,
      score: Math.round(s.score),
      cpm: this.cpm(),
      guard: s.mineSpawned ? Math.round(100 * s.mineTyped / s.mineSpawned) : null,
      maxCombo: s.maxCombo,
      salary: s.salary,
      trapHits: s.trapHits, specHits: s.specHits, claimOk: s.claimOk, claimWrong: s.claimWrong, aiTyped: s.aiTyped,
      typed: s.typed, aiGrabbed: s.aiGrabbed, missed: s.missed
    });
  }

  cpm() { return this.stats.activeMs > 3000 ? Math.round(this.stats.keys / (this.stats.activeMs / 60000)) : 0; }

  hud(slow) {
    this.hooks.hud({
      stageName: this.stage.name, stageIndex: this.si, stageCount: this.p.stages.length, bonus: this.isBonus,
      tutorial: !!this.script,
      timeLeft: Math.max(0, this.timeLeft), timeTotal: this.isBonus ? CONFIG.bonusSeconds : CONFIG.stageSeconds,
      steps: this.steps, stepGoal: CONFIG.floorSteps, altitude: this.altitude(),
      fails: this.fails, failLimit: CONFIG.failLimit,
      score: Math.round(this.stats.score), combo: this.stats.combo, cpm: this.cpm(), salary: this.stats.salary, slow
    });
  }

  move(n) { this.steps = Math.max(0, Math.min(CONFIG.floorSteps, this.steps + n)); }

  // ---------- 단어 생성 ----------
  nextJobWord() {
    for (let tries = 0; tries < this.p.words.length; tries++) {
      if (!this.bag.length) this.bag = shuffle(this.p.words);
      const w = this.bag.pop();
      if (!this.onScreen(w.text)) return w;
    }
    return null;
  }

  onScreen(text) { return this.drops.some(d => d.text === text); }

  spawn() {
    if (this.drops.length >= CONFIG.maxOnScreen) return;
    let kind = "job", text, w = null;
    const r = Math.random();
    if (!this.isBonus && this.has("trap") && this.p.traps?.length && r < CONFIG.trapRate) kind = "trap";
    else if (!this.isBonus && this.has("spec") && this.p.specs?.length && r < CONFIG.trapRate + CONFIG.specRate) kind = "spec";
    let trap = null;
    if (kind === "trap") { trap = pick(this.p.traps); text = typeof trap === "string" ? trap : trap.text; }
    else if (kind === "spec") text = pick(this.p.specs);
    else { w = this.nextJobWord(); if (!w) return; text = w.text; }
    if (this.onScreen(text)) return;
    const spotlight = kind === "job" && !this.isBonus && this.has("interview") && Math.random() < CONFIG.spotlightRate;
    const d = this.addDrop(kind, text, w, { spotlight });
    d.trap = trap;
    if (kind === "job" && !this.isBonus && MINE.has(w.judge)) this.stats.mineSpawned++;
  }

  addDrop(kind, text, w, { spotlight = false, x = null, grabAt = null } = {}) {
    const el = document.createElement("div");
    el.className = `drop kind-${kind}` + (w ? ` j-${{ "O": "o", "△": "p", "X": "x", "□": "n" }[w.judge]}` : "");
    el.textContent = text;
    if (spotlight) { el.classList.add("spotlight"); el.dataset.q = this.p.questions?.length ? pick(this.p.questions) : "이건 AI가 하면 안 돼요?"; }
    this.layer.appendChild(el);
    this.hooks.event("spawn", { text, kind });   // 바깥에서 이번 층에 나온 단어를 모은다 (용어 풀이용)
    const maxLeft = Math.max(0, this.sky.clientWidth - el.offsetWidth - this.padLeft - 8);
    el.style.left = `${this.padLeft + (x == null ? Math.random() : x) * maxLeft}px`;
    const [g0, g1] = CONFIG.aiGrabWindow;
    const d = { id: ++this.uid, el, kind, w, text, y: 0, speed: this.script ? 1 : 0.85 + Math.random() * 0.3, spotlight,
      grabAt: grabAt ?? g0 + Math.random() * (g1 - g0), tried: false };
    this.drops.push(d);
    return d;
  }

  remove(d, cls) {
    this.drops = this.drops.filter(x => x !== d);
    if (cls) { d.el.classList.add(cls); setTimeout(() => d.el.remove(), 520); } else d.el.remove();
  }

  clearDrops() { this.drops.forEach(d => d.el.remove()); this.drops = []; }

  // ---------- 연습 라운드 ----------
  spawnScripted() {
    const item = this.script[this.tutI];
    if (!item) { this.running = false; this.clearDrops(); this.hooks.tutorialDone(); return; }
    this.addDrop(item.kind, item.text, item.w || null, { x: 0.35, grabAt: 0.5 });
    this.hooks.event("tut", { phase: "spawn", i: this.tutI, item });
  }

  tutResolve(d, outcome) {
    const item = this.script[this.tutI];
    const mine = item.kind === "job" && item.w.judge !== "O";
    const ok = item.kind === "trap" ? outcome === "fell" : mine ? outcome === "typed" : true;
    this.hooks.event("tut", { phase: ok ? "ok" : "retry", i: this.tutI, item, outcome, el: d.el });
    if (ok) this.tutI++;
    this.spawnIn = 1.6;
  }

  // ---------- AI 동기 ----------
  tryGrab(d) {
    d.tried = true;
    if (this.script || Math.random() < (d.w.pct ?? 0) / 100) {
      bump(this.stats.aiGrabbed, d.text);
      this.hooks.event("ai-grab", { word: d.w, el: d.el });
      this.remove(d, "grabbed");
      if (this.script) this.tutResolve(d, "grabbed");
    }
  }

  // ---------- 바닥에 닿음 ----------
  hitBottom(d) {
    this.remove(d, "splash");
    if (this.script) return this.tutResolve(d, "fell");
    if (this.isBonus || d.kind !== "job") return;
    const j = d.w.judge;
    if (j === "O") {
      this.stats.score += CONFIG.score.aiMissed;
      this.hooks.event("ai-missed", { word: d.w, el: d.el, points: CONFIG.score.aiMissed });
    } else if (j === "△") {
      if (Math.random() < CONFIG.partialMissFail) this.fail(d);
      else this.hooks.event("ai-saved", { word: d.w, el: d.el });
    } else {
      this.fail(d);
    }
  }

  fail(d) {
    this.fails++;
    this.stats.combo = 0;
    this.move(CONFIG.steps.miss);
    bump(this.stats.missed, d.text);
    this.hooks.event("fail", { word: d.w, fails: this.fails, el: d.el });
  }

  // ---------- 입력 ----------
  submit(raw) {
    if (!this.running || this.paused) return false;
    const n = norm(raw);
    if (!n) return false;
    const hits = this.drops.filter(d => norm(d.text) === n).sort((a, b) => b.y - a.y);
    if (!hits.length) { this.stats.combo = 0; this.hooks.event("typo", { text: raw }); return false; }
    const d = hits[0], S = this.stats, C = CONFIG.score, M = CONFIG.steps;
    this.remove(d, "pop");
    if (this.script) { this.tutResolve(d, "typed"); return true; }
    S.keys += keystrokes(d.text);
    const emit = (type, points, extra = {}) => { S.score += points; this.hooks.event(type, { el: d.el, points, ...extra }); };

    if (d.kind === "trap") {
      S.combo = 0; S.trapHits++; this.move(M.trap);
      emit("trap", C.trap, { text: d.text, owner: d.trap?.owner, why: d.trap?.why });
      return true;
    }
    if (d.kind === "spec") {
      S.combo++; S.specHits++;
      this.slowUntil = performance.now() + CONFIG.specSlowSeconds * 1000;
      emit("spec", C.spec, { text: d.text });
      return true;
    }

    const j = d.w.judge;
    S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
    if (this.isBonus) {
      S.salary += keystrokes(d.text) * CONFIG.salaryPerKey;
      emit("salary", C.partial, { salary: S.salary, word: d.w });
      return true;
    }
    bump(S.typed, d.text);
    if (MINE.has(j)) S.mineTyped++;
    if (j === "O") S.aiTyped++;
    this.move(MINE.has(j) ? M.mine : j === "△" ? M.partial : M.aiOwned);
    const base = (MINE.has(j) ? C.mine : j === "△" ? C.partial : C.aiOwned) + S.combo * C.comboStep;
    if (d.spotlight) {
      if (j === "O") { S.claimWrong++; emit("claim-wrong", base + C.claimWrong, { word: d.w }); }
      else { S.claimOk++; emit("claim-ok", base + C.claimOk, { word: d.w }); }
    } else {
      emit("typed", base, { word: d.w });
    }
    return true;
  }
}

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function bump(map, k) { map[k] = (map[k] || 0) + 1; }
