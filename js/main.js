// 화면 전환과 연출. 규칙은 game.js, 숫자는 config.js, 문구는 copy.js, 층 이름은 scene.js, 데이터 읽기는 data.js.
// 화면 = 본사 안의 장소: 거리(타이틀) → 감자극장(인트로) → 로비 → 엘리베이터 홀 → 엘리베이터 안 → 옥상 또는 출구
import { loadIndex, loadPosting } from "./data.js";
import { Game, MINE } from "./game.js";
import { loadRecords, saveRecord, getFlag, setFlag } from "./storage.js";
import { esc } from "./util.js";
import { CONFIG } from "./config.js";
import { floors } from "./scene.js";
import * as T from "./copy.js";

const $ = id => document.getElementById(id);
const VIEWS = ["v-title", "v-intro", "v-select", "v-brief", "v-play", "v-result"];
// 화면마다 처음 누를 버튼. 키보드만으로도 Enter로 이어 갈 수 있게 미리 맞춰 둔다
const FIRST = { "v-title": "toStart", "v-intro": "introNext", "v-brief": "startGame", "v-result": "memoNext" };
function show(v) {
  VIEWS.forEach(x => $(x).hidden = x !== v);
  document.body.dataset.view = v;
  syncBackdrop();
  keyhint(v);
  const first = v === "v-select" ? $("postingList").querySelector("[data-id]") : $(FIRST[v]);
  if (first && v !== "v-play" && document.body.classList.contains("desk")) first.focus({ preventScroll: true });
}

let INDEX = null, current = null, game = null, FLOORS = [], wingId = null;
let alt = 0, altTarget = 0;
const mood = { now: "", oopsUntil: 0 };
let seen = new Set(), shownTerms = new Set();
let grabbed = 0;   // 이번 판에 AI 동기가 가져간 단어 수   // 이번 층에 나온 단어, 이미 풀이를 보여 준 용어

// ---------- 전체 화면: 폰 키보드가 올라오면 실제로 보이는 높이에 맞춘다 ----------
// 가로로 넓은 화면(데스크탑·가로 태블릿)에서는 세로 그림이 잘리지 않게 가운데 9:16 무대에 담는다.
const GAP = 16;
const TOUCH = matchMedia("(hover: none) and (pointer: coarse)");
function fit() {
  const vv = window.visualViewport;
  const W = window.innerWidth, H = window.innerHeight;
  const desk = W >= 700 && W / H > 0.75;
  let h = vv ? vv.height : H, top = vv ? vv.offsetTop : 0;
  if (desk) { h = H - GAP * 2; top = GAP; }
  const w = Math.min(W, Math.round(h * 9 / 16));
  const app = $("app");
  document.body.classList.toggle("desk", desk);
  document.body.classList.toggle("narrow", desk && (W - w) / 2 < 240);   // 무대 옆에 키 안내를 둘 자리가 없을 때
  document.body.style.setProperty("--stage-w", `${w}px`);
  app.style.setProperty("--app-h", `${Math.round(h)}px`);
  app.style.setProperty("--app-top", `${Math.round(top)}px`);
  app.classList.toggle("compact", h < 640);
  // 터치 폰에서 보이는 높이가 600 아래 = 대개 키보드가 올라온 상태. 게임 화면을 키보드용으로 바꾼다
  app.classList.toggle("kb", !desk && TOUCH.matches && h < 600);
  game?.measure();
}
window.addEventListener("resize", fit);
window.visualViewport?.addEventListener("resize", fit);
window.visualViewport?.addEventListener("scroll", fit);
fit();

// ---------- 폰이면 모바일 평균 타자 속도에 맞춘다 (마우스 없이 터치만 되는 기기) ----------
const pace = () => TOUCH.matches ? CONFIG.mobilePace : 1;

// ---------- 무대 밖 배경과 키 안내 (데스크탑) ----------
function syncBackdrop(img) {
  const v = document.body.dataset.view;
  const src = img ? `url(${img})` : $(v)?.querySelector(".bg")?.style.backgroundImage;
  if (src) $("backdrop").style.backgroundImage = src;
}
const KEYS = {
  "v-title": [["Enter", "시작"]],
  "v-intro": [["→", "다음"], ["Esc", "건너뛰기"]],
  "v-select": [["Tab", "고르기"], ["Enter", "선택"]],
  "v-brief": [["Enter", "출근"]],
  "v-play": [["Enter", "입력"], ["Esc", "일시정지"]],
  "v-result": [["← →", "회고록 넘기기"]],
};
function keyhint(v) {
  $("keyhint").innerHTML = (KEYS[v] || []).map(([k, t]) => `<p><kbd>${k}</kbd>${t}</p>`).join("");
}

// ---------- 창밖: 높이에 따라 낮 → 노을 → 구름 위 배경으로 바뀐다 ----------
const clamp01 = x => Math.max(0, Math.min(1, x));
function setAltitude(a, instant = false) {
  altTarget = a;
  if (instant) alt = a;
  alt += (altTarget - alt) * 0.08;
  $("liftSunset").style.opacity = clamp01((alt - 0.3) / 0.3);
  $("liftClouds").style.opacity = clamp01((alt - 0.7) / 0.25);
}

// ---------- 감자 · AI 동기 ----------
function setMood(m) {
  if (mood.now === m) return;
  mood.now = m;
  $("hero").className = `who me mood-${m}`;
}
function moodFrom(h) {
  if (performance.now() < mood.oopsUntil) return "oops";
  if (!h.bonus && !h.tutorial && h.fails >= 2) return "teary";
  if (h.combo >= CONFIG.mood.fire) return "fire";
  if (h.combo >= CONFIG.mood.spark) return "spark";
  return "idle";
}

let buddyTimer = 0;
function buddy(kind, text) {
  const b = $("buddy");
  b.className = `who ai react-${kind}`;
  $("buddySay").textContent = text || "";
  clearTimeout(buddyTimer);
  buddyTimer = setTimeout(() => { b.className = "who ai"; $("buddySay").textContent = ""; }, 1300);
}

