// 층 이름. 전형 하나 = 본사 한 층. (창밖 풍경은 assets/bg 그림을 높이에 따라 겹쳐서 바꾼다: main.js setAltitude)
// 층 이름. 공고 stages[i].room 이 있으면 그걸 쓰고, 없으면 기본 방 이름
const ROOMS = ["로비", "시험장", "면접실", "임원실", "회의실", "인사팀"];
export function floors(stages) {
  let normal = 0;
  return stages.map((s, i) => {
    const room = s.room || (s.type === "bonus" ? "인사팀" : ROOMS[Math.min(normal, ROOMS.length - 2)]);
    if (s.type !== "bonus") normal++;
    return { label: `${1 + i * 7}F`, room, name: s.name };
  });
}
