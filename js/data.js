// 공고 데이터 읽기.
// data/index.json (분야 → 직무 → 공고 요약)만 먼저 읽어 로비 안내판을 그리고,
// 공고 본문(data/postings/<id>.json)은 그 공고를 고를 때 받는다. 공고가 수백 개여도 첫 화면이 가볍다.
// data/ 는 pipeline/build.py 가 만든다. 형식 검사는 build.py 가 먼저 하고, 여기서는 예비로 한 번 더 한다.
const JUDGES = ["O", "△", "X", "□"];
const cache = new Map();

export async function loadIndex() {
  const idx = await getJSON("data/index.json");
  if (idx.version >= 2) return idx;
  // 예전 형식 { postings: [id, ...] } 도 읽는다: 공고를 전부 받아 '전체' 동 하나에 넣는다
  const postings = [];
  for (const id of idx.postings || []) {
    try { const p = await loadPosting(id); postings.push(summary(p)); } catch { /* 아래 problems에서 보임 */ }
  }
  return { version: 2, season: idx.season, fields: [{ id: "all", name: "전체", wing: "본관", jobs: [{ id: "all", name: "전체", postings }] }] };
}

export async function loadPosting(id) {
  if (cache.has(id)) return cache.get(id);
  const p = await getJSON(`data/postings/${encodeURIComponent(id)}.json`);
  const errs = validate(p);
  if (errs.length) throw new Error(errs.join(", "));
  cache.set(id, p);
  return p;
}

const summary = p => ({ id: p.id, company: p.company, position: p.position, stages: p.stages.length, sample: !!p.sample });

async function getJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

export function validate(p) {
  const e = [];
  for (const k of ["id", "company", "position", "stages", "words"]) if (!(k in p)) e.push(`${k} 없음`);
  if (Array.isArray(p.stages)) {
    if (!p.stages.some(s => s.type !== "bonus")) e.push("일반 전형이 하나도 없음");
    p.stages.forEach((s, i) => { if (!s.name) e.push(`stages[${i}].name 없음`); });
  }
  if (Array.isArray(p.words)) {
    if (p.words.length < 4) e.push("words가 4개 미만");
    p.words.forEach((w, i) => {
      if (!w.text) e.push(`words[${i}].text 없음`);
      if (!JUDGES.includes(w.judge)) e.push(`words[${i}].judge는 O·△·X·□ 중 하나`);
      if (w.judge !== "□" && typeof w.pct !== "number") e.push(`words[${i}].pct 숫자 필요`);
    });
  }
  if ("skills" in p && !(Array.isArray(p.skills) && p.skills.every(x => typeof x === "string"))) e.push("skills는 문자열 배열");
  return e;
}