function say(text) { $("say").textContent = text; }

// 규칙 카드: 사람 몫 / AI 몫 / 옆 팀 일을 캐릭터 그림과 예시 단어로 보여 준다
const WHO_IMG = { me: "assets/potato_cut.png", ai: "assets/ai_cut.png" };
function rulesHTML() {
  return `<div class="how">` + T.RULES.map(r => `<div class="how-tile ${r.who}">
    <span class="how-pic">${WHO_IMG[r.who] ? `<img class="face" src="${WHO_IMG[r.who]}" alt="">` : ""}<img class="badge-it" src="assets/items/${r.item}.png" alt=""></span>
    <span class="how-word">${esc(r.word)}</span><b>${esc(r.label)}</b></div>`).join("") + `</div>`;
}
const item = (n, cls = "") => `<img class="it ${cls}" src="assets/items/${n}.png" alt="">`;
// 목표: 쳐서 → 게이지 → 최종합격
function goalHTML() {
  return `<div class="goal-row">${item("key")}<i class="arr"></i>${item("star")}<i class="arr"></i>${item("trophy")}</div>`;
}

// 단어가 AI 동기 쪽으로 빨려 들어간다
function flyToBuddy(el) {
  const b = $("buddy").getBoundingClientRect(), r = el.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (r.left + r.width / 2), dy = b.top + b.height * 0.35 - (r.top + r.height / 2);
  el.style.transition = "translate .5s cubic-bezier(.5,0,.8,.5), scale .5s ease-in, opacity .5s ease-in";
  el.style.translate = `${dx}px ${dy}px`;
  el.style.scale = ".3";
  el.style.opacity = "0";
}

// 단어 자리에서 점수가 떠오른다
function floatAt(el, text, tone) {
  if (!el || !text) return;
  const s = $("sky").getBoundingClientRect(), r = el.getBoundingClientRect();
  const f = document.createElement("span");
  f.className = `float ${tone}`;
  f.textContent = text;
  f.style.left = `${r.left - s.left + r.width / 2}px`;
  f.style.top = `${Math.max(8, r.top - s.top)}px`;
  $("floats").appendChild(f);
  setTimeout(() => f.remove(), 950);
}

// 휴대폰 문자 배너 (메시지 앱처럼)
function smsHTML(body) {
  return `<div class="noti-top"><span class="ico"><i class="ti ti-message-circle"></i></span>${esc(T.SMS.app)}<span class="t">지금</span></div>
    <p class="noti-from">${esc(T.SMS.sender)}</p><p class="noti-body">${esc(body)}</p>`;
}
function notify(body) {
  const box = $("notifs");
  while (box.children.length >= 1) box.firstElementChild.remove();
  const n = document.createElement("div");
  n.className = "noti";
  n.innerHTML = smsHTML(body);
  box.appendChild(n);
  setTimeout(() => { n.classList.add("out"); setTimeout(() => n.remove(), 380); }, 2600);
}

