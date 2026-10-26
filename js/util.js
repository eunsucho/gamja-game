// 입력 비교와 타수 계산.

// 띄어쓰기·대소문자 차이는 무시하고 비교한다.
export const norm = s => String(s).replace(/\s+/g, "").toLowerCase();

// 한글 두벌식 기준 대략적인 타수. 쌍자음·겹모음·겹받침은 2타로 센다.
const DOUBLE_CHO = new Set([1, 4, 8, 10, 13]);            // ㄲ ㄸ ㅃ ㅆ ㅉ
const DOUBLE_JUNG = new Set([9, 10, 11, 14, 15, 16, 19]); // ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ
const DOUBLE_JONG = new Set([2, 3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18, 20]);

export function keystrokes(text) {
  let n = 0;
  for (const ch of String(text)) {
    const c = ch.charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) {
      const code = c - 0xac00, cho = Math.floor(code / 588), jung = Math.floor((code % 588) / 28), jong = code % 28;
      n += DOUBLE_CHO.has(cho) ? 2 : 1;
      n += DOUBLE_JUNG.has(jung) ? 2 : 1;
      if (jong) n += DOUBLE_JONG.has(jong) ? 2 : 1;
    } else if (ch.trim()) n += 1;
  }
  return n;
}

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
