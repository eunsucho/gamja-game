// 개인 최고 기록. 각자 브라우저(localStorage)에만 저장한다. 저장이 막혀 있어도 게임은 돌아간다.
const KEY = "gamja-game:records:v1";

export function loadRecords() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

// 더 높은 전형까지 갔거나, 같은 전형에서 점수가 높으면 갱신한다.
export function saveRecord(postingId, rec) {
  const all = loadRecords();
  const prev = all[postingId];
  const better = !prev || rec.reached > prev.reached || (rec.reached === prev.reached && rec.score > prev.score);
  if (better) {
    all[postingId] = rec;
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* 저장 불가 환경 */ }
  }
  return better;
}

// 한 번 본 것(세계관 인트로, 연습 라운드)을 기억한다.
const FLAG = "gamja-game:flags:v1";
export function getFlag(name) {
  try { return !!(JSON.parse(localStorage.getItem(FLAG)) || {})[name]; } catch { return false; }
}
export function setFlag(name) {
  try { const f = JSON.parse(localStorage.getItem(FLAG)) || {}; f[name] = true; localStorage.setItem(FLAG, JSON.stringify(f)); } catch { /* 저장 불가 환경 */ }
}