function retrigger(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// ---------- 층 도착 카드 ----------
function doorShow({ floor, msg, tip, terms = [], html = "", icon = "" }, { button = null, auto = 0 } = {}) {
  $("dIcon").hidden = !icon;
  if (icon) $("dIcon").src = `assets/items/${icon}.png`;
  $("dHow").hidden = !html;
  $("dHow").innerHTML = html;
  $("dTerms").hidden = !terms.length;
  $("dTerms").innerHTML = terms.length ? `<span>${esc(T.DOOR.termsLabel)}</span>` + terms.map(t => `<p><b>${esc(t.term)}</b> · ${esc(t.desc)}</p>`).join("") : "";
  $("dFloor").textContent = floor || "";
  $("dMsg").textContent = msg || "";
  $("dTip").textContent = tip || "";
  $("dDing").hidden = true;
  $("dMsg").hidden = !msg; $("dTip").hidden = !tip;
  $("doors").classList.remove("open");
  $("typeInput").blur();
  return new Promise(res => {
    if (button) {
      $("dGo").hidden = false; $("dGo").textContent = button;
      $("dGo").onclick = () => { $("dGo").hidden = true; res(); };
      setTimeout(() => $("dGo").focus(), 400);
    } else {
      $("dGo").hidden = true;
      setTimeout(res, auto || 1200);
    }
  });
}
function doorOpen() { $("doors").classList.add("open"); $("typeInput").value = ""; $("typeInput").focus(); }

// ---------- 시작 ----------
async function init() {
  $("creditsText").textContent = T.CREDITS;
  $("pauseHow").innerHTML = rulesHTML();
  $("lobbyTitle").textContent = T.LOBBY.title;
  $("goLabel").textContent = T.BRIEF.go;
  $("docuTag").textContent = T.DOCU_TITLE;
  INDEX = await loadIndex();
  if (INDEX.season) $("season").textContent = INDEX.season;
  const first = INDEX.fields.find(f => f.jobs.some(j => j.postings.length)) || INDEX.fields[0];
  wingId = first?.id;
  // 배경 그림을 미리 받아 둔다
  ["lobby", "hall", "lift_day", "lift_sunset", "lift_clouds", "roof", "exit"].forEach(n => { new Image().src = `assets/bg/${n}.jpg`; });
}

// ---------- 감자극장 (인트로) ----------
let introI = 0;
function openIntro() { introI = 0; renderIntro(); show("v-intro"); }
function renderIntro() {
  const c = T.INTRO[introI];
  const bg = $("docuBg");
  bg.style.backgroundImage = `url(${c.img})`;
  retrigger(bg, "kenburns");
  syncBackdrop(c.img);
  $("docuSays").innerHTML = (c.say ? `<p class="bubble hand">${esc(c.say).replace(/\n/g, "<br>")}</p>` : "") +
    (c.ai ? `<p class="bubble hand ai">${esc(c.ai)}</p>` : "");
  const sub = $("docuSub");
  sub.textContent = c.nar || "";
  sub.hidden = !c.nar;
  retrigger(sub, "docu-sub");
  $("rulesCard").hidden = !c.rules;
  requestAnimationFrame(() => placeBubbles(c));
  if (c.rules) $("rulesCard").innerHTML = rulesHTML() + goalHTML();
  placeBubbles(c);
  $("introDots").innerHTML = T.INTRO.map((_, i) => `<i class="${i === introI ? "on" : ""}"></i>`).join("");
  $("introNext").textContent = introI === T.INTRO.length - 1 ? "로비로" : "다음";
}
// 말풍선을 그림 속 감자(c.at)·AI 동기(c.aiAt) 머리 위에 붙인다. 좌표는 그림 기준 0~1
function placeBubbles(c) {
  const bg = $("docuBg"), box = $("v-intro").getBoundingClientRect(), r = bg.getBoundingClientRect();
  const IW = 900, IH = 1600, k = Math.max(r.width / IW, r.height / IH);
  const ox = (r.width - IW * k) * 0.5, oy = (r.height - IH * k) * 0.72;   // background-position: center 72%
  const pt = ([fx, fy]) => [r.left - box.left + ox + fx * IW * k, r.top - box.top + oy + fy * IH * k];
  $("docuSays").querySelectorAll(".bubble").forEach(b => {
    const at = b.classList.contains("ai") ? c.aiAt : c.at;
    if (!at) { b.style.cssText = ""; return; }
    const [x, y] = pt(at);
    const w = b.offsetWidth, left = Math.max(12, Math.min(box.width - w - 12, x - w / 2));
    b.style.position = "absolute";
    b.style.left = `${left}px`;
    b.style.top = `${Math.max(60, y - b.offsetHeight - 16)}px`;
    b.style.setProperty("--tail", `${Math.max(16, Math.min(w - 16, x - left))}px`);
  });
}
window.addEventListener("resize", () => { if (document.body.dataset.view === "v-intro") placeBubbles(T.INTRO[introI]); });

function introNext() { if (introI < T.INTRO.length - 1) { introI++; renderIntro(); } else introDone(); }
function introDone() { setFlag("intro"); openLobby(); }

// ---------- 로비 ----------
function openLobby() { renderLobby(); show("v-select"); }

function renderLobby() {
  if (!INDEX) return;
  const count = f => f.jobs.reduce((n, j) => n + j.postings.length, 0);
  $("wingTabs").innerHTML = INDEX.fields.map(f =>
    `<button class="chip glass" role="tab" data-wing="${esc(f.id)}" aria-selected="${f.id === wingId}"><i class="ti ti-${esc(f.icon || "building")}" aria-hidden="true"></i><span>${esc(f.short || f.name)}</span><em>${count(f)}</em></button>`).join("");
  $("wingTabs").querySelectorAll("[data-wing]").forEach(b => b.onclick = () => { wingId = b.dataset.wing; renderLobby(); });

  const rec = loadRecords();
  const f = INDEX.fields.find(x => x.id === wingId) || INDEX.fields[0];
  const ps = (f?.jobs || []).flatMap(j => j.postings);
  $("postingList").innerHTML = ps.length ? `<div class="plist">` + ps.map(p => {
    const r = rec[p.id];
    const mark = r ? `<i class="ti ti-${r.passed ? "trophy" : "rotate"}" aria-label="${r.passed ? "합격 기록 있음" : "지원한 적 있음"}"></i>` : "";
    return `<button class="prow" data-id="${esc(p.id)}"><span><p class="co">${esc(p.company)}${mark}</p><p class="pos">${esc(p.position)}</p></span><span class="go">›</span></button>`;
  }).join("") + `</div>` : `<div class="card soon"><p class="pos">${esc(T.LOBBY.empty)}</p></div>`;
  $("postingList").querySelectorAll("[data-id]").forEach(b => b.onclick = () => openBrief(b.dataset.id));
  $("postingList").scrollTop = 0;
}

// ---------- 엘리베이터 홀: 공고 ----------
async function openBrief(id) {
  try { current = await loadPosting(id); }
  catch (e) { $("problems").hidden = false; $("problems").textContent = `이 공고를 읽지 못했어요 (${e.message})`; return; }
  $("problems").hidden = true;
  const fl = floors(current.stages);
  // 전형 = 스테이지. 한 줄로 이어진 길: 1 서류(START) → 2 → … → 최종합격
  const rows = fl.map((f, i) => `<li class="st ${f.bonus ? "bonus" : ""} ${i === 0 ? "first" : ""}"><b>${f.step}</b><span>${esc(f.name)}</span>${i === 0 ? `<em>START</em>` : ""}</li>`)
    .concat(`<li class="st roof"><img src="assets/items/trophy.png" alt=""><span>최종합격</span></li>`);
  $("brief").innerHTML = `<span class="eyebrow"><i class="ti ti-building-skyscraper" aria-hidden="true"></i>${esc(current.company)}</span>
    <h2>${esc(current.position)}</h2>
    
    <ol class="stages">${rows.join("")}</ol>`;
  show("v-brief");
}

let calling = false;
function callElevator() {
  if (calling) return;
  calling = true;
  grabbed = 0;
  setTimeout(() => { calling = false; (!getFlag("tutorial") ? startTutorial() : startGame()); }, 350);
}

// ---------- 연습 라운드 ----------
function startTutorial() {
  game?.stop();
  const ws = current.words.slice();
  const o = ws.filter(w => w.judge === "O").sort((a, b) => b.pct - a.pct)[0] || ws.slice().sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
  const mine = ws.find(w => MINE.has(w.judge)) || ws.slice().sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))[0];
  const t0 = current.traps?.[0];
  const trap = t0 ? (typeof t0 === "string" ? t0 : t0.text) : "보도자료 배포";
  const script = [{ kind: "job", w: o, text: o.text }, { kind: "job", w: mine, text: mine.text }, { kind: "trap", text: trap }];
  const pseudo = { stages: [{ name: "연습" }], words: [o, mine] };
  game = new Game(pseudo, $("sky"), { hud, event: onEvent, stageClear() {}, end() {}, tutorialDone }, { tutorial: script, pace: pace() });
  FLOORS = floors(current.stages);
  setAltitude(0, true);
  setMood("idle");
  say("연습이니까 마음 편하게…");
  enterLift();
  game.hud(false);
  doorShow({ floor: "연습", msg: "", html: rulesHTML(), icon: "key" }, { button: "시작!" }).then(() => { doorOpen(); game.startStage(0); });
}

