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
  return `<div class="how">` + T.RULES.map(r => `<div class="how-row ${r.who}">
    <span class="how-face">${WHO_IMG[r.who] ? `<img src="${WHO_IMG[r.who]}" alt="">` : `<i class="ti ti-ban" aria-hidden="true"></i>`}</span>
    <span class="how-txt"><span class="drop how-ex">${esc(r.pill)}</span><b>${esc(r.title)}</b><small>${esc(r.desc)}</small></span></div>`).join("") + `</div>`;
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
function doorShow({ floor, msg, tip, terms = [], html = "" }, { button = null, auto = 0 } = {}) {
  $("dHow").hidden = !html;
  $("dHow").innerHTML = html;
  $("dTerms").hidden = !terms.length;
  $("dTerms").innerHTML = terms.length ? `<span>${esc(T.DOOR.termsLabel)}</span>` + terms.map(t => `<p><b>${esc(t.term)}</b> · ${esc(t.desc)}</p>`).join("") : "";
  $("dFloor").textContent = floor || "";
  $("dMsg").textContent = msg || "";
  $("dTip").textContent = tip || "";
  $("dDing").hidden = !floor;
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
  $("lobbyEyebrow").textContent = T.LOBBY.eyebrow;
  $("lobbyTitle").textContent = T.LOBBY.title;
  $("lobbySay").textContent = T.LOBBY.say;
  $("tutLabel").textContent = T.BRIEF.tutorial;
  $("goLabel").textContent = T.BRIEF.go;
  $("docuTag").textContent = T.DOCU_TITLE;
  INDEX = await loadIndex();
  if (INDEX.season) { $("season").textContent = INDEX.season; $("season2").textContent = INDEX.season; }
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
  if (c.rules) $("rulesCard").innerHTML = `<p class="pop-title">${esc(T.HOW.title)}</p>` + rulesHTML() + `<p class="how-goal">${esc(T.HOW.goal)}</p>`;
  $("introDots").innerHTML = T.INTRO.map((_, i) => `<i class="${i === introI ? "on" : ""}"></i>`).join("");
  $("introNext").textContent = introI === T.INTRO.length - 1 ? "로비로" : "다음";
}
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
  $("postingList").innerHTML = ps.length ? ps.map(p => {
    const r = rec[p.id];
    const mark = r ? `<i class="ti ti-${r.passed ? "trophy" : "rotate"}" aria-label="${r.passed ? "합격 기록 있음" : "지원한 적 있음"}"></i>` : "";
    return `<button class="card" data-id="${esc(p.id)}"><span><p class="co">${esc(p.company)}${mark}</p><p class="pos">${esc(p.position)}</p></span><span class="go"><i class="ti ti-chevron-right"></i></span></button>`;
  }).join("") : `<div class="card soon"><p class="pos">${esc(T.LOBBY.empty)}</p></div>`;
  $("postingList").querySelectorAll("[data-id]").forEach(b => b.onclick = () => openBrief(b.dataset.id));
  $("postingList").scrollTop = 0;
}

// ---------- 엘리베이터 홀: 공고 ----------
async function openBrief(id) {
  try { current = await loadPosting(id); }
  catch (e) { $("problems").hidden = false; $("problems").textContent = `이 공고를 읽지 못했어요 (${e.message})`; return; }
  $("problems").hidden = true;
  const fl = floors(current.stages);
  const rows = fl.map(f => `<li class="${f.bonus ? "bonus" : ""}"><b>${f.step}</b><span>${esc(f.name)}</span></li>`)
    .concat(`<li class="roof"><b><i class="ti ti-trophy" aria-hidden="true"></i></b><span>최종합격</span></li>`);
  $("brief").innerHTML = `<span class="eyebrow"><i class="ti ti-building-skyscraper" aria-hidden="true"></i>${esc(current.company)}</span>
    <h2>${esc(current.position)}</h2>
    ${current.intro ? `<p class="intro">${esc(current.intro)}</p>` : ""}
    <p class="label"><i class="ti ti-list-numbers" aria-hidden="true"></i>${esc(T.BRIEF.label)}</p>
    <ol class="floors">${rows.join("")}</ol>`;
  $("tutCheck").checked = !getFlag("tutorial");
  show("v-brief");
}

let calling = false;
function callElevator() {
  if (calling) return;
  calling = true;
  grabbed = 0;
  setTimeout(() => { calling = false; ($("tutCheck").checked ? startTutorial() : startGame()); }, 350);
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
  doorShow({ floor: "연습 라운드", msg: T.HOW.title, html: rulesHTML(), tip: T.HOW.lose }, { button: "알겠어요! 연습 시작" }).then(() => { doorOpen(); game.startStage(0); });
}

