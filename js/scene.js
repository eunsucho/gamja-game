// 전형 단계 이름. 전형 하나 = 한 단계. 'n층' 대신 '1단계 · 서류'처럼 몇 번째 전형인지 바로 보이게 한다.
// (창밖 풍경은 진행도에 따라 assets/bg 그림을 겹쳐 바꾼다: main.js setAltitude)
export function floors(stages) {
  const n = stages.length;
  return stages.map((s, i) => ({ label: `${i + 1}/${n}`, step: i + 1, total: n, room: s.name, name: s.name, bonus: s.type === "bonus" }));
}