// 이번 층에 내려온 단어 속 낯선 용어 (한 번 보여 준 건 다시 안 보여 줌, 최대 2개)
function termsSeen() {
  const texts = [...seen];
  const out = (current.terms || []).filter(t => !shownTerms.has(t.term) && texts.some(x => x.includes(t.term))).slice(0, 2);
  out.forEach(t => shownTerms.add(t.term));
  return out;
}

function tip(text, icon = "") {
  const t = $("tutTip");
  t.hidden = !text;
  t.innerHTML = text ? (icon ? item(icon) : "") + `<span>${esc(text)}</span>` : "";
  if (text) retrigger(t, "pop-in");
}

function tutorialDone() {
  setFlag("tutorial");
  tip("");
  delete $("v-play").dataset.tut;
  doorShow({ ...T.TUT.done, icon: "check" }, { button: "진짜 시작!" }).then(startGame);
}

// ---------- 본 게임 ----------
function enterLift() {
  $("pausedCover").classList.add("open");
  $("notifs").innerHTML = "";
  show("v-play");
}

function startGame() {
  game?.stop();
  tip("");
  FLOORS = floors(current.stages);
  setAltitude(0, true);
  game = new Game(current, $("sky"), { hud, event: onEvent, stageClear, end }, { pace: pace() });
  seen = new Set(); shownTerms = new Set();
  grabbed = 0;
  mood.oopsUntil = 0;
  setMood("idle");
  say(T.LINES.start);
  enterLift();
  game.hud(false);
  doorShow({ ...T.DOOR.start(FLOORS[0]), icon: "badge" }, { auto: 1300 }).then(() => { doorOpen(); game.startStage(0); });
}

function hud(h) {
  const f = FLOORS[h.stageIndex] || {};
  $("hFloor").textContent = h.tutorial ? "연습" : f.label;
  $("hRoom").textContent = h.tutorial ? "" : f.room;
  $("hAi").textContent = grabbed;
  $("hScore").textContent = h.score.toLocaleString();
  const combo = h.combo >= CONFIG.mood.spark;
  $("hCombo").hidden = !combo;
  if (combo) $("hCombo").textContent = `콤보 ${h.combo}`;
  $("hFails").hidden = h.bonus || h.tutorial;
  $("hFails").innerHTML = Array.from({ length: h.failLimit }, (_, i) => `<img src="assets/items/letter.png" class="${i < h.fails ? "on" : ""}" alt="">`).join("");
  $("hSteps").hidden = h.bonus || h.tutorial;
  $("hStepLabel").hidden = h.bonus || h.tutorial;

  $("hSteps").innerHTML = Array.from({ length: h.stepGoal }, (_, i) => `<i class="${h.steps >= i + 1 ? "on" : h.steps > i ? "half" : ""}"></i>`).join("");
  $("hTimeWrap").hidden = h.tutorial;
  $("hTime").style.width = `${(h.timeLeft / h.timeTotal) * 100}%`;
  $("hTimeWrap").classList.toggle("low", !h.bonus && h.timeLeft < 10);
  $("hSalaryWrap").hidden = !h.bonus;
  $("hSalary").textContent = h.salary.toLocaleString();
  if (!h.tutorial) setAltitude(h.altitude);
  setMood(moodFrom(h));
}

function onEvent(type, p) {
  if (type === "typo") { retrigger($("typeForm"), "shake"); return; }
  if (type === "spawn") { seen.add(p.text); return; }
  if (type === "tut") return onTut(p);
  const w = p.word || {};

  // 떠오르는 점수: 숫자만 (함정·스펙 같은 것만 짧은 말)
  if (p.points != null && p.points !== 0) {
    const label = T.FLOAT[type]?.(w, p) || "";
    floatAt(p.el, `${p.points > 0 ? "+" : ""}${p.points}${label ? " " + label : ""}`, p.points < 0 ? "bad" : "good");
  }

  // AI 동기 반응
  if (type === "typed") w.judge === "O" ? buddy("shrug", T.BUDDY.shrug) : buddy("nod", T.BUDDY.nod);
  else if (type === "claim-ok") buddy("nod", T.BUDDY.nod);
  else if (type === "claim-wrong") buddy("shrug", T.BUDDY.claimWrong);
  else if (type === "ai-grab") {
    grabbed++;
    floatAt(p.el, "AI 동기가 가져감!", "ai");
    p.el.classList.add("seized");
    flyToBuddy(p.el);
    buddy("grab", T.BUDDY.grab);
    retrigger($("hAiWrap"), "buzz");
  }
  else if (type === "ai-missed") buddy("sweat", T.BUDDY.missed);

  // 실수: 덜컹, 감자 당황, 채용팀 문자
  if (type === "fail" || type === "trap" || type === "claim-wrong") {
    mood.oopsUntil = performance.now() + CONFIG.mood.oopsMs;
    retrigger($("sky"), "jolt");
  }
  if (type === "fail") { retrigger($("hFails"), "buzz"); notify(T.SMS.miss(game.stage.name, p.fails)); }

  const line = T.LINES[type];
  if (line) say(line(w, p));
}