// 이번 층에 내려온 단어 속 낯선 용어 (한 번 보여 준 건 다시 안 보여 줌, 최대 2개)
function termsSeen() {
  const texts = [...seen];
  const out = (current.terms || []).filter(t => !shownTerms.has(t.term) && texts.some(x => x.includes(t.term))).slice(0, 2);
  out.forEach(t => shownTerms.add(t.term));
  return out;
}

function tip(text) {
  const t = $("tutTip");
  t.hidden = !text;
  t.textContent = text || "";
  if (text) retrigger(t, "pop-in");
}

function tutorialDone() {
  setFlag("tutorial");
  tip("");
  delete $("v-play").dataset.tut;
  doorShow(T.TUT.done, { button: "진짜 공채 시작!" }).then(startGame);
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
  doorShow(T.DOOR.start(FLOORS[0]), { auto: 1500 }).then(() => { doorOpen(); game.startStage(0); });
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
  $("hFails").innerHTML = Array.from({ length: h.failLimit }, (_, i) => `<i class="ti ti-mail${i < h.fails ? " on" : ""}"></i>`).join("");
  $("hSteps").hidden = h.bonus || h.tutorial;
  $("hStepLabel").hidden = h.bonus || h.tutorial;
  $("hStepLabel").textContent = `합격 게이지 ${Math.floor(h.steps)}/${h.stepGoal}`;
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
    tip(T.TUT.spawn[p.i]);
    $("buddy").classList.toggle("spot", p.i === 0);
    $("v-play").dataset.tut = p.i;
    $("typeForm").classList.toggle("glow", p.i === 1);
    if (p.i === 1) $("typeInput").focus();
    return;
  }
  $("typeForm").classList.remove("glow");
  $("buddy").classList.remove("spot");
  if (p.phase === "ok") {
    tip(p.outcome === "typed" && p.item.w?.judge === "O" ? T.TUT.okTypedAi : T.TUT.ok[p.i]);
    if (p.outcome === "typed") buddy(p.i === 1 ? "nod" : "shrug", p.i === 1 ? T.BUDDY.nod : T.BUDDY.shrug);
  } else {
    tip(T.TUT.retry[p.i]);
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
  doorShow(card, { button: "문 열기" }).then(() => { doorOpen(); game.startStage(nextIdx); });
}