function onTut(p) {
  if (p.phase === "spawn") {
    tip(T.TUT.spawn[p.i], ["grab", "key", "ban"][p.i]);
    $("buddy").classList.toggle("spot", p.i === 0);
    $("v-play").dataset.tut = p.i;
    $("typeForm").classList.toggle("glow", p.i === 1);
    if (p.i === 1) $("typeInput").focus();
    return;
  }
  $("typeForm").classList.remove("glow");
  $("buddy").classList.remove("spot");
  if (p.phase === "ok") {
    tip(p.outcome === "typed" && p.item.w?.judge === "O" ? T.TUT.okTypedAi : T.TUT.ok[p.i], ["grab", "star", "check"][p.i]);
    if (p.outcome === "typed") buddy(p.i === 1 ? "nod" : "shrug", p.i === 1 ? T.BUDDY.nod : T.BUDDY.shrug);
  } else {
    tip(T.TUT.retry[p.i], "ban");
    mood.oopsUntil = performance.now() + CONFIG.mood.oopsMs;
    setMood("oops");
    retrigger($("sky"), "jolt");
  }
}

function stageClear(doneIdx, nextIdx) {
  const done = current.stages[doneIdx], next = current.stages[nextIdx];
  setAltitude(nextIdx / current.stages.length);
  setMood("fire");
  say(`${done.name} 붙었다…! 믿기지 않아.`);
  const card = T.DOOR.clear(done, FLOORS[nextIdx], next);
  const stageTerm = (current.terms || []).find(t => t.term === next.name || next.name.includes(t.term));
  if (stageTerm) card.tip = stageTerm.desc;              // 다음 전형 이름이 낯선 말이면 그 풀이를 보여 준다
  card.terms = termsSeen();
  seen = new Set();
  card.icon = "check";
  doorShow(card, { button: "GO!" }).then(() => { doorOpen(); game.startStage(nextIdx); });
}

// 폰 타수: 첫 글자를 친 순간부터 Enter까지만 잰다. 한 번에 3글자 넘게 들어오면 자동완성으로 보고 타수에서 뺀다
let typing0 = 0, typingAssist = false, lastLen = 0;
$("typeInput").addEventListener("input", e => {
  const v = e.target.value;
  if (!v) { typing0 = 0; typingAssist = false; lastLen = 0; return; }
  if (!typing0) typing0 = performance.now();
  if (v.length - lastLen >= 3 && !e.isComposing) typingAssist = true;
  lastLen = v.length;
});
$("typeForm").addEventListener("submit", e => {
  e.preventDefault();
  const input = $("typeInput");
  game?.submit(input.value, { ms: typing0 ? performance.now() - typing0 : 0, assisted: typingAssist });
  typing0 = 0; typingAssist = false;
  input.value = "";   // 산성비처럼 Enter를 누르면 맞든 틀리든 입력창을 비운다
  input.focus();
});
function setPaused(on) {
  if (!game?.running) return;
  if (on) game.pause(); else game.resume();
  $("pausedCover").classList.toggle("open", !on);
  if (!on) $("typeInput").focus();
}
$("pauseBtn").onclick = () => setPaused(true);
$("resumeBtn").onclick = () => setPaused(false);
$("quitBtn").onclick = () => {
  if (!game) return;
  $("pausedCover").classList.add("open");
  if (game.script) { game.stop(); tutorialDone(); return; }   // 연습 중 포기 = 연습 건너뛰기
  game.finish(false, "quit");
};
document.addEventListener("visibilitychange", () => { if (document.hidden && game?.running && !game.paused) setPaused(true); });

// ---------- 키보드 ----------
const typing = e => e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
document.addEventListener("keydown", e => {
  if (e.isComposing || $("credits").open) return;
  const v = document.body.dataset.view;
  const onButton = document.activeElement?.closest("button, input, a");
  if (v === "v-intro") {
    if (e.key === "Escape") { e.preventDefault(); introDone(); }
    else if (e.key === "ArrowRight" || (!onButton && (e.key === "Enter" || e.key === " "))) { e.preventDefault(); introNext(); }
    else if (e.key === "ArrowLeft" && introI > 0) { e.preventDefault(); introI--; renderIntro(); }
  } else if (v === "v-play") {
    const doorsShut = !$("doors").classList.contains("open");
    if (e.key === "Escape" && game?.running && !doorsShut) { e.preventDefault(); setPaused(!game.paused); if (game.paused) $("resumeBtn").focus(); }
    // 다른 곳을 눌러 입력창 포커스가 빠져도, 글자를 치면 바로 입력창으로 돌아간다
    else if (typing(e) && !onButton && !doorsShut && !game?.paused) $("typeInput").focus();
  } else if (v === "v-result") {
    if (e.key === "ArrowLeft") { e.preventDefault(); $("memoPrev").click(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); $("memoNext").click(); }
  }
});
// 게임 화면 빈 곳을 클릭해도 입력창이 포커스를 잃지 않게
$("v-play").addEventListener("pointerdown", e => {
  if (!e.target.closest("button, input") && game?.running && !game.paused) { e.preventDefault(); $("typeInput").focus(); }
});

// ---------- 결과: 옥상 또는 1층 출구 + 감자 회고록 ----------
function end(r) {
  if (r.passed) {
    setAltitude(1, true);
    setMood("hired");
    say(T.RESULT.sayPass);
    doorShow({ ...T.DOOR.roof, icon: "trophy" }, { auto: 1600 }).then(() => renderResult(r));
  } else {
    setMood("teary");
    setTimeout(() => renderResult(r), 500);
  }
}