$("typeForm").addEventListener("submit", e => {
  e.preventDefault();
  const input = $("typeInput");
  game?.submit(input.value);
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
    doorShow(T.DOOR.roof, { auto: 1600 }).then(() => renderResult(r));
  } else {
    setMood("teary");
    setTimeout(() => renderResult(r), 500);
  }
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
  return `<p class="pg-h">퀴즈! 한 문제만</p><p class="pg-sub">이 중 사람들이 AI에게 맡겨서 AI가 가장 많이 끝까지 해낸 일은?</p>
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
  saveRecord(current.id, { passed: r.passed, failedStage: r.failedStage, reached: r.reached, score: r.score, cpm: r.cpm, guard: r.guard });

  // 오늘 배운 것 3가지
  const missedMine = current.words.filter(w => w.judge !== "O" && r.missed[w.text]).sort((a, b) => r.missed[b.text] - r.missed[a.text]);
  const x = { missedMine: missedMine.map(w => w.text) };
  const lessons = T.LESSONS.filter(l => l.when(r, x)).map(l => l.say(r, x));
  for (const d of T.LESSON_DEFAULTS) { if (lessons.length >= 3) break; lessons.push(d); }

  // 회고록: 한 장에 한 가지만. 성찰(퀴즈 → 배운 것)이 맨 앞, 기록·통계는 뒤.
  const stat = (icon, text) => `<span><i class="ti ti-${icon}" aria-hidden="true"></i>${esc(text)}</span>`;
  const quiz = quizPage();
  memoPages = [
    ...(quiz ? [quiz] : []),
    ...lessons.slice(0, 3).map((l, i) => `<p class="pg-sub">오늘 배운 것 ${i + 1}</p><div class="pg-lesson"><b>${esc(l.head)}</b><p>${esc(l.body)}</p></div>`),
    tasksPage(r),
    ...(missedMine.length ? [`<p class="pg-h">놓친 일</p><p class="pg-sub">이게 이 자리의 핵심이었어요</p><ul class="plain">${missedMine.slice(0, 3).map(w => `<li><i class="ti ti-alert-circle"></i>${esc(w.text)}</li>`).join("")}</ul>`] : []),
    `<p class="pg-sub">이번 공채 결과</p><p class="pg-record">${esc(title)}<br>${esc(result)}</p>
     <div class="pg-stats">${stat("keyboard", `${r.cpm}타`)}${r.guard == null ? "" : stat("shield-check", `사람 몫 ${r.guard}% 지킴`)}${stat("robot", `AI 동기가 가져간 일 ${grabbed}개`)}${stat("flame", `최고 콤보 ${r.maxCombo}`)}${r.passed ? stat("coin", `초봉 ${r.salary.toLocaleString()}만`) : ""}</div>`,
    ...(current.terms?.length ? [termsPage()] : []),
    `<p class="pg-h">다음 지원 전에</p><ul class="plain">${T.TODO_DEFAULT.concat((current.skills || []).slice(0, 2).map(s => `역량 점검: ${s}`)).map(t => `<li><i class="ti ti-square-check"></i>${esc(t)}</li>`).join("")}</ul>
     <a class="btn-sm glass ws-link" href="worksheet/" target="_blank" rel="noopener"><i class="ti ti-file-text" aria-hidden="true"></i>수업 학습지로 더 해 보기</a>`,
    `<div class="share"><img src="assets/potato_cut.png" alt=""><div><b>감자 취업시켜줘!! ㅜㅜ</b><span>${esc(line)}</span><span class="hand">"${esc(lessons[0].head)}"</span></div></div>
     <button class="btn sub" id="copyRecord" type="button"><i class="ti ti-copy" aria-hidden="true"></i>기록 복사</button>`
  ];
  // 성찰 장(퀴즈 + 배운 것 3장 + 진짜 할 일)을 다 넘겨야 다시 하기·로비 버튼이 열린다
  memoGate = (quiz ? 1 : 0) + 3 + 1;
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
  $("memoNext").disabled = !quizDone;
  $("memoNext").classList.toggle("nudge", quizDone && memoI < memoPages.length - 1);
  ["retry", "toSelect2"].forEach(id => { $(id).disabled = locked; });
  $("memoGateNote").hidden = !locked;
  $("memoGateNote").textContent = !quizDone ? "퀴즈를 풀면 다음 장이 열려요" : `회고록 ${Math.max(0, memoGate - memoSeen)}장 더 넘기면 버튼이 열려요`;
  page.querySelectorAll("[data-q]").forEach(b => b.onclick = () => {
    if (quizDone && page.querySelector(".quiz-opt.right")) return;
    const ok = b.dataset.q === quizAnswer.text;
    page.querySelectorAll("[data-q]").forEach(o => { if (o.dataset.q === quizAnswer.text) o.classList.add("right"); });
    if (!ok) b.classList.add("wrong");
    $("quizWhy").hidden = false;
    $("quizWhy").textContent = `${ok ? "정답!" : "아쉬워요!"} '${quizAnswer.text}' · ${T.pctPhrase(quizAnswer)} 나머지는 사람이 판단하고 설명하는 몫이 큰 일이에요.`;
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
  const copy = $("copyRecord");
  if (copy) copy.onclick = async () => {
    try { await navigator.clipboard.writeText(window.__shareText || ""); copy.lastChild.textContent = "복사했어요"; }
    catch { copy.lastChild.textContent = "복사가 막혀 있어요"; }
  };
}
// 퀴즈를 푼 뒤 버튼 상태만 다시 그린다 (장 내용은 그대로)
function renderMemoChrome() {
  const locked = memoSeen < memoGate || !quizDone;
  $("memoNext").disabled = !quizDone;
  $("memoNext").classList.toggle("nudge", quizDone && memoI < memoPages.length - 1);
  ["retry", "toSelect2"].forEach(id => { $(id).disabled = locked; });
  $("memoGateNote").hidden = !locked;
  $("memoGateNote").textContent = `회고록 ${Math.max(0, memoGate - memoSeen)}장 더 넘기면 버튼이 열려요`;
}
$("memoPrev").onclick = () => { if (memoI > 0) { memoI--; renderMemo(); } };
$("memoNext").onclick = () => { if (quizDone && memoI < memoPages.length - 1) { memoI++; renderMemo(); } };
// 회고록 넘기기: 좌우로 밀기
let swipeX = null;
$("memo").addEventListener("pointerdown", e => { swipeX = e.clientX; });
$("memo").addEventListener("pointerup", e => {
  if (swipeX == null) return;
  const dx = e.clientX - swipeX; swipeX = null;
  if (Math.abs(dx) > 50) (dx < 0 ? $("memoNext") : $("memoPrev")).click();
});

// ---------- 버튼 ----------
$("toStart").onclick = () => { if (getFlag("intro")) openLobby(); else openIntro(); };
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