// ---------- 공유 카드: 감자 그림 + 큰 타수 + 배운 것 한 줄 ----------
let lastShare = null;
const imgCache = {};
const loadImg = src => imgCache[src] || (imgCache[src] = new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
async function drawShare(cv) {
  const s = lastShare; if (!s) return;
  await document.fonts?.load?.("80px Jua").catch(() => {});
  const g = cv.getContext("2d"), W = cv.width, H = cv.height, L = T.LEVELS[s.lv];
  const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, "#FFF4D6"); grad.addColorStop(1, "#FFE0B8");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.fillStyle = "#FFFFFF"; g.globalAlpha = .6; g.beginPath(); g.arc(W / 2, 470, 330, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  const pot = await loadImg(L.img); if (pot) g.drawImage(pot, W / 2 - 300, 170, 600, 600);
  g.textAlign = "center"; g.fillStyle = "#3E2F27";
  g.font = "64px Jua"; g.fillText("감자도감", W / 2, 110);
  g.font = "84px Jua"; g.fillStyle = "#C98A00"; g.fillText(L.name, W / 2, 860);
  // 큰 타수 + 작은 '타'를 한 덩어리로 가운데
  g.fillStyle = "#3E2F27"; g.textAlign = "left";
  g.font = "210px Jua"; const w1 = g.measureText(String(s.cpm)).width;
  g.font = "80px Jua"; const w2 = g.measureText("타").width;
  const x0 = W / 2 - (w1 + 12 + w2) / 2;
  g.font = "210px Jua"; g.fillText(String(s.cpm), x0, 1080);
  g.font = "80px Jua"; g.fillText("타", x0 + w1 + 12, 1080);
  g.textAlign = "center"; g.font = "46px Jua"; g.fillStyle = "#6B5A4E"; g.fillText(`${s.job} · ${s.result}`, W / 2, 1170, W - 120);
  g.font = "50px Jua"; g.fillStyle = "#3E2F27"; g.fillText(`"${s.lesson}"`, W / 2, 1250, W - 120);
  g.font = "34px Jua"; g.fillStyle = "#A08C7C"; g.fillText("감자 취업시켜줘!! · eunsucho.github.io/gamja-game", W / 2, 1320);
}
async function shareCard() {
  const cv = $("shareCanvas"); if (!cv) return;
  const blob = await new Promise(r => cv.toBlob(r, "image/png"));
  const file = new File([blob], "gamja.png", { type: "image/png" });
  const text = `${T.LEVELS[lastShare.lv].name} · ${lastShare.cpm}타 · ${lastShare.job}`;
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
  } catch { return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "gamja.png"; a.click();
}

let memoPages = [], memoI = 0, memoGate = 0, memoSeen = 0, quizDone = true;

// 첫 장 퀴즈: 이 공고에서 AI가 가장 많이 하는 일은? (보기 3개: 가장 높은 O 하나 + 사람 몫 둘)
function quizPage() {
  const ws = current.words.filter(w => w.pct != null);
  const ai = ws.slice().sort((a, b) => b.pct - a.pct)[0];
  const human = current.words.filter(w => w !== ai && (MINE.has(w.judge) || (w.pct ?? 0) < 50)).sort(() => Math.random() - .5).slice(0, 2);
  if (!ai || human.length < 2) return null;
  quizAnswer = ai;
  const opts = [ai, ...human].sort(() => Math.random() - .5);
  return `<div class="pg-q">${item("quiz", "big")}<p class="pg-h">AI가 제일 잘한 일은?</p></div>
    <div class="quiz">${opts.map(w => `<button type="button" class="quiz-opt" data-q="${esc(w.text)}">${esc(w.text)}</button>`).join("")}</div>
    <p class="task-why" id="quizWhy" hidden></p>`;
}
let quizAnswer = null;
function renderResult(r) {
  const reason = r.passed ? "pass" : (r.reason || "letters");
  $("resultBg").style.backgroundImage = `url(assets/bg/${r.passed ? "roof" : "exit"}.jpg)`;
  $("notice").innerHTML = smsHTML(r.passed ? T.SMS.pass() : T.SMS[reason](r.failedStage));
  $("hiredTag").hidden = !r.passed;
  $("resultHero").className = `who me big mood-${r.passed ? "hired" : "teary"}`;
  $("resultSay").textContent = r.passed ? T.RESULT.sayPass : T.RESULT.sayFail;

  const result = r.passed ? T.RESULT.pass : T.RESULT[reason](r.failedStage);
  const title = `${current.company} ${current.position}`;
  const line = `${title} · ${result} · ${r.cpm}타${r.guard == null ? "" : ` · 사람 몫 사수율 ${r.guard}%`}`;
  const lv = T.levelOf(r, current.stages), L = T.LEVELS[lv];
  saveRecord(current.id, { passed: r.passed, failedStage: r.failedStage, reached: r.reached, score: r.score, cpm: r.cpm, guard: r.guard, level: lv });
  $("resultHero").querySelector("img").src = L.img;
  $("resultSay").textContent = L.say;
  lastShare = { lv, cpm: r.cpm, job: `${current.company} ${current.position}`, result, lesson: "", guard: r.guard };

  // 오늘 배운 것 3가지
  const missedMine = current.words.filter(w => w.judge !== "O" && r.missed[w.text]).sort((a, b) => r.missed[b.text] - r.missed[a.text]);
  const x = { missedMine: missedMine.map(w => w.text) };
  const lessons = T.LESSONS.filter(l => l.when(r, x)).map(l => ({ ...l.say(r, x), short: l.short }));
  for (const d of T.LESSON_DEFAULTS) { if (lessons.length >= 3) break; lessons.push(d); }

  // 회고록: 한 장에 한 가지만. 성찰(퀴즈 → 배운 것)이 맨 앞, 기록·통계는 뒤.
  const stat = (icon, text) => `<span><i class="ti ti-${icon}" aria-hidden="true"></i>${esc(text)}</span>`;
  const quiz = quizPage();
  lastShare.lesson = lessons[0].short || lessons[0].head;
  const avg = TOUCH.matches ? T.AVG_CPM.phone : T.AVG_CPM.pc;
  memoPages = [
    `<div class="pg-level"><img src="${L.img}" alt=""><p class="lv-name">${esc(L.name)}</p>
      <p class="cpm"><b>${r.cpm}</b>타</p><p class="cpm-avg">${TOUCH.matches ? "폰" : "PC"} 평균 ${avg}타 ${r.cpm >= avg ? "보다 빨라요!" : ""}</p>
      <div class="lv-bar">${T.LEVELS.map((x, i) => `<img src="${x.img}" class="${i <= lv ? "on" : ""}" alt="${esc(x.name)}">`).join("")}</div></div>`,
    ...(quiz ? [quiz] : []),
    ...lessons.slice(0, 3).map(l => `<div class="pg-lesson">${item("idea", "big")}<b>${esc(l.short || l.head)}</b></div>`),
    tasksPage(r),
    ...(missedMine.length ? [`<p class="pg-h">놓친 일</p><p class="pg-sub">이게 이 자리의 핵심이었어요</p><ul class="plain">${missedMine.slice(0, 3).map(w => `<li><i class="ti ti-alert-circle"></i>${esc(w.text)}</li>`).join("")}</ul>`] : []),
    `<p class="pg-sub">이번 공채 결과</p><p class="pg-record">${esc(title)}<br>${esc(result)}</p>
     <div class="pg-stats">${stat("keyboard", `${r.cpm}타`)}${r.guard == null ? "" : stat("shield-check", `사람 몫 ${r.guard}% 지킴`)}${stat("robot", `AI 동기가 가져간 일 ${grabbed}개`)}${stat("flame", `최고 콤보 ${r.maxCombo}`)}${r.passed ? stat("coin", `초봉 ${r.salary.toLocaleString()}만`) : ""}</div>`,
    ...(current.terms?.length ? [termsPage()] : []),
    `<p class="pg-h">다음 지원 전에</p><ul class="plain">${T.TODO_DEFAULT.concat((current.skills || []).slice(0, 2).map(s => `역량 점검: ${s}`)).map(t => `<li><i class="ti ti-square-check"></i>${esc(t)}</li>`).join("")}</ul>
     <a class="btn-sm glass ws-link" href="worksheet/" target="_blank" rel="noopener"><i class="ti ti-file-text" aria-hidden="true"></i>수업 학습지로 더 해 보기</a>`,
    `<div class="share-wrap"><canvas id="shareCanvas" width="1080" height="1350"></canvas></div>
     <div class="row"><button class="btn grow" id="shareBtn" type="button">공유하기</button><button class="btn sub fit" id="dogamBtn" type="button"><img src="assets/potato/lv4_gold.png" alt="">도감</button></div>`
  ];
  // 성찰 장(퀴즈 + 배운 것 3장 + 진짜 할 일)을 다 넘겨야 다시 하기·로비 버튼이 열린다
  memoGate = 1 + (quiz ? 1 : 0) + 3 + 1;
  memoSeen = 0;
  quizDone = !quiz;
  memoI = 0;
  renderMemo();
  show("v-result");

  // 공유 문구
  window.__shareText = `${line}\n오늘 배운 것: ${lessons[0].head}`;
}

function tasksPage(r) {
  const groups = [
    { cls: "mine", title: "내 몫이었던 일", judges: ["X", "□"] },
    { cls: "both", title: "AI랑 같이 하는 일", judges: ["△"] },
    { cls: "ai", title: "AI 동기가 많이 가져간 일", judges: ["O"] }
  ];
  return `<p class="pg-h">이 자리의 진짜 할 일</p><div class="tasks">` + groups.map(g => {
    const ws = current.words.filter(w => g.judges.includes(w.judge));
    return ws.length ? `<div class="${g.cls}"><p>${g.title}</p><div class="task-chips">${ws.map(w => `<button type="button" data-word="${esc(w.text)}" aria-expanded="false">${esc(w.text)}</button>`).join("")}</div></div>` : "";
  }).join("") + `</div><p class="task-why" id="taskWhy" hidden></p>`;
}

// 낯선 단어 풀이: 단어를 누르면 뜻이 보인다
function termsPage() {
  return `<p class="pg-h">이 단어 뭐지?</p><p class="pg-sub">공고와 게임에 나온 낯선 단어예요</p>
    <div class="task-chips">${current.terms.map(t => `<button type="button" data-term="${esc(t.term)}" aria-expanded="false">${esc(t.term)}</button>`).join("")}</div>
    <p class="task-why" id="termWhy" hidden></p>`;
}

function renderMemo() {
  const page = $("memoPage");
  page.innerHTML = memoPages[memoI];
  retrigger(page, "memo-page");
  $("memoCount").textContent = `${memoI + 1} / ${memoPages.length}`;
  $("memoDots").innerHTML = memoPages.map((_, i) => `<i class="${i === memoI ? "on" : ""}"></i>`).join("");
  $("memoPrev").style.visibility = memoI === 0 ? "hidden" : "";
  $("memoNext").style.visibility = memoI === memoPages.length - 1 ? "hidden" : "";
  memoSeen = Math.max(memoSeen, memoI + 1);
  const locked = memoSeen < memoGate || !quizDone;
  $("memoNext").disabled = !quizDone && memoI === 1;
  $("memoNext").classList.toggle("nudge", (quizDone || memoI !== 1) && memoI < memoPages.length - 1);
  ["retry", "toSelect2"].forEach(id => { $(id).disabled = locked; $(id).classList.toggle("locked", locked); });
  $("memoGateNote").hidden = true;
  page.querySelectorAll("[data-q]").forEach(b => b.onclick = () => {
    if (quizDone && page.querySelector(".quiz-opt.right")) return;
    const ok = b.dataset.q === quizAnswer.text;
    page.querySelectorAll("[data-q]").forEach(o => { if (o.dataset.q === quizAnswer.text) o.classList.add("right"); });
    if (!ok) b.classList.add("wrong");
    $("quizWhy").hidden = false;
    $("quizWhy").textContent = `${ok ? "정답!" : "땡!"} AI가 ${quizAnswer.pct}% 끝까지 해냈어요`;
    quizDone = true;
    renderMemoChrome();
  });
  page.scrollTop = 0;
  page.querySelectorAll("[data-word]").forEach(b => b.onclick = () => {
    const w = current.words.find(x => x.text === b.dataset.word);
    const open = b.getAttribute("aria-expanded") !== "true";
    page.querySelectorAll("[data-word]").forEach(o => o.setAttribute("aria-expanded", "false"));
    b.setAttribute("aria-expanded", String(open));
    const why = $("taskWhy");
    why.hidden = !open;
    if (open) why.textContent = `${w.from ? `공고: '${w.from}' · ` : ""}${T.JUDGE_LABEL[w.judge]} · ${T.pctPhrase(w)}`;
  });
  page.querySelectorAll("[data-term]").forEach(b => b.onclick = () => {
    const t = current.terms.find(x => x.term === b.dataset.term);
    const open = b.getAttribute("aria-expanded") !== "true";
    page.querySelectorAll("[data-term]").forEach(o => o.setAttribute("aria-expanded", "false"));
    b.setAttribute("aria-expanded", String(open));
    $("termWhy").hidden = !open;
    if (open) $("termWhy").textContent = `${t.term} · ${t.desc}`;
  });
  if ($("shareCanvas")) drawShare($("shareCanvas"));
  if ($("shareBtn")) $("shareBtn").onclick = shareCard;
  if ($("dogamBtn")) $("dogamBtn").onclick = openDogam;
  const copy = $("copyRecord");
  if (copy) copy.onclick = async () => {
    try { await navigator.clipboard.writeText(window.__shareText || ""); copy.lastChild.textContent = "복사했어요"; }
    catch { copy.lastChild.textContent = "복사가 막혀 있어요"; }
  };
}
// 퀴즈를 푼 뒤 버튼 상태만 다시 그린다 (장 내용은 그대로)
function renderMemoChrome() {
  const locked = memoSeen < memoGate || !quizDone;
  $("memoNext").disabled = !quizDone && memoI === 1;
  $("memoNext").classList.toggle("nudge", (quizDone || memoI !== 1) && memoI < memoPages.length - 1);
  ["retry", "toSelect2"].forEach(id => { $(id).disabled = locked; $(id).classList.toggle("locked", locked); });
  $("memoGateNote").hidden = true;
}
$("memoPrev").onclick = () => { if (memoI > 0) { memoI--; renderMemo(); } };
$("memoNext").onclick = () => { if ((quizDone || memoI !== 1) && memoI < memoPages.length - 1) { memoI++; renderMemo(); } };
// 회고록 넘기기: 좌우로 밀기
let swipeX = null;
$("memo").addEventListener("pointerdown", e => { swipeX = e.clientX; });
$("memo").addEventListener("pointerup", e => {
  if (swipeX == null) return;
  const dx = e.clientX - swipeX; swipeX = null;
  if (Math.abs(dx) > 50) (dx < 0 ? $("memoNext") : $("memoPrev")).click();
});

// ---------- 버튼 ----------
$("toStart").onclick = () => { goFull(); if (getFlag("intro")) openLobby(); else openIntro(); };

// ---------- 꽉 찬 화면: 안드로이드는 전체화면, 홈 화면에 추가하면 아이폰도 주소창 없이 ----------
const STANDALONE = matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches || navigator.standalone;
function goFull() {
  if (STANDALONE || !TOUCH.matches || document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
}
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; $("toInstall").hidden = false; });
$("toInstall").onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $("toInstall").hidden = true; };
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
if (IOS && !STANDALONE && !getFlag("iosTip")) $("iosTip").hidden = false;
$("iosTipX").onclick = () => { $("iosTip").hidden = true; setFlag("iosTip"); };

// ---------- 감자도감: 공고마다 받은 최고 감자 ----------
function openDogam() {
  const rec = loadRecords();
  const ps = (INDEX?.fields || []).flatMap(f => f.jobs.flatMap(j => j.postings.map(p => ({ ...p, job: j.name }))));
  const got = ps.filter(p => rec[p.id]?.level >= 0).length;
  $("dogamCount").textContent = `${got} / ${ps.length}`;
  $("dogamGrid").innerHTML = ps.map(p => {
    const lv = rec[p.id]?.level ?? -1, L = T.LEVELS[lv];
    return `<button type="button" class="dg ${lv < 0 ? "empty" : ""}" data-id="${esc(p.id)}">
      <img src="${L ? L.img : "assets/potato/lv4_gold_sil.png"}" alt="">
      <b>${esc(p.job)}</b>${L ? `<span>${esc(L.name)}${rec[p.id].bestCpm ? ` · ${rec[p.id].bestCpm}타` : ""}</span>` : "<span>?</span>"}</button>`;
  }).join("");
  $("dogamGrid").querySelectorAll("[data-id]").forEach(b => b.onclick = () => { $("dogam").close(); openBrief(b.dataset.id); });
  $("dogam").showModal();
}
$("toDogam").onclick = openDogam;
$("toIntro").onclick = openIntro;
$("toWorksheet").onclick = () => window.open("worksheet/", "_blank", "noopener");
$("toCredits").onclick = () => $("credits").showModal();
$("introNext").onclick = introNext;
$("docuTap").onclick = introNext;
$("introSkip").onclick = introDone;
$("backTitle").onclick = () => show("v-title");
$("backSelect").onclick = openLobby;
$("startGame").onclick = callElevator;
$("retry").onclick = () => { game?.stop(); grabbed = 0; startGame(); };
$("toSelect2").onclick = openLobby;

show("v-title");
init().catch(e => {
  $("problems").hidden = false;
  $("problems").textContent = `공고를 불러오지 못했어요 (${e.message}). 로컬에서는 파일을 직접 열지 말고 간단한 서버로 열어 주세요.`;
});
